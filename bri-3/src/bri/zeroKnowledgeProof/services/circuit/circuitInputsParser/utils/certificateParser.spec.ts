import * as path from 'path';
import * as fs from 'fs';
import {
  extractXML,
  parseXML,
  parseCertificate,
  validateCertificate,
  getSigningTime,
  getCertDigestInfo,
  verifyCertDigest,
  getIssuerSerialInfo,
  parseName,
} from './certificateParser';
import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
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
  const fullPath = path.join(
    __dirname,
    '../../snarkjs/workstepCircuits/certificateVerificationWorkstep.circom',
  );
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
  } else if (leafStrBuffer.length > paddedLength) {
    // If the leaf is longer than 32 bytes, truncate it
    leafStrBuffer = leafStrBuffer.slice(0, paddedLength);
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
const generateHashInputs = async (message: ArrayBuffer) => {
  let testStrBuffer = Buffer.from(message);
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

const base64ToHash = (base64: string): string => {
  const buffer = Buffer.from(base64, 'base64');
  return buffer.toString('hex');
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

const ASICE_PATH = path.resolve(
  __dirname,
  '../../../../../../shared/testing/x509Certificate/2cc4f0b7-0132-4b10-bc37-e1a0b37e6729.asice',
);
const SIGNATURE_XML_PATH = 'META-INF/signatures0.xml';
const OUTPUT_FILE_PATH = path.join(
  __dirname,
  '../../../../../../shared/testing/x509Certificate/signatures0.xml',
);
// TODO: Separate npm run command
describe.skip('ASiC-E signature XML extraction and certificate validation', () => {
  jest.setTimeout(2000000);
  let circuit: any;

  beforeAll(async () => {
    extractXML(ASICE_PATH, SIGNATURE_XML_PATH, OUTPUT_FILE_PATH);
    circuit = await loadBusinessLogicCircuit();
  });

  // ZK CIRCUIT: (h ∈ [i,j,k,l]) AND (hash of x matches expected) AND (signature is valid)
  it('should extract and verify the x509 certificate using zk circuit', async () => {
    const xmlContent = fs.readFileSync(OUTPUT_FILE_PATH, 'utf8');
    const parsedXML = parseXML(xmlContent);

    const cert = parseCertificate(parsedXML);

    const signingAuthority = parseName(cert.subject)['CN'][0]; // Republika Srbija - Ministarstvo finansija 200037908
    const issuingAuthority = parseName(cert.issuer)['CN'][0]; //Pošta Srbije CA 1
    const certificateTiming = String(getSigningTime(parsedXML)); //2025-05-07T09:31:10Z
    const documentType = 'Invoice'; //Invoice etc.

    //1. Check signing authority of certificate
    const tree = new MerkleTree(
      3,
      [signingAuthority, issuingAuthority, certificateTiming, documentType],
      {
        hashFunction: generateMerkleHash,
        zeroElement: '0',
      },
    );

    const path = tree.proof(signingAuthority);

    //2.Check certificate digest
    const { preimage, expectedHash } = await generateHashInputs(cert.rawData);
    const digestInfo = getCertDigestInfo(parsedXML);
    const certificateHashHex = Buffer.from(
      base64ToHash(digestInfo.value),
      'hex',
    );
    const certificateHashBuffer = buffer2bitsMSB(certificateHashHex);

    //3. Check signature of certificate
    const signature =
      parsedXML?.['asic:XAdESSignatures']['ds:Signature']['ds:SignatureValue'][
        '#text'
      ];
    // eslint-disable-next-line prettier/prettier
    const { messageBits, r8Bits, sBits, aBits } =
      await generateSignatureInputs(signature);

    //ZK CIRCUIT INPUTS
    const inputs = {
      merkleProofLeaf: [
        LeafToBits('Republika Srbija - Ministarstvo finansija 200037908', 256),
      ],
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
      hashVerificationExpectedHash: [certificateHashBuffer], // [ [256 bits] ]

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
});
