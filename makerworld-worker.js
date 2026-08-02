const ALLOWED_ORIGINS = new Set([
  'https://douglasscaramelli-spec.github.io',
  'https://executivo0709-gif.github.io',
  'https://casalexecutivo0709-gif.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);

const MAKERWORLD_BASE = 'https://makerworld.com';
const BAMBU_API = 'https://api.bambulab.com/v1';
const COMMUNITY_INDEX = 'https://api.tryar.in';
const THINGIVERSE_API = 'https://api.thingiverse.com';
const UA = 'Genesis3D/4.0 (+https://casalexecutivo0709-gif.github.io/Genesis-3D/)';

function configuredOrigins(env) {
  const extra = String(env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return new Set([...ALLOWED_ORIGINS, ...extra]);
}
function originAllowed(origin, env) {
  return !origin || configuredOrigins(env).has(String(origin).replace(/\/$/, ''));
}
function cors(origin) {
  const allowed = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(data, status = 200, origin = '', extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin), ...extra }
  });
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function cleanText(v, max = 180) { return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
function first(...vals) { return vals.find(v => v !== undefined && v !== null && v !== ''); }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }

const FREE_AI_MODEL='@cf/moondream/moondream3.1-9B-A2B';
const FREE_AI_MAX_IMAGES_PER_REQUEST=4;
const FREE_AI_DAILY_DEVICE_LIMIT=24;

function extractJsonObject(value){
  if(value&&typeof value==='object'&&!Array.isArray(value))return value;
  const text=String(value||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<start){
    const error=new Error('A IA gratuita não devolveu JSON válido.');
    error.rawAnswer=text.slice(0,600);
    throw error;
  }
  try{return JSON.parse(text.slice(start,end+1))}
  catch(parseError){
    parseError.rawAnswer=text.slice(0,600);
    throw parseError;
  }
}
function streamedAnswerText(text){
  const raw=String(text||'').trim();
  if(!raw)return '';
  if(!raw.includes('\ndata:')&&!raw.startsWith('data:'))return raw;
  const parts=[];
  for(const line of raw.split(/\r?\n/)){
    if(!line.startsWith('data:'))continue;
    const data=line.slice(5).trim();
    if(!data||data==='[DONE]')continue;
    try{
      const parsed=JSON.parse(data);
      const value=parsed?.answer??parsed?.response??parsed?.text??parsed?.token;
      if(value!==undefined&&value!==null)parts.push(String(value));
    }catch{}
  }
  return parts.join('');
}
async function modelAnswerText(result){
  if(typeof result==='string')return result;
  const direct=[
    result?.answer,result?.response,result?.output_text,result?.text,
    result?.result?.answer,result?.result?.response,result?.result?.text
  ].find(value=>typeof value==='string'&&value.trim());
  if(direct)return direct;
  if(typeof ReadableStream!=='undefined'&&result instanceof ReadableStream){
    return streamedAnswerText(await new Response(result).text());
  }
  if(result?.body&&typeof ReadableStream!=='undefined'&&result.body instanceof ReadableStream){
    return streamedAnswerText(await new Response(result.body).text());
  }
  return '';
}
function nullableNumber(value){
  if(value===null||value===undefined||value==='')return null;
  const parsed=Number(String(value).replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
  return Number.isFinite(parsed)?parsed:null;
}
function normalizeShopeeUsername(value){
  const candidate=cleanText(value,80).replace(/^@/,'').trim();
  if(!/^[a-z0-9][a-z0-9._-]{3,49}$/i.test(candidate))return '';
  if(/^(concluido|concluído|shopee|tradicional|pix|cliente|comprador)$/i.test(candidate))return '';
  return candidate;
}
function normalizedShopeeScreenshot(raw,index){
  const text=(key,max=300)=>cleanText(raw?.[key],max);
  const username=normalizeShopeeUsername(raw?.buyerUsername)||normalizeShopeeUsername(raw?.buyer);
  const items=(Array.isArray(raw?.items)?raw.items:[]).slice(0,30).map(item=>({
    productName:cleanText(item?.productName,500),
    variation:cleanText(item?.variation,300),
    qty:clamp(parseInt(item?.qty,10)||1,1,9999),
    unitPrice:nullableNumber(item?.unitPrice),
    subtotal:nullableNumber(item?.subtotal),
    sku:cleanText(item?.sku,180),
    shopeeItemId:cleanText(item?.shopeeItemId,180)
  }));
  return {
    index,
    screenType:text('screenType',80),
    orderId:text('orderId',120),
    orderDate:text('orderDate',20),
    orderTime:text('orderTime',10),
    paymentDate:text('paymentDate',20),
    paymentTime:text('paymentTime',10),
    completionDate:text('completionDate',20),
    completionTime:text('completionTime',10),
    transferDate:text('transferDate',20),
    shopeeStatus:text('shopeeStatus',120),
    postingDeadline:text('postingDeadline',20),
    buyer:username||text('buyer',180),
    buyerUsername:username,
    city:text('city',120),
    state:text('state',40),
    cep:text('cep',20),
    address:text('address',500),
    productValue:nullableNumber(raw?.productValue),
    discount:nullableNumber(raw?.discount),
    freight:nullableNumber(raw?.freight),
    total:nullableNumber(raw?.total),
    paidValue:nullableNumber(raw?.paidValue),
    netRevenue:nullableNumber(raw?.netRevenue),
    fees:nullableNumber(raw?.fees),
    paymentMethod:text('paymentMethod',80),
    logistics:text('logistics',180),
    tracking:text('tracking',180),
    items,
    confidence:clamp(Math.round(Number(raw?.confidence)||65),0,100),
    notes:(Array.isArray(raw?.notes)?raw.notes:[]).slice(0,20).map(v=>cleanText(v,300)).filter(Boolean)
  };
}
async function readShopeeUsernameFromProductScreen(env,image){
  const result=await env.AI.run(FREE_AI_MODEL,{
    task:'query',
    image,
    question:`Observe somente a linha imediatamente acima do produto: há um avatar à esquerda, o nome de login da conta e uma seta à direita. Copie EXATAMENTE esse login, preservando letras e números. No padrão esperado ele se parece com "hugohackenhaar627". Não converta em nome real e não use Driver's Name. Responda apenas {"buyerUsername":"texto_exato"}.`,
    reasoning:false,
    temperature:0,
    max_tokens:100,
    stream:false
  });
  const answer=await modelAnswerText(result);
  try{
    const parsed=extractJsonObject(answer);
    return normalizeShopeeUsername(parsed?.buyerUsername);
  }catch{
    return normalizeShopeeUsername(String(answer).replace(/[{}"']/g,'').replace(/^buyerUsername\s*:\s*/i,''));
  }
}
function isFreeAiLimitError(error){
  return /quota|rate.?limit|daily.?limit|neurons?|exceeded|429|3036/i.test(String(error?.message||error||''));
}
async function analyzeShopee(request,env,origin){
  if(String(env.ZERO_COST_MODE||'')!=='strict-free'){
    return json({ok:false,code:'zero_cost_guard',error:'A IA foi bloqueada porque o modo gratuito rígido não está ativo.'},503,origin);
  }
  if(!env.AI?.run)return json({ok:false,code:'free_ai_not_configured',error:'A IA gratuita ainda não está vinculada ao Worker.'},503,origin);
  const contentLength=Number(request.headers.get('content-length')||0);
  if(contentLength>18*1024*1024)return json({ok:false,error:'Envio maior que 18 MB.'},413,origin);
  let body;
  try{body=await request.json()}catch{return json({ok:false,error:'JSON inválido.'},400,origin)}
  const images=Array.isArray(body?.images)?body.images:[];
  if(!images.length||images.length>FREE_AI_MAX_IMAGES_PER_REQUEST)return json({ok:false,error:`Envie de 1 a ${FREE_AI_MAX_IMAGES_PER_REQUEST} screenshots.`},400,origin);
  let totalChars=0;
  for(const image of images){
    const value=String(image||'');
    totalChars+=value.length;
    if(!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value)){
      return json({ok:false,error:'Formato de imagem inválido.'},415,origin);
    }
  }
  if(totalChars>16*1024*1024)return json({ok:false,error:'Imagens maiores que o limite permitido.'},413,origin);
  const question=`Leia este screenshot da Shopee Brasil com atenção de OCR. Extraia somente o que estiver visível; nunca invente, complete, traduza ou corrija nomes, usuários, códigos, datas e valores.
Responda SOMENTE com um objeto JSON válido, sem markdown, neste formato:
{"screenType":"","orderId":"","orderDate":"","orderTime":"","paymentDate":"","paymentTime":"","completionDate":"","completionTime":"","transferDate":"","shopeeStatus":"","postingDeadline":"","buyer":"","buyerUsername":"","city":"","state":"","cep":"","address":"","productValue":null,"discount":null,"freight":null,"total":null,"paidValue":null,"netRevenue":null,"fees":null,"paymentMethod":"","logistics":"","tracking":"","items":[{"productName":"","variation":"","qty":1,"unitPrice":null,"subtotal":null,"sku":"","shopeeItemId":""}],"confidence":0,"notes":[]}
Regras importantes:
- orderId: copie EXATAMENTE o texto após "ID do pedido", sem # e sem trocar letras ou números.
- buyerUsername: na tela "Detalhes do pedido", copie EXATAMENTE o login na linha com avatar e seta, imediatamente acima da foto/título do produto. Exemplo do formato: hugohackenhaar627. Não transforme o login em nome real. buyer deve receber esse mesmo login. "Driver's Name" nunca é comprador.
- productName: é o título do produto ao lado da foto. Ignore selos como "Pré-encomenda". variation é a opção logo abaixo, como "Tradicional".
- qty: leia "x 1", "x1" ou a quantidade mostrada.
- productValue: "Subtotal dos Produtos", "Preço do Produto" ou preço do item.
- paidValue: "Pagamento total" ou "Pagamento do Comprador".
- netRevenue: "Renda do pedido", "Valor Final do Pedido" ou "Valor final do pedido".
- fees: valor de "Taxas e Encargos", "Comissão e Taxas" ou a soma das taxas, preservando o sinal.
- orderDate/orderTime: "Horário do pedido". paymentDate/paymentTime: "Data do pagamento". completionDate/completionTime: "Horário de conclusão". transferDate: "Pedido Completado em".
- paymentMethod: método como Pix. shopeeStatus: estado como Concluído.
Valores monetários são números em reais sem R$. Datas são YYYY-MM-DD; horários HH:MM. Preserve exatamente pedido, usuário, SKU e rastreio. Use string vazia ou null quando ausente.`;
  const screenshots=[],warnings=[];
  for(let index=0;index<images.length;index++){
    let result;
    try{
      result=await env.AI.run(FREE_AI_MODEL,{
        task:'query',
        image:images[index],
        question,
        reasoning:false,
        temperature:0,
        max_tokens:1400,
        stream:false
      });
    }catch(error){
      console.error('[Genesis3D Free AI runtime]',error);
      if(isFreeAiLimitError(error)){
        return json({ok:false,code:'free_ai_limit',error:'Limite diário da IA gratuita atingido. O OCR local continuará funcionando.'},429,origin,{'Cache-Control':'no-store'});
      }
      return json({ok:false,code:'free_ai_runtime_error',error:'A IA gratuita não conseguiu analisar estes prints. O OCR local continuará funcionando.'},502,origin,{'Cache-Control':'no-store'});
    }
    try{
      const answer=await modelAnswerText(result);
      const parsed=extractJsonObject(answer);
      let username=normalizeShopeeUsername(parsed?.buyerUsername)||normalizeShopeeUsername(parsed?.buyer);
      const hasProductEvidence=Array.isArray(parsed?.items)&&parsed.items.some(item=>cleanText(item?.productName,80));
      const likelyOrderScreen=hasProductEvidence||!!cleanText(parsed?.orderId,80)||!!cleanText(parsed?.buyer,80)||/pedido|produto/i.test(cleanText(parsed?.screenType,80));
      if((!username||!/\d/.test(username))&&likelyOrderScreen){
        try{
          username=(await readShopeeUsernameFromProductScreen(env,images[index]))||username;
        }catch(usernameError){
          console.warn('[Genesis3D Free AI username pass]',usernameError);
          warnings.push(`Print ${index+1}: não foi possível confirmar o login do comprador.`);
        }
      }
      if(username){
        parsed.buyerUsername=username;
        parsed.buyer=username;
      }
      screenshots.push(normalizedShopeeScreenshot(parsed,index));
    }catch(error){
      console.error('[Genesis3D Free AI output]',error);
      const resultKeys=result&&typeof result==='object'?Object.keys(result).slice(0,20):[];
      return json({
        ok:false,
        code:'free_ai_invalid_output',
        error:'A IA gratuita respondeu em formato inesperado. O OCR local continuará funcionando.',
        diagnostic:cleanText(error?.rawAnswer||error?.message||'',600),
        resultShape:{type:typeof result,keys:resultKeys}
      },502,origin,{'Cache-Control':'no-store'});
    }
  }
  return json({
    ok:true,
    analysis:{screenshots,warnings},
    provider:'cloudflare-workers-ai-free',
    model:FREE_AI_MODEL,
    zeroCost:true
  },200,origin,{'Cache-Control':'no-store'});
}
function parseMakerWorldId(v) {
  const s = String(v || '');
  const m = s.match(/\/models\/(\d+)/i);
  return m ? m[1] : (/^\d{1,12}$/.test(s) ? s : '');
}
function parseThingiverseId(v) {
  const s = String(v || '');
  const m = s.match(/thing(?:%3A|:)(\d+)/i) || s.match(/\/thing\/(\d+)/i);
  return m ? m[1] : (/^\d{1,12}$/.test(s) ? s : '');
}

function isMakerWorldFamilyHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./,'');
  return h === 'makerworld.com' || h.endsWith('.makerworld.com')
    || h === 'bambulab.com' || h.endsWith('.bambulab.com')
    || h === 'bambulab.cn' || h.endsWith('.bambulab.cn');
}
function makerWorldIdFromHtml(html='') {
  const s=String(html||'');
  const patterns=[
    /https?:\/\/(?:[^"'<>]+\.)?makerworld\.com\/[^"'<>]*?\/models\/(\d+)/i,
    /\/models\/(\d+)/i,
    /["'](?:designId|design_id|modelId|model_id)["']\s*[:=]\s*["']?(\d{1,12})/i,
    /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/models\/(\d+)/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["'][^"']*\/models\/(\d+)/i
  ];
  for(const p of patterns){const m=s.match(p);if(m)return m[1];}
  return '';
}
async function resolveMakerWorldShare(rawUrl) {
  const raw=String(rawUrl||'').trim();
  const direct=parseMakerWorldId(raw);
  if(direct)return {id:direct,resolvedUrl:`https://makerworld.com/en/models/${direct}`};

  let u;
  try{u=new URL(raw);}catch{throw new Error('Link MakerWorld/Bambu Handy inválido.');}
  if(!isMakerWorldFamilyHost(u.hostname))throw new Error('O link não pertence ao MakerWorld/Bambu Lab.');

  const res=await fetchTimeout(u.toString(),{
    headers:{
      'Accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'User-Agent':UA,
      'Referer':'https://makerworld.com/'
    },
    redirect:'follow'
  },15000);

  const finalUrl=res.url||raw;
  let id=parseMakerWorldId(finalUrl);
  let body='';
  if(!id){
    try{body=await res.text();}catch(_){}
    id=makerWorldIdFromHtml(body);
  }
  if(!id)throw new Error('Não consegui identificar o modelo dentro desse link do Bambu Handy.');
  return {id,resolvedUrl:`https://makerworld.com/en/models/${id}`,finalUrl};
}

function detectSource(v, explicit = '') {
  if (explicit === 'makerworld' || explicit === 'thingiverse') return explicit;
  return /thingiverse\.com/i.test(String(v || '')) ? 'thingiverse' : 'makerworld';
}
async function fetchTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}
const commonHeaders = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': UA,
  'Referer': 'https://makerworld.com/'
};
function parseTimeMinutes(obj = {}) {
  const direct = n(first(obj.timeMinutes, obj.printTimeMinutes, obj.estimatedMinutes));
  if (direct && direct > 0) return direct;
  const hours = n(first(obj.printTimeHours, obj.timeHours));
  if (hours && hours > 0) return Math.round(hours * 600) / 10;
  const sec = n(first(obj.printTimeSeconds, obj.printingTimeSeconds, obj.estimatedTimeSeconds, obj.prediction));
  if (sec && sec > 0) return Math.round(sec / 6) / 10;
  const raw = first(obj.printTime, obj.printingTime, obj.estimatedTime, obj.time);
  if (typeof raw === 'string') {
    const h = raw.match(/(\d+(?:[.,]\d+)?)\s*h/i), m = raw.match(/(\d+)\s*m/i);
    if (h || m) return (h ? parseFloat(h[1].replace(',', '.')) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  }
  return null;
}
function parseWeight(obj = {}) {
  const g = n(first(obj.weightGrams, obj.filamentWeight, obj.totalFilamentWeight, obj.weight, obj.filament_used_g, obj.filamentUsed));
  return g && g > 0 ? Math.round(g * 10) / 10 : null;
}
function normalizePrinter(v) {
  if (!v) return '';
  if (typeof v === 'string') return cleanText(v, 60);
  return cleanText(first(v.name, v.model, v.modelName, v.displayName), 60);
}
function normalizeProfile(p = {}, idx = 0) {
  const meta = p.metadata || p.meta || p.sliceInfo || p.printInfo || {};
  const printer = normalizePrinter(first(p.printer, p.printerName, p.printerModel, p.machine, meta.printer, meta.printerName, meta.machine));
  const layer = first(p.layerHeight, p.layer_height, meta.layerHeight, meta.layer_height);
  const filaments = Array.isArray(p.filaments) ? p.filaments : (Array.isArray(meta.filaments) ? meta.filaments : []);
  const material = cleanText(first(p.material, p.filamentType, meta.material, filaments[0]?.type, filaments[0]?.material), 40);
  const plateCount = n(first(p.plateCount, p.plate_count, p.plates?.length, meta.plateCount));
  return {
    id: String(first(p.id, p.instanceId, p.profileId, p.pid, idx)),
    name: cleanText(first(p.name, p.title, p.profileName, p.instanceName, `Perfil ${idx + 1}`), 100),
    printer,
    layerHeight: layer == null || layer === '' ? '' : String(layer).replace('mm', '').trim(),
    timeMinutes: parseTimeMinutes({ ...meta, ...p }),
    weightGrams: parseWeight({ ...meta, ...p }),
    material,
    plateCount: plateCount && plateCount > 0 ? plateCount : null
  };
}
function normalizeMakerWorld(raw = {}, fallbackUrl = '') {
  const id = String(first(raw.id, raw.designId, raw.design_id, raw.modelIdNumeric, parseMakerWorldId(fallbackUrl), ''));
  const instances = first(raw.instances, raw.printProfiles, raw.profiles, raw.designInstances, raw.plates, []);
  const profiles = Array.isArray(instances) ? instances.map(normalizeProfile) : [];
  const creatorObj = first(raw.creator, raw.user, raw.author, raw.designUser, {});
  const creator = typeof creatorObj === 'string' ? creatorObj : cleanText(first(creatorObj.name, creatorObj.handle, creatorObj.nickname, raw.creatorName, raw.authorName), 80);
  const image = cleanText(first(raw.coverUrl, raw.cover, raw.image, raw.modelImage, raw.thumbnail, raw.thumbnailUrl, raw.images?.[0]?.url, raw.pictures?.[0]), 1000);
  const url = cleanText(first(raw.cleanUrl, raw.url, fallbackUrl, id ? `https://makerworld.com/en/models/${id}` : ''), 1000);
  return {
    modelId: id, id,
    title: cleanText(first(raw.title, raw.name, raw.modelName, raw.titleTranslated, 'Modelo MakerWorld'), 180),
    creator,
    image,
    makerWorldUrl: url,
    publicUrl: url,
    license: cleanText(first(raw.license, raw.licenseName, raw.licenseType, raw.license?.name, raw.licenseInfo?.name), 120),
    commercialUse: cleanText(first(raw.commercialUse, raw.commercial_use), 40) || 'unknown',
    profiles,
    printers: [...new Set(profiles.map(p => p.printer).filter(Boolean))],
    material: cleanText(first(raw.material, profiles.find(p => p.material)?.material), 40),
    source: 'makerworld',
    downloads: n(first(raw.downloads, raw.downloadCount, raw.download_count, raw.downloadNum, raw.statistics?.downloads, raw.stats?.downloads)),
    likes: n(first(raw.likes, raw.likeCount, raw.like_count, raw.statistics?.likes, raw.stats?.likes)),
    publishedAt: first(raw.publishedAt, raw.publishTime, raw.createdAt, raw.createTime, null)
  };
}
async function officialMakerWorldSuggest(query) {
  const url = `${MAKERWORLD_BASE}/api/v1/search-service/suggest2?keyword=${encodeURIComponent(query)}&include=design`;
  const res = await fetchTimeout(url, { headers: commonHeaders }, 9000);
  if (!res.ok) throw new Error(`MakerWorld search ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data.design) ? data.design : (Array.isArray(data.designs) ? data.designs : []);
  return list.map(x => normalizeMakerWorld(x));
}
async function communitySearch(query, sort, page = 1, limit = 40) {
  const mappedSort = sort === 'recent' ? 'recent' : 'popular';
  const url = `${COMMUNITY_INDEX}/api/models?q=${encodeURIComponent(query)}&sort=${mappedSort}&page=${page}&limit=${limit}`;
  const res = await fetchTimeout(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA } }, 9000);
  if (!res.ok) return [];
  const data = await res.json();
  const rows = Array.isArray(data.models) ? data.models : [];
  return rows.map(r => normalizeMakerWorld({
    id: r.modelId, title: r.modelName, modelImage: r.modelImage, creatorName: r.creatorName,
    cleanUrl: r.cleanUrl, license: r.license, profiles: [{
      id: r.profileId, name: r.profileName, printTimeHours: r.printTimeHours,
      weightGrams: r.weightGrams, plateCount: r.plateCount, printer: r.printerName || r.printer
    }], downloads: first(r.downloads, r.downloadCount), likes: first(r.likes, r.likeCount), publishedAt: first(r.publishedAt, r.createdAt)
  }, r.cleanUrl));
}
function dedupe(list) {
  const map = new Map();
  for (const x of list) {
    const key = `${x.source}:${x.modelId || x.publicUrl}`;
    if (!key) continue;
    if (!map.has(key)) map.set(key, x);
    else {
      const prev = map.get(key);
      if ((!prev.profiles?.length && x.profiles?.length) || (!prev.image && x.image)) map.set(key, { ...prev, ...x, profiles: x.profiles?.length ? x.profiles : prev.profiles });
    }
  }
  return [...map.values()];
}
async function searchMakerWorld(query, page, limit, sort) {
  const settled = await Promise.allSettled([
    page === 1 ? officialMakerWorldSuggest(query) : Promise.resolve([]),
    communitySearch(query, sort, page, limit)
  ]);
  const official = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const community = settled[1].status === 'fulfilled' ? settled[1].value : [];
  let all = dedupe([...official, ...community]);
  if (sort === 'downloads') all.sort((a,b)=>(Number(b.downloads)||0)-(Number(a.downloads)||0));
  else if (sort === 'popular') all.sort((a,b)=>(Number(b.likes||b.downloads)||0)-(Number(a.likes||a.downloads)||0));
  else if (sort === 'recent') all.sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  return { items: all.slice(0, limit), hasMore: community.length >= Math.min(limit, 3) };
}
async function fetchMakerWorldModel(id) {
  const primaryUrl = `${BAMBU_API}/design-service/design/${id}`;
  try {
    const res = await fetchTimeout(primaryUrl, { headers: commonHeaders }, 10000);
    if (res.ok) {
      const data = await res.json();
      const model = normalizeMakerWorld(data.design || data.data || data, `https://makerworld.com/en/models/${id}`);
      if (model.title && model.title !== 'Modelo MakerWorld') return model;
    }
  } catch (_) {}
  const fallbackUrl = `${COMMUNITY_INDEX}/api/scrape?url=${encodeURIComponent(`https://makerworld.com/en/models/${id}`)}`;
  const res2 = await fetchTimeout(fallbackUrl, { headers: { 'Accept': 'application/json', 'User-Agent': UA } }, 12000);
  if (!res2.ok) throw new Error(`Não foi possível consultar o MakerWorld (${res2.status})`);
  const data2 = await res2.json();
  return normalizeMakerWorld(data2.model || data2.data || data2, `https://makerworld.com/en/models/${id}`);
}

function thingiverseHeaders(env) {
  const token = String(env.THINGIVERSE_ACCESS_TOKEN || '').trim();
  if (!token) return null;
  return { 'Accept':'application/json', 'Authorization':`Bearer ${token}`, 'User-Agent':UA };
}
function normalizeThingiverse(raw = {}, image = '') {
  const id = String(first(raw.id, raw.thing_id, ''));
  const creatorObj = first(raw.creator, raw.user, {});
  const creator = typeof creatorObj === 'string' ? creatorObj : cleanText(first(creatorObj.name, creatorObj.username, raw.creator_name), 80);
  const print = raw.print_settings || raw.printSettings || {};
  const profile = Object.keys(print).length ? normalizeProfile({
    id:`tv-${id}`, name:'Configurações informadas pelo autor',
    layerHeight:first(print.layer_height, print.layerHeight),
    material:first(print.material, print.filament),
    timeMinutes:first(print.print_time_minutes, print.timeMinutes),
    weightGrams:first(print.filament_weight_g, print.weightGrams)
  }) : null;
  const profiles = profile && (profile.layerHeight || profile.material || profile.timeMinutes || profile.weightGrams) ? [profile] : [];
  const publicUrl = `https://www.thingiverse.com/thing:${id}`;
  return {
    modelId:id, id,
    title:cleanText(first(raw.name, raw.title, `Thing ${id}`), 180),
    creator,
    image:cleanText(first(image, thingiverseImageUrl(raw.default_image), raw.thumbnail, raw.preview_image), 1000),
    thingiverseUrl:publicUrl,
    publicUrl,
    license:cleanText(first(raw.license, raw.license_name),120),
    commercialUse:'unknown',
    profiles,
    printers:[],
    material:profiles[0]?.material || '',
    source:'thingiverse',
    downloads:n(first(raw.download_count, raw.downloads)),
    likes:n(first(raw.like_count, raw.likes)),
    publishedAt:first(raw.added, raw.created_at, raw.published_at, null)
  };
}
async function thingiverseFetch(env, path, timeout = 10000) {
  const headers = thingiverseHeaders(env);
  if (!headers) throw new Error('Thingiverse não configurado: adicione THINGIVERSE_ACCESS_TOKEN aos Secrets do Worker.');
  const res = await fetchTimeout(`${THINGIVERSE_API}${path}`, { headers }, timeout);
  if (!res.ok) throw new Error(`Thingiverse API ${res.status}`);
  return res;
}
async function searchThingiverse(env, query, page, limit, sort) {
  const sortMap = sort === 'recent' ? 'newest' : sort === 'downloads' ? 'popular' : 'relevant';
  const res = await thingiverseFetch(env, `/search/${encodeURIComponent(query)}?type=things&sort=${encodeURIComponent(sortMap)}&page=${page}&per_page=${limit}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (Array.isArray(data.hits) ? data.hits : (Array.isArray(data.things) ? data.things : []));
  const items = rows.map(r => normalizeThingiverse(r));
  return { items, hasMore: rows.length >= limit };
}
async function fetchThingiverseModel(env, id) {
  const res = await thingiverseFetch(env, `/things/${id}`);
  const raw = await res.json();
  let image = '';
  try {
    const ir = await thingiverseFetch(env, `/things/${id}/images?type=display`, 8000);
    const images = await ir.json();
    const firstImage = Array.isArray(images) ? images[0] : null;
    image = thingiverseImageUrl(firstImage);
  } catch (_) {}
  return normalizeThingiverse(raw, image);
}

function thingiverseImageUrl(image = {}) {
  const sizes = Array.isArray(image?.sizes) ? image.sizes : [];
  const preferred = ['display', 'large', 'medium', 'preview', 'thumb'];
  for (const type of preferred) {
    const hit = sizes.find(size => String(size?.type || '').toLowerCase() === type && size?.url);
    if (hit?.url) return hit.url;
  }
  const biggest = sizes
    .filter(size => size?.url)
    .sort((a,b)=>(Number(b?.size||b?.width||0))-(Number(a?.size||a?.width||0)))[0];
  return first(biggest?.url, image?.thumbnail, image?.preview_image, image?.url, '');
}

function allowedImageHost(host) {
  const h = host.toLowerCase();
  return h === 'makerworld.com' || h.endsWith('.makerworld.com') || h.endsWith('.bambulab.com') || h.endsWith('.bblmw.com') || h.endsWith('.amazonaws.com') || h.endsWith('.thingiverse.com') || h.endsWith('.thingiverseusercontent.com');
}
function inferredImageType(url, upstreamType = '') {
  const cleanType = String(upstreamType || '').split(';')[0].trim().toLowerCase();
  if (cleanType.startsWith('image/')) return cleanType;
  let pathname = '';
  try { pathname = new URL(url).pathname.toLowerCase(); } catch (_) {}
  if (/\.png$/.test(pathname)) return 'image/png';
  if (/\.webp$/.test(pathname)) return 'image/webp';
  if (/\.gif$/.test(pathname)) return 'image/gif';
  if (/\.avif$/.test(pathname)) return 'image/avif';
  if (/\.svg$/.test(pathname)) return 'image/svg+xml';
  if (/\.jpe?g$/.test(pathname)) return 'image/jpeg';
  return '';
}
async function proxyImageUrl(rawUrl, origin) {
  let u;
  try { u = new URL(rawUrl); } catch { return json({ ok:false, error:'URL de imagem inválida' }, 400, origin); }
  if (u.protocol !== 'https:' || !allowedImageHost(u.hostname)) return json({ ok:false, error:'Host de imagem não permitido' }, 403, origin);
  const res = await fetchTimeout(u.toString(), { headers:{ 'User-Agent':UA, 'Accept':'image/*' }, redirect:'follow' }, 12000);
  if (!res.ok) return json({ ok:false, error:'Imagem indisponível' }, 502, origin);
  let finalUrl;
  try { finalUrl = new URL(res.url || u.toString()); } catch { finalUrl = u; }
  if (!allowedImageHost(finalUrl.hostname)) return json({ ok:false, error:'Redirecionamento de imagem não permitido' }, 403, origin);
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > 20 * 1024 * 1024) return json({ ok:false, error:'Imagem maior que 20 MB' }, 413, origin);
  const ct = inferredImageType(finalUrl.toString(), res.headers.get('content-type'));
  if (!ct) return json({ ok:false, error:'Conteúdo não é imagem' }, 415, origin);
  return new Response(res.body, {
    status:200,
    headers:{
      'Content-Type':ct,
      'Content-Disposition':'inline',
      'Cache-Control':'public, max-age=86400',
      'X-Content-Type-Options':'nosniff',
      ...cors(origin)
    }
  });
}

async function combinedSearch(env, query, page, limit, sort, source) {
  const jobs = [];
  const names = [];
  if (source === 'all' || source === 'makerworld') { names.push('makerworld'); jobs.push(searchMakerWorld(query,page,limit,sort)); }
  if (source === 'all' || source === 'thingiverse') { names.push('thingiverse'); jobs.push(searchThingiverse(env,query,page,limit,sort)); }
  const settled = await Promise.allSettled(jobs);
  const items = [];
  const sources = {};
  let hasMore = false;
  settled.forEach((r,i)=>{
    const name = names[i];
    if (r.status === 'fulfilled') {
      sources[name] = { ok:true, count:r.value.items.length };
      items.push(...r.value.items);
      hasMore ||= !!r.value.hasMore;
    } else sources[name] = { ok:false, count:0, error:cleanText(r.reason?.message || 'indisponível', 120) };
  });
  return { items:dedupe(items).slice(0,limit*2), models:dedupe(items).slice(0,limit*2), hasMore, sources };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
    if (!originAllowed(origin,env)) return json({ok:false,code:'origin_not_allowed',error:'Origem não permitida'},403,origin,{'Cache-Control':'no-store'});
    const url = new URL(request.url);
    try {
      if(request.method==='POST'&&url.pathname==='/shopee/analyze'){
        return await analyzeShopee(request,env,origin);
      }
      if (request.method !== 'GET') return json({ok:false,error:'Método não permitido'},405,origin);
      if (url.pathname === '/' || url.pathname === '/health') {
        const zeroCostMode=String(env.ZERO_COST_MODE||'')==='strict-free';
        const freeAiReady=zeroCostMode&&!!env.AI?.run;
        return json({
          ok:true,
          service:'Genesis 3D Model Bridge',
          version:10,
          zeroCostMode,
          capabilities:{makerworld:true,thingiverse:!!String(env.THINGIVERSE_ACCESS_TOKEN||'').trim(),shopeeAI:freeAiReady},
          ai:freeAiReady?{provider:'cloudflare-workers-ai-free',model:FREE_AI_MODEL,dailyDeviceSafetyLimit:FREE_AI_DAILY_DEVICE_LIMIT}:null,
          time:new Date().toISOString()
        },200,origin,{'Cache-Control':'no-store'});
      }
      if (url.pathname === '/search') {
        const q = cleanText(url.searchParams.get('q'),80);
        if (q.length < 2) return json({ok:false,error:'Busca muito curta'},400,origin);
        const page = clamp(parseInt(url.searchParams.get('page')||'1',10)||1,1,20);
        const limit = clamp(parseInt(url.searchParams.get('limit')||'20',10)||20,1,40);
        const sort = ['relevance','downloads','popular','recent'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'relevance';
        const source = ['all','makerworld','thingiverse'].includes(url.searchParams.get('source')) ? url.searchParams.get('source') : 'all';
        const data = await combinedSearch(env,q,page,limit,sort,source);
        return json({ok:true,...data},200,origin,{'Cache-Control':'public, max-age=600'});
      }
      if (url.pathname === '/model' || url.pathname === '/resolve') {
        const raw = url.searchParams.get('url') || url.searchParams.get('id') || '';
        const source = detectSource(raw, url.searchParams.get('source')||'');
        let id='', resolvedUrl='';
        if(source==='thingiverse'){
          id=parseThingiverseId(raw);
          if(!id)return json({ok:false,error:'ID/link do Thingiverse inválido'},400,origin);
        }else{
          const resolved=await resolveMakerWorldShare(raw);
          id=resolved.id;
          resolvedUrl=resolved.resolvedUrl;
        }
        const model = source === 'thingiverse' ? await fetchThingiverseModel(env,id) : await fetchMakerWorldModel(id);
        if(source==='makerworld'&&resolvedUrl){
          model.publicUrl=resolvedUrl;
          model.makerWorldUrl=resolvedUrl;
        }
        return json({ok:true,model,resolvedUrl:resolvedUrl||model.publicUrl||''},200,origin,{'Cache-Control':'public, max-age=3600'});
      }
      if (url.pathname === '/image') {
        const source = detectSource(url.searchParams.get('url')||url.searchParams.get('id'), url.searchParams.get('source')||'');
        const idRaw = url.searchParams.get('id') || '';
        if (idRaw) {
          const id = source === 'thingiverse' ? parseThingiverseId(idRaw) : parseMakerWorldId(idRaw);
          if (!id) return json({ok:false,error:'ID inválido'},400,origin);
          const model = source === 'thingiverse' ? await fetchThingiverseModel(env,id) : await fetchMakerWorldModel(id);
          if (!model.image) return json({ok:false,error:'Modelo sem imagem disponível'},404,origin);
          return proxyImageUrl(model.image,origin);
        }
        return proxyImageUrl(url.searchParams.get('url')||'',origin);
      }
      return json({ok:false,error:'Endpoint inexistente'},404,origin);
    } catch (err) {
      console.error('[Genesis3D Worker]',err);
      const msg = err?.name === 'AbortError' ? 'Tempo limite excedido' : cleanText(err?.message || 'Falha temporária',180);
      return json({ok:false,error:msg},502,origin);
    }
  }
};
