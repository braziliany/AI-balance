// Exercise the shipped standalone implementations in the existing regression suite.
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "AI-Balance.js"), "utf8");
const Data = {
  fromBase64String: value => ({
    toRawString: () => Buffer.from(value, "base64").toString("utf8"),
  }),
};
module.exports = new Function("Data", source.replace(
  "await main();", "return { Core, ProviderAdapters };"
))(Data);
