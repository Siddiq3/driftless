const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configureRelease } = require('../plugins/withAndroidRelease.cjs');
test('release has no debug fallback, preserves debug builds and is idempotent across prebuilds', () => {
  const input =
    'android { signingConfigs { debug {} } buildTypes { debug { signingConfig signingConfigs.debug } release { signingConfig signingConfigs.debug } } }';
  const output = configureRelease(input);
  assert.match(output, /debug \{ signingConfig signingConfigs.debug \}/);
  assert.match(output, /release \{ signingConfig = null/);
  assert.match(
    output,
    /buildTypes.release.signingConfig = scrollsnoozeSigned \? signingConfigs.upload : null/,
  );
  assert.match(output, /throw new GradleException/);
  assert.match(output, /SCROLLSNOOZE_UPLOAD_STORE_PASSWORD/);
  assert.equal(configureRelease(output), output);
});
