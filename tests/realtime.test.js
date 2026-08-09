const assert=require('node:assert/strict');
const Core=require('../genesis-realtime-core.js');

const event={operationId:'op-123',entityType:'Pedidos',entityId:'pedido-1',version:4,updatedAt:'2026-08-08T10:00:00.000Z',deviceId:'celular',eventType:'upsert'};
assert.deepEqual(Core.shouldProcess(event,{deviceId:'desktop',localVersion:3,processed:new Set()}).process,true);
assert.equal(Core.shouldProcess(event,{deviceId:'celular',localVersion:3,processed:new Set()}).reason,'same-device');
assert.equal(Core.shouldProcess(event,{deviceId:'desktop',localVersion:4,processed:new Set()}).reason,'stale');
assert.equal(Core.shouldProcess(event,{deviceId:'desktop',localVersion:3,processed:new Set(['op-123'])}).reason,'duplicate');
assert.equal(Core.validWorkspaceId('a'.repeat(24)),true);
assert.equal(Core.validWorkspaceId('curto'),false);
assert.equal(Core.eventPath('https://genesis-default-rtdb.firebaseio.com','a'.repeat(24),'op-123'),'https://genesis-default-rtdb.firebaseio.com/events/'+('a'.repeat(24))+'/op-123.json');

const processedOnDesktop=new Set();
const fromPhone={operationId:'phone-v1',entityType:'Orcamentos',entityId:'orc-9',version:1,updatedAt:'2026-08-09T09:00:00.000Z',deviceId:'phone',eventType:'upsert'};
const desktopDecision=Core.shouldProcess(fromPhone,{deviceId:'desktop',localVersion:0,processed:processedOnDesktop});
assert.equal(desktopDecision.process,true);
processedOnDesktop.add(desktopDecision.event.operationId);
assert.equal(Core.shouldProcess(fromPhone,{deviceId:'desktop',localVersion:1,processed:processedOnDesktop}).reason,'duplicate');

const fromDesktop={...fromPhone,operationId:'desktop-v2',version:2,deviceId:'desktop',updatedAt:'2026-08-09T09:05:00.000Z'};
assert.equal(Core.shouldProcess(fromDesktop,{deviceId:'phone',localVersion:1,processed:new Set()}).process,true);
assert.equal(Core.shouldProcess({...fromPhone,operationId:'phone-stale'}, {deviceId:'desktop',localVersion:2,processed:new Set()}).reason,'stale');

const paymentUpdate={operationId:'phone-pay-v3',entityType:'Pedidos',entityId:'pedido-1',version:3,updatedAt:'2026-08-09T09:10:00.000Z',deviceId:'phone',eventType:'payment'};
assert.equal(Core.shouldProcess(paymentUpdate,{deviceId:'desktop',localVersion:2,processed:new Set()}).process,true);
console.log('Realtime: versões, dispositivo, deduplicação e caminho isolado OK');
