import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function createAuth(path) {
  const config=JSON.parse(readFileSync(path,'utf8'));config.sessions ||= {};
  const persist=()=>writeFileSync(path,JSON.stringify(config),{mode:0o600});
  let attempts=0, windowEnd=0;
  const page=message=>`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lot Rot · Sign in</title><style>body{font:18px system-ui;background:#f3f4f6;color:#123449;margin:0;padding:24px}main{max-width:400px;margin:8vh auto;background:white;padding:24px;border-radius:20px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0 20px;font:inherit}button{background:#fb8500;border:0;border-radius:10px;font-weight:bold}p{line-height:1.5}</style></head><body><main><h1>Lot Rot</h1><h2>Sign in</h2><p>${message || 'This browser will stay signed in for 30 days.'}</p><form method="post" action="/login"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button></form></main></body></html>`;
  return async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');
    const cookie=value=>`lot_rot_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value ? 30*86400 : 0}${local ? '' : '; Secure'}`;
    const send=(status,message)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});res.end(page(message));};
    const token=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('lot_rot_session='))?.slice(16);
    const session=token && config.sessions[digest(token)];
    const valid=session && session>Date.now();
    if(['POST','PUT','DELETE'].includes(req.method) && (!req.headers.origin || new URL(req.headers.origin).host!==req.headers.host)) {res.writeHead(403);res.end('Open Lot Rot on this server before submitting.');return true;}
    if(url.pathname==='/login' && req.method==='POST') {
      if(Date.now()>windowEnd){attempts=0;windowEnd=Date.now()+60000;}
      if(++attempts>5){send(429,'Too many attempts. Wait one minute and try again.');return true;}
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096){send(413,'Sign-in request too large.');return true;}}
      const form=new URLSearchParams(raw),password=(form.get('password') || '').trim();
      const actual=scryptSync(password,config.salt,64),expected=Buffer.from(config.passwordHash,'hex');
      if((form.get('email') || '').trim().toLowerCase()!==config.email.toLowerCase() || !timingSafeEqual(actual,expected)){send(401,'Email or password is incorrect.');return true;}
      const next=randomBytes(32).toString('hex');
      config.sessions=Object.fromEntries(Object.entries(config.sessions).filter(([,expiry])=>expiry>Date.now()));
      config.sessions[digest(next)]=Date.now()+30*86400000;persist();attempts=0;
      res.writeHead(303,{'Location':'/#inventory','Set-Cookie':cookie(next),'Cache-Control':'no-store'});res.end();return true;
    }
    if(url.pathname==='/logout' && req.method==='POST') {if(token)delete config.sessions[digest(token)];persist();res.writeHead(303,{'Location':'/','Set-Cookie':cookie(''),'Cache-Control':'no-store'});res.end();return true;}
    if(valid){req.employee={id:digest(config.email.trim().toLowerCase()),name:config.name || config.email,email:config.email};req.company=config.company?.id && config.company?.name ? {id:config.company.id,name:config.company.name} : null;return false;}
    if(url.pathname.startsWith('/api/') || (req.method!=='GET' && req.method!=='HEAD')){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({message:'Sign in to Lot Rot to continue.'}));return true;}
    send(200);return true;
  };
}
export function setupAuth(path,email) {
  mkdirSync(dirname(path),{recursive:true});
  const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
  writeFileSync(path,JSON.stringify({email,salt,passwordHash:scryptSync(password,salt,64).toString('hex'),sessions:{}}),{flag:'wx',mode:0o600});
  return password;
}
