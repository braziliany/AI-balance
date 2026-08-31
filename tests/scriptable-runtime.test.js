const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const productionFiles = [
  "Installer.js",
  "AI-Balance.js",
  "AI-Balance-Core.js",
  "AI-Balance-Providers.js",
  "LPL-Design-System.js",
];
const forbidden = [
  [/\brequire\s*\(/, "require("],
  [/\brequire\s+["']/, "require string"],
  [/\bnode:/, "node:"],
  [/\b__dirname\b/, "__dirname"],
  [/\b__filename\b/, "__filename"],
  [/\bprocess\s*\./, "process."],
  [/\bBuffer\b/, "Buffer"],
];

for (const file of productionFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(source, pattern, `${file} 包含 Node-only 依赖：${label}`);
  }
}

function loadScriptableModule(file, extraContext = {}) {
  const module = { exports: {} };
  const context = vm.createContext({ module, ...extraContext });
  const source = fs.readFileSync(path.join(root, file), "utf8");
  new vm.Script(source, { filename: file }).runInContext(context);
  return module.exports;
}

const Core = loadScriptableModule("AI-Balance-Core.js");
const Providers = loadScriptableModule("AI-Balance-Providers.js", {
  importModule: (name) => {
    assert.equal(name, "AI-Balance-Core");
    return Core;
  },
});

assert.equal(typeof Core.normalizeProviderResult, "function");
assert.equal(typeof Providers.fetchProvider, "function");
assert.deepEqual(
  Array.from(Providers.PROVIDERS, (provider) => provider.id),
  ["deepseek", "codex", "muteki"]
);

console.log("scriptable runtime compatibility: ok");
