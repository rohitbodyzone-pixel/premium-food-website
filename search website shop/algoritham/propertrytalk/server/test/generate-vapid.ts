import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (!env.includes('VAPID_PUBLIC_KEY=')) {
  const vapid = webpush.generateVAPIDKeys();
  const block = `\n# Web Push VAPID\nVAPID_PUBLIC_KEY="${vapid.publicKey}"\nVAPID_PRIVATE_KEY="${vapid.privateKey}"\nVAPID_SUBJECT="mailto:admin@propertytalk.co.nz"\n`;
  fs.appendFileSync(envPath, block, 'utf8');
  console.log(`✓ Real VAPID keypair generated and saved to server/.env`);
  console.log(`✓ Public Key: ${vapid.publicKey.substring(0, 14)}...`);
} else {
  console.log('✓ VAPID keys are already configured in server/.env');
}
