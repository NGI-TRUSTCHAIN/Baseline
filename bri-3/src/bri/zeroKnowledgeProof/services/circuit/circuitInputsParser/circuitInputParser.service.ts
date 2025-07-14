import { Injectable } from '@nestjs/common';
import { PayloadFormatType } from '../../../../workgroup/worksteps/models/workstep';
import * as xml2js from 'xml2js';
import { LoggingService } from '../../../../../shared/logging/logging.service';
import { UnifiedCircuitInputsMapping, UnifiedCircuitInputMapping } from './unifiedCircuitInputsMapping';
import * as x509 from '@peculiar/x509';
import {
  base64ToHash,
  buffer2bitsMSB,
  stringToBigInt,
  generateHashInputs,
  generateSignatureInputs,
  calculateMerkleTreeHeight,
} from '../snarkjs/utils/computePublicInputs';
import { buildMimcSponge } from 'circomlibjs';
import { MerkleTree } from 'fixed-merkle-tree';

@Injectable()
export class CircuitInputsParserService {
  private mimcSponge;
  private F;

  constructor(private readonly logger: LoggingService) {}

  public validateCircuitInputTranslationSchema(schema: string): string {
    try {
      const parsedData: UnifiedCircuitInputsMapping = JSON.parse(schema);

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

  private flattenXMLObject(obj: any, prefix = ''): any {
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

  public async applyCircuitInputMappingToTxPayload(
    payload: string,
    payloadType: PayloadFormatType,
    schema: any,
  ): Promise<Record<string, any> | null> {
    try {
      // Parse payload
      const parsedPayload = payloadType === PayloadFormatType.JSON
        ? JSON.parse(payload)
        : await this.parseXMLToFlat(payload);

      // Process unified mappings
      return await this.applyMappings(parsedPayload, schema, payloadType);
    } catch (error) {
      this.logger.logError(
        `Error while applying unified mapping to payload: ${error.message}`,
      );
      return null;
    }
  }

  private async applyMappings(
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

  private async handleExtraction(
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
    return this.extractMappings(payloadType, parsedPayload, mapping.extractionField, [], mapping.extractionParam)[0];
  }

  private handleX509Extraction(parsedPayload: any, field: string): any {
    const certKeyPrefix = 'ds:X509Certificate';
    const splitIndex = field.indexOf(certKeyPrefix) + certKeyPrefix.length;
    const certKey = field.substring(0, splitIndex);
    const certBase64 = parsedPayload[certKey];

    if (typeof certBase64 !== 'string') return null;

    const certBuffer = Buffer.from(certBase64.replace(/\s+/g, ''), 'base64');
    const cert = new x509.X509Certificate(certBuffer);

    const certInternalKey = field.startsWith(certKey + '.')
      ? field.substring(certKey.length + 1)
      : null;

    return this.parseX509Certificate(cert, certInternalKey!);
  }


  private extractMappings(
    payloadType: PayloadFormatType,
    obj: any,
    targetKey: string,
    matches: any[] = [],
    extractionParam?: string,
  ): any[] {
    if (typeof obj !== 'object' || obj === null) return matches;

    if (payloadType === PayloadFormatType.XML && extractionParam === 'x509') {
      const certKeyPrefix = 'ds:X509Certificate';
      const splitIndex =
        targetKey.indexOf(certKeyPrefix) + certKeyPrefix.length;
      const certKey = targetKey.substring(0, splitIndex);
      const certBase64 = obj[certKey];

      if (typeof certBase64 !== 'string') return matches;

      const certBuffer = Buffer.from(certBase64.replace(/\s+/g, ''), 'base64');
      const cert = new x509.X509Certificate(certBuffer);

      const certInternalKey = targetKey.startsWith(certKey + '.')
        ? targetKey.substring(certKey.length + 1)
        : null;

      const extractedValue = this.parseX509Certificate(cert, certInternalKey!);
      matches.push(extractedValue);
      return matches;
    } else {
      matches.push(this.searchRecursively(obj, targetKey, payloadType)[0]);
    }

    return matches;
  }

  private parseX509Certificate(
    certificate: x509.X509Certificate,
    key: string,
  ): string {
    if (!key.includes('.')) {
      return certificate[key] ?? null;
    }

    const [topKey, ...subKeys] = key.split('.');
    const topValue = certificate[topKey];

    const parsedMap = Object.fromEntries(
      topValue.split(',').map((pair) => {
        const [k, v] = pair.trim().split('=');
        return [k.trim(), v?.trim()];
      }),
    );

    const result = parsedMap[subKeys[0]] ?? null;
    return result;
  }

  private searchRecursively(
    obj: any,
    targetKey: string,
    payloadType: PayloadFormatType,
  ): any[] {
    const matches: any[] = [];

    function recursiveSearch(current: any, keyPath: string[]) {
      if (typeof current !== 'object' || current === null) return;

      if (keyPath.length === 1 && current.hasOwnProperty(keyPath[0])) {
        matches.push(current[keyPath[0]]);
      }

      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          const child = current[key];

          if (Array.isArray(child)) {
            for (const item of child) {
              recursiveSearch(item, keyPath);
            }
          } else if (typeof child === 'object') {
            if (
              payloadType === PayloadFormatType.JSON &&
              key === keyPath[0] &&
              keyPath.length > 1
            ) {
              recursiveSearch(child, keyPath.slice(1));
            } else {
              recursiveSearch(child, keyPath);
            }
          }
        }
      }
    }

    const keyPath =
      payloadType === 'JSON' && targetKey.includes('.')
        ? targetKey.split('.')
        : [targetKey];

    recursiveSearch(obj, keyPath);
    return matches;
  }

  public async generateMerkleProofInputs(leaf: string, tree: string[]) {
    const allLeaves = tree.map((leaf) => String(stringToBigInt(leaf)));
    const height = calculateMerkleTreeHeight(tree);
    this.mimcSponge = await buildMimcSponge();
    this.F = this.mimcSponge.F;
    const merkleTree = new MerkleTree(height, allLeaves, {
      hashFunction: this.generateMimcMerkleHash.bind(this),
    });
    const path = merkleTree.proof(String(stringToBigInt(leaf)));
    const merkleProofLeaf = String(stringToBigInt(leaf));
    const merkleProofRoot = merkleTree.root;
    const merkleProofPathElement = path.pathElements;
    const merkleProofPathIndex = path.pathIndices;

    return {
      merkleProofLeaf,
      merkleProofRoot,
      merkleProofPathElement,
      merkleProofPathIndex,
    };
  }

  private generateMimcMerkleHash(left: string, right: string) {
    const hash = this.mimcSponge.multiHash([left, right], 0, 1);
    return String(this.F.toObject(hash));
  }

  private async processCircuitInputMapping(
    result: Record<string, any>,
    mapping: UnifiedCircuitInputMapping,
    value: any,
  ): Promise<void> {
    const circuitInput = mapping.circuitInput!;

    // Handle different check types with full implementation
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
        const allLeaves = mapping.merkleTreeInputsPath?.map((path) =>
          String(this.getPayloadValueByPath(result, path)),
        );

        if ((allLeaves?.length ?? 0) > 0) {
          const {
            merkleProofLeaf,
            merkleProofRoot,
            merkleProofPathElement,
            merkleProofPathIndex,
          } = await this.generateMerkleProofInputs(value, allLeaves!);
          result[`${circuitInput}Leaf`] = merkleProofLeaf;
          result[`${circuitInput}Root`] = merkleProofRoot;
          result[`${circuitInput}PathElement`] = merkleProofPathElement;
          result[`${circuitInput}PathIndex`] = merkleProofPathIndex;
        }
        break;

      case 'hashCheck':
        const { preimage, expectedHash } = await generateHashInputs(value);
        result[`${circuitInput}Preimage`] = preimage;

        if (mapping.expectedHashPath !== undefined) {
          const expectedHashPreimage = this.getPayloadValueByPath(
            result,
            mapping.expectedHashPath,
          );
          const expectedHashHex = Buffer.from(
            base64ToHash(expectedHashPreimage),
            'hex',
          );
          result[`${circuitInput}ExpectedHash`] = buffer2bitsMSB(expectedHashHex);
        } else {
          result[`${circuitInput}ExpectedHash`] = expectedHash;
        }
        break;

      case 'signatureCheck':
        const { messageBits, r8Bits, sBits, aBits } = await generateSignatureInputs(value);
        result[`${circuitInput}MessageBits`] = messageBits;
        result[`${circuitInput}R8Bits`] = r8Bits;
        result[`${circuitInput}SBits`] = sBits;
        result[`${circuitInput}ABits`] = aBits;
        break;

      default:

        await this.processPrimitiveDataType(result, mapping, value);
        break;
    }
  }

  private async processPrimitiveDataType(
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

  private setPayloadValueByPath(obj: any, path: string, value: any): void {
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
