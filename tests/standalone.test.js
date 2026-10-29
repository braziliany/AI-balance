const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const source = read("AI-Balance.js");
const baseline = read("tests/fixtures/v2.2.0/AI-Balance.js.txt");
const normalize = value => JSON.parse(JSON.stringify(value));
const exportsCode = `globalThis.api = { APP, CONFIG, Core, ProviderAdapters, DesignSystem,
  loadSettings, saveSettings, readCache, readHistory, loadBalances, createWidget,
  getSecret, setSecret, applyWebSettings, orderedProviders, main };`;
assert.doesNotMatch(source, /\bimportModule\s*\(/);
assert.doesNotMatch(source, /\bmodule\.exports/);
// Scriptable supports top-level await. Compile in an async function for Node syntax QA.
new vm.Script(`(async () => {${source}\n})()`);

function moduleApi(file, extra = {}) {
  const context = { module: { exports: {} }, ...extra };
  vm.runInNewContext(read(file), context);
  return context.module.exports;
}
const legacyCore = moduleApi("AI-Balance-Core.js");
const legacyDesign = moduleApi("LPL-Design-System.js");
const legacyProviders = moduleApi("AI-Balance-Providers.js", { importModule: () => legacyCore });
// Modules used for the old runtime only. The standalone context has no module loader.
function runtime(text, old = false) {
  const files = new Map();
  const keys = new Map();
  const requests = [];
  let offline = false;
  class Node {
    constructor(kind = "widget", text) { this.kind = kind; this.text = text; this.children = []; }
    addStack() { const child = new Node("stack"); this.children.push(child); return child; }
    addText(text) { const child = new Node("text", text); this.children.push(child); return child; }
    addImage() { const child = new Node("image"); this.children.push(child); return child; }
    addSpacer(size) { this.children.push({ kind: "spacer", size }); }
    setPadding(...values) { this.padding = values; }
    layoutVertically() { this.vertical = true; }
    centerAlignContent() { this.centered = true; }
    centerAlignText() { this.textCentered = true; }
  }
  const fm = {
    documentsDirectory: () => "/documents",
    joinPath: (a,b) => `${a}/${b}`,
    fileExists: p => files.has(p), readString: p => files.get(p),
    writeString: (p,s) => files.set(p,s),
    createDirectory: () => {}, readImage: () => ({}), writeImage: () => {},
  };
  const context = {
    Date: class extends Date { static now() { return 1793203200000; } },
    config: { runsInWidget: true, widgetFamily: "medium" },
    FileManager: { local: () => fm },
    Keychain: { contains: k => keys.has(k), get: k => keys.get(k), set: (k,v) => keys.set(k,v), remove: k => keys.delete(k) },
    ListWidget: Node, Color: class { constructor(hex, alpha) { this.hex = hex; this.alpha = alpha; } },
    Size: class { constructor(width,height) { this.width=width;this.height=height; } },
    LinearGradient: class {}, Font: { systemFont: s => s, boldSystemFont: s => s },
    Script: { setWidget: w => { context.widget = w; }, complete: () => { context.completed = true; }, name: () => "AI-Balance" },
    Request: class {
      constructor(url) { this.url=url; this.response={statusCode:200}; }
      async loadJSON() {
        requests.push({ url:this.url, headers:this.headers });
        if(offline) throw new Error("offline fixture");
        const fixture = this.url.includes("deepseek") ? "deepseek-balance" : this.url.includes("muteki") ? "muteki-wallet" : "codex-usage";
        return JSON.parse(read(`tests/fixtures/${fixture}.json`));
      }
      async loadImage() { throw new Error("logo unavailable"); }
    },
  };
  if(old) context.importModule = name => ({ "AI-Balance-Core":legacyCore, "AI-Balance-Providers":legacyProviders, "LPL-Design-System":moduleApi("LPL-Design-System.js", context) })[name];
  vm.runInNewContext(text.replace("await main();", exportsCode), context);
  return { api:context.api, context, files, keys, requests, offline: () => { offline=true; } };
}

(async () => {
  const current = runtime(source);
  const old = runtime(baseline, true);
  assert.deepEqual(Array.from(current.api.ProviderAdapters.PROVIDERS, p=>p.id), ["deepseek","codex","muteki"]);
  // Source equality proves request/parse logic and pure helpers were copied without edits.
  const embedded = (name,next) => source.slice(source.indexOf(`const ${name} = (() => {\n`)+`const ${name} = (() => {\n`.length, source.indexOf(`\n})();`,source.indexOf(`const ${name} = (() => {`))).replace(/^return \{/m,'module.exports = {');
  assert.equal(embedded('Core'), read('AI-Balance-Core.js'));
  assert.equal(embedded('ProviderAdapters'), read('AI-Balance-Providers.js').replace('const Core = importModule("AI-Balance-Core");',''));
  assert.equal(embedded('DesignSystem'), read('LPL-Design-System.js').replace('importModule("LPL-Design-System")','模块接口'));
  for(const file of fs.readdirSync(path.join(root,'tests/fixtures')).filter(f=>/^(deepseek|codex|muteki).*\.json$/.test(f))) {
    if(file.includes('invalid-key')) continue;
    const id=file.split('-')[0]; const fixture=JSON.parse(read('tests/fixtures/'+file));
    const options={now:1793203200000,settings:{usdToCnyRate:7.2}};
    let left,right;
    try { left=normalize(current.api.ProviderAdapters.parseProviderFixture(id,fixture,options)); } catch(e) { left=e.message; }
    try { right=normalize(legacyProviders.parseProviderFixture(id,fixture,options)); } catch(e) { right=e.message; }
    assert.deepEqual(left,right,file);
  }
  const seedSettings={...normalize(current.api.CONFIG),settingsVersion:9,themeMode:'light',providerOrder:['codex','deepseek','muteki'],hiddenProviders:[]};
  for(const r of [current,old]) {
    r.files.set('/documents/ai-balance-settings.json',JSON.stringify(seedSettings));
    r.files.set('/documents/ai-balance-cache.json',JSON.stringify({deepseek:{value:20,unit:'¥',updatedAt:1793203100000}}));
    r.files.set('/documents/ai-balance-history.json',JSON.stringify({deepseek:[{at:1793116800000,value:30,unit:'¥'}]}));
    for(const id of ['deepseek','codex','muteki']) r.keys.set('ai-balance.'+id,'fixture-'+id);
  }
  assert.deepEqual(normalize(current.api.loadSettings()),normalize(old.api.loadSettings()));
  const items=await current.api.loadBalances(current.api.loadSettings());
  const oldItems=await old.api.loadBalances(old.api.loadSettings());
  assert.deepEqual(normalize(items),normalize(oldItems));
  assert.deepEqual(normalize(current.requests),normalize(old.requests));
  assert.deepEqual([...current.files],[...old.files]);
  assert.deepEqual([...current.keys],[...old.keys]);
  const cleanTree = w => JSON.stringify(w).replace(/v2\.[23]\.0/g,'VERSION');
  for(const family of ['small','medium','large']) for(const themeMode of ['dark','light']) {
    const settings={...seedSettings,themeMode};
    const widget=current.api.createWidget(items,settings,{},family);
    const before=old.api.createWidget(oldItems,settings,{},family);
    assert.equal(cleanTree(widget),cleanTree(before),`${family}/${themeMode}`);
    assert.equal(widget.backgroundGradient.colors[0].hex,current.api.DesignSystem.palettes[themeMode].backgroundTop);
  }
  current.offline();old.offline();
  assert.deepEqual(normalize(await current.api.loadBalances(seedSettings)), normalize(await old.api.loadBalances(seedSettings)));
  await current.api.main();
  assert.ok(current.context.widget);assert.equal(current.context.completed,true);
  // Key edits use exactly the existing identifiers.
  current.api.setSecret('deepseek',' updated '); assert.equal(current.keys.get('ai-balance.deepseek'),'updated');
  current.api.setSecret('muteki',''); assert.equal(current.keys.has('ai-balance.muteki'),false);
  const fresh=runtime(source);await fresh.api.main();assert.ok(fresh.context.widget);
  console.log('standalone: syntax, isolation, initialization, provider parity, data compatibility, six render trees, offline fallback, full widget lifecycle: ok');
})().catch(error=>{console.error(error);process.exitCode=1;});
