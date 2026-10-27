import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unsigned = process.argv.includes('--unsigned-review');
process.env.NODE_ENV ??= 'production';
const keys = [
  'SCROLLSNOOZE_UPLOAD_STORE_FILE',
  'SCROLLSNOOZE_UPLOAD_KEY_ALIAS',
  'SCROLLSNOOZE_UPLOAD_STORE_PASSWORD',
  'SCROLLSNOOZE_UPLOAD_KEY_PASSWORD',
];
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!unsigned) {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    console.error(`Missing signing settings: ${missing.join(', ')}. See docs/ANDROID_RELEASE.md.`);
    process.exit(1);
  }
  if (
    !path.isAbsolute(process.env.SCROLLSNOOZE_UPLOAD_STORE_FILE) ||
    !existsSync(process.env.SCROLLSNOOZE_UPLOAD_STORE_FILE)
  ) {
    console.error(
      'SCROLLSNOOZE_UPLOAD_STORE_FILE must point to an existing absolute keystore path.',
    );
    process.exit(1);
  }
}
// Prebuild reads .env without printing values and reproduces signing/version configuration.
run(process.execPath, [
  'node_modules/expo/bin/cli',
  'prebuild',
  '--platform',
  'android',
  '--no-install',
]);
// Expo prebuild runs in a child process: load the same public environment for Gradle's Metro bundle.
const { load } = await import('@expo/env');
load(root);
const api = process.env.EXPO_PUBLIC_API_URL;
const client = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (
  !api?.startsWith('https://') ||
  !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(client ?? '')
) {
  console.error('Release requires a production HTTPS API URL and Google Web OAuth client ID.');
  process.exit(1);
}
if (unsigned) for (const key of keys) delete process.env[key];
run('./android/gradlew', [
  '-p',
  'android',
  ':app:bundleRelease',
  '--console=plain',
  ...(unsigned ? ['-Pscrollsnooze.unsignedReview=true'] : []),
]);
const source = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const directory = path.join(root, 'output/release');
mkdirSync(directory, { recursive: true });
const file = path.join(
  directory,
  `ScrollSnooze-${version}-${unsigned ? 'UNSIGNED-REVIEW' : 'upload'}.aab`,
);
copyFileSync(source, file);
const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(`${file}.sha256`, `${sha256}  ${path.basename(file)}\n`);
console.log(
  `\n${unsigned ? 'UNSIGNED REVIEW ONLY — cannot upload to Play' : 'Upload-signed bundle built; finish device/policy validation before submission'}\n${file}\nSHA-256: ${sha256}`,
);
