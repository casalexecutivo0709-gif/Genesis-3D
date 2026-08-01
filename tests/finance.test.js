const assert=require('node:assert/strict');
const finance=require('../genesis-finance.js');

const direct=finance.calculateSaleTotals({channel:'direct',gross:100,cost:30});
assert.deepEqual(direct,{gross:100,fees:0,received:100,revenue:100,cost:30,profit:70,margin:70});

const shopee=finance.calculateSaleTotals({channel:'shopee',gross:100,received:78,cost:30});
assert.equal(shopee.fees,22);
assert.equal(shopee.revenue,78);
assert.equal(shopee.profit,48);
assert.equal(shopee.margin,61.54);

const kitItems=[
  {id:'a',name:'Item A',qty:1,unitPrice:30,costUnit:10},
  {id:'b',name:'Item B',qty:1,unitPrice:40,costUnit:12},
  {id:'c',name:'Item C',qty:1,unitPrice:50,costUnit:18}
];
const kitDirect=finance.normalizeSale({id:'kit-direct',status:'concluido',channel:'direct',productName:'Kit',productTotal:108,kitId:'kit-1',kitItems,payment:{status:'paid',paid:108,balance:0},financialSnapshot:{cost:40}});
assert.deepEqual(kitDirect.items.map(item=>item.gross),[27,36,45]);
assert.deepEqual(kitDirect.items.map(item=>item.discountPercent),[10,10,10]);
assert.equal(kitDirect.items.length,3);
assert.equal(finance.validateSale(kitDirect).ok,true);

const kitShopee=finance.normalizeSale({id:'kit-shopee',status:'enviado',channel:'shopee',productName:'Kit',productTotal:108,kitId:'kit-1',kitItems,financialSnapshot:{cost:40},shopee:{finance:{grossProductRevenue:108,netRevenueReceived:86.4,financialStatus:'received'}}});
assert.equal(kitShopee.fees,21.6);
assert.equal(kitShopee.revenue,86.4);
assert.equal(kitShopee.items.reduce((sum,item)=>finance.round2(sum+item.revenue),0),86.4);
assert.equal(kitShopee.items.reduce((sum,item)=>finance.round2(sum+item.profit),0),kitShopee.profit);
assert.equal(finance.validateSale(kitShopee).ok,true);

assert.equal(finance.isRealized({id:'waiting',status:'aguardando-pagamento',channel:'direct',productTotal:100,payment:{status:'pending',paid:0}}),false);
assert.equal(finance.isRealized({id:'cancelled',status:'cancelado',channel:'direct',productTotal:100,payment:{status:'paid',paid:100}}),false);

const duplicateOld={id:'old',status:'enviado',channel:'shopee',shopeeOrderId:'ABC123',updatedAt:1,shopee:{finance:{grossProductRevenue:100,netRevenueReceived:80,financialStatus:'received'}}};
const duplicateNew={...duplicateOld,id:'new',updatedAt:2};
assert.deepEqual(finance.deduplicateOrders([duplicateOld,duplicateNew]).map(item=>item.id),['new']);

console.log('Financeiro: 4 cenários principais, status e idempotência OK');
