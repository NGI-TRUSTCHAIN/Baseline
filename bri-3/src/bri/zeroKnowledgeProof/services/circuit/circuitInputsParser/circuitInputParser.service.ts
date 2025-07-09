import { Injectable } from '@nestjs/common';
import { PayloadFormatType } from '../../../../workgroup/worksteps/models/workstep';
import * as xml2js from 'xml2js';
import { LoggingService } from '../../../../../shared/logging/logging.service';
import { UnifiedCircuitInputsMapping, UnifiedCircuitInputMapping, convertLegacySchemaToUnified, convertGeneralSchemaToUnified, detectSchemaType } from './unifiedCircuitInputsMapping';

@Injectable()
export class CircuitInputsParserService {
  constructor(private readonly logger: LoggingService) {}

  public validateCircuitInputTranslationSchema(schema: string): string {
    try {
      const parsedData: CircuitInputsMapping = JSON.parse(schema);

      if (!parsedData.mapping || !Array.isArray(parsedData.mapping)) {
        return `Missing mapping array`;
      }

      for (const mapping of parsedData.mapping) {
        if (typeof mapping.circuitInput !== 'string') {
          return `${mapping.circuitInput} not of type string`;
        }

        if (typeof mapping.description !== 'string') {
          return `${mapping.description} not of type string`;
        }

        if (typeof mapping.payloadJsonPath !== 'string') {
          return `${mapping.payloadJsonPath} not of type string`;
        }

        if (typeof mapping.dataType !== 'string') {
          return `${mapping.dataType} not of type string`;
        }

        if (mapping.dataType === 'array') {
          if (!mapping.arrayType || typeof mapping.arrayType !== 'string') {
            return `arrayType not defined properly for ${mapping.circuitInput}`;
          }
        }

        if (
          mapping.defaultValue &&
          typeof mapping.defaultValue !== mapping.dataType
        ) {
          return `defaultValue not of type ${mapping.dataType} for ${mapping.circuitInput}`;
        }
      }

      return '';
    } catch (error) {
      return error.message;
    }
  }

  public async applyMappingToTxPayload(
    payload: string,
    payloadType: PayloadFormatType,
    cim: CircuitInputsMapping,
  ) {
    const result: any = {};

    try {
      const parsedPayload =
        payloadType === PayloadFormatType.JSON
          ? JSON.parse(payload)
          : await this.parseXMLToFlat(payload);

      for (const mapping of cim.mapping) {
        const value = this.getPayloadValueByPath(
          parsedPayload,
          mapping.payloadJsonPath,
        );

        if (value === undefined && mapping.defaultValue === undefined) {
          this.logger.logError(
            `Missing value and default value for mapping ${cim.mapping} while mapping circuit inputs for payload ${payload}`,
          );
          return null;
        }

        switch (mapping.dataType) {
          case 'string':
            result[mapping.circuitInput] = this.calculateStringCharCodeSum(
              value || mapping.defaultValue,
            );
            break;

          case 'integer':
            result[mapping.circuitInput] =
              value !== undefined
                ? parseInt(value.toString(), 10)
                : mapping.defaultValue;
            break;
            break;

          case 'array':
            if (mapping.arrayType === 'string') {
              result[mapping.circuitInput] = value
                ? value.map((val) => this.calculateStringCharCodeSum(val))
                : mapping.defaultValue.map((val) =>
                    this.calculateStringCharCodeSum(val),
                  );
            }

            if (mapping.arrayType === 'integer') {
              result[mapping.circuitInput] = value ?? mapping.defaultValue;
            }

            if (mapping.arrayType === 'object') {
              if (mapping.arrayItemFieldName && mapping.arrayItemFieldType) {
                result[mapping.circuitInput] = value
                  ? value.map((item) => {
                      const fieldValue = item[mapping.arrayItemFieldName!];
                      if (mapping.arrayItemFieldType === 'integer') {
                        return parseInt(fieldValue, 10);
                      } else if (mapping.arrayItemFieldType === 'string') {
                        return this.calculateStringCharCodeSum(fieldValue);
                      }
                      return fieldValue;
                    })
                  : mapping.defaultValue;
              } else {
                this.logger.logError(
                  `Missing arrayItemFieldName or arrayItemFieldType for object array mapping ${mapping.circuitInput}`,
                );
                return null;
              }
            }
            break;
          default:
            this.logger.logError(
              `Unknown datatype '${mapping.dataType}' while mapping circuit inputs for payload ${payload}`,
            );
            return null;
        }
      }
    } catch (error) {
      this.logger.logError(
        `Error '${error}' while mapping circuit inputs for payload ${payload}`,
      );
      return null;
    }

    return result;
  }

  public async parseXMLToFlat(xmlPayload: string): Promise<any> {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        ignoreAttrs: false,
      });
      const parsed = await parser.parseStringPromise(xmlPayload);

      // Convert the nested XML structure to a flat structure
      return this.flattenXMLObject(parsed.root || parsed);
    } catch (error) {
      this.logger.logError(`Error parsing XML: ${error.message}`);
      throw error;
    }
  }

  protected flattenXMLObject(obj: any, prefix = ''): any {
    const flattened: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // Recursively flatten nested objects
          Object.assign(flattened, this.flattenXMLObject(value, newKey));
        } else {
          // Store primitive values and arrays directly
          flattened[newKey] = value;
        }
      }
    }

    return flattened;
  }

  protected getPayloadValueByPath(json: any, path: string) {
    const parts = path.split('.');
    let currentValue = json;

    for (const part of parts) {
      if (currentValue[part] === undefined) {
        return undefined;
      }
      currentValue = currentValue[part];
    }

    return currentValue;
  }

  private calculateStringCharCodeSum(text: string): number {
    let sum = 0;

    for (let i = 0; i < text.length; i++) {
      sum += text.charCodeAt(i);
    }

    return sum;
  }

  public async applyUnifiedMappingToTxPayload(
    payload: string,
    payloadType: PayloadFormatType,
    schema: any,
  ): Promise<Record<string, any> | null> {
    try {
      // Convert schema to unified format
      const schemaType = detectSchemaType(schema);
      const unifiedSchema = schemaType === 'general' 
        ? convertGeneralSchemaToUnified(schema)
        : convertLegacySchemaToUnified(schema);

      // Parse payload
      const parsedPayload = payloadType === PayloadFormatType.JSON
        ? JSON.parse(payload)
        : await this.parseXMLToFlat(payload);

      // Process unified mappings
      return await this.processUnifiedMappings(parsedPayload, unifiedSchema, payloadType);
    } catch (error) {
      this.logger.logError(
        `Error while applying unified mapping to payload: ${error.message}`,
      );
      return null;
    }
  }

  private async processUnifiedMappings(
    parsedPayload: any,
    schema: UnifiedCircuitInputsMapping,
    payloadType: PayloadFormatType,
  ): Promise<Record<string, any> | null> {
    const result: Record<string, any> = {};

    for (const mapping of schema.mapping) {
      // Handle extraction if needed
      if (mapping.extractionField) {
        const extractedValue = await this.handleExtraction(
          parsedPayload,
          mapping,
          payloadType,
        );
        if (extractedValue !== null) {
          this.setPayloadValueByPath(parsedPayload, mapping.payloadJsonPath, extractedValue);
        }
      }

      // Get value from payload
      const value = this.getPayloadValueByPath(parsedPayload, mapping.payloadJsonPath) ?? mapping.defaultValue;

      if (value === undefined && mapping.defaultValue === undefined) {
        this.logger.logError(
          `Missing value and default value for mapping ${mapping.payloadJsonPath}`,
        );
        return null;
      }

      // Process mapping based on check type and data type
      if (mapping.circuitInput) {
        await this.processCircuitInputMapping(result, mapping, value);
      }
    }

    return result;
  }

  protected async handleExtraction(
    parsedPayload: any,
    mapping: UnifiedCircuitInputMapping,
    payloadType: PayloadFormatType,
  ): Promise<any> {
    if (!mapping.extractionField) {
      return null;
    }

    // Handle x509 extraction
    if (mapping.extractionParam === 'x509') {
      return this.handleX509Extraction(parsedPayload, mapping.extractionField);
    }

    // Handle regular extraction
    return this.extractValueByPath(parsedPayload, mapping.extractionField);
  }

  private handleX509Extraction(parsedPayload: any, field: string): any {
    // This is a simplified version - for full X509 support, 
    // we would need to import the x509 logic from GeneralCircuitInputsParserService
    return this.extractValueByPath(parsedPayload, field);
  }

  private extractValueByPath(obj: any, path: string): any {
    return this.getPayloadValueByPath(obj, path);
  }

  protected async processCircuitInputMapping(
    result: Record<string, any>,
    mapping: UnifiedCircuitInputMapping,
    value: any,
  ): Promise<void> {
    const circuitInput = mapping.circuitInput!;

    // Handle different check types
    switch (mapping.checkType) {
      case 'isEqual':
        result[`${circuitInput}Value`] = value;
        if (mapping.expectedValue !== undefined) {
          result[`${circuitInput}Expected`] = mapping.expectedValue;
        }
        break;

      case 'isInRange':
        result[`${circuitInput}Value`] = value;
        if (mapping.minValue !== undefined) {
          result[`${circuitInput}Min`] = mapping.minValue;
        }
        if (mapping.maxValue !== undefined) {
          result[`${circuitInput}Max`] = mapping.maxValue;
        }
        break;

      case 'merkleProof':
        // For merkle proof, we need more complex logic
        // This would require importing merkle logic from GeneralCircuitInputsParserService
        result[circuitInput] = value;
        break;

      case 'hashCheck':
        // For hash check, we need hash generation logic
        // This would require importing hash logic from GeneralCircuitInputsParserService
        result[circuitInput] = value;
        break;

      case 'signatureCheck':
        // For signature check, we need signature logic
        // This would require importing signature logic from GeneralCircuitInputsParserService
        result[circuitInput] = value;
        break;

      default:
        // Handle legacy data types
        await this.processLegacyDataType(result, mapping, value);
        break;
    }
  }

  private async processLegacyDataType(
    result: Record<string, any>,
    mapping: UnifiedCircuitInputMapping,
    value: any,
  ): Promise<void> {
    const circuitInput = mapping.circuitInput!;

    switch (mapping.dataType) {
      case 'string':
        result[circuitInput] = this.calculateStringCharCodeSum(value || mapping.defaultValue);
        break;

      case 'integer':
        result[circuitInput] = value !== undefined
          ? parseInt(value.toString(), 10)
          : mapping.defaultValue;
        break;

      case 'array':
        await this.processArrayType(result, mapping, value);
        break;

      default:
        result[circuitInput] = value;
        break;
    }
  }

  private async processArrayType(
    result: Record<string, any>,
    mapping: UnifiedCircuitInputMapping,
    value: any,
  ): Promise<void> {
    const circuitInput = mapping.circuitInput!;

    if (mapping.arrayType === 'string') {
      result[circuitInput] = value
        ? value.map((val: any) => this.calculateStringCharCodeSum(val))
        : mapping.defaultValue?.map((val: any) => this.calculateStringCharCodeSum(val));
    } else if (mapping.arrayType === 'integer') {
      result[circuitInput] = value ?? mapping.defaultValue;
    } else if (mapping.arrayType === 'object') {
      if (mapping.arrayItemFieldName && mapping.arrayItemFieldType) {
        result[circuitInput] = value
          ? value.map((item: any) => {
              const fieldValue = item[mapping.arrayItemFieldName!];
              if (mapping.arrayItemFieldType === 'integer') {
                return parseInt(fieldValue, 10);
              } else if (mapping.arrayItemFieldType === 'string') {
                return this.calculateStringCharCodeSum(fieldValue);
              }
              return fieldValue;
            })
          : mapping.defaultValue;
      } else {
        this.logger.logError(
          `Missing arrayItemFieldName or arrayItemFieldType for object array mapping ${circuitInput}`,
        );
      }
    }
  }

  protected setPayloadValueByPath(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop();

    let current = obj;
    for (const part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }

    if (last) {
      current[last] = value;
    }
  }
}
