const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const installer = fs.readFileSync(process.argv[2] || path.join(root,'Installer.js'),'utf8');
const bundle = fs.readFileSync(path.join(root,'AI-Balance.js'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
async function run(mode) {
  const shared = [
    ['/docs/LPL-Design-System.js','shared-design'], ['/docs/AI-Balance-Core.js','old-core'],
    ['/docs/AI-Balance-Providers.js','old-providers'], ['/docs/OtherProject.js','other-project'],
    ['/docs/ai-balance-settings.json','settings'], ['/docs/ai-balance-cache.json','cache'],
    ['/docs/ai-balance-history.json','history'],
  ];
  const files = new Map(shared);
  if(mode !== 'first-install-fail') files.set('/docs/AI-Balance.js','old widget');
  const before = new Map(files); let failed = false;
  const notices = [];
  const fm = {
    documentsDirectory: () => '/docs', joinPath:(a,b)=>`${a}/${b}`,
    fileExists:p=>files.has(p), isFileDownloaded:()=>true,readString:p=>files.get(p),
    writeString(p,s) {
      files.set(p,s);
      if(!failed && ['write-fail','first-install-fail','corrupt-write'].includes(mode)) {
        failed=true;
        files.set(p,'partial write');
        if(mode !== 'corrupt-write') throw new Error('injected disk error');
      }
    },
    remove:p=>files.delete(p),
  };
  const context = {
    console:{warn:()=>{}}, FileManager:{iCloud:()=>fm},
    Script:{complete:()=>{}},Safari:{open:()=>{}},
    Alert:class {
      addAction(){} addCancelAction(){} addDestructiveAction(){}
      async present(){notices.push(this.title);return mode==='cancel'?-1:0;}
    },
    Request:class {
      constructor(url){this.url=url;this.response={statusCode:200};}
      async loadString() {
        if(this.url.endsWith('manifest.json')) {
          if(mode==='manifest-offline') throw new Error('offline manifest');
          if(mode==='old-manifest') return JSON.stringify({...manifest,resources:[...manifest.resources,{scriptName:'LPL-Design-System',sourceUrl:'https://example.com/shared.js',marker:'shared'}]});
          return JSON.stringify(manifest);
        }
        if(this.url.endsWith('CHANGELOG.md')) return '';
        if(mode==='download-fail') throw new Error('network error');
        if(mode==='bad-marker') return 'invalid file';
        return bundle;
      }
    },
  };
  await new vm.Script(`(async()=>{${installer}\n})()`).runInNewContext(context);
  for(const [p,s] of shared) assert.equal(files.get(p),s,`${mode}: ${p}`);
  const success=['success','manifest-offline','old-manifest'].includes(mode);
  if(success) {assert.equal(files.get('/docs/AI-Balance.js'),bundle);assert.ok(notices.includes('安装完成'));}
  else {assert.deepEqual([...files],[...before]);assert.ok(notices.includes(mode==='cancel'?'安装 AI Balance':'安装失败'));}
}
(async()=>{
  const modes = process.argv[2] ? ['success','write-fail','first-install-fail','corrupt-write','cancel'] : ['success','manifest-offline','old-manifest','download-fail','bad-marker','write-fail','first-install-fail','corrupt-write','cancel'];
  for(const mode of modes) await run(mode);
  console.log('single-file installer: success, safe manifest fallback, download/marker failure, partial write rollback, new-file cleanup, readback rollback, cancellation, shared files preserved: ok');
})().catch(e=>{console.error(e);process.exitCode=1;});
