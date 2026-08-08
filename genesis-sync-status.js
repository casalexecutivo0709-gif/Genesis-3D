/* Genesis 3D — indicador consolidado, orientado por eventos e sem polling. */
(function(){
  'use strict';
  const state={sheets:{status:'idle',text:'Aguardando dados',enabled:false,configured:false,pending:0,conflicts:0},local:{status:'idle',text:'Servidor local não testado',enabled:false},realtime:{status:'disabled',text:'Realtime desativado'},images:{status:'idle',pending:0,failed:0}};
  const LABELS={connected:'Conectado',syncing:'Sincronizando',offline:'Offline',conflict:'Conflito',error:'Erro'};
  function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function overall(){
    if(!navigator.onLine)return 'offline';
    if(Number(state.sheets.conflicts)>0||state.sheets.status==='conflict')return 'conflict';
    if(state.sheets.status==='error'||(state.local.enabled&&state.local.status==='error')||(state.realtime.status==='error'&&window.GenesisRealtime?.status?.().configured)||Number(state.images.failed)>0)return 'error';
    if(state.sheets.status==='syncing'||state.images.status==='syncing'||Number(state.sheets.pending)>0||Number(state.images.pending)>0)return 'syncing';
    return 'connected';
  }
  function render(){const status=overall(),button=document.getElementById('genesisSyncIndicator');if(!button)return;button.dataset.state=status;button.querySelector('.genesis-sync-label').textContent=LABELS[status];button.title=`Sincronização: ${LABELS[status]}`;}
  function row(label,value,stateName=''){return `<div class="genesis-diagnostic-row"><span>${esc(label)}</span><strong data-state="${esc(stateName)}">${esc(value)}</strong></div>`;}
  async function openDiagnostic(){
    const modal=document.getElementById('genesisSyncDiagnosticModal'),content=document.getElementById('genesisSyncDiagnosticContent');if(!modal||!content)return;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');content.innerHTML='<div class="secondary-note">Verificando o estado local…</div>';
    const data=await window.genesisSyncDiagnostics?.()||{internet:navigator.onLine,indexedDb:false,sheets:{}},workspace=await window.GenesisWorkspace?.diagnostics?.()||{},realtime=window.GenesisRealtime?.status?.()||state.realtime,sheets=data.sheets||{};
    const sheetsText=!sheets.enabled?'Desativado':!sheets.configured?'Não configurado':sheets.busy?'Sincronizando':sheets.conflicts?`${sheets.conflicts} conflito(s)`:sheets.pending?`${sheets.pending} pendente(s)`:sheets.lastSuccessAt?'Sincronizado':'Pronto';
    const serverText=!workspace.localEnabled?'Desativado':state.local.text||'Não testado',realtimeText=realtime.configured?realtime.text||realtime.status:'Desativado';
    content.innerHTML=row('Internet',data.internet?'Online':'Offline',data.internet?'connected':'offline')+row('IndexedDB',data.indexedDb?'Disponível':'Falha','')+row('Google Sheets',sheetsText,sheets.conflicts?'conflict':sheets.failed?'error':'')+row('Servidor local',serverText,state.local.status)+row('Realtime',realtimeText,realtime.status)+row('Fila pendente',String(sheets.pending||0),sheets.pending?'syncing':'')+row('Conflitos',String(sheets.conflicts||0),sheets.conflicts?'conflict':'')+row('Imagens aguardando',String(workspace.imagePending||0),workspace.imageFailed?'error':workspace.imagePending?'syncing':'');
    const conflictButton=document.getElementById('genesisDiagnosticConflicts');if(conflictButton)conflictButton.hidden=!sheets.conflicts;
  }
  function closeDiagnostic(){const modal=document.getElementById('genesisSyncDiagnosticModal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');}
  function install(){
    const topbar=document.querySelector('.topbar');if(!topbar||document.getElementById('genesisSyncIndicator'))return;
    const button=document.createElement('button');button.id='genesisSyncIndicator';button.className='genesis-sync-indicator';button.type='button';button.innerHTML='<span class="genesis-sync-dot"></span><span class="genesis-sync-label">Conectado</span>';button.onclick=openDiagnostic;topbar.appendChild(button);
    const modal=document.createElement('div');modal.id='genesisSyncDiagnosticModal';modal.className='genesis-modal-layer';modal.setAttribute('aria-hidden','true');modal.innerHTML='<div class="genesis-modal-card genesis-sync-diagnostic"><div class="genesis-modal-head"><div><h2>Estado da sincronização</h2><p>Diagnóstico resumido sem recarregar o aplicativo.</p></div><button type="button" id="genesisDiagnosticClose" aria-label="Fechar">×</button></div><div id="genesisSyncDiagnosticContent"></div><div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" id="genesisDiagnosticSync" type="button">Sincronizar agora</button><button class="btn btn-secondary" id="genesisDiagnosticConflicts" type="button" hidden>Resolver conflitos</button></div></div>';document.body.appendChild(modal);
    document.getElementById('genesisDiagnosticClose').onclick=closeDiagnostic;modal.addEventListener('click',event=>{if(event.target===modal)closeDiagnostic();});document.getElementById('genesisDiagnosticSync').onclick=async()=>{await window.genesisSheetsSync?.({silent:false});await window.GenesisWorkspace?.flushImageQueue?.({silent:false});await openDiagnostic();};document.getElementById('genesisDiagnosticConflicts').onclick=()=>window.genesisOpenSyncConflicts?.();
    render();
  }
  window.addEventListener('genesis:sheets-status',event=>{state.sheets={...state.sheets,...event.detail};render();});
  window.addEventListener('genesis:local-server-status',event=>{state.local={...state.local,...event.detail};render();});
  window.addEventListener('genesis:realtime-status',event=>{state.realtime={...state.realtime,...event.detail};render();});
  window.addEventListener('genesis:image-sync-status',event=>{state.images={...state.images,...event.detail};render();});
  window.addEventListener('online',render);window.addEventListener('offline',render);
  if(window.genesisAppReady)setTimeout(install,350);else window.addEventListener('genesis:app-ready',()=>setTimeout(install,350),{once:true});
})();
