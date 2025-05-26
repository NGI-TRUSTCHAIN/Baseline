type GeneralCircuitInputsMapping = {
  mapping: GeneralCircuitInputMapping[];
  extractions?: GeneralCircuitInputExtraction[];
};

type CheckType =
  | 'isEqual'
  | 'isInRange'
  | 'merkleProof'
  | 'hashCheck'
  | 'signatureCheck';

type GeneralCircuitInputMapping = {
  circuitInput: string;
  description: string;
  payloadJsonPath: string;
  dataType: 'string' | 'integer' | 'array' | 'object';
  defaultValue?: any;

  checkType: CheckType;

  // for isEqual
  expectedValue?: any;

  // for isInRange
  minValue?: number;
  maxValue?: number;

  // for merkleProof --> payloadJSonPath of all leaves
  merkleTreeInputsPath?: string[];

  // for hashCheck
  expectedHashPath?: string;

  // for signatureCheck
  messagePath?: string;
};

type GeneralCircuitInputExtraction = {
  inputType: 'asice' | 'xml' | 'x509';
  payloadJsonPath: string;
  dataToExtract: {
    field:
      | 'xmlFilePath'
      | 'signingTime'
      | 'signedHash'
      | 'signedCertificate'
      | 'signature'
      | 'signer'
      | 'issuer'
      | 'certPreimage';
    destinationPath: string;
    circuitInput?: string;
    description?: string;
    checkType?: CheckType;
    dataType?: 'string' | 'integer' | 'array' | 'object';
    defaultValue?: any;
    expectedValue?: any;
    minValue?: number;
    maxValue?: number;
    merkleTreeInputsPath?: string[];
    expectedHashPath?: string;
    messagePath?: string[];
  }[];
};
