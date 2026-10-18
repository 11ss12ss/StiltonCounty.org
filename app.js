// ===== CONFIG =====
const CFG={DISCORD_CLIENT_ID:'1542247332899455006',GUILD_ID:'1462548365907722252',POLICE_ROLE_ID:'1554679644102332506',STAFF_ROLE_ID:'1554679627342159922',JOIN_URL:''}; // JOIN_URL = your main Discord invite link (optional, adds a Join button on Home)
// Firebase web config (public by design; access is controlled by Firestore rules)
firebase.initializeApp({apiKey:"AIzaSyAtjPX7727zNlvBh85jzTeAqPs5LfvuYr0",authDomain:"rossite.firebaseapp.com",projectId:"rossite",storageBucket:"rossite.firebasestorage.app",messagingSenderId:"812413188846",appId:"1:812413188846:web:a3e3d7e65697ff290c91ff"});
const db=firebase.firestore();
// ==================
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S={user:null,staff:false},tab='home',draft={};
const say=t=>{const m=$('#msg');m.textContent=t;m.classList.toggle('hide',!t)};
const fe=e=>e&&e.code==='permission-denied'?'Firestore blocked this. Paste the rules into Firebase Console > Firestore > Rules and press Publish.':(e&&e.message)||'Database error';
const dc=async(p,t)=>{const r=await fetch('https://discord.com/api/v10'+p,{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw new Error(r.status);return r.json()};
const loginUrl=()=>'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:CFG.DISCORD_CLIENT_ID,response_type:'token',scope:'identify guilds.members.read',redirect_uri:location.origin+location.pathname+location.search});
function token(){const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){localStorage.setItem('rp_tok',JSON.stringify({t:h.get('access_token'),exp:Date.now()+h.get('expires_in')*1000}));history.replaceState(null,'',location.pathname+location.search)}
  const a=JSON.parse(localStorage.getItem('rp_tok')||'null');return a&&a.exp>Date.now()?a.t:null}
function logout(){localStorage.removeItem('rp_tok');location.reload()}
async function init(){
  const t=token();
  if(t){try{const u=await dc('/users/@me',t),m=await dc(`/users/@me/guilds/${CFG.GUILD_ID}/member`,t),r=m.roles||[];
      S.user={id:u.id,name:m.nick||u.global_name||u.username,avatar:u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`:null,police:r.includes(CFG.POLICE_ROLE_ID)};
      S.staff=r.includes(CFG.STAFF_ROLE_ID);
      draft=JSON.parse(localStorage.getItem('rp_draft_'+u.id)||'{}');
      try{const p=await db.collection('prefs').doc(u.id).get();if(p.exists)draft=JSON.parse(p.data().json)}catch{}
      tab=draft.tab||tab;
    }catch{localStorage.removeItem('rp_tok');say('You must be a member of our Discord server to log in.')}}
  render();
}
function render(){
  const tabs=[['home','Home'],['chains','Chain Servers'],['register','Register Vehicle']];
  if(S.user&&(S.user.police||S.staff))tabs.push(['police','Police Database']);
  if(!tabs.some(x=>x[0]==tab))tab='home';
  $('#nav').innerHTML=tabs.map(([k,l])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#who').innerHTML=S.user?`<span class="user">${S.user.avatar?`<img src="${esc(S.user.avatar)}">`:''}${esc(S.user.name)}${S.staff?'<span class="badge">Staff</span>':S.user.police?'<span class="badge">Police</span>':''} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn" href="${loginUrl()}">Log in with Discord</a>`;
  ({home,chains,register,police})[tab]();
}
const go=k=>{tab=k;draft.tab=k;say('');render()};
const needLogin=()=>$('#view').innerHTML=`<div class="card"><h2>Citizen Login</h2><p class="mu">Log in with Discord. We'll check that you're in our server.</p><a class="btn" href="${loginUrl()}">Log in with Discord</a></div>`;

const safeUrl=u=>{try{const x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)?x.href:''}catch{return ''}};

function home(){
  $('#view').innerHTML=`<div class="card hero"><div class="kick">|+-+| Republic Of Stilton |+-+|</div><h2>Republic of Stilton</h2>
   <p class="mu">Est Jan 2026 &bull; “United in governance, Freedom in communities”</p>
   <p><button class="btn" onclick="go('chains')">Explore Chain Servers</button> ${safeUrl(CFG.JOIN_URL)?`<a class="btn s" href="${esc(safeUrl(CFG.JOIN_URL))}" target="_blank" rel="noopener noreferrer">Join the Discord</a>`:''}</p></div>

   <div class="card sec"><h3>What ROS Is</h3>
    <p>The Republic of Stilton (ROS) is, at its core, a roleplay server where you get to choose your path. In ROS there are many paths you can take such as:</p>
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

const STATUS=['Open','Coming soon','Closed'];
const isOk=x=>x.review==='accepted'; // anything not explicitly accepted (including older entries) waits for staff
async function chains(){
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

const F=['plate','make','model','color','year','owner_name','notes'];
const plateOf=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,12);
async function register(){
  if(!S.user)return needLogin();
  let mine=[];try{mine=(await db.collection('vehicles').where('discord_id','==',S.user.id).get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.created-a.created)}catch(e){say(fe(e))}
  const v=draft.form||{};
  $('#view').innerHTML=`<div class="card"><h2>Register a vehicle</h2><p class="mu">Your progress is saved automatically.</p>
   <div class="row"><div><label>License plate *</label><input id="f_plate"></div><div><label>Year</label><input id="f_year" maxlength="4"></div></div>
   <div class="row"><div><label>Make *</label><input id="f_make"></div><div><label>Model *</label><input id="f_model"></div></div>
   <div class="row"><div><label>Color</label><input id="f_color"></div><div><label>Owner (in-game name)</label><input id="f_owner_name"></div></div>
   <label>Notes</label><textarea id="f_notes" rows="3"></textarea><p><button class="btn" onclick="sendVeh()">Register</button></p></div>
   <div class="card"><h3>My vehicles</h3><table>${mine.map(x=>`<tr><td><b>${esc(x.plate)}</b></td><td>${esc(x.year)} ${esc(x.make)} ${esc(x.model)}</td><td>${esc(x.color)}</td><td><button class="btn s" onclick="delVeh('${esc(x.id)}')">Remove</button></td></tr>`).join('')||'<tr><td class="mu">None yet</td></tr>'}</table></div>`;
  F.forEach(k=>$('#f_'+k).value=v[k]||'');
}
const form=()=>Object.fromEntries(F.map(k=>[k,$('#f_'+k)?.value.trim()||'']));
async function sendVeh(){const f=form(),plate=plateOf(f.plate);
  if(!plate||!f.make||!f.model)return say('Plate, make and model are required');
  try{const ref=db.collection('vehicles').doc(plate);
    if((await ref.get()).exists)throw new Error('That plate is already registered');
    await ref.set({plate,make:f.make.slice(0,80),model:f.model.slice(0,80),color:f.color.slice(0,80),year:f.year.slice(0,4),owner_name:(f.owner_name||S.user.name).slice(0,80),notes:f.notes.slice(0,300),discord_id:S.user.id,created:Date.now()});
    draft.form={};say('Registered '+plate);register()}catch(e){say(fe(e))}}
async function delVeh(id){if(!confirm('Remove this vehicle?'))return;
  try{const ref=db.collection('vehicles').doc(id),d=await ref.get();
    if(d.exists&&d.data().discord_id!==S.user.id&&!S.staff)return say('That is not your vehicle');
    await ref.delete();tab=='police'?search():register()}catch(e){say(fe(e))}}

function police(){
  if(!S.user)return needLogin();
  $('#view').innerHTML=`<div class="card"><h2>Vehicle database</h2><input id="q" placeholder="Search plate, make, model, color, owner…" oninput="clearTimeout(window.t);window.t=setTimeout(search,250)"></div><div class="card" id="res"></div>`;search();
}
async function search(){
  const q=$('#q').value.trim().toLowerCase().slice(0,40);
  try{let r=(await db.collection('vehicles').orderBy('created','desc').limit(500).get()).docs.map(d=>({id:d.id,...d.data()}));
  if(q)r=r.filter(x=>[x.plate,x.make,x.model,x.color,x.owner_name,x.year].some(c=>String(c||'').toLowerCase().includes(q)));
  r=r.slice(0,100);
  $('#res').innerHTML=`<table><tr><th>Plate</th><th>Vehicle</th><th>Color</th><th>Owner</th><th>Notes</th>${S.staff?'<th></th>':''}</tr>${r.map(x=>`<tr><td><b>${esc(x.plate)}</b></td><td>${esc(x.year)} ${esc(x.make)} ${esc(x.model)}</td><td>${esc(x.color)}</td><td>${esc(x.owner_name)}</td><td>${esc(x.notes)}</td>${S.staff?`<td><button class="btn s" onclick="delVeh('${esc(x.id)}')">Delete</button></td>`:''}</tr>`).join('')||'<tr><td class="mu">No results</td></tr>'}</table>`}
  catch(e){say(fe(e))}
}

// Save progress when leaving the page (and every 15s)
function save(){if(!S.user)return;if($('#f_plate'))draft.form=form();draft.tab=tab;
  localStorage.setItem('rp_draft_'+S.user.id,JSON.stringify(draft));
  db.collection('prefs').doc(S.user.id).set({json:JSON.stringify(draft),updated:Date.now()}).catch(()=>{})}
addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>document.hidden&&save());setInterval(save,15000);
init();

