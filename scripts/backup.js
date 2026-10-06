/**
 * Wick Studio - Settings & Data Backup Utility
 * Creates timestamped backups of settings.json and the dist/ source tree.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetDir = path.join(backupDir, `backup-${timestamp}`);
const sources = [
    { file: 'settings.json', dest: 'settings.json' },
    { file: 'dist', dest: 'dist' }
];
const excludedDirs = ['node_modules', 'logs', 'cache', 'backups'];

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (entry.isDirectory() && excludedDirs.includes(entry.name)) {
            continue;
        }
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

let created = false;
for (const source of sources) {
    const srcPath = path.join(rootDir, source.file);
    if (!fs.existsSync(srcPath)) {
        console.warn(`⚠ Skipping missing path: ${source.file}`);
        continue;
    }
    if (!created) {
        fs.mkdirSync(targetDir, { recursive: true });
        created = true;
    }
    const destPath = path.join(targetDir, source.dest);
    if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
    } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
    }
    console.log(`✓ Backed up ${source.file}`);
}

if (!created) {
    console.error('✗ Nothing to back up. Expected settings.json and/or dist/.');
    process.exit(1);
}

console.log(`✓ Backup created at ${path.relative(rootDir, targetDir)}`);