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

// Utility functions to convert existing schemas to unified format
export function convertLegacySchemaToUnified(schema: CircuitInputsMapping): UnifiedCircuitInputsMapping {
  return {
    mapping: schema.mapping.map(mapping => ({
      circuitInput: mapping.circuitInput,
      description: mapping.description,
      payloadJsonPath: mapping.payloadJsonPath,
      dataType: mapping.dataType as 'string' | 'integer' | 'array' | 'object',
      defaultValue: mapping.defaultValue,
      arrayType: mapping.arrayType,
      arrayItemFieldName: mapping.arrayItemFieldName,
      arrayItemFieldType: mapping.arrayItemFieldType,
    }))
  };
}

export function convertGeneralSchemaToUnified(schema: GeneralCircuitInputsMapping): UnifiedCircuitInputsMapping {
  const unifiedMappings: UnifiedCircuitInputMapping[] = [];
  
  // First, convert existing mappings
  for (const mapping of schema.mapping) {
    unifiedMappings.push({
      circuitInput: mapping.circuitInput,
      description: mapping.description,
      payloadJsonPath: mapping.payloadJsonPath,
      dataType: mapping.dataType,
      defaultValue: mapping.defaultValue,
      checkType: mapping.checkType,
      expectedValue: mapping.expectedValue,
      minValue: mapping.minValue,
      maxValue: mapping.maxValue,
      isMerkleLeaf: mapping.isMerkleLeaf,
      merkleTreeInputsPath: mapping.merkleTreeInputsPath,
      expectedHashPath: mapping.expectedHashPath,
      messagePath: mapping.messagePath ? [mapping.messagePath] : undefined,
    });
  }
  
  // Then, convert extractions to unified mappings
  if (schema.extractions) {
    for (const extraction of schema.extractions) {
      unifiedMappings.push({
        circuitInput: extraction.circuitInput,
        description: extraction.description || '',
        payloadJsonPath: extraction.destinationPath,
        dataType: extraction.dataType || 'string',
        defaultValue: extraction.defaultValue,
        extractionField: extraction.field,
        extractionParam: extraction.extractionParam,
        checkType: extraction.checkType,
        expectedValue: extraction.expectedValue,
        minValue: extraction.minValue,
        maxValue: extraction.maxValue,
        merkleTreeInputsPath: extraction.merkleTreeInputsPath,
        expectedHashPath: extraction.expectedHashPath,
        messagePath: extraction.messagePath,
      });
    }
  }
  
  return {
    mapping: unifiedMappings
  };
}

export function detectSchemaType(schema: any): 'legacy' | 'general' {
  return 'extractions' in schema ? 'general' : 'legacy';
}