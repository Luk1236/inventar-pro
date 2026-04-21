#!/usr/bin/env node
/**
 * Bumps version in app.json and package.json
 * Usage: node scripts/bump-version.js [major|minor|patch]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const bumpType = args[0] || 'patch'; // default: patch

const appJsonPath = path.join(__dirname, '..', 'app.json');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read current versions
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = appJson.expo.version;
console.log(`Current version: ${currentVersion}`);

// Parse version
let [major, minor, patch] = currentVersion.split('.').map(Number);

// Bump version
switch (bumpType) {
  case 'major':
    major++;
    minor = 0;
    patch = 0;
    break;
  case 'minor':
    minor++;
    patch = 0;
    break;
  case 'patch':
  default:
    patch++;
    break;
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`New version: ${newVersion}`);

// Update app.json
appJson.expo.version = newVersion;
appJson.expo.android.versionCode = major * 10000 + minor * 100 + patch;

// Update package.json
packageJson.version = newVersion;

// Write files
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✓ Version bumped to ${newVersion}`);
console.log(`✓ Android versionCode: ${appJson.expo.android.versionCode}`);