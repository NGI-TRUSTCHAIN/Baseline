import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import * as path from 'path';
import { createHash } from 'crypto';
import { ed25519 } from '@noble/curves/ed25519';
import * as circomlib from 'circomlibjs';
import { MerkleTree } from 'fixed-merkle-tree';
import e from 'express';

// This is the prime field used in the circuit
// The prime field is defined by the following equation:
// p = 2^255 - 19
// The prime field is used to define the elliptic curve used in the circuit
const p = Scalar.fromString(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);
const Fr = new F1Field(p);

const WITNESS_IS_OUTPUT_INDEX = 1;

const loadBusinessLogicCircuit = async () => {
  const fullPath = path.join(__dirname, '../workstepCircuits/workstep.circom');
  console.log(`Loading circuit from: ${fullPath}`);
  try {
    const circuit = await wasm_tester(fullPath);
    console.log('Circuit loaded successfully.');
    return circuit;
  } catch (error) {
    console.error(`Error loading circuit from ${fullPath}:`, error);
    throw error;
  }
};

//This gives most-significant-bit (MSB) first order.
function buffer2bitsMSB(b: Buffer) {
  const res: number[] = [];
  for (let i = 0; i < b.length; i++) {
    for (let j = 0; j < 8; j++) {
      res.push((b[i] >> (7 - j)) & 1);
    }
  }
  return res;
}

//This gives least-significant-bit (LSB) first order.
const buffer2bitsLSB = (buffer: Buffer) => {
  const res: bigint[] = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < 8; j++) {
      if ((buffer[i] >> j) & 1) {
        res.push(BigInt(1));
      } else {
        res.push(BigInt(0));
      }
    }
  }
  return res;
};

function is256BitBinaryString(str: string): boolean {
  return str.length === 256 && /^[01]+$/.test(str);
}
function LeafToBits(leaf: string, bitPadding: number): number[] {
  let leafStrBuffer = Buffer.from(leaf, 'utf8');
  const paddedLength = bitPadding / 8;
  if (leafStrBuffer.length < paddedLength) {
    const padding = Buffer.alloc(paddedLength - leafStrBuffer.length, 0); // zero padding
    leafStrBuffer = Buffer.concat([leafStrBuffer, padding]);
  }

  const leafBits = buffer2bitsMSB(leafStrBuffer);
  return leafBits;
}
function bitsToBuffer(bits: number[]): Buffer {
  const byteArray: number[] = []; // 👈 Fix here
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i + j] || 0); // MSB first
    }
    byteArray.push(byte);
  }
  return Buffer.from(byteArray);
}

const generateMerkleHash = (left: string, right: string) => {
  //CONVERTING LEAF TO BIT
  let leftBits;
  let rightBits;

  if (!is256BitBinaryString(left)) {
    leftBits = LeafToBits(left, 256);
  } else {
    leftBits = left.split('').map(Number);
  }
  if (!is256BitBinaryString(right)) {
    rightBits = LeafToBits(right, 256);
  } else {
    rightBits = right.split('').map(Number);
  }

  //Concatenate the two bit arrays
  const totalBits = leftBits.concat(rightBits);

  //Convert totalBits to Buffer
  const totalBitsBuffer = bitsToBuffer(totalBits); //512

  //Generate hash string
  const hashStr = createHash('sha256').update(totalBitsBuffer).digest('hex');

  //Convert hash string to bits array
  const expectedHash = buffer2bitsMSB(Buffer.from(hashStr, 'hex'));

  return expectedHash.join('');
};

//Generate hash inputs
const generateHashInputs = async (message: string) => {
  let testStrBuffer = Buffer.from(message, 'utf8');
  //Check the length of the string and pad with 0s if less than 512 bits
  // Pad with zeros to reach 64 bytes (512 bits)
  const paddedLength = 64;
  if (testStrBuffer.length < paddedLength) {
    const padding = Buffer.alloc(paddedLength - testStrBuffer.length, 0); // zero padding
    testStrBuffer = Buffer.concat([testStrBuffer, padding]);
  }

  const preimage = buffer2bitsMSB(testStrBuffer);

  //Expected hash string
  const hashStr = createHash('sha256').update(testStrBuffer).digest('hex');
  const hashStrBuffer = Buffer.from(hashStr, 'hex');
  const expectedHash = buffer2bitsMSB(hashStrBuffer);
  return {
    preimage,
    expectedHash,
  };
};

function flattenMerkleProofPathElement(
  merkleProofPathElement: number[][][],
): number[][] {
  return merkleProofPathElement.map(
    (proof) => proof.flat(), // Flatten [depth][256] into [depth * 256]
  );
}

//Generate signature inputs
const generateSignatureInputs = async (message: string) => {
  const msg = createHash('sha256').update(message).digest();
  const eddsa = await circomlib.buildEddsa();
  const babyJub = await circomlib.buildBabyjub();
  const privateKey = ed25519.utils.randomPrivateKey(); // or hardcode a fixed one
  const publicKey = eddsa.prv2pub(privateKey);
  const publicKeyPoints = eddsa.prv2pub(privateKey);
  const packedPublicKey = babyJub.packPoint(publicKeyPoints);
  const signature = eddsa.signPedersen(privateKey, msg);
  const packedSignature = eddsa.packSignature(signature);

  const messageBits = buffer2bitsLSB(msg);
  const r8Bits = buffer2bitsLSB(Buffer.from(packedSignature.slice(0, 32)));
  const sBits = buffer2bitsLSB(Buffer.from(packedSignature.slice(32, 64)));
  const aBits = buffer2bitsLSB(Buffer.from(packedPublicKey));
  return {
    messageBits,
    r8Bits,
    sBits,
    aBits,
  };
};

// This function is used to convert a number to a field element
expect.extend({
  toEqualInFr(received: unknown, expected: unknown) {
    const pass = Fr.eq(
      Fr.e(received as bigint | number | string),
      Fr.e(BigInt(expected as bigint | number | string)),
    );
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be equal to ${expected} in Fr`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be equal to ${expected} in Fr`,
        pass: false,
      };
    }
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEqualInFr(expected: unknown): R;
    }
  }
}

describe('BusinessLogic Circuit for ((a==b) OR (c==d)) AND (e≤f≤g) AND ((h ∈ [i,j,k,l]) OR (hash of x matches expected)) AND (signature is valid)', () => {
  jest.setTimeout(100000);

  let circuit: any;

  beforeAll(async () => {
    circuit = await loadBusinessLogicCircuit();
  });
  it('Should output 1 when (true OR true) AND (true) AND (true OR true) AND (true)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const testStr = 'ljklmklmnlmnomnopnopq';
    const { preimage, expectedHash } = await generateHashInputs(testStr);

    //SIGNATURE VERIFICATION
    const { messageBits, r8Bits, sBits, aBits } = await generateSignatureInputs(
      'This is a test message for signature verification',
    );

    const inputs = {
      isEqualA: [123, 456],
      isEqualB: [123, 456],

      rangeCheckValue: [50],
      rangeCheckMin: [10],
      rangeCheckMax: [100],

      merkleProofLeaf: [LeafToBits('Paid', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],

      hashVerificationPreimage: [preimage], // [ [512 bits] ]
      hashVerificationExpectedHash: [expectedHash], // [ [256 bits] ]

      signatureVerificationMessage: [messageBits], // [ [256 bits] ]
      signatureVerificationA: [aBits], // [ [256 bits] ]
      signatureVerificationR8: [r8Bits], // [ [256 bits] ]
      signatureVerificationS: [sBits], // [ [256 bits] ]
    };

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
  it('Should output 1 when (false OR true) AND (true) AND (true OR true) AND (true)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const testStr = 'ljklmklmnlmnomnopnopq';
    const { preimage, expectedHash } = await generateHashInputs(testStr);

    //SIGNATURE VERIFICATION
    const { messageBits, r8Bits, sBits, aBits } = await generateSignatureInputs(
      'This is a test message for signature verification',
    );

    const inputs = {
      isEqualA: [10, 20],
      isEqualB: [99, 20], // 10 != 99 => false OR true
      rangeCheckValue: [30],
      rangeCheckMin: [10],
      rangeCheckMax: [50],
      merkleProofLeaf: [LeafToBits('Paid', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],
      hashVerificationPreimage: [preimage],
      hashVerificationExpectedHash: [expectedHash],
      signatureVerificationMessage: [messageBits],
      signatureVerificationA: [aBits],
      signatureVerificationR8: [r8Bits],
      signatureVerificationS: [sBits],
    };

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
  it('Should output 1 when (true OR true) AND (true) AND (false OR true) AND (true)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const testStr = 'ljklmklmnlmnomnopnopq';
    const { preimage, expectedHash } = await generateHashInputs(testStr);

    //SIGNATURE VERIFICATION
    const { messageBits, r8Bits, sBits, aBits } = await generateSignatureInputs(
      'This is a test message for signature verification',
    );

    const inputs = {
      isEqualA: [10, 10],
      isEqualB: [10, 10],
      rangeCheckValue: [20],
      rangeCheckMin: [10],
      rangeCheckMax: [30],
      merkleProofLeaf: [LeafToBits('In Progress', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],
      hashVerificationPreimage: [preimage],
      hashVerificationExpectedHash: [expectedHash],
      signatureVerificationMessage: [messageBits],
      signatureVerificationA: [aBits],
      signatureVerificationR8: [r8Bits],
      signatureVerificationS: [sBits],
    };

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
  it('Should output 1 when (true OR true) AND (true) AND (true OR false) AND (true)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const wrongHash = Buffer.alloc(32, 0);
    const wrongHashBits = buffer2bitsMSB(wrongHash);

    //SIGNATURE VERIFICATION
    const { messageBits, r8Bits, sBits, aBits } = await generateSignatureInputs(
      'This is a test message for signature verification',
    );

    const inputs = {
      isEqualA: [123, 456],
      isEqualB: [123, 456],

      rangeCheckValue: [50],
      rangeCheckMin: [10],
      rangeCheckMax: [100],

      merkleProofLeaf: [LeafToBits('Paid', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],

      hashVerificationPreimage: [Array(512).fill(0)],
      hashVerificationExpectedHash: [wrongHashBits],

      signatureVerificationMessage: [messageBits], // [ [256 bits] ]
      signatureVerificationA: [aBits], // [ [256 bits] ]
      signatureVerificationR8: [r8Bits], // [ [256 bits] ]
      signatureVerificationS: [sBits], // [ [256 bits] ]
    };

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
  it('Should output 0 when (false OR false) AND (false) AND (false OR false) AND (false)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const wrongHash = Buffer.alloc(32, 0);
    const wrongHashBits = buffer2bitsMSB(wrongHash);

    const inputs = {
      isEqualA: [1, 2], // false OR false
      isEqualB: [3, 4],
      rangeCheckValue: [200], // out of range
      rangeCheckMin: [10],
      rangeCheckMax: [100],
      merkleProofLeaf: [LeafToBits('In Progress', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],
      hashVerificationPreimage: [Array(512).fill(0)],
      hashVerificationExpectedHash: [wrongHashBits],
      signatureVerificationMessage: [Array(256).fill(0)],
      signatureVerificationA: [Array(256).fill(0)],
      signatureVerificationR8: [Array(256).fill(0)],
      signatureVerificationS: [Array(256).fill(0)],
    };

    const expectedOutput = 0;
    //If calculateWitness fails, it will throw an error and the test will fail
    try {
      const witness = await circuit.calculateWitness(inputs, true);
      await circuit.checkConstraints(witness);
    } catch (error) {
      //Signature verification failed using assert
      //This is expected to fail
      expect(error).toBeDefined();
      expect(error.message).toMatch('Error: Assert Failed.');
      expect(0).toEqualInFr(expectedOutput);
      return;
    }
  });
  it('Should output 0 when (true OR false) AND (false) AND (false OR false) AND (true)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const wrongHash = Buffer.alloc(32, 0);
    const wrongHashBits = buffer2bitsMSB(wrongHash);

    //SIGNATURE VERIFICATION
    const { messageBits, r8Bits, sBits, aBits } = await generateSignatureInputs(
      'This is a test message for signature verification',
    );

    const inputs = {
      isEqualA: [3, 2], // true OR false
      isEqualB: [3, 4],
      rangeCheckValue: [200], // out of range
      rangeCheckMin: [10],
      rangeCheckMax: [100],
      merkleProofLeaf: [LeafToBits('In Progress', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],
      hashVerificationPreimage: [Array(512).fill(0)],
      hashVerificationExpectedHash: [wrongHashBits],
      signatureVerificationMessage: [messageBits],
      signatureVerificationA: [aBits],
      signatureVerificationR8: [r8Bits],
      signatureVerificationS: [sBits],
    };

    const expectedOutput = 0;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
  it('Should output 0 when (true OR false) AND (false) AND (true OR false) AND (false)', async () => {
    //MERKLE PROOF VERIFICATION
    //Height of the tree = 1 (2 leaves and 1 root)
    const tree = new MerkleTree(
      2,
      ['In Progress', 'Paid', 'Approved', 'Rejected'],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );
    const path = tree.proof('Paid');

    //HASH VERIFICATION
    const wrongHash = Buffer.alloc(32, 0);
    const wrongHashBits = buffer2bitsMSB(wrongHash);

    const inputs = {
      isEqualA: [3, 2], // true OR false
      isEqualB: [3, 4],
      rangeCheckValue: [200], // out of range
      rangeCheckMin: [10],
      rangeCheckMax: [100],
      merkleProofLeaf: [LeafToBits('Paid', 256)],
      merkleProofRoot: [String(tree.root).split('').map(Number)],
      merkleProofPathElement: flattenMerkleProofPathElement([
        path.pathElements.map((node) => {
          let nodeBits;
          if (!is256BitBinaryString(String(node))) {
            nodeBits = LeafToBits(String(node), 256);
          } else {
            nodeBits = String(node).split('').map(Number);
          }
          return nodeBits;
        }),
      ]),
      merkleProofPathIndex: [[path.pathIndices]],
      hashVerificationPreimage: [Array(512).fill(0)],
      hashVerificationExpectedHash: [wrongHashBits],
      signatureVerificationMessage: [Array(256).fill(0)],
      signatureVerificationA: [Array(256).fill(0)],
      signatureVerificationR8: [Array(256).fill(0)],
      signatureVerificationS: [Array(256).fill(0)],
    };

    const expectedOutput = 0;
    //If calculateWitness fails, it will throw an error and the test will fail
    try {
      const witness = await circuit.calculateWitness(inputs, true);
      await circuit.checkConstraints(witness);
    } catch (error) {
      //Signature verification failed using assert
      //This is expected to fail
      expect(error).toBeDefined();
      expect(error.message).toMatch('Error: Assert Failed.');
      expect(0).toEqualInFr(expectedOutput);
      return;
    }
  });
});
