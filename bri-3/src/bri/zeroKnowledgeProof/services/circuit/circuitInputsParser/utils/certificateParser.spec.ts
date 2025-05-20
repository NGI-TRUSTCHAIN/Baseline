import * as path from 'path';
import * as fs from 'fs';
import {
  extractXML,
  parseXML,
  parseCertificate,
  validateCertificate,
} from './certificateParser';

const ASICE_PATH = path.resolve(
  __dirname,
  '../../../../../../shared/testing/x509Certificate/2cc4f0b7-0132-4b10-bc37-e1a0b37e6729.asice',
);
const SIGNATURE_XML_PATH = 'META-INF/signatures0.xml';
const OUTPUT_FILE_PATH = path.join(
  __dirname,
  '../../../../../../shared/testing/x509Certificate/signatures0.xml',
);

describe('ASiC-E signature XML extraction and certificate validation', () => {
  beforeAll(() => {
    extractXML(ASICE_PATH, SIGNATURE_XML_PATH, OUTPUT_FILE_PATH);
  });

  it('should extract and parse the X.509 certificate from XML file', () => {
    const xmlContent = fs.readFileSync(OUTPUT_FILE_PATH, 'utf8');
    const parsed = parseXML(xmlContent);
    const certBase64 =
      parsed?.['asic:XAdESSignatures']?.['ds:Signature']?.['ds:KeyInfo']?.[
        'ds:X509Data'
      ]?.['ds:X509Certificate'];

    expect(certBase64).toBeDefined();

    const cert = parseCertificate(certBase64);
    expect(cert.subject).toBeDefined();
    console.log('Subject:', cert.subject);
    console.log('Issuer:', cert.issuer);
  });

  it('should attempt to verify the certificate (self-signed or not)', async () => {
    const xmlContent = fs.readFileSync(OUTPUT_FILE_PATH, 'utf8');
    const parsed = parseXML(xmlContent);

    const certBase64 =
      parsed?.['asic:XAdESSignatures']?.['ds:Signature']?.['ds:KeyInfo']?.[
        'ds:X509Data'
      ]?.['ds:X509Certificate'];

    const cert = parseCertificate(certBase64);

    const isVerified = await validateCertificate(cert);
    expect(typeof isVerified).toBe('boolean');
    console.log('Certificate verified:', isVerified);
  });
});
