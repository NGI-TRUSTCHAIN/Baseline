// efaktura-request-with-tls.js

const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

function httpsRequestWithCertInfo(targetUrl, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      servername: url.hostname,
      headers,
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate(true);
      if (!cert || !cert.raw) {
        return reject(new Error('No certificate available'));
      }

      const fingerprint = crypto.createHash('sha256').update(cert.raw).digest('hex');
      const formatted = fingerprint.match(/.{1,2}/g).join(':');

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          fingerprint_sha256: formatted,
          subject: cert.subject,
          issuer: cert.issuer,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

// Request config
const targetUrl = 'https://efaktura.mfin.gov.rs/api/publicApi/sales-invoice/xml?invoiceId=<INVOICEID>';
const headers = {
  'accept': '*/*',
  'ApiKey': '<APIKEY>',
};

// Run the request
httpsRequestWithCertInfo(targetUrl, headers)
  .then((res) => {
    console.log('✅ HTTPS Request to efaktura.mfin.gov.rs Successful');
    console.log('TLS Certificate SHA-256 Fingerprint:', res.fingerprint_sha256);
    console.log('Subject:', res.subject);
    console.log('Issuer:', res.issuer);
    console.log('Valid From:', res.valid_from);
    console.log('Valid To:', res.valid_to);
    console.log('HTTP Status:', res.status);
    console.log('Body Preview:', res.body.slice(0, 500));
  })
  .catch((err) => {
    console.error('❌ Request failed:', err.message);
  });
