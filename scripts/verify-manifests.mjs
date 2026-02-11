import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, '.output');
const targets = ['chrome-mv3', 'firefox-mv3'];
const forbiddenProductionPermissions = new Set(['tabs']);
const forbiddenHostPermissions = new Set(['<all_urls>', 'http://*/*', 'https://*/*']);

function readManifest(target) {
  const manifestPath = path.join(outputDir, target, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest for ${target}: ${manifestPath}`);
  }
  return {
    manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf-8')),
  };
}

function assertNoTestActivate(target) {
  const testActivatePath = path.join(outputDir, target, 'test-activate.html');
  if (fs.existsSync(testActivatePath)) {
    throw new Error(
      `Unexpected test-activate entrypoint in production output: ${testActivatePath}`
    );
  }
}

function assertManifestContract(target, manifestPath, manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error(
      `${target} manifest_version must be 3. Found ${String(manifest.manifest_version)} in ${manifestPath}`
    );
  }

  const permissions = new Set(manifest.permissions ?? []);
  for (const permission of forbiddenProductionPermissions) {
    if (permissions.has(permission)) {
      throw new Error(
        `${target} manifest contains forbidden production permission "${permission}" in ${manifestPath}`
      );
    }
  }

  const hostPermissions = manifest.host_permissions ?? [];
  for (const permission of hostPermissions) {
    if (forbiddenHostPermissions.has(permission)) {
      throw new Error(
        `${target} manifest contains forbidden host permission "${permission}" in ${manifestPath}`
      );
    }
  }
}

function main() {
  for (const target of targets) {
    const {manifestPath, manifest} = readManifest(target);
    assertManifestContract(target, manifestPath, manifest);
    assertNoTestActivate(target);
  }

  console.log('Manifest verification passed for production outputs.');
}

main();
