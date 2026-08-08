export function normalizeOrigin(value){
  const raw=String(value||'').trim().replace(/\/$/,'');
  if(!raw)return '';
  try{return new URL(raw).origin.toLowerCase()}catch{return raw.toLowerCase()}
}

export function isOriginAllowed(value,allowedOrigins=[],options={}){
  const origin=normalizeOrigin(value);
  if(!origin)return options.allowMissing!==false;
  if(origin==='null')return false;
  const configured=new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean));
  if(configured.has(origin))return true;
  return options.allowLocalhost!==false&&/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export function corsHeaders(value,{privateNetwork=false}={}){
  const origin=normalizeOrigin(value);
  const headers={
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,X-Genesis-Token,X-Genesis-Source-Type,X-Genesis-Variant,X-Genesis-File-Name,X-Genesis-Width,X-Genesis-Height,X-Genesis-Entity,X-Genesis-Entity-Id,X-Genesis-Hash',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin'
  };
  if(origin&&origin!=='null')headers['Access-Control-Allow-Origin']=origin;
  if(privateNetwork)headers['Access-Control-Allow-Private-Network']='true';
  return headers;
}
