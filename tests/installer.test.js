const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const installerPath = path.join(__dirname, "..", "Installer.js");
const source = fs
  .readFileSync(installerPath, "utf8")
  .replace(
    "await main();",
    `globalThis.__installerTestApi = {
      CONFIG,
      compareVersions,
      extractReleaseNotes,
      extractVersion,
      normalizeManifest,
    };`
  );
const context = {};
vm.runInNewContext(source, context, { filename: installerPath });

const resources = JSON.parse(
  JSON.stringify(context.__installerTestApi.CONFIG.resources)
);
assert.deepEqual(
  resources.map((resource) => resource.scriptName),
  [
    "LPL-Design-System",
    "AI-Balance-Core",
    "AI-Balance-Providers",
    "AI-Balance",
    "AI Balance Installer",
  ]
);
assert.match(resources[0].sourceUrl, /LPL-Design-System\.js$/);
assert.match(resources[1].sourceUrl, /AI-Balance-Core\.js$/);
assert.match(resources[2].sourceUrl, /AI-Balance-Providers\.js$/);
assert.match(resources[3].sourceUrl, /AI-Balance\.js$/);
assert.match(resources[4].sourceUrl, /Installer\.js$/);
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);
assert.deepEqual(resources, manifest.resources);
assert.equal(
  context.__installerTestApi.normalizeManifest(manifest).version,
  "2.0.5"
);
assert.throws(
  () => context.__installerTestApi.normalizeManifest({
    version: "2.0.5",
    resources: [{ scriptName: "bad", sourceUrl: "http://example.com", marker: "x" }],
  }),
  /非 HTTPS/
);
assert.equal(
  context.__installerTestApi.extractVersion(
    'const APP = { version: "2.0.5" };'
  ),
  "2.0.5"
);
assert.equal(context.__installerTestApi.compareVersions("2.0.4", "2.0.5"), -1);
assert.equal(context.__installerTestApi.compareVersions("2.0.5", "2.0.5"), 0);
assert.equal(context.__installerTestApi.compareVersions("3.0.0", "2.0.5"), 1);
assert.equal(
  context.__installerTestApi.extractReleaseNotes(
    "# 更新日志\n\n## 2.0.5 · 2026-08-11\n\n- Codex 重置日期\n- 移除订阅文案\n\n## 2.0.4 · 2026-08-09",
    "2.0.5"
  ),
  "- Codex 重置日期\n- 移除订阅文案"
);

console.log("installer: ok");
