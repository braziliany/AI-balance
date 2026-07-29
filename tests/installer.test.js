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
assert.equal(
  context.__installerTestApi.extractVersion(
    'const APP = { version: "1.6.0" };'
  ),
  "1.6.0"
);
assert.equal(context.__installerTestApi.compareVersions("1.5.0", "1.6.0"), -1);
assert.equal(context.__installerTestApi.compareVersions("1.6.0", "1.6.0"), 0);
assert.equal(context.__installerTestApi.compareVersions("2.0.0", "1.6.0"), 1);
assert.equal(
  context.__installerTestApi.extractReleaseNotes(
    "# 更新日志\n\n## 1.6.0 · 2026-07-29\n\n- 日周变化\n- 历史清理\n\n## 1.5.0 · 2026-07-29",
    "1.6.0"
  ),
  "- 日周变化\n- 历史清理"
);

console.log("installer: ok");
