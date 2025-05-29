import * as path from 'path';
import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
import { GeneralCircuitInputsParserService } from './generalCircuitInputParser.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoggingService } from '../../../../../shared/logging/logging.service';
import { doc } from 'prettier';
import * as fs from 'fs';
import { PayloadFormatType } from '../../../../workgroup/worksteps/models/workstep';
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
    '../snarkjs/workstepCircuits/circuitInputParserTestWorkstep.circom',
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

describe('XML extraction and certificate validation', () => {
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
    const XML_FILE_PATH = path.join(
      __dirname,
      '../../../../../shared/testing/x509Certificate/signatures0.xml',
    );
    const xmlContent = fs.readFileSync(XML_FILE_PATH, 'utf8');
    const payload = xmlContent;
    const cim: GeneralCircuitInputsMapping = {
      mapping: [],
      extractions: [
        {
          field:
            'asic:XAdESSignatures.ds:Signature.ds:Object.xades:QualifyingProperties.xades:SignedProperties.xades:SignedSignatureProperties.xades:SigningTime',
          destinationPath: 'signingTime',
          description: 'Timestamp of the signature',
        },
        {
          field:
            'asic:XAdESSignatures.ds:Signature.ds:Object.xades:QualifyingProperties.xades:SignedProperties.xades:SignedSignatureProperties.xades:SigningCertificate.xades:Cert.xades:CertDigest.ds:DigestValue',
          destinationPath: 'signedCertificateHash',
          description: 'Hash of the certificate',
        },
        {
          field: 'asic:XAdESSignatures.ds:Signature.ds:SignatureValue._',
          destinationPath: 'signatureValue',
          circuitInput: 'certificateSignature',
          description: 'Signature on the document',
          dataType: 'string',
          checkType: 'signatureCheck',
        },
        {
          field:
            'asic:XAdESSignatures.ds:Signature.ds:KeyInfo.ds:X509Data.ds:X509Certificate.subject.CN',
          extractionParam: 'x509',
          destinationPath: 'signerName',
          circuitInput: 'signerName', //Merkle leaf used for proof
          description: 'Common name of certificate signer',
          dataType: 'string',
          checkType: 'merkleProof',
          merkleTreeInputsPath: [
            'signerName',
            'issuerName',
            'signingTime',
            'signerName',
          ],
        },
        {
          field:
            'asic:XAdESSignatures.ds:Signature.ds:KeyInfo.ds:X509Data.ds:X509Certificate.issuer.CN',
          extractionParam: 'x509',
          destinationPath: 'issuerName',
          description: 'Common name of issuing authority',
          dataType: 'string',
        },
        {
          field:
            'asic:XAdESSignatures.ds:Signature.ds:KeyInfo.ds:X509Data.ds:X509Certificate.rawData',
          extractionParam: 'x509',
          destinationPath: 'certPreimage',
          circuitInput: 'certHash',
          description: 'Preimage of certificate raw data',
          dataType: 'array',
          checkType: 'hashCheck',
          expectedHashPath: 'signedCertificateHash', //same as destinationPath of signedHash
        },
      ],
    };

    const result = await gcips.applyGeneralMappingToTxPayload(
      payload,
      PayloadFormatType.XML,
      cim,
    );

    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
