import * as path from 'path';
import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import { GeneralCircuitInputsParserService } from '../../../../circuitInputsParser/generalCircuitInputParser.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoggingService } from '../../../../../../../../shared/logging/logging.service';
import { PayloadFormatType } from '../../../../../../../workgroup/worksteps/models/workstep';
import * as fs from 'fs';
import { UnifiedCircuitInputsMapping } from '../../../../circuitInputsParser/unifiedCircuitInputsMapping';

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
// TODO: Separate npm run command
describe.skip('Supplier XML extraction and signature verification', () => {
  jest.setTimeout(100000);
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
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
    const payload = xmlContent;

    const cim: UnifiedCircuitInputsMapping = {
      mapping: [
        {
          extractionField: 'ds:Signature.ds:SignatureValue._',
          payloadJsonPath: 'supplierSignature',
          circuitInput: 'supplierSignature',
          description: 'Signature on the document',
          dataType: 'string',
          checkType: 'signatureCheck',
        },
      ],
    };

    // Act
    const result = await gcips.applyUnifiedMappingToTxPayload(
      payload,
      PayloadFormatType.XML,
      cim,
    );

    //ZK Circuit Inputs
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
// TODO: Separate npm run command
describe.skip('Efakture XML extraction and signature verification', () => {
  jest.setTimeout(100000);
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
    const xmlFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/signatures0.xml',
    );
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
    const payload = xmlContent;

    const cim: UnifiedCircuitInputsMapping = {
      mapping: [
        {
          extractionField: 'asic:XAdESSignatures.ds:Signature.ds:SignatureValue._',
          payloadJsonPath: 'efaktureSignature',
          circuitInput: 'efaktureSignature',
          description: 'Signature on the document',
          dataType: 'string',
          checkType: 'signatureCheck',
        },
        {
          extractionField:
            'asic:XAdESSignatures.ds:Signature.ds:KeyInfo.ds:X509Data.ds:X509Certificate.subject.CN',
          extractionParam: 'x509',
          payloadJsonPath: 'signerName',
          circuitInput: 'signerName', //Merkle leaf used for proof
          description: 'Common name of certificate signer',
          dataType: 'string',
          checkType: 'merkleProof',
          merkleTreeInputsPath: ['signerName', 'signerName'],
        },
      ],
    };

    // Act
    const result = await gcips.applyUnifiedMappingToTxPayload(
      payload,
      PayloadFormatType.XML,
      cim,
    );

    //ZK Circuit Inputs
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
// TODO: Separate npm run command
describe.skip('Supplier XML extraction and Id verification', () => {
  jest.setTimeout(100000);
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
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
    const payload = xmlContent;

    const cim: UnifiedCircuitInputsMapping = {
      mapping: [
        {
          extractionField: 'SupplierSEFSalesInvoiceId',
          payloadJsonPath: 'supplierId',
          circuitInput: 'supplierId', //Merkle leaf used for proof
          description: 'Supplied Id number',
          dataType: 'string',
          checkType: 'merkleProof',
          merkleTreeInputsPath: ['supplierId', 'supplierId'],
        },
      ],
    };

    // Act
    const result = await gcips.applyUnifiedMappingToTxPayload(
      payload,
      PayloadFormatType.XML,
      cim,
    );

    //ZK Circuit Inputs
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
// TODO: Separate npm run command
describe.skip('Efakture XML extraction and signature verification', () => {
  jest.setTimeout(100000);
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
    const xmlFilePath = path.join(
      __dirname,
      '../../../../../../../../shared/testing/interop/verifiedSupplierInvoice.xml',
    );
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
    const payload = xmlContent;

    const cim: UnifiedCircuitInputsMapping = {
      mapping: [
        {
          extractionField: 'SupplierSEFSalesInvoiceId', //TODO: need accurate ID
          payloadJsonPath: 'invoiceStatus',
          circuitInput: 'invoiceStatus',
          description: 'Supplied Id number',
          dataType: 'string',
          checkType: 'merkleProof',
          merkleTreeInputsPath: ['invoiceStatus', 'invoiceStatus'],
        },
      ],
    };

    // Act
    const result = await gcips.applyUnifiedMappingToTxPayload(
      payload,
      PayloadFormatType.XML,
      cim,
    );

    //ZK Circuit Inputs
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
