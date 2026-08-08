/* Genesis 3D — Firebase Realtime Database opcional, somente barramento de eventos. */
(function(){
  'use strict';
  const Core=window.GenesisRealtimeCore,CONFIG_KEY='genesis3d:realtimeConfig',SESSION_KEY='genesis3d:realtimeSession',CLEANUP_KEY='genesis3d:realtimeCleanupAt';
  const state={status:'disabled',text:'Realtime desativado',source:null,reconnectTimer:0,reconnectAttempt:0,connectGeneration:0,session:null,processed:new Set(),started:false};
  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}}
  function readConfig(){const saved=readJson(CONFIG_KEY,{});return {enabled:!!saved.enabled,apiKey:String(saved.apiKey||'').trim(),databaseURL:String(saved.databaseURL||'').trim().replace(/\/$/,''),workspaceId:String(saved.workspaceId||'').trim()};}
  function writeConfig(value){localStorage.setItem(CONFIG_KEY,JSON.stringify({enabled:!!value.enabled,apiKey:String(value.apiKey||'').trim(),databaseURL:String(value.databaseURL||'').trim().replace(/\/$/,''),workspaceId:String(value.workspaceId||'').trim()}));}
  function configReady(config=readConfig()){return !!(config.enabled&&config.apiKey&&/^https:\/\//i.test(config.databaseURL)&&Core.validWorkspaceId(config.workspaceId));}
  function emit(status,text,details={}){state.status=status;state.text=text;window.dispatchEvent(new CustomEvent('genesis:realtime-status',{detail:{status,text,...details}}));const label=document.getElementById('genesisRealtimeStatus');if(label){label.textContent=text;label.dataset.state=status;}}
  function safeError(error){return String(error?.message||error||'Falha realtime').replace(/[?&](?:auth|key)=[^&\s]+/gi,'').slice(0,240);}
  async function fetchJson(url,options={}){const response=await fetch(url,{...options,cache:'no-store'}),payload=await response.json().catch(()=>({}));if(!response.ok||payload.error){const message=payload.error?.message||payload.error||`Resposta ${response.status}`;throw new Error(message);}return payload;}
  function sessionConfigId(config){return `${config.databaseURL}|${config.apiKey.slice(0,10)}`;}
  async function authenticate(force=false){
    const config=readConfig();if(!configReady(config))throw new Error('Complete a configuração gratuita do Firebase.');
    let session=state.session||readJson(SESSION_KEY,null),payload;
    if(!force&&session?.configId===sessionConfigId(config)&&session.idToken&&Number(session.expiresAt)>Date.now()+90000){state.session=session;return session;}
    if(session?.configId===sessionConfigId(config)&&session.refreshToken){
      try{payload=await fetchJson(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`});session={configId:sessionConfigId(config),idToken:payload.id_token,refreshToken:payload.refresh_token||session.refreshToken,uid:payload.user_id||session.uid,expiresAt:Date.now()+(Number(payload.expires_in)||3600)*1000};}
      catch(error){session=null;}
    }
    if(!session){payload=await fetchJson(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});session={configId:sessionConfigId(config),idToken:payload.idToken,refreshToken:payload.refreshToken,uid:payload.localId,expiresAt:Date.now()+(Number(payload.expiresIn)||3600)*1000};}
    state.session=session;localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
  }
  function remember(operationId){state.processed.add(operationId);if(state.processed.size>300)state.processed.delete(state.processed.values().next().value);}
  async function consume(input){
    const normalized=Core.normalizeEvent(input);if(!normalized)return;
    const localVersion=await window.genesisGetEntityVersion?.(normalized.entityType,normalized.entityId)||0,decision=Core.shouldProcess(normalized,{deviceId:window.genesisSheetsDeviceId?.()||'',localVersion,processed:state.processed});
    if(!decision.process)return;
    remember(normalized.operationId);
    const applied=await window.genesisSheetsPullEntity?.(normalized.entityType,normalized.entityId);
    window.dispatchEvent(new CustomEvent('genesis:realtime-entity',{detail:{...normalized,applied:!!applied}}));
  }
  function consumePayload(payload){
    let parsed;try{parsed=JSON.parse(payload.data||'null')}catch{return;}
    const data=parsed?.data;if(!data)return;
    if(data.operationId){void consume(data);return;}
    if(typeof data==='object')Object.values(data).forEach(value=>{if(value?.operationId)void consume(value);});
  }
  function close(){state.connectGeneration++;clearTimeout(state.reconnectTimer);state.source?.close?.();state.source=null;}
  function scheduleReconnect(){
    close();const config=readConfig();if(!configReady(config)||document.visibilityState==='hidden')return;
    const delay=Math.min(60000,3000*Math.pow(2,state.reconnectAttempt++));state.reconnectTimer=setTimeout(()=>connect(),delay);
  }
  async function connect(){
    close();const generation=state.connectGeneration,config=readConfig();
    if(!config.enabled){emit('disabled','Realtime desativado');return false;}
    if(!navigator.onLine){emit('offline','Realtime offline');return false;}
    if(!configReady(config)){emit('error','Configuração realtime incompleta');return false;}
    emit('connecting','Conectando realtime…');
    try{
      const session=await authenticate();if(generation!==state.connectGeneration)return false;
      const base=Core.eventPath(config.databaseURL,config.workspaceId),query=`auth=${encodeURIComponent(session.idToken)}&orderBy=${encodeURIComponent('"updatedAt"')}&limitToLast=50`;
      const source=new EventSource(`${base}?${query}`);state.source=source;
      source.addEventListener('put',consumePayload);source.addEventListener('patch',consumePayload);
      source.onopen=()=>{state.reconnectAttempt=0;emit('connected','Realtime conectado');void cleanupOwnEvents();};
      source.onerror=()=>{emit(navigator.onLine?'error':'offline',navigator.onLine?'Realtime reconectando…':'Realtime offline');scheduleReconnect();};
      return true;
    }catch(error){emit('error',`Realtime indisponível: ${safeError(error)}`);scheduleReconnect();return false;}
  }
  async function publish(input){
    const config=readConfig();if(!configReady(config)||!navigator.onLine)return false;
    const event=Core.normalizeEvent(input);if(!event)return false;
    try{
      const session=await authenticate(),payload={...event,authUid:session.uid,publishedAt:Date.now()},url=Core.eventPath(config.databaseURL,config.workspaceId,event.operationId)+`?auth=${encodeURIComponent(session.idToken)}`;
      await fetchJson(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});remember(event.operationId);return true;
    }catch(error){state.session=null;emit('error',`Evento realtime aguardará a próxima sincronização: ${safeError(error)}`);return false;}
  }
  async function cleanupOwnEvents(){
    if(Date.now()-Number(localStorage.getItem(CLEANUP_KEY)||0)<86400000)return;
    const config=readConfig();
    try{
      const session=await authenticate(),cutoff=Date.now()-7*86400000,base=Core.eventPath(config.databaseURL,config.workspaceId),query=`auth=${encodeURIComponent(session.idToken)}&orderBy=${encodeURIComponent('"publishedAt"')}&endAt=${cutoff}&limitToFirst=50`,rows=await fetchJson(`${base}?${query}`);
      for(const [id,row] of Object.entries(rows||{})){if(row?.authUid!==session.uid)continue;await fetch(`${Core.eventPath(config.databaseURL,config.workspaceId,id)}?auth=${encodeURIComponent(session.idToken)}`,{method:'DELETE'});}
      localStorage.setItem(CLEANUP_KEY,String(Date.now()));
    }catch(error){}
  }
  function generatedWorkspaceId(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
  function installSettings(){
    const settings=document.getElementById('screen-settings'),anchor=document.getElementById('genesisImageCloudSettings')||document.getElementById('sheetsApiUrl')?.closest('.card');if(!settings||document.getElementById('genesisRealtimeSettings'))return;
    const config=readConfig(),card=document.createElement('div');card.id='genesisRealtimeSettings';card.className='card';card.innerHTML='<p class="card-label">Sincronização realtime opcional</p><p class="secondary-note">Somente barramento de eventos no Firebase Realtime Database · plano Spark gratuito. Google Sheets continua sendo o banco principal.</p><label class="checkbox-row"><input id="genesisRealtimeEnabled" type="checkbox"><span>Ativar realtime entre celular e computador</span></label><div class="field"><label>Firebase Web API Key</label><input id="genesisRealtimeApiKey" type="password" autocomplete="off" placeholder="Cole a apiKey do app Web"></div><div class="field"><label>Realtime Database URL</label><input id="genesisRealtimeDatabaseUrl" type="url" autocomplete="off" placeholder="https://seu-projeto-default-rtdb.firebaseio.com"></div><div class="field"><label>Código privado do seu espaço</label><div class="row2"><input id="genesisRealtimeWorkspace" autocomplete="off" placeholder="Mesmo código nos dois aparelhos"><button class="btn btn-secondary" id="genesisRealtimeGenerate" type="button">Gerar</button></div></div><div class="btn-row"><button class="btn btn-secondary" id="genesisRealtimeTest" type="button">Testar realtime</button></div><div class="integration-status"><span class="integration-dot" id="genesisRealtimeDot"></span><span id="genesisRealtimeStatus">Realtime não testado</span></div>';
    if(anchor?.parentNode)anchor.parentNode.insertBefore(card,anchor.nextSibling);else settings.appendChild(card);
    card.querySelector('#genesisRealtimeEnabled').checked=config.enabled;card.querySelector('#genesisRealtimeApiKey').value=config.apiKey;card.querySelector('#genesisRealtimeDatabaseUrl').value=config.databaseURL;card.querySelector('#genesisRealtimeWorkspace').value=config.workspaceId;
    const persist=(reconnect=true)=>{writeConfig({enabled:card.querySelector('#genesisRealtimeEnabled').checked,apiKey:card.querySelector('#genesisRealtimeApiKey').value,databaseURL:card.querySelector('#genesisRealtimeDatabaseUrl').value,workspaceId:card.querySelector('#genesisRealtimeWorkspace').value});state.session=null;localStorage.removeItem(SESSION_KEY);if(reconnect)void connect();};
    card.addEventListener('change',()=>persist(true));card.querySelector('#genesisRealtimeGenerate').onclick=()=>{card.querySelector('#genesisRealtimeWorkspace').value=generatedWorkspaceId();persist(true);};card.querySelector('#genesisRealtimeTest').onclick=async()=>{persist(false);const ok=await connect();showToast(ok?'Realtime conectado no plano gratuito':'Não foi possível conectar ao realtime.',ok);};
  }
  function updateDot(event){const dot=document.getElementById('genesisRealtimeDot');if(dot)dot.className='integration-dot '+(event.detail.status==='connected'?'ok':event.detail.status==='error'?'bad':'');}
  function init(){if(state.started)return;state.started=true;installSettings();window.addEventListener('genesis:realtime-status',updateDot);window.addEventListener('online',connect);window.addEventListener('offline',()=>{close();emit('offline','Realtime offline');});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')close();else connect();});void connect();}
  window.GenesisRealtime={connect,close,publish,status:()=>({status:state.status,text:state.text,configured:configReady()}),config:readConfig};
  if(window.genesisAppReady)setTimeout(init,300);else window.addEventListener('genesis:app-ready',()=>setTimeout(init,300),{once:true});
})();
