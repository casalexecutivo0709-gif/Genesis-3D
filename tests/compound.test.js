const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.resolve(__dirname,'..','corrigido.html'),'utf8');
const start=html.indexOf('function cloneCompoundComponents');
const end=html.indexOf('function compoundValidComponents',start);
assert.ok(start>=0&&end>start,'Núcleo do cálculo composto precisa existir');
const context={uid:prefix=>`${prefix}-test`};
vm.createContext(context);
vm.runInContext(`${html.slice(start,end)};this.cloneCompoundComponents=cloneCompoundComponents;this.aggregateCompoundComponents=aggregateCompoundComponents;`,context);

const components=[
  {id:'a',name:'Corpo',timeMinutes:120,weightGrams:80,quantity:1},
  {id:'b',name:'Pé',timeMinutes:30,weightGrams:10,quantity:4}
];
assert.deepEqual({...context.aggregateCompoundComponents(components)},{timeMinutes:240,weightGrams:120});
assert.deepEqual({...context.aggregateCompoundComponents(components.slice(0,1))},{timeMinutes:120,weightGrams:80});
const normalized=context.cloneCompoundComponents([{timeMinutes:-2,weightGrams:-5,quantity:0}])[0];
assert.equal(normalized.timeMinutes,0);
assert.equal(normalized.weightGrams,0);
assert.equal(normalized.quantity,1);
assert.match(html,/calculationType:'compound'|calculationType=type==='compound'/);
assert.match(html,/components:cloneCompoundComponents/);
assert.match(html,/canvasDrawCompoundImages/);
assert.match(html,/genesisIsNativeEditable/);
assert.match(html,/-webkit-user-select:text!important/);
console.log('Cálculo composto e proteções de edição iPhone OK');
