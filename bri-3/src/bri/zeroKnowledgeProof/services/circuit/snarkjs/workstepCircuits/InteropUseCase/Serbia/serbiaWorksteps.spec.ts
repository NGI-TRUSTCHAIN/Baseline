import * as path from 'path';
import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import { GeneralCircuitInputsParserService } from '../../../../circuitInputsParser/utils/generalCircuitInputParser.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoggingService } from '../../../../../../../../shared/logging/logging.service';

// This is the prime field used in the circuit
// The prime field is defined by the following equation:
// p = 2^255 - 19
// The prime field is used to define the elliptic curve used in the circuit
const p = Scalar.fromString(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);
const Fr = new F1Field(p);

const WITNESS_IS_OUTPUT_INDEX = 1;

const loadBusinessLogicCircuit = async (pathToCircuit: string) => {
  const fullPath = path.join(__dirname, pathToCircuit);
  try {
    const circuit = await wasm_tester(fullPath);
    console.log(`${pathToCircuit.split('./')[1]} Circuit loaded successfully.`);
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

describe('Supplier XML extraction and signature verification', () => {
  jest.setTimeout(2000000);
  let circuit: any;
  let gcips: GeneralCircuitInputsParserService;
  const loggingServiceMock: DeepMockProxy<LoggingService> =
    mockDeep<LoggingService>();

  beforeAll(async () => {
    gcips = new GeneralCircuitInputsParserService(loggingServiceMock);
    circuit = await loadBusinessLogicCircuit('./workstep1.circom');
  });

  // ZK CIRCUIT: (supplier signature is valid)
  it('should extract and verify the supplier xml signature', async () => {
    const xmlFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/supplierInvoice.xml',
    );
    const payload = JSON.stringify({
      xmlFilePath,
    });

    const cim: GeneralCircuitInputsMapping = {
      mapping: [],
      extractions: [
        {
          inputType: 'xml',
          payloadJsonPath: 'xmlFilePath',
          dataToExtract: [
            {
              field: 'signature',
              destinationPath: 'signatureValue',
              circuitInput: 'supplierSignature',
              description: 'Signature on the document',
              dataType: 'string',
              checkType: 'signatureCheck',
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

describe('Efakture XML extraction and signature verification', () => {
  jest.setTimeout(2000000);
  let circuit: any;
  let gcips: GeneralCircuitInputsParserService;
  const loggingServiceMock: DeepMockProxy<LoggingService> =
    mockDeep<LoggingService>();

  beforeAll(async () => {
    gcips = new GeneralCircuitInputsParserService(loggingServiceMock);
    circuit = await loadBusinessLogicCircuit('./workstep2.circom');
  });

  // ZK CIRCUIT: (supplier signature is valid)
  it('should extract and verify that signer is Republika Srbija - Ministarstvo finansija', async () => {
    const asiceFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/efaktureResponse.asice',
    );

    const xmlFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/signatures0.xml',
    );

    const payload = JSON.stringify({
      asiceFilePath,
      documentType: 'Invoice',
      expectedSignerName: 'Republika Srbija - Ministarstvo finansija 200037908', //check if this is the expected signer name
    });

    const cim: GeneralCircuitInputsMapping = {
      mapping: [
        {
          description: 'Type of the document - Invoice',
          payloadJsonPath: 'documentType',
          dataType: 'string',
          defaultValue: '',
        },
        {
          description: 'Expected signer name from the certificate',
          payloadJsonPath: 'expectedSignerName',
          dataType: 'string',
          defaultValue: '',
          circuitInput: 'signerName',
          checkType: 'merkleProof', // This will be used to verify the signer name in the circuit
          merkleTreeInputsPath: ['signerName', 'documentType'], // This is the path to the Merkle tree inputs
        },
      ],
      extractions: [
        {
          inputType: 'asice',
          payloadJsonPath: 'asiceFilePath',
          dataToExtract: [
            {
              field: 'xmlFilePath',
              destinationPath: xmlFilePath,
              extractionParam: 'META-INF/signatures0.xml',
            },
          ],
        },
        {
          inputType: 'xml',
          payloadJsonPath: 'xmlFilePath', // extracted from ASiC-e
          dataToExtract: [
            {
              field: 'signedCertificate',
              destinationPath: 'signedCertificatePath',
              description: 'Extracted certificate from the XML',
            },
            {
              field: 'signature',
              destinationPath: 'signatureValue',
              description: 'Signature from the XML document',
              circuitInput: 'efaktureSignature',
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

describe('Supplier XML extraction and Id verification', () => {
  jest.setTimeout(2000000);
  let circuit: any;
  let gcips: GeneralCircuitInputsParserService;
  const loggingServiceMock: DeepMockProxy<LoggingService> =
    mockDeep<LoggingService>();

  beforeAll(async () => {
    gcips = new GeneralCircuitInputsParserService(loggingServiceMock);
    circuit = await loadBusinessLogicCircuit('./workstep3.circom');
  });

  // ZK CIRCUIT: (supplier signature is valid)
  it('should extract and verify that signer is Republika Srbija - Ministarstvo finansija', async () => {
    const xmlFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/supplierInvoice.xml',
    );

    const payload = JSON.stringify({
      xmlFilePath,
      documentType: 'Invoice',
      expectedSupplierId: '304524665', //check if this is the expected supplier Id
    });

    const cim: GeneralCircuitInputsMapping = {
      mapping: [
        {
          description: 'Type of the document - Invoice',
          payloadJsonPath: 'documentType',
          dataType: 'string',
          defaultValue: '',
        },
        {
          description: 'Expected supplier Id',
          payloadJsonPath: 'expectedSupplierId',
          dataType: 'string',
          defaultValue: '',
          circuitInput: 'supplierId',
          checkType: 'merkleProof', // This will be used to verify the signer name in the circuit
          merkleTreeInputsPath: ['supplierId', 'documentType'], // This is the path to the Merkle tree inputs
        },
      ],
      extractions: [
        {
          inputType: 'xml',
          payloadJsonPath: 'xmlFilePath', // extracted from ASiC-e
          dataToExtract: [
            {
              field: 'SupplierSEFSalesInvoiceId',
              destinationPath: 'supplierId',
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

describe('Efakture XML extraction and signature verification', () => {
  jest.setTimeout(2000000);
  let circuit: any;
  let gcips: GeneralCircuitInputsParserService;
  const loggingServiceMock: DeepMockProxy<LoggingService> =
    mockDeep<LoggingService>();

  beforeAll(async () => {
    gcips = new GeneralCircuitInputsParserService(loggingServiceMock);
    circuit = await loadBusinessLogicCircuit('./workstep4.circom');
  });

  // ZK CIRCUIT: (supplier signature is valid)
  it('should extract and verify that invoice status is Approved', async () => {
    const asiceFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/efaktureResponse.asice',
    );

    const xmlFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/verifiedSupplierInvoice.xml',
    );

    const payload = JSON.stringify({
      asiceFilePath,
      documentType: 'Invoice',
      expectedInvoiceStatus: 'APPROVED', //TODO: What is the actual value?
    });

    const cim: GeneralCircuitInputsMapping = {
      mapping: [
        {
          description: 'Type of the document - Invoice',
          payloadJsonPath: 'documentType',
          dataType: 'string',
          defaultValue: '',
        },
        {
          description: 'Expected supplier Id',
          payloadJsonPath: 'expectedInvoiceStatus',
          dataType: 'string',
          defaultValue: '',
          circuitInput: 'invoiceStatus',
          checkType: 'merkleProof', // This will be used to verify the signer name in the circuit
          merkleTreeInputsPath: ['invoiceStatus', 'documentType'], // This is the path to the Merkle tree inputs
        },
      ],
      extractions: [
        {
          inputType: 'asice',
          payloadJsonPath: 'asiceFilePath',
          dataToExtract: [
            {
              field: 'xmlFilePath',
              destinationPath: xmlFilePath,
              extractionParam: /^(?!META-INF\/).+\.xml$/,
            },
          ],
        },
        {
          inputType: 'xml',
          payloadJsonPath: 'xmlFilePath', // extracted from ASiC-e
          dataToExtract: [
            {
              field: 'SupplierSEFSalesInvoiceId', //TODO: What is the actual key?
              destinationPath: 'invoiceStatus',
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
