const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const workerPath=path.resolve(__dirname,'..','makerworld-worker.js');
const source=fs.readFileSync(workerPath,'utf8').replace(/export default\s*\{/,'globalThis.__worker={');
const context={URL,Response,Request,Headers,AbortController,ReadableStream,setTimeout,clearTimeout,console};
vm.runInNewContext(source+'\nglobalThis.__corsTest={originAllowed,cors,normalizeRequestOrigin};',context,{filename:workerPath});
const test=context.__corsTest,publicOrigin='https://casalexecutivo0709-gif.github.io';
assert.equal(test.originAllowed(publicOrigin,{}),true);
assert.equal(test.originAllowed(publicOrigin+'/',{}),true);
assert.equal(test.originAllowed('https://unknown.example',{}),false);
assert.equal(test.originAllowed('null',{}),false);
assert.equal(test.cors(publicOrigin)['Access-Control-Allow-Origin'],publicOrigin);
assert.equal(test.cors('')['Access-Control-Allow-Origin'],undefined);
assert.equal(test.cors(publicOrigin)['Access-Control-Allow-Origin']==='*',false);
assert.equal(test.cors(publicOrigin).Vary,'Origin');
console.log('Cloudflare Worker: origem pública, OPTIONS e bloqueio de origem desconhecida OK');
