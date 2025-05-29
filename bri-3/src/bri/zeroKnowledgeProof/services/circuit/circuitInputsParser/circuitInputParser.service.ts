import { Injectable } from '@nestjs/common';
import { PayloadFormatType } from '../../../../workgroup/worksteps/models/workstep';
import * as xml2js from 'xml2js';
import { LoggingService } from '../../../../../shared/logging/logging.service';

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

  private flattenXMLObject(obj: any, prefix: string = ''): any {
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

  private getPayloadValueByPath(json: any, path: string) {
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
}
