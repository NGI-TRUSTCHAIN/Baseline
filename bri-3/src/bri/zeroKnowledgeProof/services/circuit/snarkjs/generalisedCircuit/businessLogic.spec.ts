import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import * as path from 'path';

// This is the prime field used in the circuit
// The prime field is defined by the following equation:
// p = 2^255 - 19
// The prime field is used to define the elliptic curve used in the circuit
const p = Scalar.fromString(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);
const Fr = new F1Field(p);

const WITNESS_IS_OUTPUT_INDEX = 1;
const WITNESS_PUBLIC_INPUT_A_INDEX = 2;

const loadBusinessLogicCircuit = async () => {
  const fullPath = path.join(__dirname, 'businessLogic.circom');
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

describe('BusinessLogic Circuit for ((a==b) OR (c==d)) AND (e<=f<=g) AND (h ∈ [h, i, j, k])', () => {
  jest.setTimeout(100000);

  let circuit: any;

  beforeAll(async () => {
    circuit = await loadBusinessLogicCircuit();
  });
  it('Should output 1 when (true OR true) AND (true) AND (true)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          10,
          20,
          20, // IsEqual: a==b (true), c==d (true)
          10,
          3,
          20, // RangeCheck: e ≤ f ≤ g → 3 ≤ 10 ≤ 20 (true),
          4,
          2,
          4,
          6,
          8, // h ∈ [h, i, j, k] → 4 ∈ [4, 2, 4, 6] (true)
        ],
      ],
    };

    // Expected output is 1(true)
    const expectedOutput = 1;

    const witness = await circuit.calculateWitness(
      {
        inputs: inputs.inputs,
      },
      true,
    );
    await circuit.checkConstraints(witness);

    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
  it('Should output 1 when (false OR true) AND (true) AND (true)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          50,
          20,
          20, // IsEqual: a==b (false), c==d (true)
          10,
          3,
          20, // RangeCheck: 3 ≤ 10 ≤ 20 (true)
          4,
          2,
          4,
          6,
          8, // Membership: 4 ∈ [2, 4, 6, 8] (true)
        ],
      ],
    };
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });

  it('Should output 1 when (true OR false) AND (true) AND (true)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          10,
          20,
          50, // IsEqual: a==b (true), c==d (false)
          10,
          3,
          20, // RangeCheck: 3 ≤ 10 ≤ 20 (true)
          6,
          2,
          4,
          6,
          8, // Membership: 6 ∈ [2, 4, 6, 8] (true)
        ],
      ],
    };
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });

  it('Should output 0 when (false OR false) AND (true) AND (true)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          40,
          50,
          20, // IsEqual: both false
          10,
          3,
          20, // RangeCheck: true
          4,
          2,
          4,
          6,
          8, // Membership: true
        ],
      ],
    };
    const expectedOutput = 0;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });

  it('Should output 0 when (false OR true) AND (false) AND (true)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          40,
          70,
          70, // IsEqual: false OR true
          30,
          3,
          20, // RangeCheck: 3 ≤ 30 ≤ 20 → false
          4,
          2,
          4,
          6,
          8, // Membership: true
        ],
      ],
    };
    const expectedOutput = 0;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });

  it('Should output 0 when (true OR true) AND (true) AND (false)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          10,
          20,
          20, // IsEqual: both true
          10,
          3,
          20, // RangeCheck: true
          5,
          2,
          4,
          6,
          8, // Membership: 5 ∉ [2,4,6,8] → false
        ],
      ],
    };
    const expectedOutput = 0;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });

  it('Should output 0 when (false OR false) AND (false) AND (false)', async () => {
    const inputs = {
      inputs: [
        [
          10,
          40,
          30,
          70, // IsEqual: both false
          30,
          3,
          20, // RangeCheck: false
          5,
          2,
          4,
          6,
          8, // Membership: false
        ],
      ],
    };
    const expectedOutput = 0;
    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
