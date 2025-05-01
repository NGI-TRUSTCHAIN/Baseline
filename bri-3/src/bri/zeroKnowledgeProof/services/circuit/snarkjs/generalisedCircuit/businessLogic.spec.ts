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

describe('BusinessLogic Circuit Test', () => {
  jest.setTimeout(100000);

  let circuit: any;

  beforeAll(async () => {
    circuit = await loadBusinessLogicCircuit();
  });
  it('Should output 1 when (a == b OR c == d) AND (e < f)', async () => {
    const nIsEqual = 2;
    const nLessThan = 1;
    const n = 8; // Bit width for LessThan
    const truthTableRows = 3;
    const numInputsPerRow = 6; // For 2 isEqual (2*2) and 1 lessThan (1*2)

    const inputs = {
      inputs: [
        [10, 10, 20, 30, 5, 10], // [a, b, c, d] for isEqual, [e, f] for lessThan
        [5, 10], // These inputs are not directly used in this test case's logic but are required by the circuit structure
      ],
      truthTable: [
        [0, 0, 0, 1, 0], // intermediate[0] = (outputs[0] AND outputs[1]) - Incorrect logic for OR
        [1, 0, 0, 1, 0], // intermediate[1] = (outputs[0] OR outputs[1])
        [0, 1, 1, 2, 0], // intermediate[2] = (intermediates[1] AND outputs[2])
      ],
    };

    // Expected output is 1 because (10 == 10 OR 20 == 30(false)) AND (5 < 10) => (true OR false) AND true => true AND true => 1
    const expectedOutput = 1;

    const witness = await circuit.calculateWitness(
      {
        nIsEqual: nIsEqual,
        nLessThan: nLessThan,
        n: n,
        truthTableRows: truthTableRows,
        numInputsPerRow: numInputsPerRow,
        inputs: inputs.inputs,
        truthTable: inputs.truthTable,
      },
      true,
    );
    await circuit.checkConstraints(witness);

    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
