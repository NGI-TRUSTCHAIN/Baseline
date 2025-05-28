import * as x509 from '@peculiar/x509';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as AdmZip from 'adm-zip';
import * as crypto from 'crypto';

export const parseCertificate = (certificate: object): x509.X509Certificate => {
  const certBase64 =
    certificate?.['asic:XAdESSignatures']?.['ds:Signature']?.['ds:KeyInfo']?.[
      'ds:X509Data'
    ]?.['ds:X509Certificate'];

  const certBuffer = Buffer.from(certBase64.replace(/\s+/g, ''), 'base64');
  const cert = new x509.X509Certificate(certBuffer);
  return cert;
};

export const parseXML = (xml: string): object => {
  const parser = new XMLParser({
    ignoreAttributes: false, // Required to keep `@_Algorithm`
    attributeNamePrefix: '@_', // Default is '@_', needed to access attributes
  });
  const parsedXML = parser.parse(xml);
  return parsedXML;
};

export const validateCertificate = (certificate: x509.X509Certificate) => {
  return certificate.verify({ publicKey: certificate.publicKey });
};

export const extractXML = (
  asiceFilePath: string,
  targetFilePath: string,
  outputFilePath: string,
) => {
  // Load the ASiC-E container (ZIP archive)
  const zip = new AdmZip(asiceFilePath);

  // Extract the XML content
  const entry = zip.getEntry(targetFilePath);

  if (entry) {
    const xmlContent = entry.getData().toString('utf8');

    // Optionally write to disk
    fs.writeFileSync(outputFilePath, xmlContent);
  } else {
    console.error(`File ${targetFilePath} not found in archive.`);
  }
};

export const getSigningTime = (parsedXML: object): string | null => {
  try {
    return parsedXML['asic:XAdESSignatures']['ds:Signature']['ds:Object'][
      'xades:QualifyingProperties'
    ]['xades:SignedProperties']['xades:SignedSignatureProperties'][
      'xades:SigningTime'
    ];
  } catch (err) {
    console.warn('Signing time not found in expected location.');
    return null;
  }
};

export const getCertDigestInfo = (
  parsedXML: object,
): { algorithm: string; value: string } => {
  const certDigest =
    parsedXML['asic:XAdESSignatures']['ds:Signature']['ds:Object'][
      'xades:QualifyingProperties'
    ]['xades:SignedProperties']['xades:SignedSignatureProperties'][
      'xades:SigningCertificate'
    ]['xades:Cert']['xades:CertDigest'];
  const digestMethod = certDigest['ds:DigestMethod']['@_Algorithm'];
  const digestValue = certDigest['ds:DigestValue'];
  return { algorithm: digestMethod, value: digestValue };
};

export const verifyCertDigest = (
  cert: x509.X509Certificate,
  digestInfo: { algorithm: string; value: string },
): boolean => {
  const algorithmMap: Record<string, string> = {
    'http://www.w3.org/2000/09/xmldsig#sha1': 'sha1',
    'http://www.w3.org/2001/04/xmlenc#sha256': 'sha256',
    'http://www.w3.org/2001/04/xmlenc#sha512': 'sha512',
  };

  const hashAlg = algorithmMap[digestInfo.algorithm];
  if (!hashAlg) throw new Error('Unsupported digest algorithm');

  const derBuffer = Buffer.from(cert.rawData);
  const hash = crypto.createHash(hashAlg).update(derBuffer).digest('base64');

  return hash === digestInfo.value;
};

export const getIssuerSerialInfo = (
  parsedXML: object,
): { issuerName: string; serialNumber: string } => {
  const issuerSerial =
    parsedXML['asic:XAdESSignatures']['ds:Signature']['ds:Object'][
      'xades:QualifyingProperties'
    ]['xades:SignedProperties']['xades:SignedSignatureProperties'][
      'xades:SigningCertificate'
    ]['xades:Cert']['xades:IssuerSerial'];

  return {
    issuerName: issuerSerial['ds:X509IssuerName'],
    serialNumber: issuerSerial['ds:X509SerialNumber'],
  };
};

export const parseName = (dn: string): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  const parts = dn
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => part.trim());

  for (const part of parts) {
    const [key, ...valParts] = part.split('=');
    const value = valParts.join('=').trim();
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(value);
  }

  return result;
};
