// ===== CONFIG =====
const CFG={DISCORD_CLIENT_ID:'1542247332899455006',GUILD_ID:'1462548365907722252',POLICE_ROLE_ID:'1554679644102332506',STAFF_ROLE_ID:'1554679627342159922'};
// Firebase web config (public by design; access is controlled by Firestore rules)
firebase.initializeApp({apiKey:"AIzaSyAtjPX7727zNlvBh85jzTeAqPs5LfvuYr0",authDomain:"rossite.firebaseapp.com",projectId:"rossite",storageBucket:"rossite.firebasestorage.app",messagingSenderId:"812413188846",appId:"1:812413188846:web:a3e3d7e65697ff290c91ff"});
const db=firebase.firestore();
// ==================
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S={user:null,staff:false},tab='economy',draft={};
const say=t=>{const m=$('#msg');m.textContent=t;m.classList.toggle('hide',!t)};
const fe=e=>e&&e.code==='permission-denied'?'Firestore blocked this. Paste the rules into Firebase Console > Firestore > Rules and press Publish.':(e&&e.message)||'Database error';
const dc=async(p,t)=>{const r=await fetch('https://discord.com/api/v10'+p,{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw new Error(r.status);return r.json()};
const loginUrl=()=>'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:CFG.DISCORD_CLIENT_ID,response_type:'token',scope:'identify guilds.members.read',redirect_uri:location.origin+location.pathname});
function token(){const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){localStorage.setItem('rp_tok',JSON.stringify({t:h.get('access_token'),exp:Date.now()+h.get('expires_in')*1000}));history.replaceState(null,'',location.pathname)}
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
  const tabs=[['economy','Economy'],['register','Register Vehicle']];
  if(S.user&&(S.user.police||S.staff))tabs.push(['police','Police Database']);
  if(!tabs.some(x=>x[0]==tab))tab='economy';
  $('#nav').innerHTML=tabs.map(([k,l])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#who').innerHTML=S.user?`<span class="user">${S.user.avatar?`<img src="${esc(S.user.avatar)}">`:''}${esc(S.user.name)}${S.staff?'<span class="badge">Staff</span>':S.user.police?'<span class="badge">Police</span>':''} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn" href="${loginUrl()}">Log in with Discord</a>`;
  ({economy,register,police})[tab]();
}
const go=k=>{tab=k;draft.tab=k;say('');render()};
const needLogin=()=>$('#view').innerHTML=`<div class="card"><h2>Citizen Login</h2><p class="mu">Log in with Discord. We'll check that you're in our server.</p><a class="btn" href="${loginUrl()}">Log in with Discord</a></div>`;

async function economy(){
  let d=[];try{d=(await db.collection('economy').orderBy('day').limit(365).get()).docs.map(x=>x.data())}catch(e){say(fe(e))}
  const l=d[d.length-1],max=Math.max(1,...d.map(x=>x.money));
  $('#view').innerHTML=`<div class="grid">
   <div class="card stat"><b>$${l?Math.round(l.money).toLocaleString():'—'}</b><span>Money in economy</span></div>
   <div class="card stat"><b>${l?l.players:'—'}</b><span>Players</span></div>
   <div class="card stat"><b>$${l&&l.players?Math.round(l.money/l.players).toLocaleString():'—'}</b><span>Avg per player</span></div></div>
   <div class="card"><h3>Economy over time</h3>${d.length?`<svg viewBox="0 0 ${d.length*24} 120" style="width:100%;height:160px">${d.map((x,i)=>`<rect x="${i*24+3}" y="${120-x.money/max*115}" width="18" height="${x.money/max*115}" rx="3" fill="var(--red)"><title>${esc(x.day)}: $${Math.round(x.money).toLocaleString()}</title></rect>`).join('')}</svg>`:'<p class="mu">No data yet. Staff can add entries.</p>'}</div>
   <div class="card"><h3>History</h3><table><tr><th>Date</th><th>Money</th><th>Players</th><th>Note</th></tr>${d.slice().reverse().slice(0,30).map(x=>`<tr><td>${esc(x.day)}</td><td>$${Math.round(x.money).toLocaleString()}</td><td>${x.players}</td><td>${esc(x.note)}</td></tr>`).join('')}</table></div>
   ${S.staff?`<div class="card"><h3>Add Entry (Staff)</h3><div class="row"><div><label>Total money</label><input id="em" type="number"></div><div><label>Players</label><input id="ep" type="number"></div></div><label>Note</label><input id="en"><p><button class="btn" onclick="addEco()">Add entry</button></p></div>`:''}`;
}
async function addEco(){const money=Number($('#em').value),players=parseInt($('#ep').value,10);
  if(!isFinite(money)||!(players>=0))return say('Money and players must be numbers');
  try{const day=new Date().toISOString().slice(0,10);await db.collection('economy').doc(day).set({day,money,players,note:$('#en').value.slice(0,200)});say('Entry saved.');economy()}catch(e){say(fe(e))}}

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
