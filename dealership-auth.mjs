import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(name,label,type='text')=>`<label>${label}<input name="${name}" type="${type}" required maxlength="${type==='password'?128:254}" ${type==='password'?'minlength="12" autocomplete="new-password"':''}></label>`;
export function createDealershipAuth(path, companyName='Freedom RV', setupConfiguration) {
  const data=JSON.parse(readFileSync(path,'utf8'));
  const save=()=>{writeFileSync(path+'.next',JSON.stringify(data),{mode:0o600});renameSync(path+'.next',path);};
  if(!data.users){
    const company=data.company?.id && data.company?.name ? data.company : {id:randomUUID(),name:companyName};
    const id=hash(data.email.trim().toLowerCase());
    data.defaultCompanyId=company.id;data.companies=[company];data.users=[{id,email:data.email.trim().toLowerCase(),name:data.name || data.email,companyId:company.id,role:'admin',siteOwner:true,salt:data.salt,passwordHash:data.passwordHash}];data.invitations=[];
    data.sessions=Object.fromEntries(Object.entries(data.sessions || {}).map(([key,s])=>[key,{userId:id,expiresAt:typeof s==='number'?s:s.expiresAt}]));save();
  }
  const setup=setupConfiguration ? JSON.parse(setupConfiguration) : null;
  const primary=data.users.find(u=>u.siteOwner),attempts=new Map();
  const shell=(title,body,message='')=>`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Lot Rot</title><style>body{font:18px system-ui;background:#f3f4f6;color:#123449;margin:0;padding:24px}main{max-width:540px;margin:5vh auto;background:white;padding:24px;border-radius:20px}input,button,select{box-sizing:border-box;width:100%;padding:14px;margin:8px 0 20px;font:inherit}button{background:#fb8500;border:0;border-radius:10px;font-weight:bold}p{line-height:1.5}h1,h2{text-align:center}.login-logo{display:block;width:180px;max-width:100%;margin:0 auto 16px}code{overflow-wrap:anywhere}li{margin:12px 0}a{color:#123449}</style></head><body><main><img class="login-logo" src="/assets/lot-rot-logo.jpg" alt="Lot Rot">${title==='Sign in' ? '' : '<h1>Lot Rot</h1>'}<h2>${title}</h2>${message?`<p role="status">${esc(message)}</p>`:''}${body}</main></body></html>`;
  const login=m=>shell('Sign in',`<p>Your account opens your dealership automatically. Stay signed in for 30 days.</p><form method="post" action="/login">${field('email','Email','email')}<label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label><button>Sign in</button></form><p><a href="/register">Create dealership account</a></p><p><a href="/join">Accept employee invitation</a></p><a href="/create-password">Create or reset password</a>`,m);
  const passwords=field('password','Choose password','password')+field('confirm','Confirm password','password');
  const register=m=>shell('Create dealership account',`<p>Create a separate dealership and its first administrator. Invite a second administrator or employees after signing in. This does not purchase a subscription.</p><form method="post" action="/register">${field('company','Dealership name')}${field('name','Your full name')}${field('email','Your email','email')}${passwords}<button>Create dealership account</button></form><a href="/">Back to sign in</a>`,m);
  const join=m=>shell('Join your dealership',`<p>Your name, role, and dealership are set by your administrator’s invitation.</p><form method="post" action="/join">${field('email','Email','email')}${field('code','Invitation code')}${passwords}<button>Activate account</button></form><a href="/">Back to sign in</a>`,m);
  const reset=m=>shell('Create or reset password',`<p>Use the one-time code provided by your administrator.</p><form method="post" action="/create-password">${field('email','Email','email')}${field('code','Setup code')}${passwords}<button>Create password</button></form><a href="/">Back to sign in</a>`,m);
  const emailOf=f=>(f.get('email') || '').trim().toLowerCase();
  const passwordOf=f=>{const p=(f.get('password') || '').trim();return p.length>=12 && p.length<=128 && p===f.get('confirm') ? p : null;};
  const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length<=254;
  const setPassword=(u,p)=>{u.salt=randomBytes(16).toString('hex');u.passwordHash=scryptSync(p,u.salt,64).toString('hex');};
  return async(req,res)=>{
    const url=new URL(req.url,'http://localhost'),route=url.pathname;
    if(route==='/assets/lot-rot-logo.jpg' && req.method==='GET')return false;
    const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');
    const cookie=v=>`lot_rot_session=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${v?2592000:0}${local?'':'; Secure'}`;
    const send=(status,html)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});res.end(html);};
    const json=(status,message)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({message}));};
    let origin;try{origin=new URL(req.headers.origin).host;}catch{}
    if(['POST','PUT','DELETE'].includes(req.method) && origin!==req.headers.host){json(403,'Open Lot Rot on this server before submitting.');return true;}
    const token=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('lot_rot_session='))?.slice(16),session=token && data.sessions[hash(token)];
    const user=session?.expiresAt>Date.now() && data.users.find(u=>u.id===session.userId && u.passwordHash && !u.disabled);
    const form=async()=>{let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>8192){const error=new Error('Request too large');error.status=413;throw error;}}return new URLSearchParams(raw);};
    const screens={'/register':register,'/join':join,'/create-password':reset};
    if(req.method==='GET' && screens[route]){send(200,screens[route]());return true;}
    if(req.method==='POST' && ['/login',...Object.keys(screens)].includes(route)){
      const f=await form(),email=emailOf(f),now=Date.now(),key=route==='/register'?'register':email;
      const a=attempts.get(key);if(!a || a.until<now){if(attempts.size>1000)attempts.clear();attempts.set(key,{count:1,until:now+60000});}else if(++a.count>5){send(429,(screens[route] || login)('Too many attempts. Wait one minute.'));return true;}
      let account=data.users.find(u=>u.email===email);
      if(route==='/login'){
        const p=(f.get('password') || '').trim();if(p.length>128){send(401,login('Email or password is incorrect.'));return true;}
        const actual=scryptSync(p,account?.salt || 'invalid-account',64),expected=Buffer.from(account?.passwordHash || '0'.repeat(128),'hex');
        if(!account?.passwordHash || account.disabled || !timingSafeEqual(actual,expected)){send(401,login('Email or password is incorrect.'));return true;}
        const next=randomBytes(32).toString('hex');data.sessions=Object.fromEntries(Object.entries(data.sessions).filter(([,s])=>s.expiresAt>now));data.sessions[hash(next)]={userId:account.id,expiresAt:now+2592000000};save();attempts.delete(key);res.writeHead(303,{'Location':'/#home','Set-Cookie':cookie(next),'Cache-Control':'no-store'});res.end();return true;
      }
      const p=passwordOf(f);if(!p || !validEmail(email)){send(422,screens[route]('Enter a valid email and matching passwords of 12–128 characters.'));return true;}
      if(route==='/register'){
        const name=(f.get('name') || '').trim(),company=(f.get('company') || '').trim();
        if(!name || !company || name.length>100 || company.length>100){send(422,register('Enter names up to 100 characters.'));return true;}
        if(account || data.invitations.some(i=>i.email===email && !i.used && i.expiresAt>now) || data.companies.some(c=>c.name.toLowerCase()===company.toLowerCase())){send(409,register('That email or dealership is already registered or invited. Sign in or accept your invitation.'));return true;}
        const c={id:randomUUID(),name:company},u={id:randomUUID(),email,name,companyId:c.id,role:'admin'};setPassword(u,p);data.companies.push(c);data.users.push(u);save();attempts.delete(key);send(201,login('Dealership account created. Sign in with your new password.'));return true;
      }
      if(route==='/create-password'){
        const h=hash((f.get('code') || '').trim());if(!primary || email!==primary.email || !setup || !/^[a-f0-9]{64}$/.test(setup.tokenHash || '') || setup.expiresAt<=now || data.completedSetupHash===setup.tokenHash || !timingSafeEqual(Buffer.from(h,'hex'),Buffer.from(setup.tokenHash,'hex'))){send(401,reset('Setup code is incorrect, expired, or already used.'));return true;}
        setPassword(primary,p);data.completedSetupHash=setup.tokenHash;data.sessions=Object.fromEntries(Object.entries(data.sessions).filter(([,s])=>s.userId!==primary.id));save();send(200,login('Password created. Sign in with your new password.'));return true;
      }
      const invitation=data.invitations.find(i=>i.hash===hash((f.get('code') || '').trim()) && i.email===email && !i.used && i.expiresAt>now);
      if(!invitation || (account && (account.companyId!==invitation.companyId || (account.passwordHash && invitation.kind!=='reset')))){send(401,join('Invitation is incorrect, expired, or already used.'));return true;}
      if(!account){account={id:randomUUID(),email,name:invitation.name,companyId:invitation.companyId,role:invitation.role};data.users.push(account);}
      setPassword(account,p);invitation.used=true;data.sessions=Object.fromEntries(Object.entries(data.sessions).filter(([,s])=>s.userId!==account.id));save();attempts.delete(key);send(200,login('Account activated. Sign in with your new password.'));return true;
    }
    if(route==='/logout' && req.method==='POST'){if(token)delete data.sessions[hash(token)];save();res.writeHead(303,{'Location':'/','Set-Cookie':cookie(''),'Cache-Control':'no-store'});res.end();return true;}
    if(user){
      const company=data.companies.find(c=>c.id===user.companyId);if(!company){json(403,'Dealership unavailable.');return true;}
      req.employee={id:user.id,name:user.name,email:user.email,role:user.role,siteOwner:!!user.siteOwner};req.company={id:company.id,name:company.name};req.defaultCompanyId=data.defaultCompanyId;
      if(route==='/team'){
        if(user.role!=='admin'){send(403,shell('Access denied','<a href="/#home">Home</a>'));return true;}
        const body=()=>`<p>${esc(company.name)}. Employees record trips; administrators also manage units and invitations.</p><ul>${data.users.filter(u=>u.companyId===company.id).map(u=>`<li>${esc(u.name)} — ${esc(u.email)} (${esc(u.role)})</li>`).join('')}</ul><form method="post" action="/team">${field('name','Employee full name')}${field('email','Employee email','email')}<label>Role<select name="role"><option value="employee">Employee</option><option value="admin">Administrator</option></select></label><button>Create invitation</button></form><p>Inviting an existing employee creates a password reset code. Share codes privately.</p><a href="/#home">Back to home</a>`;
        let notice='';if(req.method==='POST'){
          const f=await form(),email=emailOf(f),name=(f.get('name') || '').trim(),existing=data.users.find(u=>u.email===email);
          if(!validEmail(email) || !name || name.length>100){send(422,shell('Team',body(),'Enter a valid email and full name.'));return true;}
          if(existing && (existing.companyId!==company.id || existing.id===user.id || existing.siteOwner)){send(409,shell('Team',body(),'That account cannot be invited here.'));return true;}
          if(data.invitations.some(i=>i.email===email && i.companyId!==company.id && !i.used && i.expiresAt>Date.now())){send(409,shell('Team',body(),'That email already has an invitation to another dealership.'));return true;}
          const code=randomBytes(24).toString('base64url');for(const i of data.invitations)if(i.email===email && !i.used)i.used=true;
          data.invitations.push({hash:hash(code),email,name:existing?.name || name,companyId:company.id,role:existing?.role || (f.get('role')==='admin'?'admin':'employee'),kind:existing?'reset':'join',expiresAt:Date.now()+604800000,used:false});save();notice=`<p>Invitation for ${esc(email)}. Code expires in 7 days and works once:</p><p><code>${code}</code></p><p>Ask them to open <a href="/join">${esc((local?'http':'https')+'://'+req.headers.host+'/join')}</a> and enter their email, this code, and their chosen password.</p>`;
        }send(200,shell('Team',notice+body()));return true;
      }
      return false;
    }
    if(route.startsWith('/api/') || req.method!=='GET'){json(401,'Sign in to Lot Rot to continue.');return true;}
    send(200,login());return true;
  };
}
