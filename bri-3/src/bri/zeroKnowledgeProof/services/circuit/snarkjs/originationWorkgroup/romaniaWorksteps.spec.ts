import * as path from 'path';
import { F1Field, Scalar } from 'ffjavascript';
import { wasm as wasm_tester } from 'circom_tester';
// Update the import path below if the actual location is different
import { GeneralCircuitInputsParserService } from '../../circuitInputsParser/generalCircuitInputParser.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { LoggingService } from '../../../../../../shared/logging/logging.service';
import { PayloadFormatType } from '../../../../../workgroup/worksteps/models/workstep';
import * as fs from 'fs';

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
describe.skip('Invoice payload verification', () => {
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
  it('should extract and verify the supplier and buyer signature', async () => {
    const payload = `{
      "supplier": {
        "format": "CAdES-BES (Basic Electronic Signature)",
        "algorithm": "RSA-SHA256",
        "timestamp": "2025-06-03T12:57:16.324972",
        "signer": {
          "country": "RO",
          "organization": "SC TECH SOLUTIONS BUCURESTI SRL",
          "cui": "RO12345678",
          "email": "admin@sctestindustries.ro",
          "fullRegistration": "J40/12345/2023",
          "registrationCounty": "Bucharest (J40)",
          "year": "2023"
        },
        "certificate": {
          "issuer": "certSIGN SA (TEST)",
          "serial": "282776557463243117587615775002810695387071614761",
          "valid_from": "2025-06-03T07:26:51",
          "valid_until": "2028-06-02T07:26:51",
          "policy": "Qualified Certificate for Electronic Signatures"
        },
        "legal_framework": [
          "eIDAS Regulation (EU) No 910/2014",
          "Romanian Law 455/2001 on Electronic Signatures",
          "Romanian GEO 38/2020 on Electronic Documents"
        ],
        "signature_base64": "J8BZf5LhuTpN/KtPicXCmIO/kSVXn+hh8tE1v1k/Z9ZuhAXMKTYT8nc5wWkc3DMtCQGntkT1b75kw+fzhGWF0VZRmF4LU78FMr4sgpsu9stGPHtprhvRWvBjjF629DRxyTwK4CPGu5v/qRiWYGjXpWi9v4mKDEcYxBNQNB3+nwG36IgDQy9/mHlJX1+GXXi1RcWHXZuP2lWPFlTWZGBR+EJRQB0+XsVjDeKihHYWaqhxWdf76hc9NjQIzQWN7GOsCiey+Faru+Rmys7V49GxypenTkyHk0hvaa+/676ZclAm6Uq0JI6zFa+9C3Di9jUyIBI9/LkRqGUKSFejIBW3ig==",
        "document_hash_sha256": "302c2628fea5fdbf3d2bc3e3288068f346224aff78f3cb7b950e1a7a4f5f171c"
      },
      "buyer": {
        "format": "CAdES-BES (Basic Electronic Signature)",
        "algorithm": "RSA-SHA256",
        "timestamp": "2025-06-03T13:03:37.635966",
        "signer": {
          "country": "RO",
          "organization": "SC INNOVATE SYSTEMS TIMISOARA SRL",
          "cui": "RO87654321",
          "email": "admin@scinnovatesystems.ro",
          "fullRegistration": "J35/8765/2021",
          "registrationCounty": "Timiș (J35)",
          "year": "2021"
        },
        "certificate": {
          "issuer": "certSIGN SA (TEST)",
          "serial": "215068228859894812045338183829428970583415168537",
          "valid_from": "2025-06-03T07:31:53",
          "valid_until": "2028-06-02T07:31:53",
          "policy": "Qualified Certificate for Electronic Signatures"
        },
        "legal_framework": [
          "eIDAS Regulation (EU) No 910/2014",
          "Romanian Law 455/2001 on Electronic Signatures",
          "Romanian GEO 38/2020 on Electronic Documents"
        ],
        "signature_base64": "nQegVyRBk3UidE6vafhzRcVbnvyVgZkJP0a4AfmIB3sZQHst2w/eLIlQVo5EuIdBhkm6y5+R7yoJCyyh6QuAc0lRwuATeH19CVzmNw/zGpPETjy6lJvWJ1IFm9dGHMTquufyuuUMkf/1+xaRhNkXMo/kyyadKCO/3pU0x0U2+aT0NgTuKVmYfZ4qWInEGvqTcvI9LoLELc6K3AbqwQ8chlJ3I7AuUfuf6R1N3onp/C+//mCHsXK9SB2TlxJVzdI5xukKLD9VQqLt6w0DClCPZ9477i73k5pWSbajuqQYpDyJ2TVmnp/IhKV4gDQ/766hxnSwfewFg5RzyBe9xHVGVA==",
        "document_hash_sha256": "302c2628fea5fdbf3d2bc3e3288068f346224aff78f3cb7b950e1a7a4f5f171c"
      }
    }
`;

    const cim: GeneralCircuitInputsMapping = {
      mapping: [],
      extractions: [
        {
          field: 'supplier.signature_base64',
          destinationPath: 'supplierSignature',
          circuitInput: 'supplierSignature',
          description: 'Supplier signature on the document',
          dataType: 'string',
          checkType: 'signatureCheck',
        },
        {
          field: 'buyer.signature_base64',
          destinationPath: 'buyerSignature',
          circuitInput: 'buyerSignature',
          description: 'Buyer signature on the document',
          dataType: 'string',
          checkType: 'signatureCheck',
        },
      ],
    };

    // Act
    const result = await gcips.applyGeneralMappingToTxPayload(
      payload,
      PayloadFormatType.JSON,
      cim,
    );

    //ZK Circuit Inputs
    const expectedOutput = 1;
    const witness = await circuit.calculateWitness(result, true);
    await circuit.checkConstraints(witness);
    expect(witness[WITNESS_IS_OUTPUT_INDEX]).toEqualInFr(expectedOutput);
  });
});
