const assert=require('node:assert/strict');
const Sync=require('../genesis-sync-core.js');

const base={entity:'Pedidos',entity_id:'p1',action:'upsert',payload:{id:'p1',status:'novo',version:2},version:2,status:'pending',created_at:'2026-08-08T10:00:00.000Z'};
const duplicateA={...base,operation_id:'op-a'};
const duplicateB={...base,operation_id:'op-b',updated_at:'2026-08-08T10:01:00.000Z'};
const newer={...base,operation_id:'op-c',version:3,payload:{id:'p1',status:'producao',version:3},updated_at:'2026-08-08T10:02:00.000Z'};
const conflict={...base,operation_id:'op-conflict',version:4,payload:{id:'p1',status:'pronto',version:4},status:'conflict'};
const other={...base,operation_id:'op-other',entity_id:'p2',payload:{id:'p2',status:'novo',version:1},version:1};
const synced={...other,operation_id:'op-synced',entity_id:'p3',payload:{id:'p3'},status:'synced'};

const diagnosis=Sync.diagnoseQueue([duplicateA,duplicateB,newer,conflict,other,synced]);
assert.equal(diagnosis.total,6);
assert.equal(diagnosis.duplicates,1);
assert.equal(diagnosis.conflicts,1);

const repaired=Sync.repairQueue([duplicateA,duplicateB,newer,conflict,other,synced]);
assert.equal(repaired.report.before,6);
assert.equal(repaired.report.duplicates,2);
assert.equal(repaired.report.syncedRemoved,1);
assert.equal(repaired.report.conflictsPreserved,1);
assert.equal(repaired.queue.length,3);
assert.ok(repaired.queue.some(item=>item.operation_id==='op-c'));
assert.ok(repaired.queue.some(item=>item.operation_id==='op-conflict'));
assert.ok(repaired.queue.some(item=>item.operation_id==='op-other'));

const logical={entity:'Pedidos',entityId:'p1',action:'upsert',version:7,fingerprint:'abc',deviceId:'phone'};
assert.equal(Sync.operationId(logical),Sync.operationId(logical));
console.log('Fila: diagnóstico, deduplicação, conflitos e operationId idempotente OK');
