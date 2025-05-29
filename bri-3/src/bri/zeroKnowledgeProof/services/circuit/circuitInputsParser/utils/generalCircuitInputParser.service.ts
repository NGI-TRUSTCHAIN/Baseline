import { Injectable } from '@nestjs/common';
import { LoggingService } from '../../../../../../shared/logging/logging.service';
import * as fs from 'fs';
import {
  extractXML,
  parseXML,
  parseCertificate,
  getSigningTime,
  getCertDigestInfo,
  parseName,
  parseSignature,
  findAllKeyMatches,
} from './certificateParser';
import {
  base64ToHash,
  buffer2bitsMSB,
  generateMerkleProofInputs,
  generateHashInputs,
  generateSignatureInputs,
} from '../../snarkjs/utils/computePublicInputs';
import { X509Certificate } from '@peculiar/x509';
import * as path from 'path';
import { find, map } from 'rxjs';
import e from 'express';

@Injectable()
export class GeneralCircuitInputsParserService {
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

  //Have granular worksteps!
  public async applyMappingToJSONPayload(
    payload: string,
    cim: GeneralCircuitInputsMapping,
  ) {
    const result: Record<string, any> = {};
    const jsonPayload = JSON.parse(payload);

    if (cim.extractions && cim.extractions.length > 0) {
      for (const extraction of cim.extractions) {
        const value = this.getJsonValueByPath(
          jsonPayload,
          extraction.payloadJsonPath,
        );

        switch (extraction.inputType) {
          case 'asice':
            let ASICE_FILE_PATH;
            if (value.startsWith('../')) {
              ASICE_FILE_PATH = path.resolve(__dirname, value);
            } else {
              ASICE_FILE_PATH = value;
            }

            const EXTRACTION_XML_PATH =
              extraction.dataToExtract[0].extractionParam;

            let OUTPUT_FILE_PATH;
            if (extraction.dataToExtract[0].destinationPath.startsWith('../')) {
              OUTPUT_FILE_PATH = path.join(
                __dirname,
                extraction.dataToExtract[0].destinationPath,
              );
            } else {
              OUTPUT_FILE_PATH = extraction.dataToExtract[0].destinationPath;
            }
            extractXML(ASICE_FILE_PATH, EXTRACTION_XML_PATH!, OUTPUT_FILE_PATH);

            this.setJsonValueByPath(
              jsonPayload,
              extraction.dataToExtract[0].field,
              extraction.dataToExtract[0].destinationPath,
            );
            break;
          case 'xml':
            let xmlContent: string;
            //if value is a xml tag
            if (!value.startsWith('<?xml')) {
              let XML_FILE_PATH;
              //if value starts with ../
              if (value.startsWith('../')) {
                XML_FILE_PATH = path.join(__dirname, value);
              } else {
                XML_FILE_PATH = value;
              }
              xmlContent = fs.readFileSync(XML_FILE_PATH, 'utf8');
            } else {
              xmlContent = value;
            }
            const parsedXML = parseXML(xmlContent);

            let extractedXMLField;
            extraction.dataToExtract.forEach((data) => {
              if (data.field !== undefined && data.field !== null) {
                switch (data.field) {
                  case 'signingTime':
                    extractedXMLField = String(getSigningTime(parsedXML));
                    break;
                  case 'signedHash':
                    const digestInfo = getCertDigestInfo(parsedXML); //Destination path of signedHash == ExpectedHashPath of preimage
                    const certificateHashHex = Buffer.from(
                      base64ToHash(digestInfo.value),
                      'hex',
                    );
                    extractedXMLField = buffer2bitsMSB(certificateHashHex);
                    break;
                  case 'signedCertificate':
                    extractedXMLField = parseCertificate(parsedXML);
                    break;
                  case 'signature':
                    extractedXMLField = parseSignature(parsedXML);
                    break;
                  default:
                    extractedXMLField = findAllKeyMatches(
                      parsedXML,
                      data.field,
                    )[0];
                    break;
                }

                this.setJsonValueByPath(
                  jsonPayload,
                  data.destinationPath,
                  extractedXMLField,
                );

                if (data.circuitInput) {
                  const newCircuitMapping: GeneralCircuitInputMapping =
                    this.createCircuitInputMapping(data);
                  cim.mapping.push(newCircuitMapping);
                }
              }
            });
            break;
          case 'x509':
            const cert = value;
            let extractedCertField;
            for (const data of extraction.dataToExtract) {
              if (data.field !== undefined && data.field !== null) {
                switch (data.field) {
                  case 'signerName':
                    extractedCertField = parseName(cert.subject)['CN'][0];
                    break;
                  case 'signerID':
                    extractedCertField = parseName(cert.subject)[
                      'serialNumber'
                    ];
                    console.log('Signer ID:', extractedCertField);
                    break;
                  case 'issuerName':
                    extractedCertField = parseName(cert.issuer)['CN'][0];
                    break;
                  case 'certPreimage':
                    extractedCertField = cert.rawData;
                    break;
                  default:
                    extractedCertField = findAllKeyMatches(cert, data.field)[0];
                    break;
                }

                this.setJsonValueByPath(
                  jsonPayload,
                  data.destinationPath,
                  extractedCertField,
                );
                if (data.circuitInput) {
                  const newCircuitMapping: GeneralCircuitInputMapping =
                    this.createCircuitInputMapping(data);
                  cim.mapping.push(newCircuitMapping);
                }
              }
            }
            break;
        }
      }
    }

    for (const mapping of cim.mapping) {
      const value =
        this.getJsonValueByPath(jsonPayload, mapping.payloadJsonPath) ??
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
              String(this.getJsonValueByPath(jsonPayload, path)),
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
            result[`${mapping.circuitInput}ExpectedHash`] =
              mapping.expectedHashPath !== undefined
                ? this.getJsonValueByPath(jsonPayload, mapping.expectedHashPath)
                : expectedHash;
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

  private getJsonValueByPath(json: any, path: string) {
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

  private setJsonValueByPath(obj: any, path: string, value: any): void {
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
}
