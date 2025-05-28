import * as path from 'path';
import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import { GeneralCircuitInputsParserService } from './generalCircuitInputParser.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoggingService } from '../../../../../../shared/logging/logging.service';
import { doc } from 'prettier';
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
    '../../snarkjs/workstepCircuits/circuitInputParserTestWorkstep.circom',
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

describe('ASiC-E signature XML extraction and certificate validation', () => {
  jest.setTimeout(2000000);
  let circuit: any;
  let gcips: GeneralCircuitInputsParserService;
  const loggingServiceMock: DeepMockProxy<LoggingService> =
    mockDeep<LoggingService>();

  beforeAll(async () => {
    gcips = new GeneralCircuitInputsParserService(loggingServiceMock);
    circuit = await loadBusinessLogicCircuit();
  });

  // ZK CIRCUIT: (h ∈ [i,j,k,l]) AND (hash of x matches expected) AND (signature is valid)
  it('should extract and verify the x509 certificate using zk circuit', async () => {
    const payload = JSON.stringify({
      asiceFilePath:
        '../../../../../../shared/testing/x509Certificate/2cc4f0b7-0132-4b10-bc37-e1a0b37e6729.asice',
      documentType: 'Invoice',
    });

    const cim: GeneralCircuitInputsMapping = {
      mapping: [
        {
          description: 'Type of the document - Invoice',
          payloadJsonPath: 'documentType',
          dataType: 'string',
          defaultValue: '',
        },
      ],
      extractions: [
        {
          inputType: 'asice',
          payloadJsonPath: 'asiceFilePath',
          dataToExtract: [
            {
              field: 'xmlFilePath',
              destinationPath:
                '../../../../../../shared/testing/x509Certificate/signatures0.xml',
            },
          ],
        },
        {
          inputType: 'xml',
          payloadJsonPath: 'xmlFilePath', //same as the destinationPath in the previous extraction
          dataToExtract: [
            {
              field: 'signingTime', //Added as merkle leaf, but not a circuit input
              destinationPath: 'signingTime',
              description: 'Timestamp of the signature',
            },
            {
              field: 'signedHash',
              destinationPath: 'signedCertificateHash',
              description: 'Signed certificate digest',
              dataType: 'array',
            },
            {
              field: 'signedCertificate',
              destinationPath: 'signedCertificatePath',
            },
            {
              field: 'signature',
              destinationPath: 'signatureValue',
              circuitInput: 'certificateSignature',
              description: 'Signature on the document',
              dataType: 'string',
              checkType: 'signatureCheck',
            },
          ],
        },
        {
          inputType: 'x509',
          payloadJsonPath: 'signedCertificatePath',
          dataToExtract: [
            {
              field: 'signerName',
              destinationPath: 'signerName',
              circuitInput: 'signerName', //Merkle leaf used for proof
              description: 'Common name of certificate signer',
              dataType: 'string',
              checkType: 'merkleProof',
              merkleTreeInputsPath: [
                'signerName',
                'issuerName',
                'signingTime',
                'documentType',
              ],
            },
            {
              field: 'issuerName',
              destinationPath: 'issuerName',
              description: 'Common name of issuing authority',
              dataType: 'string',
            },
            {
              field: 'certPreimage',
              destinationPath: 'certPreimage',
              circuitInput: 'certHash',
              description: 'Preimage of certificate raw data',
              dataType: 'array',
              checkType: 'hashCheck',
              expectedHashPath: 'signedCertificateHash', //same as destinationPath of signedHash
            },
          ],
        },
      ],
    };

    // Act
    const result = await gcips.applyMappingToJSONPayload(payload, cim);

    //ZK Circuit Inputs

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
