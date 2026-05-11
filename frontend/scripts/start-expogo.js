#!/usr/bin/env node
/**
 * start-expogo.js — Startet Expo im Expo-Go-Kompatibilitätsmodus.
 *
 * Setzt EXPO_GO_MODE=1 (wird in app.config.js gelesen) und ruft `expo start` auf.
 * Plattform-unabhängig (Windows/Mac/Linux), keine cross-env Dependency nötig.
 *
 * Verwendung (via package.json):
 *   npm run start:expogo        # mit --tunnel (funktioniert über Mobilfunk)
 *   npm run start:expogo:lan    # mit --lan (gleiches WLAN, schneller)
 */
const { spawn } = require('child_process');
const path = require('path');

// Extra-Args nach script-Namen durchreichen
const args = process.argv.slice(2);

// Default-Flags wenn nichts übergeben
if (args.length === 0) {
  args.push('--tunnel', '--clear');
} else if (!args.includes('--clear')) {
  // immer cache löschen damit app.config.js neu evaluiert wird
  args.push('--clear');
}

const env = {
  ...process.env,
  EXPO_GO_MODE: '1',
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🟢 Expo Go Mode — Sentry deaktiviert, New Architecture aus');
console.log('   Auf dem Handy: Expo Go App installieren und QR scannen');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

// Auf Windows muss expo via .cmd aufgerufen werden
const isWindows = process.platform === 'win32';
const expoCmd = isWindows ? 'expo.cmd' : 'expo';

// Falls expo nicht global, nutze npx
const cmd = isWindows ? 'npx.cmd' : 'npx';
const finalArgs = ['expo', 'start', ...args];

const child = spawn(cmd, finalArgs, {
  env,
  stdio: 'inherit',
  shell: isWindows,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('FEHLER beim Starten von expo:', err.message);
  process.exit(1);
});
