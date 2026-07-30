const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const extractVersion = (source, label) => {
  const match = source.match(/\bversion\s*:\s*["'](\d+\.\d+\.\d+)["']/);
  assert.ok(match, `${label} 缺少版本号`);
  return match[1];
};

const manifest = JSON.parse(read("manifest.json"));
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const widgetSource = read("AI-Balance.js");
const installerSource = read("Installer.js");

const versions = {
  manifest: manifest.version,
  package: packageJson.version,
  packageLock: packageLock.version,
  packageLockRoot: packageLock.packages[""].version,
  widget: extractVersion(widgetSource, "AI-Balance.js"),
  installer: extractVersion(installerSource, "Installer.js"),
};
assert.equal(
  new Set(Object.values(versions)).size,
  1,
  `发布版本不一致：${JSON.stringify(versions)}`
);

for (const resource of manifest.resources) {
  const url = new URL(resource.sourceUrl);
  const fileName = decodeURIComponent(url.pathname.split("/").at(-1));
  const localPath = path.join(root, fileName);
  assert.ok(fs.existsSync(localPath), `manifest 资源不存在：${fileName}`);
  assert.match(
    fs.readFileSync(localPath, "utf8"),
    new RegExp(resource.marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `manifest 校验标记不存在：${resource.scriptName}`
  );
}

const logoReferences = Array.from(
  widgetSource.matchAll(/assets\/logos\/([a-z0-9.-]+)/g),
  (match) => match[1]
);
assert.deepEqual(
  logoReferences.sort(),
  ["codex.png", "deepseek.png", "kimi.png", "serpbase.jpg", "stepfun.png"]
);
for (const logo of logoReferences) {
  assert.ok(
    fs.existsSync(path.join(root, "assets", "logos", logo)),
    `品牌图标不存在：${logo}`
  );
}

console.log("release integrity: ok");
