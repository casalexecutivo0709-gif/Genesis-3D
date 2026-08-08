(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GenesisRealtimeCore=api;
})(typeof self!=='undefined'?self:globalThis,function(){
  'use strict';
  function clean(value,max=160){return String(value??'').trim().slice(0,max);}
  function normalizeEvent(input={}){
    const event={operationId:clean(input.operationId||input.operation_id),entityType:clean(input.entityType||input.entity),entityId:clean(input.entityId||input.entity_id),version:Math.max(0,Number(input.version)||0),updatedAt:clean(input.updatedAt||input.updated_at,40),deviceId:clean(input.deviceId||input.device_id),eventType:clean(input.eventType||input.action||'updated',40)};
    return event.operationId&&event.entityType&&event.entityId&&event.version?event:null;
  }
  function shouldProcess(input,{deviceId='',localVersion=0,processed=null}={}){
    const event=normalizeEvent(input);if(!event)return {process:false,reason:'invalid',event:null};
    if(event.deviceId&&event.deviceId===deviceId)return {process:false,reason:'same-device',event};
    if(processed?.has?.(event.operationId))return {process:false,reason:'duplicate',event};
    if(event.version<=Number(localVersion||0))return {process:false,reason:'stale',event};
    return {process:true,reason:'newer',event};
  }
  function validWorkspaceId(value){return /^[a-zA-Z0-9_-]{24,80}$/.test(String(value||''));}
  function eventPath(databaseURL,workspaceId,operationId=''){
    if(!validWorkspaceId(workspaceId))throw new Error('Código do espaço realtime inválido.');
    const base=String(databaseURL||'').trim().replace(/\/$/,'');if(!/^https:\/\//i.test(base))throw new Error('URL do Realtime Database inválida.');
    return `${base}/events/${workspaceId}${operationId?'/'+encodeURIComponent(operationId):''}.json`;
  }
  return {normalizeEvent,shouldProcess,validWorkspaceId,eventPath};
});
