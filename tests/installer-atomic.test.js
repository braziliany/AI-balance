const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const installerPath = path.join(__dirname, "..", "Installer.js");
const source = fs
  .readFileSync(installerPath, "utf8")
  .replace(
    "await main();",
    "globalThis.__installerAtomicApi = { installDownloads };"
  );
const files = new Map([
  ["/documents/Existing.js", "old-existing"],
  ["/documents/Fail.js", "old-fail"],
]);
let failedOnce = false;
const fileManager = {
  documentsDirectory: () => "/documents",
  joinPath: (left, right) => `${left}/${right}`,
  fileExists: (file) => files.has(file),
  isFileDownloaded: () => true,
  readString: (file) => files.get(file),
  writeString: (file, content) => {
    if (file.endsWith("/Fail.js") && !failedOnce) {
      failedOnce = true;
      throw new Error("simulated write failure");
    }
    files.set(file, content);
  },
  remove: (file) => files.delete(file),
};
const context = { FileManager: { iCloud: () => fileManager } };
vm.runInNewContext(source, context, { filename: installerPath });

(async () => {
  await assert.rejects(
    context.__installerAtomicApi.installDownloads([
      { scriptName: "Existing", content: "new-existing" },
      { scriptName: "Fail", content: "new-fail" },
    ]),
    /simulated write failure/
  );
  assert.equal(files.get("/documents/Existing.js"), "old-existing");
  assert.equal(files.get("/documents/Fail.js"), "old-fail");
  console.log("installer atomic rollback: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
