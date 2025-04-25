import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';

const p = Scalar.fromString(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);
const Fr = new F1Field(p);

const WITNESS_IS_OUTPUT_INDEX = 1;
const WITNESS_PUBLIC_INPUT_A_INDEX = 2;

const loadCircuit = async () => {
  const currentDirectory = process.cwd();
  console.log(`Current directory: ${currentDirectory}`);
  const fullPath = `${currentDirectory}/businessLogic.circom`;

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
    circuit = await loadCircuit();
  });

  it('Should output 1 when a == b with 1 isEqual check and 0 lessThan checks', async () => {
    //checkSelector = 1 (isEqual)
    // inputs[0] = [a, b] for isEqual
    // inputs[1] = [a, b] for lessThan
    const inputs = {
      inputs: [
        [50, 50],
        [100, 200],
      ],
      checkSelector: 1,
    };

    // Expected output is 1(true) for a == b (50 == 50)
    const expectedOutput = 1;

    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);

    expect(witness[WITNESS_PUBLIC_INPUT_A_INDEX + 0]).toEqualInFr(
      inputs.inputs[0][0],
    );
    expect(witness[WITNESS_PUBLIC_INPUT_A_INDEX + 1]).toEqualInFr(
      inputs.inputs[0][1],
    );
    expect(witness[WITNESS_PUBLIC_INPUT_A_INDEX + 4]).toEqualInFr(
      inputs.checkSelector,
    );
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });

  it('Should output 1 when a == b with 1 isEqual check and 0 lessThan checks', async () => {
    //checkSelector = 0 (isLessThan)
    // inputs[0] = [a, b] for isEqual
    // inputs[1] = [a, b] for lessThan
    const inputs = {
      inputs: [
        [50, 50],
        [100, 200],
      ],
      checkSelector: 0,
    };

    // Expected output is 1(true) for a < b (100 < 200)
    const expectedOutput = 1;

    const witness = await circuit.calculateWitness(inputs, true);
    await circuit.checkConstraints(witness);

    expect(witness[WITNESS_PUBLIC_INPUT_A_INDEX + 0]).toEqualInFr(
      inputs.inputs[0][0],
    );
    expect(witness[WITNESS_PUBLIC_INPUT_A_INDEX + 1]).toEqualInFr(
      inputs.inputs[0][1],
    );
    expect(witness[WITNESS_PUBLIC_INPUT_A_INDEX + 4]).toEqualInFr(
      inputs.checkSelector,
    );
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
