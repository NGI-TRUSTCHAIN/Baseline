import * as x509 from '@peculiar/x509';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as AdmZip from 'adm-zip';

export const parseCertificate = (certificate: string): x509.X509Certificate => {
  const certBuffer = Buffer.from(certificate.replace(/\s+/g, ''), 'base64');
  const cert = new x509.X509Certificate(certBuffer);
  return cert;
};

export const parseXML = (xml: string): object => {
  const parser = new XMLParser();
  const parsedXML = parser.parse(xml);
  return parsedXML;
};

export const validateCertificate = (certificate: x509.X509Certificate) => {
  return certificate.verify();
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
