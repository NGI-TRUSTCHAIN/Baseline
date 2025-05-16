// tls-cert-info.js

const tls = require('tls');
const crypto = require('crypto');

const url = new URL('https://efaktura.mfin.gov.rs');
const host = url.hostname;
const port = url.port || 443;

function getTlsFingerprint(host, port) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host, // required for SNI
        rejectUnauthorized: false, // allow self-signed certs, if needed
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        if (!cert || !cert.raw) {
          reject(new Error('No certificate available'));
          return;
        }

        const fingerprint = crypto.createHash('sha256').update(cert.raw).digest('hex');
        const formatted = fingerprint.match(/.{1,2}/g).join(':');

        console.log('🔐 TLS Certificate Info for:', host);
        console.log('----------------------------------------');
        console.log('Subject:', cert.subject.CN);
        console.log('Issuer:', cert.issuer.CN);
        console.log('Valid From:', cert.valid_from);
        console.log('Valid To:', cert.valid_to);
        console.log('SHA-256 Fingerprint:', formatted);
        console.log('----------------------------------------');

        resolve({
          subject: cert.subject,
          issuer: cert.issuer,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          fingerprint_sha256: formatted,
        });

        socket.end();
      }
    );

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

// Run the script
getTlsFingerprint(host, port)
  .then(() => console.log('✅ Done'))
  .catch((err) => console.error('❌ Error:', err.message));
