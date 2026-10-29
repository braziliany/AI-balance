// Build the offline iPhone acceptance package; no network or publishing actions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname,'..');
const out = process.argv[2] || 'F:/共享文件夹/AI-Balance-v2.3.0';
const read = f => fs.readFileSync(path.join(root,f),'utf8');
fs.mkdirSync(path.join(out,'rollback'),{recursive:true});
for(const f of ['AI-Balance.js','Installer.js','manifest.json','README.md','CHANGELOG.md']) fs.copyFileSync(path.join(root,f),path.join(out,f));
for(const [from,to] of [
  ['docs/v2.3.0/iphone-acceptance.md','iPhone-验收清单.md'],
  ['docs/v2.3.0/automated-test-report.md','自动化测试报告.md'],
  ['docs/v2.3.0/test-output.txt','test-output.txt'],
  ['tests/fixtures/v2.2.0/AI-Balance.js.txt','rollback/AI-Balance.js'],
]) fs.copyFileSync(path.join(root,from),path.join(out,to));
const payload=JSON.stringify({bundle:read('AI-Balance.js'),manifest:JSON.parse(read('manifest.json')),changelog:read('CHANGELOG.md')});
const installer=read('Installer.js')
  .replace(' * AI Balance 一键安装器',' * AI Balance 一键安装器 — v2.3.0 离线验收专用（未发布）')
  .replace(/async function downloadText\(url\) \{[\s\S]*?\n\}/,()=>`async function downloadText(url) {
  const embedded = ${payload};
  if (url.endsWith("manifest.json")) return JSON.stringify(embedded.manifest);
  if (url.endsWith("CHANGELOG.md")) return embedded.changelog;
  if (url.endsWith("AI-Balance.js")) return embedded.bundle;
  throw new Error("离线验收包不支持此资源");
}`);
fs.writeFileSync(path.join(out,'Installer-Acceptance.js'),installer);
const entries=fs.readdirSync(out,{recursive:true}).filter(f=>fs.statSync(path.join(out,f)).isFile() && f!=='SHA256SUMS.json');
const hashes=Object.fromEntries(entries.sort().map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
fs.writeFileSync(path.join(out,'SHA256SUMS.json'),JSON.stringify(hashes,null,2)+'\n');
for(const f of ['AI-Balance.js','Installer.js','manifest.json']) {
  if(!fs.readFileSync(path.join(root,f)).equals(fs.readFileSync(path.join(out,f)))) throw new Error('Copy mismatch: '+f);
}
console.log('Acceptance package copied and checksummed: '+out);
