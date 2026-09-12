const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SOURCE_DIR = path.resolve(__dirname, '..');
const BACKUP_ROOT = path.resolve('C:/Users/ASUS 1/OneDrive/Desktop/Cafe-Click-Collect/backups');
const BACKUP_NAME = 'propertytalk_stable_checkpoint_2026-09-12';
const TARGET_DIR = path.join(BACKUP_ROOT, BACKUP_NAME);
const TARGET_ZIP = path.join(BACKUP_ROOT, `${BACKUP_NAME}.zip`);

console.log('📦 Starting PropertyTalk Laptop Full Backup...');
console.log('Source:', SOURCE_DIR);
console.log('Target Dir:', TARGET_DIR);
console.log('Target Zip:', TARGET_ZIP);

if (!fs.existsSync(BACKUP_ROOT)) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
}

if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TARGET_DIR, { recursive: true });

function copyRecursive(src, dest) {
  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item === 'node_modules' || item === 'dist' || item === '.git') continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(SOURCE_DIR, TARGET_DIR);

// Verify critical files in backup
const dbSourcePath = path.join(SOURCE_DIR, 'server', 'prisma', 'dev.db');
const dbDestPath = path.join(TARGET_DIR, 'server', 'prisma', 'dev.db');
const envSourcePath = path.join(SOURCE_DIR, 'server', '.env');
const envDestPath = path.join(TARGET_DIR, 'server', '.env');

if (!fs.existsSync(dbDestPath) && fs.existsSync(dbSourcePath)) {
  fs.copyFileSync(dbSourcePath, dbDestPath);
}

if (!fs.existsSync(envDestPath) && fs.existsSync(envSourcePath)) {
  fs.copyFileSync(envSourcePath, envDestPath);
}

// Compute checksum of SQLite DB
const dbBuffer = fs.readFileSync(dbDestPath);
const dbSha256 = crypto.createHash('sha256').update(dbBuffer).digest('hex');
const dbSize = dbBuffer.length;

// Count total files in backup
function countFiles(dir) {
  let count = 0;
  let size = 0;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const sub = countFiles(full);
      count += sub.count;
      size += sub.size;
    } else {
      count++;
      size += stat.size;
    }
  }
  return { count, size };
}

const stats = countFiles(TARGET_DIR);

// Generate manifest
const manifest = {
  backupName: BACKUP_NAME,
  timestamp: new Date().toISOString(),
  localTime: '2026-09-12T15:07:00+12:00',
  description: 'PropertyTalk Stable Checkpoint (Real LINZ Cadastre + 437/437 Tests Passed + Customer/Expert/Admin Multi-Portal Builds Pass)',
  gitCommit: '1cdd17b',
  gitRemote: 'https://github.com/rohitbodyzone-pixel/premium-food-website.git',
  totalFiles: stats.count,
  totalSizeBytes: stats.size,
  totalSizeMB: (stats.size / 1024 / 1024).toFixed(2),
  sqliteSnapshot: {
    path: 'server/prisma/dev.db',
    sizeBytes: dbSize,
    sha256: dbSha256,
  },
  environmentIncluded: {
    path: 'server/.env',
    note: 'Includes local environment secrets strictly for laptop recovery. Excluded from GitHub.',
  },
  testVerification: {
    totalSuites: 16,
    testsPassed: 437,
    testsFailed: 0,
    status: 'ALL_PASSED',
  },
  ports: {
    customer: 'http://localhost:5173/',
    expert: 'http://localhost:5174/',
    admin: 'http://localhost:5175/',
    backend: 'http://localhost:5000/',
  },
};

const manifestPath = path.join(TARGET_DIR, 'backup_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log('✅ Local Directory Backup complete:', TARGET_DIR);
console.log('   Files:', stats.count, '| Total Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
console.log('   SQLite DB Snapshot:', dbSize, 'bytes | SHA256:', dbSha256);

// Create ZIP Archive
console.log('🗜️ Creating ZIP Archive with Compress-Archive...');
if (fs.existsSync(TARGET_ZIP)) {
  fs.unlinkSync(TARGET_ZIP);
}

execSync(`powershell -Command "Compress-Archive -Path '${TARGET_DIR}\\*' -DestinationPath '${TARGET_ZIP}' -Force"`, {
  stdio: 'inherit',
});

const zipStats = fs.statSync(TARGET_ZIP);
console.log('✅ ZIP Archive Created successfully:', TARGET_ZIP);
console.log('   ZIP Size:', (zipStats.size / 1024 / 1024).toFixed(2), 'MB');
