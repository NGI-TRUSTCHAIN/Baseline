import { Injectable } from '@nestjs/common';
import * as x509 from '@peculiar/x509';
import {
  base64ToHash,
  buffer2bitsMSB,
  generateMerkleProofInputs,
  generateHashInputs,
  generateSignatureInputs,
} from '../snarkjs/utils/computePublicInputs';
import { CircuitInputsParserService } from './circuitInputParser.service';
import { PayloadFormatType } from '../../../../workgroup/worksteps/models/workstep';

@Injectable()
export class GeneralCircuitInputsParserService extends CircuitInputsParserService {
  public async applyGeneralMappingToTxPayload(
    payload: string,
    payloadType: PayloadFormatType,
    cim: GeneralCircuitInputsMapping,
  ) {
    const result: Record<string, any> = {};

    const fullParsedPayload =
      payloadType === PayloadFormatType.JSON
        ? JSON.parse(payload)
        : await this.parseXMLToFlat(payload);

    let parsedPayload = {};

    let extractedMappings: GeneralCircuitInputMapping[] = [];
    if (cim.extractions && cim.extractions.length > 0) {
      ({ parsedPayload, extractedMappings } = this.executeExtractions(
        payloadType,
        fullParsedPayload,
        cim.extractions,
        parsedPayload,
      ));

      cim.mapping = cim.mapping.concat(extractedMappings);
    }

    for (const mapping of cim.mapping) {
      const value =
        this.getPayloadValueByPath(parsedPayload, mapping.payloadJsonPath) ??
        mapping.defaultValue;

      if (mapping.circuitInput) {
        switch (mapping.checkType) {
          case 'isEqual':
            result[`${mapping.circuitInput}Value`] = value;
            mapping.expectedValue !== undefined &&
              (result[`${mapping.circuitInput}Expected`] =
                mapping.expectedValue);
            break;

          case 'isInRange':
            result[`${mapping.circuitInput}Value`] = value;
            mapping.minValue !== undefined &&
              (result[`${mapping.circuitInput}Min`] = mapping.minValue);
            mapping.maxValue !== undefined &&
              (result[`${mapping.circuitInput}Max`] = mapping.maxValue);
            break;
          case 'merkleProof':
            const allLeaves = mapping.merkleTreeInputsPath?.map((path) =>
              String(this.getPayloadValueByPath(parsedPayload, path)),
            );

            if ((allLeaves?.length ?? 0) > 0) {
              const {
                merkleProofLeaf,
                merkleProofRoot,
                merkleProofPathElement,
                merkleProofPathIndex,
              } = generateMerkleProofInputs(value, allLeaves!);
              result[`${mapping.circuitInput}Leaf`] = merkleProofLeaf;
              result[`${mapping.circuitInput}Root`] = merkleProofRoot;
              result[`${mapping.circuitInput}PathElement`] =
                merkleProofPathElement;
              result[`${mapping.circuitInput}PathIndex`] = merkleProofPathIndex;
            }
            break;
          case 'hashCheck':
            const { preimage, expectedHash } = await generateHashInputs(value);
            result[`${mapping.circuitInput}Preimage`] = preimage;

            if (mapping.expectedHashPath !== undefined) {
              const expectedHashPreimage = this.getPayloadValueByPath(
                parsedPayload,
                mapping.expectedHashPath,
              );
              const expectedHashHex = Buffer.from(
                base64ToHash(expectedHashPreimage),
                'hex',
              );
              result[`${mapping.circuitInput}ExpectedHash`] =
                buffer2bitsMSB(expectedHashHex);
            } else {
              result[`${mapping.circuitInput}ExpectedHash`] = expectedHash;
            }
            break;
          case 'signatureCheck':
            const { messageBits, r8Bits, sBits, aBits } =
              await generateSignatureInputs(value);
            result[`${mapping.circuitInput}MessageBits`] = messageBits;
            result[`${mapping.circuitInput}R8Bits`] = r8Bits;
            result[`${mapping.circuitInput}SBits`] = sBits;
            result[`${mapping.circuitInput}ABits`] = aBits;
            break;
          default:
            result[mapping.circuitInput] = value;
            break;
        }
      }
    }
    return result;
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

      if (typeof certBase64 !== 'string') return matches; // handle missing certBase64

      const certBuffer = Buffer.from(certBase64.replace(/\s+/g, ''), 'base64');
      const cert = new x509.X509Certificate(certBuffer);

      const certInternalKey = targetKey.startsWith(certKey + '.')
        ? targetKey.substring(certKey.length + 1)
        : null;

      const extractedValue = this.parseX509Certificate(cert, certInternalKey!);
      matches.push(extractedValue);
      return matches;
    } else {
      // Regular object traversal
      matches.push(this.searchRecursively(obj, targetKey)[0]);
    }

    return matches;
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

  private executeExtractions(
    payloadType: PayloadFormatType,
    fullParsedPayload: any,
    extractions: GeneralCircuitInputExtraction[],
    cleanParsedPayload: any,
  ) {
    const extractedMappings: GeneralCircuitInputMapping[] = [];

    for (const extraction of extractions!) {
      const extractedField = this.extractMappings(
        payloadType,
        fullParsedPayload,
        extraction.field,
        [],
        extraction.extractionParam,
      )[0];

      // Write only to cleanParsedPayload (NOT fullParsedPayload)
      this.setPayloadValueByPath(
        cleanParsedPayload,
        extraction.destinationPath,
        extractedField,
      );

      if (extraction.circuitInput) {
        const newCircuitMapping: GeneralCircuitInputMapping =
          this.createCircuitInputMapping(extraction);
        extractedMappings.push(newCircuitMapping);
      }
    }

    return { parsedPayload: cleanParsedPayload, extractedMappings };
  }

  private parseX509Certificate(
    certificate: x509.X509Certificate,
    key: string,
  ): string {
    if (!key.includes('.')) {
      return certificate[key] ?? null;
    }

    // Split the key into parts
    const [topKey, ...subKeys] = key.split('.');

    const topValue = certificate[topKey];

    // Convert string like "C=RS, CN=XYZ" to key-value pairs
    const parsedMap = Object.fromEntries(
      topValue.split(',').map((pair) => {
        const [k, v] = pair.trim().split('=');
        return [k.trim(), v?.trim()];
      }),
    );

    // Use the first subKey to get value
    const result = parsedMap[subKeys[0]] ?? null;
    return result;
  }

  private createCircuitInputMapping(dataToExtract): GeneralCircuitInputMapping {
    return {
      circuitInput: dataToExtract.circuitInput,
      description: dataToExtract.description,
      payloadJsonPath: dataToExtract.destinationPath,
      dataType: dataToExtract.dataType,
      checkType: dataToExtract.checkType,
      ...(dataToExtract.defaultValue !== undefined && {
        defaultValue: dataToExtract.defaultValue,
      }),
      ...(dataToExtract.expectedValue !== undefined && {
        expectedValue: dataToExtract.expectedValue,
      }),
      ...(dataToExtract.minValue !== undefined && {
        minValue: dataToExtract.minValue,
      }),
      ...(dataToExtract.maxValue !== undefined && {
        maxValue: dataToExtract.maxValue,
      }),
      ...(dataToExtract.merkleTreeInputsPath && {
        merkleTreeInputsPath: dataToExtract.merkleTreeInputsPath,
      }),
      ...(dataToExtract.expectedHashPath && {
        expectedHashPath: dataToExtract.expectedHashPath,
      }),
      ...(dataToExtract.messagePath && {
        messagePath: dataToExtract.messagePath,
      }),
    };
  }

  private searchRecursively(obj: any, targetKey: string): any[] {
    const matches: any[] = [];

    function recursiveSearch(current: any) {
      if (typeof current !== 'object' || current === null) return;

      if (current.hasOwnProperty(targetKey)) {
        matches.push(current[targetKey]);
      }

      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          recursiveSearch(current[key]);
        }
      }

      // If it's an array, iterate through items too
      if (Array.isArray(current)) {
        for (const item of current) {
          recursiveSearch(item);
        }
      }
    }

    recursiveSearch(obj);
    return matches;
  }
}
