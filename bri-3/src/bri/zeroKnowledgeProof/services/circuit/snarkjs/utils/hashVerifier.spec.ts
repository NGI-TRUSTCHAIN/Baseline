import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import * as path from 'path';
import { createHash } from 'crypto';

const p = Scalar.fromString(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);
const Fr = new F1Field(p);

const WITNESS_IS_OUTPUT_INDEX = 1;

const loadCircuit = async () => {
  const fullPath = path.join(__dirname, 'hashVerifier.circom');
  const circuit = await wasm_tester(fullPath);
  return circuit;
};

function buffer2bitArray(b: Buffer) {
  const res: number[] = [];
  for (let i = 0; i < b.length; i++) {
    for (let j = 0; j < 8; j++) {
      res.push((b[i] >> (7 - j)) & 1);
    }
  }
  return res;
}

function bitArray2buffer(a) {
  const len = Math.floor((a.length - 1) / 8) + 1;
  const b = Buffer.alloc(len);

  for (let i = 0; i < a.length; i++) {
    const p = Math.floor(i / 8);
    b[p] = b[p] | (Number(a[i]) << (7 - (i % 8)));
  }
  return b;
}

// Custom matcher
expect.extend({
  toEqualInFr(received: unknown, expected: unknown) {
    const pass = Fr.eq(Fr.e(received), Fr.e(expected));
    if (pass) {
      return {
        message: () => `expected ${received} not to equal ${expected} in Fr`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to equal ${expected} in Fr`,
        pass: false,
      };
    }
  },
});

describe('HashVerifier Circuit', () => {
  jest.setTimeout(100000);

  let circuit: any;

  beforeAll(async () => {
    circuit = await loadCircuit();
  });

  it('should verify a correct SHA256 hash using crypto', async () => {
    //Input string
    //This string is 56 bytes long ---> Need to have a fixed length with padding????
    const testStr = 'ljklmklmnlmnomnopnopq';
    let testStrBuffer = Buffer.from(testStr, 'utf8');
    //Check the length of the string and pad with 0s if less than 512 bits
    // Pad with zeros to reach 64 bytes (512 bits)
    const paddedLength = 64;
    if (testStrBuffer.length < paddedLength) {
      const padding = Buffer.alloc(paddedLength - testStrBuffer.length, 0); // zero padding
      testStrBuffer = Buffer.concat([testStrBuffer, padding]);
    }

    const preimage = buffer2bitArray(testStrBuffer);

    //Expected hash string
    const hashStr = createHash('sha256').update(testStrBuffer).digest('hex');
    const hashStrBuffer = Buffer.from(hashStr, 'hex');
    const expectedHash = buffer2bitArray(hashStrBuffer);

    console.log('expectedHash', expectedHash.length);

    //Witness Input

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(
      { preimage, expectedHash },
      true,
    );

    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
