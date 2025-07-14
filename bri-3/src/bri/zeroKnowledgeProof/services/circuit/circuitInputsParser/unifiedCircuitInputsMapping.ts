// Types are declared globally in this module context

export type CheckType =
  | 'isEqual'
  | 'isInRange'
  | 'merkleProof'
  | 'hashCheck'
  | 'signatureCheck';

export type UnifiedCircuitInputsMapping = {
  mapping: UnifiedCircuitInputMapping[];
};

export type UnifiedCircuitInputMapping = {
  // Core properties (common to both schemas)
  circuitInput?: string;
  description: string;
  payloadJsonPath: string;
  dataType: 'string' | 'integer' | 'array' | 'object';
  defaultValue?: any;
  
  // Legacy array properties (from CircuitInputsMapping)
  arrayType?: string;
  arrayItemFieldName?: string;
  arrayItemFieldType?: string;
  
  // Extraction properties (from GeneralCircuitInputExtraction)
  extractionField?: string;
  extractionParam?: string;
  
  // Check type properties (from GeneralCircuitInputMapping)
  checkType?: CheckType;
  expectedValue?: any;
  minValue?: number;
  maxValue?: number;
  isMerkleLeaf?: boolean;
  merkleTreeInputsPath?: string[];
  expectedHashPath?: string;
  messagePath?: string[];
};
