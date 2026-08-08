(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GenesisSyncCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function stableHash(value){
    let hash=2166136261;
    for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(36);
  }
  function stableObject(value){
    if(Array.isArray(value))return value.map(stableObject);
    if(!value||typeof value!=='object')return value;
    return Object.keys(value).sort().reduce((out,key)=>{
      if(['updated_at','sync_status','version'].includes(key))return out;
      out[key]=stableObject(value[key]);return out;
    },{});
  }
  function payloadFingerprint(payload){return stableHash(JSON.stringify(stableObject(payload||{})));}
  function normalizeOperation(item,index=0){
    const entity=String(item?.entity||item?.entityType||'').trim();
    const entityId=String(item?.entity_id||item?.entityId||item?.payload?.id||'').trim();
    const action=String(item?.action||item?.operationType||'upsert').trim()||'upsert';
    const version=Math.max(1,Number(item?.version??item?.payload?.version)||1);
    const fingerprint=String(item?.payload_fingerprint||payloadFingerprint(item?.payload));
    const operationId=String(item?.operation_id||item?.operationId||`legacy-${stableHash(`${entity}|${entityId}|${action}|${version}|${fingerprint}|${index}`)}`);
    return {...item,operation_id:operationId,operationId,entity,entityType:entity,entity_id:entityId,entityId,action,operationType:action,version,payload_fingerprint:fingerprint,status:item?.status||'pending'};
  }
  function equivalenceKey(item){
    const op=normalizeOperation(item);
    return `${op.entity}|${op.entity_id}|${op.action}|${op.version}|${op.payload_fingerprint}`;
  }
  function entityActionKey(item){
    const op=normalizeOperation(item);return `${op.entity}|${op.entity_id}|${op.action}`;
  }
  function countBy(items,keyFn){
    const counts={};items.forEach(item=>{const key=String(keyFn(item)||'desconhecido');counts[key]=(counts[key]||0)+1;});return counts;
  }
  function diagnoseQueue(queue){
    const normalized=(Array.isArray(queue)?queue:[]).map(normalizeOperation);
    const equivalent=countBy(normalized,equivalenceKey);
    const duplicateGroups=Object.entries(equivalent).filter(([,count])=>count>1).map(([key,count])=>({key,count,duplicates:count-1}));
    return {
      total:normalized.length,
      byEntity:countBy(normalized,item=>item.entity),
      byAction:countBy(normalized,item=>item.action),
      byEntityId:countBy(normalized,item=>`${item.entity}:${item.entity_id}`),
      byStatus:countBy(normalized,item=>item.status),
      duplicateGroups,
      duplicates:duplicateGroups.reduce((sum,item)=>sum+item.duplicates,0),
      conflicts:normalized.filter(item=>item.status==='conflict').length,
      synced:normalized.filter(item=>item.status==='synced').length
    };
  }
  function preference(item){
    const statusScore={conflict:50,syncing:40,pending:30,failed:20,synced:10}[item.status]||0;
    const updated=Date.parse(item.updated_at||item.updatedAt||item.created_at||item.createdAt||0)||0;
    return statusScore*1e15+Math.max(0,Number(item.version)||1)*1e10+updated;
  }
  function repairQueue(queue){
    const before=diagnoseQueue(queue),normalized=(Array.isArray(queue)?queue:[]).map(normalizeOperation);
    const exact=new Map();let exactRemoved=0,syncedRemoved=0;
    normalized.forEach(item=>{
      if(item.status==='synced'){syncedRemoved++;return;}
      const key=equivalenceKey(item),previous=exact.get(key);
      if(!previous){exact.set(key,item);return;}
      exactRemoved++;
      if(preference(item)>preference(previous))exact.set(key,item);
    });
    const conflicts=[],activeGroups=new Map();
    [...exact.values()].forEach(item=>{
      if(item.status==='conflict'){conflicts.push(item);return;}
      const key=entityActionKey(item),previous=activeGroups.get(key);
      if(!previous||preference(item)>preference(previous))activeGroups.set(key,item);
    });
    const activeBefore=[...exact.values()].filter(item=>item.status!=='conflict').length;
    const supersededRemoved=Math.max(0,activeBefore-activeGroups.size);
    const repaired=[...conflicts,...activeGroups.values()].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
    const after=diagnoseQueue(repaired);
    return {queue:repaired,report:{before:before.total,duplicates:exactRemoved+supersededRemoved,syncedRemoved,conflictsPreserved:conflicts.length,real:after.total,after:after.total,exactRemoved,supersededRemoved,beforeDetails:before,afterDetails:after}};
  }
  function operationId({entity,entityId,action='upsert',version=1,fingerprint='',deviceId=''}){
    return `op-${stableHash(`${entity}|${entityId}|${action}|${version}|${fingerprint}|${deviceId}`)}`;
  }
  return {stableHash,payloadFingerprint,normalizeOperation,equivalenceKey,diagnoseQueue,repairQueue,operationId};
});
