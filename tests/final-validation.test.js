const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'corrigido.html'),'utf8');
const data=fs.readFileSync(path.join(root,'genesis-data.js'),'utf8');
const workspace=fs.readFileSync(path.join(root,'genesis-workspace.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const workspaceCss=fs.readFileSync(path.join(root,'genesis-workspace.css'),'utf8');

for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.js'))){
  const source=fs.readFileSync(path.join(root,file),'utf8').replace(/^\s*export\s+default\s+/m,'const __moduleDefault = ');
  new vm.Script(source,{filename:file});
}
const inlineScripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match=>!(/\bsrc\s*=/i.test(match[1]))&&!(/\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(match[1])));
inlineScripts.forEach((match,index)=>new vm.Script(match[2],{filename:`corrigido-inline-${index+1}.js`}));

const cssFiles=fs.readdirSync(root).filter(name=>name.endsWith('.css'));
for(const file of cssFiles){
  const css=fs.readFileSync(path.join(root,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  let balance=0;
  for(const char of css){if(char==='{')balance++;if(char==='}')balance--;assert.ok(balance>=0,`${file} possui chave CSS fechada sem abertura`);}
  assert.equal(balance,0,`${file} possui bloco CSS sem fechamento`);
}

function loadShopeeParser(){
  const begin=html.indexOf('const ShopeeScreenshotImporter = (()=>{');
  const marker='window.ShopeeScreenshotImporter=ShopeeScreenshotImporter;';
  const finish=html.indexOf(marker,begin);
  assert.ok(begin>=0&&finish>begin,'Importador Shopee precisa continuar presente');
  let sequence=0;
  const context={
    console,
    window:{},
    document:{},
    navigator:{onLine:true},
    URL:{createObjectURL:()=>`blob:test-${++sequence}`,revokeObjectURL:()=>{}},
    AbortController,
    setTimeout,
    clearTimeout,
    uid:prefix=>`${prefix}-test-${++sequence}`,
    round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100,
    cfg:{makerworld:{workerUrl:''}}
  };
  vm.createContext(context);
  vm.runInContext(html.slice(begin,finish+marker.length),context,{filename:'shopee-parser.js'});
  return context.window.ShopeeScreenshotImporter;
}

const OCR=loadShopeeParser();
const parse=(text,confidence,index)=>OCR.merge([OCR.parseScreenshot(text,confidence,index)]);

const complete=parse(`
Detalhes do pedido
hugohackenhaar627
Produto: Pomo de ouro Harry Potter tamanho tradicional
Variação: Tradicional
Quantidade: 1
Preço unitário: R$ 60,00
Pagamento total: R$ 61,44
ID do pedido: #260717TQTAY6E3
Horário do pedido: 16 de jul 2026 13:35
`,91,0);
assert.equal(complete.fields.orderId.value,'260717TQTAY6E3');
assert.equal(complete.fields.buyerUsername.value,'hugohackenhaar627');
assert.equal(complete.fields.buyer.value,'hugohackenhaar627');
assert.equal(complete.fields.paidValue.value,'61.44');
assert.equal(complete.fields.orderDate.value,'2026-07-16');
assert.equal(complete.fields.orderTime.value,'13:35');
assert.equal(complete.items[0].productName,'Pomo de ouro Harry Potter tamanho tradicional');
assert.equal(complete.items[0].variation,'Tradicional');
assert.equal(complete.items[0].qty,1);
assert.equal(complete.items[0].unitPrice,60);

const multiple=parse(`
Detalhes do pedido
Comprador: cliente123
Produto: Suporte articulado para celular
Variação: Roxo
Quantidade: 3
Preço unitário: R$ 11,48
Subtotal: R$ 34,44
Frete: R$ 5,00
Desconto: R$ 2,00
Total do pedido: R$ 37,44
ID do pedido: 260717ABC1234
Data do pedido: 09/08/2026
`,88,1);
assert.equal(multiple.items[0].qty,3);
assert.equal(multiple.items[0].unitPrice,11.48);
assert.equal(multiple.items[0].subtotal,34.44);
assert.equal(multiple.fields.freight.value,'5');
assert.equal(multiple.fields.discount.value,'2');
assert.equal(multiple.fields.total.value,'37.44');
assert.equal(multiple.fields.orderDate.value,'2026-08-09');

const withoutVariation=parse(`
Produto: Chaveiro Genesis
Quantidade: 2
Valor unitário: R$ 7,50
`,80,2);
assert.equal(withoutVariation.items[0].productName,'Chaveiro Genesis');
assert.equal(withoutVariation.items[0].variation,'');
assert.equal(withoutVariation.items[0].qty,2);

const mobile=parse(`
hugohackenhaar627
Concluído
Pré-encomenda
Pomo de ouro Harry Potter tamanho tradicional
Tradicional
x 1
R$ 60,00
Pagamento total: R$ 61,44
ID do pedido
260717TQTAY6E3
`,76,3);
assert.equal(mobile.items[0].productName,'Pomo de ouro Harry Potter tamanho tradicional');
assert.equal(mobile.items[0].qty,1);
assert.equal(mobile.fields.buyer.value,'hugohackenhaar627');

const cropped=parse(`
Detalhes do pedido
hugohackenhaar627
Produto: Peça sem identificação
Quantidade: 1
Preço unitário: R$ 10,00
`,35,4);
assert.equal(cropped.fields.orderId,undefined);
assert.equal(cropped.fields.buyer.value,'hugohackenhaar627');
assert.equal(cropped.overallConfidence,35);

const noisy=parse(`
  ID do pedido :   260717NOISE123

  cliente_9876
  Produto: Miniatura com nome muito longo para validar espaços extras
  Quantidade: 1
  Total do pedido: R$ 19,90
`,58,5);
assert.equal(noisy.fields.orderId.value,'260717NOISE123');
assert.equal(noisy.fields.buyer.value,'cliente_9876');
assert.equal(noisy.fields.total.value,'19.9');

const conflict=OCR.merge([
  OCR.parseScreenshot('ID do pedido: 260717AAAA111\nComprador: cliente111\nTotal do pedido: R$ 10,00',90,0),
  OCR.parseScreenshot('ID do pedido: 260717BBBB222\nComprador: cliente222\nTotal do pedido: R$ 12,00',90,1)
]);
assert.ok(conflict.conflicts.some(item=>item.field==='orderId'));
assert.ok(conflict.conflicts.some(item=>item.field==='buyer'));
assert.ok(conflict.conflicts.some(item=>item.field==='total'));

assert.match(html,/ocrReviewState=analysis;[\s\S]{0,160}fillOcrReview\(\)/);
assert.match(html,/Revise principalmente código do pedido, preços, datas e quantidades/);
assert.match(html,/confidence-low/);
assert.match(html,/btnOcrImportOrder/);

assert.match(html,/saveActiveDraft\('before-file-picker'\)/);
assert.match(html,/addEventListener\('pagehide',[\s\S]{0,120}saveActiveDraft/);
assert.match(html,/addEventListener\('pageshow'/);
assert.match(html,/addEventListener\('visibilitychange'/);
assert.match(html,/resetModalState\(\{preserveOpen:true/);
assert.match(workspace,/URL\.revokeObjectURL/);
assert.match(workspace,/canvas\.width=1;canvas\.height=1/);

assert.match(data,/Conflitos de sincronização/);
assert.match(data,/Manter este dispositivo/);
assert.match(data,/Manter Google Sheets/);
assert.match(data,/Mesclar versões/);
assert.match(data,/if\(queueMaintenanceBusy\|\|sheetsApplying\|\|!\['user','migration'\]\.includes\(syncMutationSource\)\)return 0/);
assert.match(data,/if\(!SHEETS_SYNCABLE_ENTITY_TYPES\.has\(String\(entity\|\|''\)\)\)return null/);
assert.match(data,/syncQueueArmed&&/);
assert.match(data,/await dbDelete\(SYNC_QUEUE_STORE,item\.operation_id\)/);

assert.match(workspace,/hydrateImageFromFallback\(imageEntity\(id\),'thumbnail'\)/);
assert.match(workspace,/remoteThumbnailOnly/);
assert.match(workspace,/Google Drive/);
assert.match(html,/\$\{qty\} un\. x \$\{fmtBRL\(unit\)\}/);
assert.match(html,/Total a pagar: \$\{fmtBRL\(total\)\}/);
assert.match(sw,/if\(event\.data\?\.type==='SKIP_WAITING'\)self\.skipWaiting\(\)/);
assert.doesNotMatch(sw,/clients\.claim\s*\(/);
assert.match(workspaceCss,/@media screen and \(max-width:1220px\)[\s\S]*#screen-calc\.active\{grid-template-columns:minmax\(0,1fr\)\}/);
const coreMatch=sw.match(/const CORE=\[([^\]]+)\]/);
assert.ok(coreMatch,'Lista de arquivos essenciais do PWA precisa existir');
for(const match of coreMatch[1].matchAll(/['"]\.\/([^'"]*)['"]/g)){
  const relative=match[1];
  if(!relative)continue;
  assert.ok(fs.existsSync(path.join(root,relative)),`Arquivo essencial ausente no cache do PWA: ${relative}`);
}
assert.doesNotMatch(`${html}\n${data}\n${workspace}`,/supabase/i);

console.log('Validação final: OCR sintético, rascunho iPhone, conflitos, Drive, WhatsApp e PWA OK');
