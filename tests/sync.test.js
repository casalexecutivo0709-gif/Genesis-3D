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

const stablePayload={id:'p4',status:'em_producao',dados:{valor:34.44},updated_at:'2026-08-08T10:00:00.000Z',sync_status:'pending',version:1};
assert.equal(
  Sync.payloadFingerprint(stablePayload),
  Sync.payloadFingerprint({...stablePayload,updated_at:'2026-08-09T10:00:00.000Z',sync_status:'synced',version:99}),
  'Metadados de sincronização não podem criar uma nova operação lógica'
);

const repeated=[];
for(let attempt=0;attempt<12;attempt++){
  repeated.push({...base,operation_id:`op-repeat-${attempt}`,updated_at:`2026-08-08T10:${String(attempt).padStart(2,'0')}:00.000Z`});
}
const repeatedRepair=Sync.repairQueue(repeated);
assert.equal(repeatedRepair.queue.length,1,'Doze gravações equivalentes devem virar uma operação pendente');
assert.equal(repeatedRepair.report.afterDetails.duplicates,0);

const completed=Sync.repairQueue(repeatedRepair.queue.map(item=>({...item,status:'synced'})));
assert.equal(completed.queue.length,0,'A fila deve zerar depois da confirmação do servidor');

const diagnosticInput=[
  {...base,operation_id:'diag-1',entity:'Pedidos',entity_id:'p1',action:'update',source:'local',reason:'saveOrders',created_at:'2026-08-01T10:00:00.000Z'},
  {...base,operation_id:'diag-2',entity:'Pedidos',entity_id:'p1',action:'update',source:'local',reason:'saveOrders',created_at:'2026-08-02T10:00:00.000Z'},
  {...base,operation_id:'diag-3',entity:'Clientes',entity_id:'c1',action:'create',source:'migration',reason:'prepare',created_at:'2026-08-03T10:00:00.000Z'},
  {...base,operation_id:'diag-4',entity:'Pedidos',entity_id:'p2',action:'delete',source:'local',reason:'delete',status:'conflict',created_at:'2026-08-04T10:00:00.000Z'}
];
const diagnosticInputSnapshot=JSON.stringify(diagnosticInput);
const readOnlyDiagnostic=Sync.diagnoseQueueReadOnly(diagnosticInput);
assert.equal(readOnlyDiagnostic.total,4);
assert.equal(readOnlyDiagnostic.realEntities,3);
assert.equal(readOnlyDiagnostic.uniqueOperations,3);
assert.equal(readOnlyDiagnostic.probableDuplicates,1);
assert.equal(readOnlyDiagnostic.pending,3);
assert.equal(readOnlyDiagnostic.conflicts,1);
assert.deepEqual(readOnlyDiagnostic.byEntity,{Pedidos:3,Clientes:1});
assert.deepEqual(readOnlyDiagnostic.byAction,{update:2,create:1,delete:1});
assert.equal(readOnlyDiagnostic.oldestAt,'2026-08-01T10:00:00.000Z');
assert.equal(readOnlyDiagnostic.newestAt,'2026-08-04T10:00:00.000Z');
assert.equal(JSON.stringify(diagnosticInput),diagnosticInputSnapshot,'O diagnóstico não pode alterar nem metadados da fila');

assert.equal(Sync.isSyncableEntityType('Pedidos'),true);
assert.equal(Sync.isSyncableEntityType('Imagens'),true,'Metadados de imagem continuam sincronizáveis');
assert.equal(Sync.isSyncableEntityType('Diagnosticos'),false,'Diagnósticos devem ser estritamente locais');
assert.equal(Sync.isSyncableEntityType('uiState'),false);
assert.equal(Sync.shouldQueueMutation('orders','user'),true,'Pedido alterado pelo usuário deve entrar na fila');
assert.equal(Sync.shouldQueueMutation('orders','google-sheets'),false,'Dados recebidos do Sheets não podem voltar para a fila');
assert.equal(Sync.shouldQueueMutation('orders','restore'),false,'Restauração não pode criar operações');
for(const collection of ['diagnostics','uiState','counters','makerWorldCache','shopeeLearnedAliases','drafts','syncMetadata'])assert.equal(Sync.shouldQueueMutation(collection,'user'),false,`${collection} deve permanecer local`);

const remainingEntityCounts={Imagens:236,Produtos:34,Orcamento_Itens:32,Orcamentos:32,Pedidos:24,Venda_Itens:24,Vendas:21,Clientes:18,Kit_Itens:16,Filamentos:12,Kits:6,Configuracoes:1};
const contaminatedQueue=[];
for(let index=0;index<122008;index++)contaminatedQueue.push({
  operation_id:`diag-contaminated-${index}`,entity:'Diagnosticos',entity_id:`diag-${index}`,action:index<94000?'delete':'upsert',status:'pending',payload:{id:`diag-${index}`},created_at:new Date(1722500000000+index).toISOString()
});
let commercialIndex=0;
for(const [entity,count] of Object.entries(remainingEntityCounts))for(let index=0;index<count;index++){
  const action=commercialIndex<328?'delete':'upsert';
  contaminatedQueue.push({operation_id:`commercial-${commercialIndex}`,entity,entity_id:`${entity}-${index}`,action,status:commercialIndex<4?'conflict':'pending',payload:{id:`${entity}-${index}`},source:'user',reason:'acceptance-test',created_at:new Date(1722700000000+commercialIndex).toISOString()});commercialIndex++;
}
const contaminatedReport=Sync.diagnoseQueueReadOnly(contaminatedQueue);
assert.equal(contaminatedReport.total,122464);
assert.equal(contaminatedReport.pending,122460);
assert.equal(contaminatedReport.conflicts,4);
assert.equal(contaminatedReport.byEntity.Diagnosticos,122008);
assert.deepEqual(contaminatedReport.byAction,{delete:94328,upsert:28136});
const surgicalRepair=Sync.removeQueueEntities(contaminatedQueue,['Diagnosticos']);
assert.equal(surgicalRepair.report.removed,122008);
assert.equal(surgicalRepair.report.removedConflicts,0);
assert.equal(surgicalRepair.report.after.total,456);
assert.equal(surgicalRepair.report.after.pending,452);
assert.equal(surgicalRepair.report.after.conflicts,4,'Os quatro conflitos comerciais devem permanecer intactos');
assert.equal(surgicalRepair.report.after.byAction.delete,328);
assert.equal(surgicalRepair.report.after.byAction.upsert,128);
assert.equal(surgicalRepair.report.after.byEntity.Diagnosticos,undefined);
assert.deepEqual(surgicalRepair.report.after.byEntity,remainingEntityCounts);
console.log('Fila: diagnóstico, deduplicação, conflitos e operationId idempotente OK');
