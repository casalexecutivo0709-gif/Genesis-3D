import assert from 'node:assert/strict';
import {corsHeaders,isOriginAllowed,normalizeOrigin} from '../genesis-local-server/cors.mjs';

const publicOrigin='https://casalexecutivo0709-gif.github.io';
assert.equal(normalizeOrigin(publicOrigin+'/'),publicOrigin);
assert.equal(isOriginAllowed(publicOrigin,[publicOrigin]),true);
assert.equal(isOriginAllowed('https://evil.example',[publicOrigin]),false);
assert.equal(isOriginAllowed('null',[publicOrigin]),false);
assert.equal(isOriginAllowed('http://127.0.0.1:4176',[publicOrigin]),true);
assert.equal(isOriginAllowed('',[publicOrigin]),true);
const headers=corsHeaders(publicOrigin,{privateNetwork:true});
assert.equal(headers['Access-Control-Allow-Origin'],publicOrigin);
assert.equal(headers.Vary,'Origin');
assert.equal(headers['Access-Control-Allow-Private-Network'],'true');
assert.equal(headers['Access-Control-Allow-Origin']==='*',false);
console.log('Servidor local: origem pública, preflight privado e bloqueios CORS OK');
