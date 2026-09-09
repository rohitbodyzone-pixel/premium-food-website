/**
 * PropertyTalk - Stripe Webhook Setup Helper
 *
 * Uses Stripe CLI to retrieve the local test webhook signing secret (--print-secret)
 * and writes STRIPE_WEBHOOK_SECRET directly into server/.env without exposing it.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execFile } from 'child_process';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey || !secretKey.startsWith('sk_test_')) {
  console.error('❌ Error: Valid STRIPE_SECRET_KEY (sk_test_...) is required in server/.env');
  process.exit(1);
}

const stripeCliPath =
  'C:\\Users\\ASUS 1\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\\stripe.exe';

console.log('Fetching local webhook signing secret via Stripe CLI...');

execFile(stripeCliPath, ['listen', '--print-secret', '--api-key', secretKey], (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Failed to retrieve webhook secret from Stripe CLI:', error.message);
    process.exit(1);
  }

  const output = (stdout || '') + (stderr || '');
  const match = output.match(/whsec_[a-zA-Z0-9]+/);

  if (!match) {
    console.error('❌ Could not parse whsec_ secret from Stripe CLI output.');
    process.exit(1);
  }

  const webhookSecret = match[0];
  console.log('✓ Successfully retrieved webhook signing secret (whsec_...)');

  // Read current .env
  let envContent = fs.readFileSync(envPath, 'utf8');

  if (envContent.includes('STRIPE_WEBHOOK_SECRET=')) {
    envContent = envContent.replace(
      /STRIPE_WEBHOOK_SECRET=.*/g,
      `STRIPE_WEBHOOK_SECRET="${webhookSecret}"`
    );
  } else {
    envContent += `\nSTRIPE_WEBHOOK_SECRET="${webhookSecret}"\n`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✓ Saved STRIPE_WEBHOOK_SECRET securely to server/.env');
});
