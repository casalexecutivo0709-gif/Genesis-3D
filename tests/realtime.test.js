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
console.log('Realtime: versões, dispositivo, deduplicação e caminho isolado OK');
