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
  ["LPL-Design-System", "AI-Balance", "AI Balance Installer"]
);
assert.match(resources[0].sourceUrl, /LPL-Design-System\.js$/);
assert.match(resources[1].sourceUrl, /AI-Balance\.js$/);
assert.match(resources[2].sourceUrl, /Installer\.js$/);
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);
assert.equal(
  context.__installerTestApi.normalizeManifest(manifest).version,
  "1.9.1"
);
assert.throws(
  () => context.__installerTestApi.normalizeManifest({
    version: "1.9.1",
    resources: [{ scriptName: "bad", sourceUrl: "http://example.com", marker: "x" }],
  }),
  /非 HTTPS/
);
assert.equal(
  context.__installerTestApi.extractVersion(
    'const APP = { version: "1.9.1" };'
  ),
  "1.9.1"
);
assert.equal(context.__installerTestApi.compareVersions("1.9.0", "1.9.1"), -1);
assert.equal(context.__installerTestApi.compareVersions("1.9.1", "1.9.1"), 0);
assert.equal(context.__installerTestApi.compareVersions("2.0.0", "1.9.1"), 1);
assert.equal(
  context.__installerTestApi.extractReleaseNotes(
    "# 更新日志\n\n## 1.9.1 · 2026-07-30\n\n- 刷新品牌图标\n- 安全清理缓存\n\n## 1.9.0 · 2026-07-30",
    "1.9.1"
  ),
  "- 刷新品牌图标\n- 安全清理缓存"
);

console.log("installer: ok");
