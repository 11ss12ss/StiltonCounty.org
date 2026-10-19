// ===== CONFIG =====
const CFG={DISCORD_CLIENT_ID:'1542247332899455006',GUILD_ID:'1462548365907722252',POLICE_ROLE_ID:'1554679644102332506',STAFF_ROLE_ID:'1554679627342159922',JOIN_URL:''}; // JOIN_URL = your main Discord invite link (optional)
// Firebase web config (public by design; access is controlled by Firestore rules)
firebase.initializeApp({apiKey:"AIzaSyAtjPX7727zNlvBh85jzTeAqPs5LfvuYr0",authDomain:"rossite.firebaseapp.com",projectId:"rossite",storageBucket:"rossite.firebasestorage.app",messagingSenderId:"812413188846",appId:"1:812413188846:web:a3e3d7e65697ff290c91ff"});
const db=firebase.firestore();
// ==================
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S={user:null,staff:false},tab='home',draft={};
const LOADER=n=>`<div class="loader"><span class="spin"></span><span>Loading…</span></div>`+(n?`<div class="cgrid">${'<div class="skel"></div>'.repeat(n)}</div>`:'');
const say=t=>{const m=$('#msg');m.textContent=t;m.classList.toggle('hide',!t)};
const fe=e=>e&&e.code==='permission-denied'?'Firestore blocked this. Paste the rules into Firebase Console > Firestore > Rules and press Publish.':(e&&e.message)||'Database error';
const dc=async(p,t)=>{const r=await fetch('https://discord.com/api/v10'+p,{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw new Error(r.status);return r.json()};
const loginUrl=()=>'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:CFG.DISCORD_CLIENT_ID,response_type:'token',scope:'identify guilds.members.read',redirect_uri:location.origin+location.pathname+location.search});
function token(){const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){localStorage.setItem('rp_tok',JSON.stringify({t:h.get('access_token'),exp:Date.now()+h.get('expires_in')*1000}));history.replaceState(null,'',location.pathname+location.search)}
  const a=JSON.parse(localStorage.getItem('rp_tok')||'null');return a&&a.exp>Date.now()?a.t:null}
function logout(){localStorage.removeItem('rp_tok');location.reload()}
// ===== device identity (used for device / hardware bans) =====
const h53=(str,seed=0)=>{let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(16).padStart(14,'0')};
const sha=async x=>{try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x));return[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,32)}catch{return h53(x)+h53(x,7)}};
async function deviceIds(){
  // v = random id kept in this browser; f = fingerprint of the hardware (same across browsers on one machine, but identical devices can share it)
  let v='';try{v=localStorage.getItem('ros_dev')||(document.cookie.match(/(?:^|; )ros_dev=([a-f0-9]+)/)||[])[1]||''}catch{}
  if(!/^[a-f0-9]{32}$/.test(v)){v=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('')}
  try{localStorage.setItem('ros_dev',v)}catch{}try{document.cookie='ros_dev='+v+';max-age=63072000;path=/;SameSite=Lax'}catch{}
  let gpu='';try{const g=document.createElement('canvas').getContext('webgl'),e=g.getExtension('WEBGL_debug_renderer_info');gpu=e?g.getParameter(e.UNMASKED_VENDOR_WEBGL)+'|'+g.getParameter(e.UNMASKED_RENDERER_WEBGL):''}catch{}
  const f=await sha(['ros',navigator.platform,navigator.hardwareConcurrency,navigator.deviceMemory,screen.width,screen.height,screen.colorDepth,devicePixelRatio,Intl.DateTimeFormat().resolvedOptions().timeZone,gpu].join('|'));
  return{v,f};
}
// A ban is also remembered in this browser, so using another Discord account here does not get around it.
const getFlag=()=>{try{const v=localStorage.getItem('ros_banned')||(document.cookie.match(/(?:^|; )ros_banned=([^;]+)/)||[])[1]||'';return v?JSON.parse(decodeURIComponent(v)):null}catch{return null}};
const setFlag=b=>{const v=encodeURIComponent(JSON.stringify({u:String(b.user_id||''),r:String(b.reason||'').slice(0,100)}));try{localStorage.setItem('ros_banned',decodeURIComponent(v))}catch{}try{document.cookie='ros_banned='+v+';max-age=63072000;path=/;SameSite=Lax'}catch{}};
const clearFlag=()=>{try{localStorage.removeItem('ros_banned')}catch{}try{document.cookie='ros_banned=;max-age=0;path=/'}catch{}};
async function findBan(uid,dev,flagUid){
  try{const ops=[db.collection('bans').where('devices','array-contains-any',['v:'+dev.v,'f:'+dev.f]).limit(1).get()];
    if(uid)ops.push(db.collection('bans').doc('u_'+uid).get());
    if(flagUid&&flagUid!==uid)ops.push(db.collection('bans').doc('u_'+flagUid).get());
    const [q,...ds]=await Promise.all(ops);
    if(!q.empty)return{ban:q.docs[0].data(),ok:true};
    for(const d of ds)if(d.exists)return{ban:d.data(),ok:true};
    return{ban:null,ok:true};
  }catch{return{ban:null,ok:false}}
}
function showBan(b){
  $('#nav').innerHTML='';$('#who').innerHTML='';
  $('#view').innerHTML=`<div class="card hero"><div class="kick">ACCESS DENIED</div><h2>You are banned</h2>
    <p>You have been banned from the Republic of Stilton website.</p>
    ${b&&b.reason?`<p class="mu">Reason: ${esc(b.reason)}</p>`:''}
    <p class="mu">Using another account or browser to get around a ban is against the Terms of Service (Section 3, Ban Evasion).</p>
    <p class="mu">If you think this is a mistake, contact the staff team on Discord.</p></div>`;
}
let DEV=null;
async function init(){
  $('#view').innerHTML=LOADER();
  const t=token();
  DEV=await deviceIds();
  let u=null;
  if(t){try{u=await dc('/users/@me',t)}catch{localStorage.removeItem('rp_tok')}}
  const flag=getFlag(),{ban,ok}=await findBan(u&&u.id,DEV,flag&&flag.u);
  if(ban){setFlag(ban);
    if(u&&String(ban.user_id||'')!==u.id)db.collection('devices').doc(u.id).set({ids:firebase.firestore.FieldValue.arrayUnion('v:'+DEV.v,'f:'+DEV.f),name:String(u.global_name||u.username||'').slice(0,80),updated:Date.now()},{merge:true}).catch(()=>{}); // another account on a banned browser: record it so staff can ban it too
    return showBan(ban)}
  if(flag&&!ok)return showBan({reason:flag.r}); // cannot check right now: stay banned
  if(flag)clearFlag(); // staff lifted the ban
  if(u){try{const m=await dc(`/users/@me/guilds/${CFG.GUILD_ID}/member`,t),r=m.roles||[];
      S.user={id:u.id,name:m.nick||u.global_name||u.username,avatar:u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`:null};
      S.staff=r.includes(CFG.STAFF_ROLE_ID);
      draft=JSON.parse(localStorage.getItem('rp_draft_'+u.id)||'{}');
      try{const p=await db.collection('prefs').doc(u.id).get();if(p.exists)draft=JSON.parse(p.data().json)}catch{}
      tab=draft.tab||tab;
      db.collection('devices').doc(u.id).set({ids:firebase.firestore.FieldValue.arrayUnion('v:'+DEV.v,'f:'+DEV.f),name:S.user.name.slice(0,80),updated:Date.now()},{merge:true}).catch(()=>{}); // lets staff ban this person's devices too
    }catch{localStorage.removeItem('rp_tok');say('You must be a member of our Discord server to log in.')}}
  render();
}
function render(){
  const tabs=[['home','Home'],['chains','Chain Servers']];
  if(S.staff)tabs.push(['mod','Moderation']);
  if(!tabs.some(x=>x[0]==tab))tab='home';
  $('#nav').innerHTML=tabs.map(([k,l])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#who').innerHTML=S.user?`<span class="user">${S.user.avatar?`<img src="${esc(S.user.avatar)}">`:''}${esc(S.user.name)}${S.staff?'<span class="badge">Staff</span>':''} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn" href="${loginUrl()}">Log in with Discord</a>`;
  ({home,chains,mod})[tab]();
}
const go=k=>{tab=k;draft.tab=k;say('');render()};
const needLogin=()=>$('#view').innerHTML=`<div class="card"><h2>Citizen Login</h2><p class="mu">Log in with Discord. We'll check that you're in our server.</p><a class="btn" href="${loginUrl()}">Log in with Discord</a></div>`;

const safeUrl=u=>{try{const x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)?x.href:''}catch{return ''}};

function home(){
  $('#view').innerHTML=`<div class="card hero"><div class="kick">|+-+| Republic Of Stilton |+-+|</div><h2>Republic of Stilton</h2>
   <p class="mu">Est Jan 2026 &bull; “United in governance, Freedom in communities”</p>
   <p><button class="btn" onclick="go('chains')">Explore Chain Servers</button> ${safeUrl(CFG.JOIN_URL)?`<a class="btn s" href="${esc(safeUrl(CFG.JOIN_URL))}" target="_blank" rel="noopener noreferrer">Join the Discord</a>`:''}</p></div>

   <div class="card sec"><h3>What ROS Is.</h3>
    <p>The Republic of Stilton (ROS) is, at its core, is a roleplay server where you get to choose your path. In ROS there are many paths you can take such as:</p>
    <ul><li>Becoming a first responder</li><li>Run large scale businesses</li><li>Live a life of crime</li><li>Run for public office</li></ul><p>And much more.</p></div>

   <div class="card sec"><h3>Roleplay</h3>
    <p>The paths you take are entirely up to you. We understand that everyone enjoys different levels of realism, and we believe that everyone should have the freedom to roleplay in their own way.</p>
    <p>What makes ROS different is our commitment to player freedom. Whether you want to drive around for 15 minutes, explore the town on foot, or start a business, your experience is yours to shape!</p></div>

   <div class="card sec"><h3>Government</h3>
    <p>Government discussions and large scale events help make ROS a living and thriving community. However, we recognize that not all players want to be involved in politics or government affairs. Which is why ROS is designed to improve RP experience and not dictate how every player must play.</p></div>

   <div class="card sec"><h3>Branches Of Government</h3>
    <p class="mu">If you are not into this type of stuff you can skip to the next part!</p>
    <p>The ROS government is made up of 3 branches:</p>
    <ul><li>Legislative Branch</li><li>Judicial Branch</li><li>Executive Branch</li></ul>
    <p>Each branch has its own purposes for example, The Legislative Branch (LB) is where Law Proposals happen! The Judicial Branch is in charge of Appeals &amp; Review (Laws) And the last one is the Executive Branch. The Executive Branch (EB) Is in charge of Departments &amp; Agencies as well as Executive Leadership.</p>
    <p>If you are interested in this Government style of RP then ROS Has many opportunities. ROS Has more opportunities regarding the government that I can't fit in this message.</p></div>

   <div class="card sec"><h3>Chain Servers</h3>
    <p>The ROS has something called "Chain Servers". A chain server is an external server to the main ROS Server for example, The main server is considered the capital city but Users, with permission, can create their own Chain Server and establish a city with its own local laws, provided those laws do not conflict with national law. This means that you can be a resident in different cities and you have choices on what departments you wish to work for! Some Chain Servers can also use mods though not all will.</p>
    <p>If you wish to start a business there may be some city's (in the future) that may be better for example, City 1 could have a better vehicle market than city 2 so it is best to start dealerships or car shops in City 1.</p>
    <p>Though that explanation is part of what Chain Servers offer there is so much more you can do!</p>
    <p><button class="btn s" onclick="go('chains')">See all chain servers</button></p></div>

   <div class="card sec"><h3>Economy</h3>
    <p>The ROS economy is shared across all participating cities. StiltonBux (SB) is the universal currency, accepted throughout the Republic. Here are a few ways to make money:</p>
    <ul><li>Working for other players</li><li>Start a company/business</li><li>Do odd jobs</li></ul>
    <p>Every penny that is in the ROS economy is 100% player earned with as of writing there being 8 million SB (StiltonBux) in the economy. Also the name is subject to change for obvious reasons. The economy is fairly simple and easy to use.</p></div>

   <div class="card sec"><h3>Join The Republic</h3>
    <p>Ready to get started? Join the Republic of Stilton and discover the opportunities waiting for you. Because whether you want to build a business, serve your community, participate in government, or simply enjoy the freedom of roleplay, there is a place for you in ROS.</p>
    <p><b>Your path. Your community. Your Republic.</b> Join below and become part of the Republic of Stilton.</p>
    <p><button class="btn" onclick="go('chains')">Find your city</button> ${safeUrl(CFG.JOIN_URL)?`<a class="btn s" href="${esc(safeUrl(CFG.JOIN_URL))}" target="_blank" rel="noopener noreferrer">Join the Discord</a>`:''}</p>
    <p class="mu"><i>United in governance, Freedom in communities.</i></p></div>`;
}

const pin=()=>{try{return sessionStorage.getItem('ros_pin')||''}catch{return ''}};
// Staff actions are checked by the database rules: the staff PIN must be sent along with the change.
async function staffWrite(id,fn){
  const p=($('#b_pin')&&$('#b_pin').value)||pin();
  if(!p)throw new Error('Enter the staff PIN first');
  try{sessionStorage.setItem('ros_pin',p)}catch{}
  const b=db.batch();b.set(db.collection('proofs').doc(id),{pin:p});fn(b);
  try{await b.commit()}
  catch(e){if(e&&e.code==='permission-denied')throw new Error('Staff PIN rejected. Check the PIN, and that the newest Firestore rules are published.');throw e}
  finally{db.collection('proofs').doc(id).delete().catch(()=>{})}
}
async function mod(){
  if(!S.staff)return go('home');
  $('#view').innerHTML=LOADER(1);
  let list=[];try{list=(await db.collection('bans').get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))}catch(e){say(fe(e))}
  $('#view').innerHTML=`<div class="card"><h2>Moderation</h2><p class="mu">Banned people cannot use the site. Banning someone also bans every device they have logged in from.</p></div>
   <div class="card"><h3>Ban someone</h3>
    <div class="row"><div><label>Discord user ID *</label><input id="b_id" placeholder="e.g. 123456789012345678" inputmode="numeric"></div><div><label>Reason (shown to them)</label><input id="b_reason" maxlength="200"></div></div>
    <div class="row"><div><label>Staff PIN *</label><input id="b_pin" type="password" autocomplete="off" value="${esc(pin())}"></div><div></div></div>
    <label style="display:flex;gap:10px;align-items:flex-start;text-transform:none;letter-spacing:0;font-size:.9rem"><input id="b_fp" type="checkbox" checked style="width:auto;margin-top:3px"><span>Also ban their hardware fingerprint <span class="mu">(stronger, but could also block someone with an identical device)</span></span></label>
    <p><button class="btn" onclick="doBan()">Ban</button></p></div>
   <div class="card"><h3>Banned (${list.length})</h3><table><tr><th>User</th><th>Reason</th><th>By</th><th>Devices</th><th></th></tr>${list.map(x=>`<tr><td><b>${esc(x.name||'—')}</b><br><span class="mu">${esc(x.user_id)}</span></td><td>${esc(x.reason||'')}</td><td>${esc(x.by_name||'')}</td><td>${(x.devices||[]).length}</td><td><button class="btn s" onclick="doUnban('${esc(x.user_id)}')">Unban</button></td></tr>`).join('')||'<tr><td class="mu" colspan="5">Nobody is banned.</td></tr>'}</table></div>`;
}
async function doBan(){
  const id=$('#b_id').value.replace(/\D/g,'');
  if(id.length<15)return say('Enter the numeric Discord user ID (right-click the user, Copy User ID)');
  if(id===S.user.id)return say('You cannot ban yourself');
  if(!confirm('Ban '+id+' from the site?'))return;
  try{let ids=[],name='';
    try{const d=await db.collection('devices').doc(id).get();if(d.exists){name=String(d.data().name||'');ids=(d.data().ids||[]).filter(v=>$('#b_fp').checked||!String(v).startsWith('f:')).slice(0,12)}}catch{}
    await staffWrite('u_'+id,b=>b.set(db.collection('bans').doc('u_'+id),{type:'user',user_id:id,name:name.slice(0,80),reason:$('#b_reason').value.trim().slice(0,200),by:S.user.id,by_name:S.user.name.slice(0,80),created:Date.now(),devices:ids}));
    say('Banned. '+ids.length+' known device(s) also banned.');mod()}catch(e){say(e.message||fe(e))}}
async function doUnban(id){if(!confirm('Unban '+id+'?'))return;
  try{await staffWrite('u_'+id,b=>b.delete(db.collection('bans').doc('u_'+id)));say('Unbanned.');mod()}catch(e){say(e.message||fe(e))}}

const STATUS=['Open','Coming soon','Closed'];
const isOk=x=>x.review==='accepted'; // anything not explicitly accepted (including older entries) waits for staff
async function chains(){
  $('#view').innerHTML=LOADER(2);
  let all=[];try{all=(await db.collection('chains').get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.created||0)-(b.created||0))}catch(e){say(fe(e))}
  const ok=all.filter(isOk),pending=all.filter(x=>x.review==='pending'||!x.review),denied=all.filter(x=>x.review==='denied');
  const mine=S.user?all.filter(x=>x.submitted_by===S.user.id&&!isOk(x)):[];
  const rev={pending:'Awaiting approval',denied:'Denied',accepted:'Accepted'};
  const card=(x,mode)=>{const u=safeUrl(x.invite);return `<div class="card chain"><div class="ctop"><h3>${esc(x.name)}</h3>${mode=='pub'?`<span class="tag ${x.status=='Open'?'ok':x.status=='Closed'?'no':'soon'}">${esc(x.status||'Open')}</span>`:`<span class="tag ${x.review=='denied'?'no':'soon'}">${rev[x.review]||rev.pending}</span>`}</div>
    ${x.city?`<div class="mu">${esc(x.city)}</div>`:''}<p>${esc(x.description).replace(/\n/g,'<br>')}</p>
    ${mode!='pub'?`<p class="mu">Submitted by ${esc(x.submitted_name||'unknown')} &bull; Status when open: ${esc(x.status)}${u&&S.staff?` &bull; <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">invite</a>`:''}</p>`:''}
    <p>${mode=='pub'?(u?`<a class="btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Join this server</a>`:'<span class="mu">No invite link yet</span>')+(S.staff?` <button class="btn s" onclick="delChain('${esc(x.id)}')">Remove</button>`:''):''}
    ${mode=='staff'?`<button class="btn" onclick="review('${esc(x.id)}','accepted')">Accept</button> <button class="btn s" onclick="review('${esc(x.id)}','denied')">Deny</button>${x.review=='denied'?` <button class="btn s" onclick="delChain('${esc(x.id)}')">Delete</button>`:''}`:''}
    ${mode=='mine'?`<button class="btn" disabled style="opacity:.6;cursor:not-allowed">${x.review=='denied'?'Denied':'Awaiting approval'}</button> <button class="btn s" onclick="delChain('${esc(x.id)}')">Withdraw</button>`:''}</p></div>`};
  $('#view').innerHTML=`<div class="card"><h2>Chain Servers</h2><p class="mu">Every city in the Republic of Stilton. Each one has its own local laws, and StiltonBux works in all of them. New chain servers are listed once staff accept them.</p></div>
   <div class="cgrid">${ok.map(x=>card(x,'pub')).join('')||'<div class="card"><p class="mu">No chain servers listed yet.</p></div>'}</div>
   ${S.staff?`<div class="card"><h3>Pending applications (${pending.length})</h3></div><div class="cgrid">${pending.map(x=>card(x,'staff')).join('')||'<div class="card"><p class="mu">Nothing waiting for review.</p></div>'}</div>
     ${denied.length?`<div class="card"><h3>Denied (${denied.length})</h3></div><div class="cgrid">${denied.map(x=>card(x,'staff')).join('')}</div>`:''}`:''}
   ${mine.length?`<div class="card"><h3>Your applications</h3></div><div class="cgrid">${mine.map(x=>card(x,'mine')).join('')}</div>`:''}
   ${S.user?`<div class="card"><h3>${S.staff?'Add a chain server':'Apply to list a chain server'}</h3><p class="mu">${S.staff?'Staff entries are accepted right away.':'Staff will review it. Your invite link stays hidden from everyone but staff, and nobody sees a Join button until it is accepted.'}</p>
     <div class="row"><div><label>Server / city name *</label><input id="c_name" maxlength="60"></div><div><label>Location / region</label><input id="c_city" maxlength="60"></div></div>
     <div class="row"><div><label>Discord invite link</label><input id="c_invite" placeholder="https://discord.gg/..."></div><div><label>Status</label><select id="c_status">${STATUS.map(s=>`<option>${s}</option>`).join('')}</select></div></div>
     <label>Description *</label><textarea id="c_desc" rows="4" maxlength="600"></textarea>
     <p><button class="btn" onclick="addChain()">${S.staff?'Add chain server':'Submit for review'}</button></p></div>`
   :`<div class="card"><p class="mu">Want to list your own chain server? <a href="${loginUrl()}">Log in with Discord</a> to apply.</p></div>`}`;
}
async function addChain(){
  if(!S.user)return say('Log in first');
  const name=$('#c_name').value.trim(),desc=$('#c_desc').value.trim(),inv=$('#c_invite').value.trim();
  if(!name||!desc)return say('Name and description are required');
  if(inv&&!safeUrl(inv))return say('The invite link must start with https://');
  try{
    if(!S.staff){const open=(await db.collection('chains').where('submitted_by','==',S.user.id).get()).docs.filter(d=>d.data().review==='pending').length;
      if(open>=3)return say('You already have 3 applications waiting. Please wait for staff to review them.')}
    const ref=await db.collection('chains').add({name:name.slice(0,60),city:$('#c_city').value.trim().slice(0,60),description:desc.slice(0,600),invite:inv?safeUrl(inv):'',status:$('#c_status').value,review:'pending',submitted_by:S.user.id,submitted_name:S.user.name.slice(0,80),created:Date.now()});
    if(S.staff){await ref.update({review:'accepted',reviewed_by:S.user.id});say('Chain server added.')}
    else say('Submitted! Staff will review it soon.');
    chains()}catch(e){say(fe(e))}}
async function review(id,r){if(!S.staff)return;
  try{await db.collection('chains').doc(id).update({review:r,reviewed_by:S.user.id});say(r=='accepted'?'Accepted. It is now listed.':'Denied.');chains()}catch(e){say(fe(e))}}
async function delChain(id){if(!confirm('Remove this chain server?'))return;
  try{const ref=db.collection('chains').doc(id),d=await ref.get();
    if(d.exists&&!S.staff&&d.data().submitted_by!==(S.user&&S.user.id))return say('That is not your application');
    await ref.delete();chains()}catch(e){say(fe(e))}}

// Save progress when leaving the page (and every 15s)
function save(){if(!S.user)return;draft.tab=tab;
  localStorage.setItem('rp_draft_'+S.user.id,JSON.stringify(draft));
  db.collection('prefs').doc(S.user.id).set({json:JSON.stringify(draft),updated:Date.now()}).catch(()=>{})}
addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>document.hidden&&save());setInterval(save,15000);
// ===== animation: cards rise in as they appear / scroll into view =====
(function(){
  const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.08}):null;
  const reveal=()=>{document.querySelectorAll('#view .card:not(.rv),#view .cgrid .card:not(.rv)').forEach(c=>{c.classList.add('rv');io?io.observe(c):c.classList.add('in')})};
  new MutationObserver(reveal).observe(document.getElementById('view'),{childList:true});
})();
init();
