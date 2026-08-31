const Core = require("../AI-Balance-Core");

if (typeof global.Data === "undefined") {
  global.Data = {
    fromBase64String: (value) => ({
      toRawString: () => Buffer.from(value, "base64").toString("utf8"),
    }),
  };
}

const previousImportModule = global.importModule;
global.importModule = (name) => {
  if (name === "AI-Balance-Core") return Core;
  if (typeof previousImportModule === "function") return previousImportModule(name);
  throw new Error(`未知测试模块：${name}`);
};

let ProviderAdapters;
try {
  ProviderAdapters = require("../AI-Balance-Providers");
} finally {
  if (previousImportModule === undefined) delete global.importModule;
  else global.importModule = previousImportModule;
}

module.exports = { Core, ProviderAdapters };
