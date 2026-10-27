// ===== CONFIG =====
const CFG={DISCORD_CLIENT_ID:'1542247332899455006',GUILD_ID:'1462548365907722252',POLICE_ROLE_ID:'1554679644102332506',STAFF_ROLE_ID:'1554679627342159922',JOIN_URL:'',EMERGENCY_ROLE_IDS:[],JUDGE_ROLE_IDS:[],EMS_ROLE_IDS:[]}; // EMERGENCY_ROLE_IDS = extra Discord role IDs (EMT, Fire, Dispatch...) that may use Emergency Response mode; POLICE_ROLE_ID is always allowed. JUDGE_ROLE_IDS = roles that may approve or deny warrant requests (staff always can). EMS_ROLE_IDS = confirmed EMS role(s): they can use Emergency Response mode. JOIN_URL = your main Discord invite link (optional)
// Firebase web config (public by design; access is controlled by Firestore rules)
firebase.initializeApp({apiKey:"AIzaSyAtjPX7727zNlvBh85jzTeAqPs5LfvuYr0",authDomain:"rossite.firebaseapp.com",projectId:"rossite",storageBucket:"rossite.firebasestorage.app",messagingSenderId:"812413188846",appId:"1:812413188846:web:a3e3d7e65697ff290c91ff"});
const db=firebase.firestore();
// ==================
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
safeId=s=>/^[A-Za-z0-9_-]+$/.test(String(s??''))?String(s):'';
let S={user:null,staff:false,ers:false,police:false},tab='home',draft={},MODE='std';
const LOADER=n=>`<div class="loader"><span class="spin"></span><span>Loading…</span></div>`+(n?`<div class="cgrid">${'<div class="skel"></div>'.repeat(n)}</div>`:'');
const say=t=>{const m=$('#msg');m.textContent=t;m.classList.toggle('hide',!t)};
const fe=e=>e&&e.code==='permission-denied'?'Firestore blocked this. Paste the rules into Firebase Console > Firestore > Rules and press Publish.':(e&&e.message)||'Database error';
const dc=async(p,t)=>{const r=await fetch('https://discord.com/api/v10'+p,{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw new Error(r.status);return r.json()};
let LOGIN_MSG='';
const oState=()=>{try{const o=JSON.parse(localStorage.getItem('ros_st')||'null');if(o&&o.s&&o.t>Date.now()-18e5)return o.s;
  const s=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('ros_st',JSON.stringify({s,t:Date.now()}));return s}catch{return ''}};
const loginUrl=()=>'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:CFG.DISCORD_CLIENT_ID,response_type:'token',scope:'identify guilds.members.read',redirect_uri:location.origin+location.pathname+location.search,state:oState()});
function token(){const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){
    let want='';try{const o=JSON.parse(localStorage.getItem('ros_st')||'null');want=o&&o.s||''}catch{}
    // only accept a token we asked for: a link crafted by someone else cannot log you in as them
    if(want&&h.get('state')===want){localStorage.setItem('rp_tok',JSON.stringify({t:h.get('access_token'),exp:Date.now()+h.get('expires_in')*1000}));try{localStorage.removeItem('ros_st')}catch{}}
    else LOGIN_MSG='Login could not be verified. Press "Log in with Discord" again and finish the login in the same browser.';
    history.replaceState(null,'',location.pathname+location.search)}
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
let TOSBACK=null;
function footTerms(){
  if(BANNED||DOWN){ // banned or closed: show only the (static, read-only) Terms with a way back
    if(TOSBACK===null)TOSBACK=$('#view').innerHTML;
    terms();$('#view').insertAdjacentHTML('afterbegin','<div class="card"><button class="btn s" onclick="closeTerms()">Back</button></div>');
    scrollTo(0,0);return}
  go('terms');scrollTo(0,0)}
function closeTerms(){if(TOSBACK!==null){$('#view').innerHTML=TOSBACK;TOSBACK=null}scrollTo(0,0)}
function showBan(b){
  BANNED=true;
  $('#nav').innerHTML='';$('#who').innerHTML='';
  $('#view').innerHTML=`<div class="card hero"><div class="kick">ACCESS DENIED</div><h2>You are banned</h2>
    <p>You have been banned from the Republic of Stilton website.</p>
    ${b&&b.reason?`<p class="mu">Reason: ${esc(b.reason)}</p>`:''}
    <p class="mu">Using another account or browser to get around a ban is against the Terms of Service (Section 3, Ban Evasion).</p>
    <p class="mu">If you think this is a mistake, contact the staff team on Discord.</p></div>`;
}
let DEV=null,BANNED=false,DOWN=false,SITE=null;
async function init(){
  $('#view').innerHTML=LOADER();
  const t=token();
  DEV=await deviceIds();
  const siteP=db.collection('site').doc('status').get().then(d=>d.exists?d.data():null).catch(()=>null);
  let u=null;
  if(t){try{u=await dc('/users/@me',t)}catch{localStorage.removeItem('rp_tok');LOGIN_MSG='Your Discord login expired. Please log in again.'}}
  const flag=getFlag(),{ban,ok}=await findBan(u&&u.id,DEV,flag&&flag.u);
  if(ban){setFlag(ban);
    if(u&&String(ban.user_id||'')!==u.id)db.collection('devices').doc(u.id).set({ids:firebase.firestore.FieldValue.arrayUnion('v:'+DEV.v,'f:'+DEV.f),name:String(u.global_name||u.username||'').slice(0,80),updated:Date.now()},{merge:true}).catch(()=>{}); // another account on a banned browser: record it so staff can ban it too
    return showBan(ban)}
  if(flag&&!ok)return showBan({reason:flag.r}); // cannot check right now: stay banned
  if(flag)clearFlag(); // staff lifted the ban
  if(u){try{const m=await dc(`/users/@me/guilds/${CFG.GUILD_ID}/member`,t),r=m.roles||[];
      S.user={id:u.id,name:m.nick||u.global_name||u.username,avatar:u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`:null};
      S.staff=r.includes(CFG.STAFF_ROLE_ID);
      if(!S.staff){try{S.staff=(await db.collection('admins').doc(u.id).get()).exists}catch{}} // admins added from the Staff tab
      S.police=r.includes(CFG.POLICE_ROLE_ID);
      S.judge=(CFG.JUDGE_ROLE_IDS||[]).some(x=>r.includes(x));
      S.ems=(CFG.EMS_ROLE_IDS||[]).some(x=>r.includes(x));
      S.ers=S.staff||S.police||S.judge||S.ems||(CFG.EMERGENCY_ROLE_IDS||[]).some(x=>r.includes(x));
      try{const mm=localStorage.getItem('ros_mode');MODE=(mm==='staff'&&S.staff)||(mm==='er'&&S.ers)?mm:'std'}catch{}
      draft=JSON.parse(localStorage.getItem('rp_draft_'+u.id)||'{}');
      tab=['bank','tickets'].includes(draft.tab)?'portal':['home','chains','portal','terms','mod','er'].includes(draft.tab)?draft.tab:tab;
      db.collection('devices').doc(u.id).set({ids:firebase.firestore.FieldValue.arrayUnion('v:'+DEV.v,'f:'+DEV.f),name:S.user.name.slice(0,80),updated:Date.now()},{merge:true}).catch(()=>{}); // lets staff ban this person's devices too
    }catch(e){localStorage.removeItem('rp_tok');S.user=null;S.staff=false;LOGIN_MSG='Could not confirm your Discord server membership'+(e&&/^\d+$/.test(e.message)?' (Discord error '+e.message+')':'')+'. You must be a member of our Discord server to log in.'}}
  SITE=await siteP;
  if(SITE&&SITE.down&&!S.staff){showDown();watchSite();return}
  render();
  if(LOGIN_MSG)say(LOGIN_MSG);
  if(SITE&&SITE.down&&S.staff)say('The site is shut down. Only staff can see it. You can reopen it in the Staff tab.');
  watchBan(u&&u.id);
  watchSite();
  startPresence();
  try{initLawBot()}catch{}
  try{resumeDuty()}catch{}
  setTimeout(()=>{try{if(!BANNED&&!DOWN&&isCivilian()&&!tutSeen())startIntro()}catch{}},500);
}
// ===== site shutdown (staff kill switch) =====
function showDown(){
  DOWN=true;
  $('#nav').innerHTML='';
  $('#who').innerHTML=S.user?`<span class="user">${esc(S.user.name)} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn s" href="${loginUrl()}">Staff log in</a>`;
  $('#view').innerHTML=`<div class="card hero"><div class="kick">TEMPORARILY CLOSED</div><h2>The site is down</h2>
    <p>The Republic of Stilton website has been shut down for now.</p>
    ${SITE&&SITE.message?`<p class="mu">${esc(SITE.message)}</p>`:''}
    <p class="mu">Please check the Discord server for updates.</p></div>`;
}
function watchSite(){
  let prev=!!(SITE&&SITE.down),first=true;
  db.collection('site').doc('status').onSnapshot(s=>{
    SITE=s.exists?s.data():null;const now=!!(SITE&&SITE.down);
    if(first){first=false;if(now===prev)return}
    if(now&&!S.staff){if(!BANNED)showDown()}
    else if(!now&&DOWN)location.reload();
    else if(S.staff&&now!==prev){say(now?'The site is now shut down. Only staff can see it.':'The site is open again.');if(tab==='mod')mod()}
    prev=now;
  },()=>{});
}
// ===== who is online (a heartbeat while a logged-in page is open and visible) =====
function startPresence(){
  if(!S.user)return;
  const beat=()=>{if(!S.user||BANNED||document.hidden)return;
    db.collection('presence').doc(S.user.id).set({name:S.user.name.slice(0,80),seen:Date.now(),tab:String(tab).slice(0,20)}).catch(()=>{})};
  beat();setInterval(beat,120000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)beat()});
}
let ONL=null;
async function loadOnline(){
  const box=$('#online');if(!box||tab!=='mod')return;
  try{const since=Date.now()-5*60000;
    const q=await db.collection('presence').where('seen','>',since).limit(200).get();
    const rows=q.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>(y.seen||0)-(x.seen||0));
    const to=$('#t_online');if(to)to.textContent=rows.length;box.innerHTML=`<h3>Online now (${rows.length})</h3><p class="mu">People logged in with Discord who have the site open. Updates about every 2 minutes. Entries disappear after 5 minutes.</p>
     <table class="tbl"><tr><th>User</th><th>Page</th><th>Last seen</th><th></th></tr>${rows.map(x=>`<tr><td><b>${esc(x.name||'—')}</b><br><span class="mu">${esc(x.id)}</span></td><td>${esc(x.tab||'')}</td><td class="mu">${Math.max(0,Math.round((Date.now()-(x.seen||0))/1000))}s ago</td><td style="text-align:right"><button class="btn s" onclick="fillBan('${safeId(x.id)}')">Ban</button></td></tr>`).join('')||'<tr><td class="mu" colspan="4">Nobody is logged in right now.</td></tr>'}</table>
     <p><button class="lnk" onclick="loadOnline()">Refresh</button></p>`;
  }catch(e){box.innerHTML='<h3>Online now</h3><p class="mu">Could not load: '+esc(e&&e.code==='permission-denied'?'publish the newest Firestore rules':(e&&e.message)||'error')+'</p>'}
  clearTimeout(ONL);ONL=setTimeout(loadOnline,30000);
}
async function loadEconomy(){
  const te=$('#t_econ');if(!te||tab!=='mod')return;
  try{await authed();
    const [g,t,n,f]=await Promise.all(['grant','take','income','fine'].map(k=>db.collection('ledger').where('type','==',k).get()));
    const sum=q=>q.docs.reduce((x,d)=>x+(Number(d.data().amount)||0),0),gv=sum(g),tk=sum(t),inc=sum(n),fn=sum(f);
    te.textContent=SB(gv+inc-tk-fn);const c=$('#t_econ_s');if(c)c.textContent=SB(gv)+' given, '+SB(inc)+' income, '+SB(tk+fn)+' removed';
  }catch(e){te.textContent='—';const c=$('#t_econ_s');if(c)c.textContent=e&&e.code==='permission-denied'?'publish the newest rules':'could not load'}
}
const fillBan=id=>{DT='bans';mod().then(()=>{const el=$('#b_id');if(el&&id){el.value=id;el.scrollIntoView({block:'center'})}})};
async function toggleSite(down){
  if(down&&!confirm('Shut the site down for everyone except staff?'))return;
  try{await staffWrite('s_status',b=>b.set(db.collection('site').doc('status'),{down,message:(($('#s_msg')&&$('#s_msg').value)||'').trim().slice(0,200),by:S.user.name.slice(0,80),updated:Date.now()}));
    SITE={down,message:(($('#s_msg')&&$('#s_msg').value)||'').trim().slice(0,200)};say(down?'Site is now shut down. Only staff can see it.':'Site is open again.');mod()}catch(e){say(e.message||fe(e))}
}
// Live ban watch: the moment staff bans this account (or a device it uses), reload the page so the ban screen appears.
function watchBan(uid){
  let n=0;try{n=+sessionStorage.getItem('ros_rl')||0}catch{}
  const hit=()=>{if(BANNED||n>=3)return;try{sessionStorage.setItem('ros_rl',String(n+1))}catch{}
    try{save()}catch{} location.reload()};
  const first={a:true,b:true};
  if(uid)db.collection('bans').doc('u_'+uid).onSnapshot(s=>{if(first.a){first.a=false;return}if(s.exists)hit()},()=>{});
  const ids=['v:'+DEV.v,'f:'+DEV.f];
  db.collection('bans').where('devices','array-contains-any',ids).onSnapshot(s=>{if(first.b){first.b=false;return}if(!s.empty)hit()},()=>{});
}
function render(){
  if(!modesFor().includes(MODE))MODE='std';
  let tabs;
  if(MODE==='staff')tabs=[['mod','Console'],['terms','Terms']];
  else if(MODE==='er')tabs=[['er','Response'],['terms','Terms']];
  else if(S.user&&!S.staff)tabs=[['portal','Portal'],['chains','Chain Servers'],['terms','Terms']];   // no Home screen for logged-in civilians
  else{tabs=[['home','Home'],['chains','Chain Servers']];if(S.user)tabs.push(['portal','Portal']);tabs.push(['terms','Terms'])}
  if(!tabs.some(x=>x[0]==tab))tab=tabs[0][0];
  $('#nav').innerHTML=tabs.map(([k,l])=>`<button data-k="${k}" class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#who').innerHTML=S.user?`${modeBtn()}<span class="user">${S.user.avatar?`<img src="${esc(S.user.avatar)}">`:''}${esc(S.user.name)}${S.staff?'<span class="badge">Staff</span>':''} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn" href="${loginUrl()}">Log in with Discord</a>`;
  document.body.classList.toggle('wide',tab==='mod'||tab==='er');
  document.body.classList.toggle('m-staff',MODE==='staff');document.body.classList.toggle('m-er',MODE==='er');
  const ft=document.querySelector('footer'),fa=document.getElementById('foottut');
  if(ft&&isCivilian()){if(!fa){const a=document.createElement('a');a.id='foottut';a.href='#';a.textContent='Replay the tutorial';a.style.cssText='display:inline-block;margin:8px 0 0 14px;font-size:.85rem';a.onclick=e=>{e.preventDefault();startTour()};const t=ft.querySelector('a');t?t.insertAdjacentElement('afterend',a):ft.appendChild(a)}}
  else if(fa)fa.remove();
  ({home,chains,portal,terms,mod,er})[tab]();
  if(S.user)ticketBadge();
}
const go=k=>{if(BANNED||DOWN)return;tab=k;draft.tab=k;say('');render()};
const needLogin=()=>$('#view').innerHTML=`<div class="card"><h2>Citizen Login</h2><p class="mu">Log in with Discord. We'll check that you're in our server.</p><a class="btn" href="${loginUrl()}">Log in with Discord</a></div>`;

const safeUrl=u=>{try{const x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)?x.href:''}catch{return ''}};

const TERMS={"title": "Stilton County Discord Terms of Service", "meta": ["Community: Stilton County Roleplay", "Issued by: Stilton County Leadership"], "sections": [{"h": "Introduction", "b": [["p", "By joining or participating in Stilton County, you agree to follow these Terms of Service, the applicable Stilton County community and department rules, and the rules of any platform used for Stilton County activities."], ["p", "These Terms apply to members, staff, developers, partners, affiliates, and anyone participating in official Stilton County spaces or activities."], ["p", "Violations may result in moderation or administrative action, including content removal, warnings, mutes, kicks, temporary or permanent bans, department removal, staff removal, or loss of privileges. Serious violations may result in immediate action without a prior warning."], ["p", "If you do not agree to these Terms, do not participate in the Stilton County community."]]}, {"h": "1. Acceptance and Platform Rules", "b": [["p", "Members must:"], ["ul", ["Follow these Terms and all applicable Stilton County rules and policies.", "Follow Discord's Terms of Service and Community Guidelines.", "Follow Roblox's Terms of Use and applicable rules when using Roblox.", "Follow the rules of other platforms used for official Stilton County activities.", "Understand that violations on external platforms may result in action when they affect the safety, operations, or members of Stilton County."]], ["p", "These Terms govern participation in Stilton County; they do not replace or override any platform's rules."]]}, {"h": "2. Conduct and Community Standards", "b": [["p", "Members must treat others respectfully and avoid behavior that disrupts the community. The following are prohibited:"], ["ul", ["Harassment, bullying, targeted abuse, hate speech, discrimination, or slurs.", "Threats of violence, intimidation, or encouragement of harm.", "Posting NSFW, sexually explicit, or otherwise prohibited content.", "Spam, flooding, disruptive trolling, or deliberate interference with community activities.", "Encouraging others to break rules or coordinating harassment or attacks.", "Knowingly spreading fabricated announcements, impersonating official representatives, or presenting manipulated evidence as genuine.", "Offensive usernames, profile images, or statuses that violate these Terms or applicable platform rules."]], ["p", "Good-faith criticism, respectful disagreement, and legitimate complaints are not prohibited merely because they are critical of Stilton County or its leadership. Staff may intervene when conduct becomes harassment, targeted disruption, threats, or another rule violation."], ["p", "Though not all mentioned, The rules posted in the #Rules channel still apply in these terms."]]}, {"h": "3. Accounts, Impersonation, and Ban Evasion", "b": [["p", "Members are responsible for activity conducted through their accounts and should take reasonable steps to keep accounts secure."], ["p", "Members may not:"], ["ul", ["Use alternate accounts to evade a ban or other restriction.", "Impersonate members, staff, developers, department leaders, official organizations, or other representatives.", "Falsely claim official status or authority.", "Use another person's account or credentials without authorization.", "Ask another person to evade a restriction or act as a proxy to bypass moderation.", "Abuse Discord features, bots, roles, or permissions."]]]}, {"h": "4. Advertising, Partnerships, and Recruitment", "b": [["p", "Advertising and recruitment are restricted to protect the community."], ["p", "Unless authorized by Stilton County Leadership, members may not:"], ["ul", ["Advertise other Discord servers, Roblox games, groups, communities, or outside services.", "Send unsolicited advertisements through direct messages, including when acting as a partner.", "Use usernames, statuses, profiles, or community access to advertise competing communities.", "Mass-message members to recruit them elsewhere.", "Use private or confidential information to recruit members.", "Conduct organized recruitment or promotion that disrupts Stilton County."]], ["p", "Approved advertisements and partnerships may only be posted through authorized channels and by authorized users. Ordinary conversation or a member's decision to leave is not, by itself, a violation; enforcement should focus on unauthorized advertising, targeted solicitation, misuse of private information, or disruptive recruitment."]]}, {"h": "5. Roleplay, Departments, and External Representation", "b": [["p", "Members participating in roleplay must:"], ["ul", ["Act in good faith and respect other players.", "Follow server, game, event, and department rules.", "Avoid intentionally ruining another person's roleplay experience.", "Follow applicable training requirements and reasonable instructions from authorized department leadership.", "Report concerns through the appropriate channels."]], ["p", "Cheating, exploiting, or abusing game mechanics is prohibited. Members representing Stilton County elsewhere must not falsely claim authority, impersonate official representatives, or engage in conduct that violates these Terms while acting in an official capacity."], ["p", "Departments may adopt additional procedures with leadership approval. Department rules must be communicated to affected members."]]}, {"h": "6. Staff Authority and Responsibilities", "b": [["p", "Authorized staff may, as reasonably necessary to protect the community:"], ["ul", ["Moderate conversations and remove rule-breaking content.", "Issue warnings, mutes, kicks, temporary bans, or permanent bans.", "Restrict channel access, manage roles, and remove privileges.", "Manage community operations and enforce approved policies."]], ["p", "Staff must use permissions responsibly, treat members fairly, follow staff procedures, and protect confidential information. Staff may not use their position for personal retaliation, unauthorized punishment, personal benefit, or unauthorized access."], ["p", "Staff abuse may result in investigation, removal of permissions, dismissal from staff, or other appropriate action. Leadership retains authority over community operations, staff management, partnerships, and development decisions, subject to applicable platform rules and law."]]}, {"h": "7. Confidentiality and Internal Information", "b": [["p", "Members must not disclose confidential or restricted Stilton County information without authorization. This may include:"], ["ul", ["Private staff discussions, internal documents, and moderation logs.", "Private reports, personal information, or confidential support-ticket content.", "Unreleased announcements, development information, or restricted content.", "Security details that could reasonably expose the community or its members to harm."]], ["p", "Staff have an additional duty to protect private reports and internal discussions and must not improperly disclose moderation actions or confidential development information."], ["p", "This section does not prohibit good-faith reports of abuse, safety concerns, or potentially unlawful conduct to appropriate people or authorities, or disclosures required by law. When possible, report concerns privately to authorized leadership rather than publishing sensitive information publicly."]]}, {"h": "8. Intellectual Property and Content Ownership", "b": [["p", "Stilton County retains rights to original assets that it owns or has legally acquired the rights to use. These may include original logos, branding, scripts, models, systems, documents, and game assets."], ["p", "Without authorization, members may not:"], ["ul", ["Claim protected Stilton County content as their own.", "Redistribute private or restricted assets.", "Use official branding in a way that falsely suggests endorsement or official status.", "Leak unreleased content or access-restricted development materials."]], ["p", "Third-party content remains subject to its respective owner's rights, licenses, and usage restrictions. This Terms of Service does not transfer ownership of a member's independently created work to Stilton County merely because the member participates in the community. Any separate transfer or license must be clearly agreed upon."]]}, {"h": "9. Privacy and Personal Information", "b": [["p", "Members may not:"], ["ul", ["Share another person's personal or sensitive information without authorization.", "Dox, threaten to expose, or attempt to obtain private information about another person.", "Publish private screenshots, messages, reports, or recordings containing sensitive information without appropriate authorization.", "Use private information to threaten, harass, intimidate, or recruit members."]], ["p", "Report privacy violations privately to authorized staff. Do not post sensitive evidence in public channels; provide only the information reasonably needed for review. Staff should limit access to reports to people who need the information to handle the issue."]]}, {"h": "10. Exploits, Security, Bots, and Permissions", "b": [["p", "Members may not:"], ["ul", ["Exploit bugs or security vulnerabilities, bypass permissions, or attempt unauthorized access.", "Abuse, spam, crash, or interfere with bots or community systems.", "Use unauthorized automation to disrupt the community or evade moderation.", "Delete content, assign roles, punish members, or access restricted channels without authorization.", "Distribute malware, viruses, malicious links, harmful files, scams, or fraudulent material.", "Organize harassment, attacks, or other prohibited activity through Stilton County spaces."]], ["p", "Report security issues privately to authorized staff. Do not exploit the issue further, access data that is not yours, or publicly disclose details that could put members or systems at risk."]]}, {"h": "11. Reporting and Appeals", "b": [["p", "Members are encouraged to report rule violations, staff abuse, privacy concerns, suspicious activity, and security issues through the designated support or reporting channels."], ["p", "Reports should be made honestly and include relevant information where available. Knowingly fabricated reports, forged evidence, or deliberate attempts to frame another member may result in moderation action. A report is not considered false merely because it cannot be substantiated."], ["p", "Members may appeal a moderation action through the designated appeal or support channel, where available. Appeals should briefly explain the action being appealed and provide relevant context or evidence. Appeals may be denied if they are abusive, repetitive without new information, or used to harass staff."], ["p", "Where practical, a staff member not directly involved in the original decision should review a serious staff-misconduct complaint or appeal. Leadership may decide how appeals are handled based on the circumstances. An appeal does not automatically pause a restriction, and serious safety issues may require immediate action while a review is pending."]]}, {"h": "12. Enforcement and Consequences", "b": [["p", "Depending on the severity, frequency, intent, impact, and context of a violation, actions may include:"], ["ul", ["Informal direction or a warning.", "Content removal or a mute.", "A kick or temporary ban.", "A permanent ban or removal from the community.", "Department removal, staff removal, or loss of roles and privileges."]], ["p", "Stilton County may take action for conduct not specifically listed when the conduct presents a reasonable safety risk, materially disrupts community operations, involves abuse of access, or is otherwise inconsistent with these Terms. Staff should apply this discretion in good faith and proportionately. No particular sequence of warnings is guaranteed; serious violations may warrant immediate removal."], ["p", "Membership and access to departments, staff positions, and community resources may be restricted or withdrawn when necessary to protect the community. This does not remove any rights members may have under applicable law or platform policies."]]}, {"h": "13. Technical Issues and Third-Party Services", "b": [["p", "Stilton County does not control third-party services and cannot guarantee uninterrupted access to Discord, Roblox, games, bots, websites, or other external services. Outages, updates, and third-party failures may affect community features or cause data loss."], ["p", "Staff may attempt to help resolve issues but cannot guarantee a fix or recovery of data controlled by an external provider. Nothing in this section excludes responsibility where it cannot lawfully be excluded."]]}, {"h": "14. Safety and Legal Compliance", "b": [["p", "Members must comply with applicable laws and platform rules. Using Stilton County to organize illegal activity, commit fraud, threaten others, distribute illegal content, or facilitate harm is prohibited."], ["p", "Members should avoid suspicious links and downloads, secure their accounts, enable two-factor authentication when available, and report suspicious activity. Stilton County cannot guarantee the security of a member's personal device or external account."]]}, {"h": "15. International Users", "b": [["p", "Stilton County welcomes members from all countries and regions. The following applies to members who participate from outside the country where Stilton County Leadership is based:"], ["ul", ["These Terms apply equally to every member, regardless of nationality, language, or country of residence. Discrimination or harassment based on any of these is prohibited under Section 2.", "Members are responsible for following the laws that apply to them where they live or access the community. Nothing in these Terms requires a member to break the law of their country.", "Members must meet the minimum age required by each platform used (such as Discord and Roblox) and by the law where they live. Minimum ages differ between countries and regions.", "Official communication is primarily in English. Members may use translation tools, and staff will make reasonable efforts to help members who have difficulty with language. If a translation of these Terms conflicts with the English version, the English version applies.", "Members live in many time zones. Staff should state the time zone for events, deadlines, and appeal windows, and should take time-zone differences into account when reviewing reports and appeals.", "Stilton County's systems, including this website, rely on third-party providers such as Discord and Google Firebase, and information used to operate them (for example a Discord account ID, or a device identifier stored in your browser to prevent ban evasion) may be processed on servers located in other countries."]], ["p", "Nothing in these Terms removes any rights a member has under the law of their country that cannot lawfully be waived. If a provision cannot be applied to a member under their local law, the remaining provisions still apply to the extent permitted."]]}, {"h": "16. Changes to These Terms", "b": [["p", "Stilton County Leadership may revise these Terms when necessary. The latest version should be made available in an official community location, with material changes announced where reasonably practical such as the Stilton website."], ["p", "Members are responsible for reviewing the current version. Continued participation after an update may be treated as acceptance of the revised community rules to the extent permitted by applicable law. If a member does not agree to the changes, they should stop participating in Stilton County."]]}, {"h": "17. Final Agreement", "b": [["p", "By joining or continuing to participate in Stilton County, you acknowledge that you are expected to follow these Terms, applicable platform rules, and relevant community and department policies. Violations may result in moderation or administrative action as described above."], ["p", "Stilton County is intended to promote teamwork, respect, professionalism, safety, and quality roleplay. Members are expected to help maintain that environment."], ["p", "— Stilton County Leadership"]]}]};
function terms(){
  $('#view').innerHTML=`<div class="card hero"><div class="kick">${esc(TERMS.meta[0])} &bull; ${esc(TERMS.meta[1])}</div><h2>${esc(TERMS.title)}</h2></div>`+
   TERMS.sections.map(x=>`<div class="card sec"><h3>${esc(x.h)}</h3>${x.b.map(b=>b[0]==='ul'?`<ul>${b[1].map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:`<p>${esc(b[1])}</p>`).join('')}</div>`).join('');
}

function home(){
  $('#view').innerHTML=`<div class="card hero"><div class="kick">|+-+| Republic Of Stilton |+-+|</div><h2>Republic of Stilton</h2>
   <p class="mu">Est Jan 2026 &bull; “United in governance, Freedom in communities”</p>
   <p><button class="btn" onclick="go('chains')">Explore Chain Servers</button> ${!S.user||isCivilian()?'<button class="btn s" onclick="startTour()">Take the tutorial</button>':''} ${safeUrl(CFG.JOIN_URL)?`<a class="btn s" href="${esc(safeUrl(CFG.JOIN_URL))}" target="_blank" rel="noopener noreferrer">Join the Discord</a>`:''}</p></div>

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

let PIN=(()=>{try{return sessionStorage.getItem('ros_spin')||''}catch{return ''}})(),UNLOCKED=false;const pin=()=>PIN;
const setPin=v=>{PIN=String(v||'').trim();if(!PIN)UNLOCKED=false;try{PIN?sessionStorage.setItem('ros_spin',PIN):sessionStorage.removeItem('ros_spin')}catch{};pinChip()};
const pinChip=()=>{const c=$('#pinchip');if(c){c.textContent=UNLOCKED?'PIN unlocked':'PIN locked';c.className='st-stat '+(UNLOCKED?'':'bad')}};
async function unlockStaff(){
  const p=((($('#b_pin')||{}).value)||PIN).trim();if(!p)return say('Type the staff PIN first');
  try{await authed();const ref=db.collection('proofs').doc('k_'+Date.now());await ref.set({pin:p});await ref.delete().catch(()=>{});setPin(p);UNLOCKED=true;pinChip();say('Staff PIN accepted. You are unlocked.')}
  catch(e){UNLOCKED=false;setPin('');const i=$('#b_pin');if(i)i.value='';say(e&&e.code==='permission-denied'?'That staff PIN is wrong. Try again.':(e.message||fe(e)))}
}
// Staff actions are checked by the database rules: the staff PIN must be sent along with the change.
async function staffWrite(id,fn){
  let p=(($('#b_pin')&&$('#b_pin').value)||PIN).trim();
  if(!p)p=(prompt('Staff PIN')||'').trim();
  if(!p)throw new Error('Enter the staff PIN first');
  const ref=db.collection('proofs').doc(id);
  // step 1: check the PIN on its own, so a wrong PIN can be told apart from a blocked change
  try{await ref.set({pin:p})}catch(e){if(e&&e.code==='permission-denied'){setPin('');throw new Error('Staff PIN rejected. Check it and try again.')}throw e}
  await ref.delete().catch(()=>{}); // no leftover proof, so it cannot be reused
  setPin(p);UNLOCKED=true;
  // step 2: the real change, sent together with the PIN proof
  const b=db.batch();b.set(ref,{pin:p});fn(b);
  try{await b.commit()}
  catch(e){if(e&&e.code==='permission-denied')throw new Error('Your PIN is correct, but the database rules blocked this change ('+id+'). Check the Discord ID and that the newest rules are published.');throw e}
  finally{ref.delete().catch(()=>{})}
}
let DT='over',PULSE=15,PT=null;
const dashTab=k=>{DT=k;mod()};
const sid=x=>{x=String(x||'');return x.length>12?x.slice(0,4)+'…'+x.slice(-4):x};
const ago=t=>{const s=Math.max(0,Math.round((Date.now()-(t||0))/1000));return s<60?s+'s ago':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago'};
async function healthChecks(){
  const one=async(name,fn,ok)=>{try{const r=await fn();return {name,ok:ok?ok(r):true,note:''}}catch(e){return {name,ok:false,note:e&&e.code==='permission-denied'?'blocked by rules':(e&&e.message)||'error'}}};
  const c=db.collection.bind(db);
  const r=await Promise.all([
    one('Database reachable',()=>c('bans').limit(1).get()),
    one('Site status readable',()=>c('site').doc('status').get()),
    one('Site open to the public',async()=>SITE,x=>!(x&&x.down)),
    one('Online list readable',()=>c('presence').limit(1).get()),
    one('Chain servers readable',()=>c('chains').limit(1).get()),
    one('Bank sign-in works',()=>authed()),
    one('Bank ledger readable',async()=>{await authed();return c('ledger').limit(1).get()})]);
  return r;
}
async function runHealth(){
  const box=$('#health');if(!box)return;
  box.innerHTML='<div class="loader"><span class="spin"></span><span>Running checks…</span></div>';
  const r=await healthChecks();if(!$('#health'))return;
  const ok=r.filter(x=>x.ok).length,score=Math.round(ok/r.length*100),good=ok===r.length,col=good?'#22c55e':score>=70?'#f59e0b':'#ef4444';
  box.innerHTML=`<div class="health"><div class="score" style="color:${col}">${score}<small>/ 100</small></div>
    <div><h3>${good?'All systems operational':'Attention needed'}</h3><p class="sub" style="margin:0">${good?'Every check passed. The site and the bank are working.':(r.length-ok)+' of '+r.length+' checks failed. Open the list below.'}</p><div class="hbar" style="--c:${col}"><i style="width:${score}%"></i></div></div>
    <div style="text-align:right"><div class="mu" style="font-size:.85em">Checked ${new Date().toLocaleTimeString()}</div><button class="lnk" onclick="runHealth()">Run checks again</button></div></div>
    <details class="hd"><summary>${ok} of ${r.length} checks passed</summary><ul>${r.map(x=>`<li class="${x.ok?'ok':'bad'}"><b>${x.ok?'Pass':'Fail'}</b>${esc(x.name)}${x.note?` <span class="mu">(${esc(x.note)})</span>`:''}</li>`).join('')}</ul></details>`;
}
async function loadPulse(){
  const box=$('#pulse');if(!box||tab!=='mod')return;
  let rows=[];
  try{await authed();const q=await db.collection('ledger').orderBy('at','desc').limit(PULSE).get();rows=q.docs.map(d=>d.data())}catch(e){}
  const items=rows.map(t=>{let tag,cls='',tx;
    if(t.type==='deposit'){tag='Deposit';tx=`<b>${esc(sid(t.from))}</b> deposited ${esc(SB(t.amount))}`}
    else if(t.type==='withdraw'){tag='Withdraw';tx=`<b>${esc(sid(t.from))}</b> withdrew ${esc(SB(t.amount))}`}
    else if(t.type==='grant'){tag='Staff';cls='a';tx=`Staff gave ${esc(SB(t.amount))} to <b>${esc(sid(t.to))}</b>`}
    else if(t.type==='take'){tag='Staff';cls='a';tx=`Staff removed ${esc(SB(t.amount))} from <b>${esc(sid(t.to))}</b>`}
    else if(t.type==='income'){tag='Income';tx=`<b>${esc(sid(t.to))}</b> collected ${esc(SB(t.amount))} income`}
    else if(t.type==='fine'){tag='Ticket';cls='a';tx=`<b>${esc(sid(t.from))}</b> paid a ticket of ${esc(SB(t.amount))}`}
    else{tag='Transfer';cls='g';tx=`<b>${esc(sid(t.from))}</b> sent ${esc(SB(t.amount))} to <b>${esc(sid(t.to))}</b>`}
    return {at:t.at||0,tag,cls,tx}});
  (window.__bans||[]).slice(0,10).forEach(b=>items.push({at:b.created||0,tag:'Ban',cls:'r',tx:`<b>${esc(b.name||sid(b.user_id))}</b> was banned by ${esc(b.by_name||'staff')}`}));
  items.sort((a,b)=>b.at-a.at);const shown=items.slice(0,PULSE);
  box.innerHTML=`<table class="tbl"><tr><th>Type</th><th>Event</th><th style="text-align:right">When</th></tr>${shown.map(x=>`<tr><td><span class="tag ${x.cls}">${x.tag}</span></td><td>${x.tx}</td><td class="mu" style="text-align:right;white-space:nowrap">${ago(x.at)}</td></tr>`).join('')||'<tr><td colspan="3" class="mu">Nothing has happened yet.</td></tr>'}</table>`+(rows.length>=PULSE?'<p class="more"><button class="lnk" onclick="PULSE+=15;loadPulse()">Load more</button></p>':'');
  clearTimeout(PT);PT=setTimeout(loadPulse,30000);
}
async function lookupUser(){
  const id=($('#lk_id').value||'').replace(/\D/g,'');const box=$('#lk_out');
  if(id.length<15||id.length>25){box.innerHTML='<p class="mu">Enter a Discord user ID.</p>';return}
  box.innerHTML='<div class="loader"><span class="spin"></span><span>Looking up…</span></div>';
  try{await authed();
    const [ban,pre,dev,a,b,c,d]=await Promise.all([db.collection('bans').doc('u_'+id).get(),db.collection('presence').doc(id).get(),db.collection('devices').doc(id).get(),
      db.collection('ledger').where('from','==',id).limit(10).get(),db.collection('ledger').where('to','==',id).limit(10).get(),
      db.collection('ledger').where('from','==','c_'+id).limit(10).get(),db.collection('ledger').where('to','==','c_'+id).limit(10).get()]);
    const m={};[a,b,c,d].forEach(q=>q.docs.forEach(x=>m[x.id]=x.data()));const tx=Object.values(m).sort((p,q)=>(q.at||0)-(p.at||0)).slice(0,12);
    const bd=ban.exists?ban.data():null,pd=pre.exists?pre.data():null,dd=dev.exists?dev.data():null;
    box.innerHTML=`<div class="kpis"><div class="kpi"><div class="lbl">Status</div><div class="big" style="font-size:1.4em;color:${bd?'#ff8a8a':'#7ee2a1'}">${bd?'Banned':'Not banned'}</div><div class="mu">${bd?esc(bd.reason||'No reason given'):'No ban on record'}</div></div>
      <div class="kpi"><div class="lbl">Last seen online</div><div class="big" style="font-size:1.4em">${pd?ago(pd.seen):'Not recently'}</div><div class="mu">${pd?esc(pd.name||''):esc((dd&&dd.name)||'')}</div></div>
      <div class="kpi"><div class="lbl">Known devices</div><div class="big" style="font-size:1.4em">${dd?(dd.ids||[]).length:0}</div><div class="mu">${bd?'':`<button class="lnk" onclick="fillBan('${safeId(id)}')">Ban this user</button>`}</div></div></div>
      <div class="panel"><h3>Recent bank activity</h3><p class="sub">Personal account and company account (c_${esc(sid(id))}).</p><table class="tbl"><tr><th>Type</th><th>From</th><th>To</th><th>Amount</th><th style="text-align:right">When</th></tr>${tx.map(t=>`<tr><td><span class="tag">${esc(t.type)}</span></td><td>${esc(sid(t.from))}</td><td>${esc(sid(t.to))}</td><td>${esc(SB(t.amount))}</td><td class="mu" style="text-align:right">${ago(t.at)}${t.note?' · '+esc(t.note):''}</td></tr>`).join('')||'<tr><td colspan="5" class="mu">No bank activity.</td></tr>'}</table></div>`;
  }catch(e){box.innerHTML='<p class="mu">Could not look up: '+esc(e&&e.code==='permission-denied'?'publish the newest rules':(e&&e.message)||'error')+'</p>'}
}
async function mod(){
  if(!S.staff)return go('home');
  $('#view').innerHTML=LOADER(1);
  let list=[],pend=0;
  try{list=(await db.collection('bans').get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))}catch(e){say(fe(e))}
  window.__bans=list;
  try{pend=(await db.collection('chains').get()).docs.filter(d=>{const r=d.data().review;return r==='pending'||!r}).length}catch{}
  let regPend=0;try{await authed();regPend=(await db.collection('vehicles').where('status','==','pending').get()).size}catch{}
  const down=!!(SITE&&SITE.down);
  const nav=[['over','Overview'],['look','Lookup'],['bank','Bank'],['tix','Tickets'],['lic','Licenses'],['reg','Registrations'],['bans','Bans'],['adm','Admins'],['law','Laws'],['site','Site']];
  let adm=[];if(DT==='adm'){try{adm=(await db.collection('admins').get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))}catch(e){say(e&&e.code==='permission-denied'?'Publish the newest rules':fe(e))}}
  let laws={text:'',meta:null};if(DT==='law'){try{const d=await db.collection('laws').doc('main').get();if(d.exists){laws.meta=d.data();laws.text=String(d.data().text||'')}}catch(e){say(e&&e.code==='permission-denied'?'Publish the newest rules':fe(e))}}
  let tix=[];if(DT==='tix'){try{await authed();tix=(await db.collection('tickets').orderBy('created','desc').limit(60).get()).docs.map(d=>({id:d.id,...d.data()}))}catch(e){say(e&&e.code==='permission-denied'?'Publish the newest rules':fe(e))}}
  let lics=[],vehs=[];if(DT==='lic'||DT==='reg'){try{await authed();[lics,vehs]=await Promise.all([db.collection('licenses').get().then(q=>q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.updated||0)-(a.updated||0))),db.collection('vehicles').orderBy('created','desc').limit(100).get().then(q=>q.docs.map(d=>({id:d.id,...d.data()})))])}catch(e){say(e&&e.code==='permission-denied'?'Publish the newest rules':fe(e))}}
  const head=`<div class="st-head"><div class="st-title"><h2>Staff Console</h2><span>Republic of Stilton</span></div>
    <div class="st-tabs">${nav.map(([k,l])=>`<button class="${DT===k?'on':''}" onclick="dashTab('${k}')">${l}${k==='bans'?`<b>${list.length}</b>`:k==='reg'&&regPend?`<b>${regPend}</b>`:''}</button>`).join('')}</div>
    <div class="st-r"><span class="st-stat ${down?'bad':''}">${down?'Site shut down':'Site operational'}</span><span id="pinchip" class="st-stat ${UNLOCKED?'':'bad'}">${UNLOCKED?'PIN unlocked':'PIN locked'}</span><input id="b_pin" type="password" placeholder="Staff PIN" title="Staff PIN, used for every action" name="ros-staff-pin" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" oninput="setPin(this.value)" onkeydown="if(event.key==='Enter')unlockStaff()" value="${esc(pin())}"><button class="btn" type="button" onclick="unlockStaff()">Unlock</button></div></div>`;
  let body='';
  if(DT==='over')body=`<div class="panel" id="health"></div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">Online now</div><div class="big" id="t_online">…</div><div class="mu">logged in right now</div></div>
      <div class="kpi"><div class="lbl">SB in circulation</div><div class="big" id="t_econ">…</div><div class="mu" id="t_econ_s">counting…</div></div>
      <div class="kpi click" onclick="dashTab('bans')"><div class="lbl">Banned</div><div class="big">${list.length}</div><div class="mu">people banned</div></div>
      <div class="kpi click" onclick="openChains()"><div class="lbl">Chain applications</div><div class="big">${pend}</div><div class="mu">waiting for review</div></div>
      <div class="kpi click" onclick="dashTab('reg')"><div class="lbl">Vehicle registrations</div><div class="big">${regPend}</div><div class="mu">waiting for review</div></div></div>
    <div class="cols">
      <div class="panel"><div class="hl"><h3>Recent activity</h3><span class="mu" style="font-size:.85em">Refreshes every 30 seconds</span></div><p class="sub">Bank activity and bans, newest first.</p><div id="pulse"><div class="loader"><span class="spin"></span><span>Loading…</span></div></div></div>
      <div class="panel"><h3>Actions</h3><p class="sub">Common staff tasks.</p><div class="acts">
        <button onclick="copySite()">Copy site link</button>
        <button onclick="dashTab('site')">${down?'Reopen the site':'Shut the site down'}</button>
        <button onclick="dashTab('bans')">Ban a user</button>
        <button onclick="dashTab('bank')">Give or remove cash</button>
        <button onclick="dashTab('look')">Look up a user</button>
        <button onclick="dashTab('reg')">Review vehicle registrations</button>
        <button onclick="dashTab('lic')">Turn a license on or off</button>
        <button onclick="dashTab('tix')">Issue a ticket</button>
        <button onclick="openChains()">Review chain applications</button></div></div></div>
    <div class="panel" id="online" style="margin-top:1.2em"><h3>Online now</h3><div class="loader"><span class="spin"></span><span>Loading…</span></div></div>`;
  else if(DT==='look')body=`<div class="panel"><h3>Look up a user</h3><p class="sub">See whether someone is banned, when they were last online, how many devices are on record and their recent bank activity.</p>
    <div class="row"><div><label>Discord user ID</label><input id="lk_id" inputmode="numeric" placeholder="e.g. 123456789012345678" onkeydown="if(event.key==='Enter')lookupUser()"></div><div><label>&nbsp;</label><button class="btn" onclick="lookupUser()">Look up</button></div></div></div><div id="lk_out"></div>`;
  else if(DT==='bank')body=`<div class="panel"><h3>Bank</h3><p class="sub">Money only enters the economy here. The person must have opened their bank account on the Bank tab first. For a company account enter its ID, which starts with c_. Uses the staff PIN at the top right.</p>
    <div class="row"><div><label>Account ID *</label><input id="g_id" placeholder="Discord ID, or c_ID for a company"></div><div><label>Amount (SB) *</label><input id="g_amt" inputmode="numeric"></div></div>
    <label>Note</label><input id="g_note" maxlength="100">
    <p><button class="btn" onclick="bankGrant('grant')">Give cash</button> <button class="btn s" onclick="bankGrant('take')">Remove cash</button> <button class="btn s" onclick="bankReset()">Unlink account</button></p></div>`;
  else if(DT==='tix')body=`<div class="panel"><h3>Issue a ticket</h3><p class="sub">The person sees it on their Tickets tab and pays it from their bank. Paid tickets remove that money from the economy. Uses the staff PIN at the top right.</p>
    <div class="row"><div><label>Discord user ID *</label><input id="tk_id" inputmode="numeric" placeholder="e.g. 123456789012345678"></div><div><label>Amount (SB) *</label><input id="tk_amt" inputmode="numeric"></div></div>
    <label>Reason *</label><input id="tk_reason" maxlength="200" placeholder="e.g. Speeding, 40 over the limit">
    <p><button class="btn" onclick="issueTicket()">Issue ticket</button></p></div>
    <div class="panel"><h3>Recent tickets</h3><table class="tbl"><tr><th>User</th><th>Reason</th><th>Amount</th><th>Status</th><th>By</th><th></th></tr>${tix.map(x=>`<tr><td>${esc(x.to)}</td><td>${esc(x.reason)}</td><td>${esc(SB(x.amount))}</td><td><span class="tag ${x.status==='paid'?'g':x.status==='void'?'':'a'}">${esc(x.status)}</span></td><td>${esc(x.by_name||'')}</td><td style="text-align:right">${x.status==='unpaid'?`<button class="btn s" onclick="voidTicket('${safeId(x.id)}')">Cancel</button>`:''}</td></tr>`).join('')||'<tr><td class="mu" colspan="6">No tickets issued yet.</td></tr>'}</table></div>`;
  else if(DT==='adm')body=`<div class="panel"><h3>Give someone admin</h3><p class="sub">Admins see this Staff tab as soon as they log in, even without the staff role on Discord. They still need the staff PIN to make any change, so only give the PIN to people you trust. People with the staff role on Discord are always admins. Uses the staff PIN at the top right.</p>
    <div class="row"><div><label>Discord user ID *</label><input id="ad_id" inputmode="numeric" placeholder="e.g. 123456789012345678"></div><div><label>Name or note</label><input id="ad_name" maxlength="80" placeholder="e.g. Jordan"></div></div>
    <p><button class="btn" onclick="addAdmin()">Give admin</button></p></div>
    <div class="panel"><h3>Admins added here (${adm.length})</h3><table class="tbl"><tr><th>User</th><th>Added by</th><th>When</th><th></th></tr>${adm.map(x=>`<tr><td><b>${esc(x.name||'—')}</b><br><span class="mu">${esc(x.id)}</span></td><td>${esc(x.by_name||'')}</td><td class="mu">${esc(new Date(x.created||0).toLocaleString())}</td><td style="text-align:right"><button class="btn s" onclick="removeAdmin('${safeId(x.id)}')">Remove</button></td></tr>`).join('')||'<tr><td class="mu" colspan="4">Nobody added yet. Staff-role members on Discord are not listed here.</td></tr>'}</table></div>`;
  else if(DT==='law')body=lawsPanel(laws.text,laws.meta);
  else if(DT==='lic')body=licPanel(lics);
  else if(DT==='reg')body=regPanel(vehs,lics);
  else if(DT==='bans')body=`<div class="panel"><h3>Ban a user</h3><p class="sub">Banning someone also bans every device they have logged in from. Uses the staff PIN at the top right.</p>
    <div class="row"><div><label>Discord user ID *</label><input id="b_id" placeholder="e.g. 123456789012345678" inputmode="numeric"></div><div><label>Reason (shown to them)</label><input id="b_reason" maxlength="200"></div></div>
    <label style="display:flex;gap:10px;align-items:flex-start;text-transform:none;letter-spacing:0;font-size:.9rem"><input id="b_fp" type="checkbox" checked style="width:auto;margin-top:3px"><span>Also ban their hardware fingerprint <span class="mu">(stronger, but could also block someone with an identical device)</span></span></label>
    <p><button class="btn" onclick="doBan()">Ban</button></p></div>
    <div class="panel"><h3>Banned users (${list.length})</h3><table class="tbl"><tr><th>User</th><th>Reason</th><th>By</th><th>Devices</th><th></th></tr>${list.map(x=>`<tr><td><b>${esc(x.name||'—')}</b><br><span class="mu">${esc(x.user_id)}</span></td><td>${esc(x.reason||'')}</td><td>${esc(x.by_name||'')}</td><td>${(x.devices||[]).length}</td><td style="text-align:right"><button class="btn s" onclick="doUnban('${safeId(x.user_id)}')">Unban</button></td></tr>`).join('')||'<tr><td class="mu" colspan="5">Nobody is banned.</td></tr>'}</table></div>`;
  else body=`<div class="panel"><h3>Site status</h3><p>The site is currently <b>${down?'SHUT DOWN':'OPEN'}</b>.</p>
    <p class="sub">Shutting down shows a closed page to everyone except staff, and freezes the bank and new chain applications. Uses the staff PIN at the top right.</p>
    <label>Message shown to visitors (optional)</label><input id="s_msg" maxlength="200" placeholder="e.g. Back soon, we are fixing something." value="${esc((SITE&&SITE.message)||'')}">
    <p>${down?'<button class="btn" onclick="toggleSite(false)">Reopen the site</button>':'<button class="btn" onclick="toggleSite(true)">Shut the site down</button>'}</p></div>`;
  $('#view').innerHTML=`<div class="st">${head}${body}</div>`;
  if(DT==='over'){PULSE=15;runHealth();loadPulse();loadOnline();loadEconomy()}
}
function copySite(){const u=location.origin+location.pathname;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>say('Site link copied.'),()=>say(u))}
async function doBan(){
  const id=$('#b_id').value.replace(/\D/g,'');
  if(id.length<15)return say('Enter the numeric Discord user ID (right-click the user, Copy User ID)');
  if(id===S.user.id)return say('You cannot ban yourself');
  if(!confirm('Ban '+id+' from the site?'))return;
  try{let ids=[],name='';
    try{const d=await db.collection('devices').doc(id).get();if(d.exists){name=String(d.data().name||'');ids=(d.data().ids||[]).filter(v=>$('#b_fp').checked||!String(v).startsWith('f:')).slice(0,20)}}catch{}
    await staffWrite('u_'+id,b=>b.set(db.collection('bans').doc('u_'+id),{type:'user',user_id:id,name:name.slice(0,80),reason:$('#b_reason').value.trim().slice(0,200),by:S.user.id,by_name:S.user.name.slice(0,80),created:Date.now(),devices:ids}));
    say('Banned. '+ids.length+' known device(s) also banned.');mod()}catch(e){say(e.message||fe(e))}}
async function doUnban(id){if(!id||!confirm('Unban '+id+'?'))return;
  try{await staffWrite('u_'+id,b=>b.delete(db.collection('bans').doc('u_'+id)));say('Unbanned.');mod()}catch(e){say(e.message||fe(e))}}


// ===== bank / economy (Firestore: accounts + ledger) =====
const SB=n=>Number(n||0).toLocaleString()+' SB';
const FV=()=>firebase.firestore.FieldValue;
const newId=c=>db.collection(c).doc().id;
const INCOME=500,INCOME_MS=3*3600*1000;
const aid=v=>{v=String(v||'').trim();const m=v.match(/^c_?(\d{15,25})$/i);return m?'c_'+m[1]:v.replace(/\D/g,'')};
const aidOk=v=>/^(c_)?\d{15,25}$/.test(v);
const amt=v=>{const n=Number(String(v||'').replace(/[, ]/g,''));return Number.isInteger(n)&&n>0&&n<=1e9?n:0};
async function authed(){
  if(!firebase.auth)throw new Error('Bank is not set up: firebase-auth-compat.js is missing from index.html.');
  const a=firebase.auth();if(a.currentUser)return a.currentUser;
  try{await a.signInAnonymously()}catch(e){throw new Error(e&&['auth/operation-not-allowed','auth/admin-restricted-operation','auth/configuration-not-found'].includes(e.code)?'Bank is not set up: in Firebase Console open Authentication, press Get started, then Sign-in method > Anonymous > Enable.':(e.message||'Sign-in failed'))}
  return a.currentUser;
}
const bankErr=(e,type)=>e&&e.code==='permission-denied'?(type==='transfer'?'Transfer blocked. Check that you have enough in the bank and that the recipient has opened their own bank account.':type==='deposit'?'Blocked. Check that you have enough cash.':type==='withdraw'?'Blocked. Check that you have enough in the bank.':'Blocked by the database rules.'):(e&&e.message)||'Database error';
let BK='me';
async function ticketBadge(){
  try{await authed();const q=await db.collection('tickets').where('to','==',S.user.id).get();const n=q.docs.filter(d=>d.data().status==='unpaid').length;
    const b=document.querySelector('#nav [data-k=portal]');if(b)b.textContent='Portal'+(n?' ('+n+')':'')}catch{}
}
async function tickets(){
  if(!S.user)return needLogin();
  pv().innerHTML=LOADER(1);let rows=[];
  try{await authed();rows=(await db.collection('tickets').where('to','==',S.user.id).get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))}
  catch(e){pv().innerHTML=`<div class="card"><h2>Tickets</h2><p class="mu">${esc(e&&e.code==='permission-denied'?'Publish the newest Firestore rules to use tickets.':(e&&e.message)||'Could not load tickets.')}</p></div>`;return}
  const open=rows.filter(x=>x.status==='unpaid'),done=rows.filter(x=>x.status!=='unpaid');
  pv().innerHTML=`<div class="card"><h2>Tickets</h2><p class="mu">Tickets issued to you by staff. Unpaid tickets are paid from your personal bank balance.</p></div>
   <div class="card"><h3>Unpaid (${open.length})</h3>${open.length?`<table><tr><th>Reason</th><th>Amount</th><th>Issued by</th><th>When</th><th></th></tr>${open.map(x=>`<tr><td>${esc(x.reason)}</td><td>${esc(SB(x.amount))}</td><td>${esc(x.by_name||'Staff')}</td><td class="mu">${esc(new Date(x.created||0).toLocaleString())}</td><td style="text-align:right"><button class="btn" onclick="payTicket('${safeId(x.id)}')">Pay</button></td></tr>`).join('')}</table>`:'<p class="mu">You have no unpaid tickets.</p>'}</div>
   <div class="card"><h3>History</h3><table><tr><th>Reason</th><th>Amount</th><th>Status</th><th>When</th></tr>${done.map(x=>`<tr><td>${esc(x.reason)}</td><td>${esc(SB(x.amount))}</td><td>${x.status==='paid'?'Paid':'Cancelled'}</td><td class="mu">${esc(new Date(x.paidAt||x.created||0).toLocaleString())}</td></tr>`).join('')||'<tr><td class="mu" colspan="4">Nothing yet.</td></tr>'}</table></div>`;
}
async function payTicket(tid){
  if(!S.user||!tid)return;const id=S.user.id;
  try{await authed();
    const tr=db.collection('tickets').doc(tid),d=await tr.get();
    if(!d.exists||d.data().status!=='unpaid'||d.data().to!==id)return say('That ticket cannot be paid.');
    const t=d.data();if(!confirm('Pay '+SB(t.amount)+' from your bank for: '+t.reason+'?'))return;
    const L=newId('ledger'),now=Date.now(),b=db.batch();
    b.set(db.collection('ledger').doc(L),{type:'fine',from:id,to:'government',amount:t.amount,at:now,note:('Ticket: '+t.reason).slice(0,100),ticket:tid});
    b.update(db.collection('accounts').doc(id),{bank:FV().increment(-t.amount),lastTx:L,updated:now});
    b.update(tr,{status:'paid',paidAt:now,payLedger:L});
    await b.commit();say('Ticket paid.');tickets();ticketBadge()}
  catch(e){say(e&&e.code==='permission-denied'?'Payment blocked. You need enough money in your bank (not cash) and an open bank account. Deposit first if needed.':(e.message||fe(e)))}
}
async function issueTicket(){
  const to=($('#tk_id').value||'').replace(/\D/g,''),a=amt($('#tk_amt').value),reason=($('#tk_reason').value||'').trim().slice(0,200);
  if(to.length<15||to.length>25)return say('Enter the Discord user ID');if(!a||a>1000000)return say('Enter an amount from 1 to 1,000,000');if(!reason)return say('Enter the reason');
  if(!confirm('Issue a ticket of '+SB(a)+' to '+to+'?'))return;
  const tid=newId('tickets');
  try{await staffWrite('t_'+tid,b=>b.set(db.collection('tickets').doc(tid),{to,by:S.user.id,by_name:S.user.name.slice(0,80),reason,amount:a,created:Date.now(),status:'unpaid'}));say('Ticket issued.');mod()}
  catch(e){say(e.message||fe(e))}
}
async function addAdmin(){
  const id=($('#ad_id').value||'').replace(/\D/g,''),name=($('#ad_name').value||'').trim().slice(0,80);
  if(id.length<15||id.length>25)return say('Enter the Discord user ID');
  if(!confirm('Give admin access to '+id+'?'))return;
  try{await staffWrite('a_'+id,b=>b.set(db.collection('admins').doc(id),{name,by:S.user.id,by_name:S.user.name.slice(0,80),created:Date.now()}));say('Admin added. They see the Staff tab the next time they load the site.');mod()}
  catch(e){say(e.message||fe(e))}
}
async function removeAdmin(id){if(!id||!confirm('Remove admin access from '+id+'?'))return;
  try{await staffWrite('a_'+id,b=>b.delete(db.collection('admins').doc(id)));say('Admin removed.');mod()}catch(e){say(e.message||fe(e))}}
async function voidTicket(tid){if(!tid||!confirm('Cancel this ticket?'))return;
  try{await staffWrite('tv_'+tid,b=>b.update(db.collection('tickets').doc(tid),{status:'void'}));say('Ticket cancelled.');mod()}catch(e){say(e.message||fe(e))}}
async function bank(){
  clearInterval(window.__incT);
  if(!S.user){pv().innerHTML=`<div class="card"><h2>Bank</h2><p class="mu">Log in with Discord to use the bank.</p><a class="btn" href="${loginUrl()}">Log in with Discord</a></div>`;return}
  pv().innerHTML=LOADER(1);
  const pid=S.user.id,cid='c_'+pid;let acct=null,comp=null,coLocked=false,state='ok';
  try{await authed();const d=await db.collection('accounts').doc(pid).get();
    if(!d.exists)state='new';else{acct=d.data();if(acct.owner==='')state='claim'}
  }catch(e){if(e&&e.code==='permission-denied')state='locked';else{state='err';say(e.message||fe(e))}}
  if(state!=='ok'){
    const m={new:['Open your bank account','You do not have a bank account yet. It starts at 0 SB.','Open account','openAcct()'],
      claim:['Claim your bank account','An account is waiting for you (staff created or reset it). Claim it on this browser to use it.','Claim account','openAcct(true)'],
      locked:['Account locked to another browser','This bank account is linked to a different browser or device. If that was you (for example you cleared your browser data), ask staff to reset it, then come back and claim it.','',''],
      err:['Bank unavailable','Something went wrong. Reload the page and try again.','','']}[state];
    pv().innerHTML=`<div class="card"><h2>${m[0]}</h2><p class="mu">${esc(m[1])}</p>${m[2]?`<button class="btn" onclick="${m[3]}">${m[2]}</button>`:''}</div>`;return}
  try{const d=await db.collection('accounts').doc(cid).get();if(d.exists)comp=d.data()}catch(e){if(e&&e.code==='permission-denied')coLocked=true}
  if(comp&&comp.owner==='')coLocked=true;
  if(BK==='co'&&(!comp||coLocked))BK='me';
  const id=BK==='co'?cid:pid,cur=BK==='co'?comp:acct;
  let hist=[];try{const [x,y]=await Promise.all([db.collection('ledger').where('from','==',id).limit(25).get(),db.collection('ledger').where('to','==',id).limit(25).get()]);const m={};[...x.docs,...y.docs].forEach(d=>m[d.id]=d.data());hist=Object.values(m).sort((p,q)=>(q.at||0)-(p.at||0)).slice(0,20)}catch{}
  const line=t=>{const n=SB(t.amount);
    if(t.type==='income')return['Income',n,'+'];if(t.type==='fine')return['Ticket paid',n,'-'];
    if(t.type==='deposit')return['Deposit',n,'+'];if(t.type==='withdraw')return['Withdrawal',n,'-'];
    if(t.type==='grant')return['Received from staff',n,'+'];if(t.type==='take')return['Removed by staff',n,'-'];
    return t.from===id?['Sent to '+t.to,n,'-']:['Received from '+t.from,n,'+']};
  const li=cur.lastIncome&&cur.lastIncome.toMillis?cur.lastIncome.toMillis():0,nextAt=li+INCOME_MS;
  const incomeCard=BK==='me'?`<div class="card"><h3>Income</h3><p class="mu">Collect ${SB(INCOME)} in cash once every 3 hours.</p><p><button class="btn" id="inc_b" onclick="collectIncome()">Collect ${SB(INCOME)}</button> <span class="mu" id="inc_t"></span></p></div>`:'';
  const switcher=`<p style="margin:14px 0 0"><button class="btn${BK==='me'?'':' s'}" onclick="BK='me';bank()">Personal</button> ${comp&&!coLocked?`<button class="btn${BK==='co'?'':' s'}" onclick="BK='co';bank()">Company: ${esc(String(comp.name||'').slice(0,40))}</button>`:''}</p>`;
  const newco=!comp?`<div class="card"><h3>Company account</h3><p class="mu">You can open <b>one</b> extra account for a company or business. It has its own cash and bank balance and its own ID, so people can pay your company. This cannot be undone, and the name cannot be changed later.</p>
      <label>Company name *</label><input id="co_name" maxlength="40" placeholder="e.g. Stilton Motors"><p><button class="btn" onclick="makeCompany()">Create company account</button></p></div>`
    :coLocked?`<div class="card"><h3>Company account</h3><p class="mu">Your company account is linked to a different browser or was reset. Ask staff to unlink it (ID ${esc(cid)}), then claim it here.</p><button class="btn s" onclick="claimCompany()">Claim company account</button></div>`:'';
  pv().innerHTML=`<div class="card"><h2>${BK==='co'?esc(String(cur.name||'Company')):'Bank'}</h2><p class="mu">StiltonBux (SB) &bull; ${BK==='co'?'Company account of '+esc(S.user.name):esc(S.user.name)}<br>Account ID to give others: <b>${esc(id)}</b></p>${switcher}
    <div class="cgrid" style="margin:14px 0 0"><div class="card"><div class="mu">Cash</div><h3>${SB(cur.cash)}</h3></div><div class="card"><div class="mu">Bank</div><h3>${SB(cur.bank)}</h3></div><div class="card"><div class="mu">Total</div><h3>${SB((cur.cash||0)+(cur.bank||0))}</h3></div></div></div>
   <div class="cgrid">
    <div class="card"><h3>Deposit</h3><p class="mu">Move cash into the bank.</p><input id="k_dep" inputmode="numeric" placeholder="Amount"><p><button class="btn" onclick="bankOp('deposit')">Deposit</button></p></div>
    <div class="card"><h3>Withdraw</h3><p class="mu">Take money out of the bank as cash.</p><input id="k_wd" inputmode="numeric" placeholder="Amount"><p><button class="btn" onclick="bankOp('withdraw')">Withdraw</button></p></div>
    <div class="card"><h3>Transfer</h3><p class="mu">Send money from this account's bank to another account (a person's Discord ID, or a company ID starting with c_). They must have opened their account.</p>
      <input id="k_to" placeholder="Their account ID"><input id="k_amt" inputmode="numeric" placeholder="Amount" style="margin-top:8px"><input id="k_note" maxlength="100" placeholder="Note (optional)" style="margin-top:8px"><p><button class="btn" onclick="bankOp('transfer')">Send</button></p></div></div>
   ${incomeCard}
   ${newco}
   <div class="card"><h3>Recent activity</h3><table><tr><th>What</th><th>Amount</th><th>Note</th><th>When</th></tr>${hist.map(t=>{const l=line(t);return `<tr><td>${esc(l[0])}</td><td>${l[2]}${esc(l[1])}</td><td>${esc(t.note||'')}</td><td class="mu">${esc(new Date(t.at||0).toLocaleString())}</td></tr>`}).join('')||'<tr><td class="mu" colspan="4">No activity yet.</td></tr>'}</table></div>`;
  if(BK==='me'){const tick=()=>{const b=$('#inc_b'),t=$('#inc_t');if(!b||!t){clearInterval(window.__incT);return}
      const left=nextAt-Date.now();if(left<=0){b.disabled=false;b.style.opacity='';t.textContent='Ready'}
      else{b.disabled=true;b.style.opacity='.55';const m=Math.ceil(left/60000);t.textContent='Next payout in '+Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'}};
    tick();window.__incT=setInterval(tick,30000)}
}
async function collectIncome(){
  if(!S.user||BK!=='me')return;
  const id=S.user.id,L=newId('ledger'),now=Date.now(),b=db.batch();
  b.set(db.collection('ledger').doc(L),{type:'income',from:'system',to:id,amount:INCOME,at:now,note:'Income'});
  b.update(db.collection('accounts').doc(id),{cash:FV().increment(INCOME),lastIncome:FV().serverTimestamp(),lastTx:L,updated:now});
  try{await authed();await b.commit();say('Collected '+SB(INCOME)+' in cash.');bank()}
  catch(e){say(e&&e.code==='permission-denied'?'Income is not ready yet. Try again when the timer reaches zero.':(e.message||fe(e)))}
}
async function openAcct(claim){
  try{const u=await authed(),ref=db.collection('accounts').doc(S.user.id),now=Date.now();
    if(claim)await ref.update({owner:u.uid,updated:now});
    else await ref.set({owner:u.uid,name:S.user.name.slice(0,80),cash:0,bank:0,lastTx:'',updated:now});
    bank()}catch(e){say(e&&e.code==='permission-denied'?'That account is already linked to another browser. Ask staff to reset it.':(e.message||fe(e)))}
}
async function makeCompany(){
  const name=(($('#co_name')&&$('#co_name').value)||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>40)return say('Give the company a name of 2 to 40 characters');
  if(!confirm('Create the company account "'+name+'"? You only get one and the name cannot be changed.'))return;
  try{const u=await authed();
    await db.collection('accounts').doc('c_'+S.user.id).set({owner:u.uid,ownerId:S.user.id,type:'company',name,cash:0,bank:0,lastTx:'',updated:Date.now()});
    BK='co';say('Company account created.');bank()}
  catch(e){say(e&&e.code==='permission-denied'?'Blocked. You may already have a company account, or it is linked to another browser.':(e.message||fe(e)))}
}
async function claimCompany(){
  try{const u=await authed();await db.collection('accounts').doc('c_'+S.user.id).update({owner:u.uid,updated:Date.now()});BK='co';bank()}
  catch(e){say(e&&e.code==='permission-denied'?'Ask staff to unlink the company account first.':(e.message||fe(e)))}
}
async function bankOp(type){
  if(!S.user)return;const id=BK==='co'?'c_'+S.user.id:S.user.id;let to=id,note='';
  const a=amt($(type==='deposit'?'#k_dep':type==='withdraw'?'#k_wd':'#k_amt').value);
  if(!a)return say('Enter a whole number above 0 (up to 1,000,000,000)');
  if(type==='transfer'){to=aid($('#k_to').value);
    if(!aidOk(to))return say("Enter the recipient's account ID (a Discord ID, or c_ID for a company)");
    if(to===id)return say('You cannot send money to yourself');
    note=$('#k_note').value.trim().slice(0,100)}
  const L=newId('ledger'),b=db.batch(),inc=FV().increment,now=Date.now(),me=db.collection('accounts').doc(id);
  b.set(db.collection('ledger').doc(L),{type,from:id,to,amount:a,at:now,note});
  if(type==='deposit')b.update(me,{cash:inc(-a),bank:inc(a),lastTx:L,updated:now});
  else if(type==='withdraw')b.update(me,{bank:inc(-a),cash:inc(a),lastTx:L,updated:now});
  else{b.update(me,{bank:inc(-a),lastTx:L,updated:now});b.update(db.collection('accounts').doc(to),{bank:inc(a),lastTx:L,updated:now})}
  try{await authed();await b.commit();say(type==='transfer'?'Sent '+SB(a)+'.':type==='deposit'?'Deposited '+SB(a)+'.':'Withdrew '+SB(a)+'.');bank()}catch(e){say(bankErr(e,type))}
}
// staff: give or remove cash, or unlink an account from its browser (all need the staff PIN)
async function bankGrant(kind){
  const to=aid($('#g_id').value),a=amt($('#g_amt').value);
  if(!aidOk(to))return say('Enter the Discord user ID (or c_ID for a company)');if(!a)return say('Enter a whole number above 0');
  if(!confirm((kind==='grant'?'Give ':'Remove ')+SB(a)+(kind==='grant'?' to ':' from ')+to+'?'))return;
  const inc=FV().increment,note=$('#g_note').value.trim().slice(0,100),by=S.user.name.slice(0,80);
  // create=true: the person has no bank account yet, so staff create one (unclaimed) that already holds the cash
  const run=(create)=>{const L=newId('ledger'),now=Date.now();
    return staffWrite('g_'+L,b=>{b.set(db.collection('ledger').doc(L),{type:kind,from:'staff',to,amount:a,at:now,note,by});
      const acc=db.collection('accounts').doc(to);
      if(create)b.set(acc,{owner:'',name:'',cash:a,bank:0,lastTx:L,updated:now});
      else b.update(acc,{cash:inc(kind==='grant'?a:-a),lastTx:L,updated:now})})};
  try{await authed();
    try{await run(false);say('Done. '+(kind==='grant'?'Gave ':'Removed ')+SB(a)+'.')}
    catch(e1){
      if(kind==='grant'&&!to.startsWith('c_')&&/rules blocked/.test(e1.message||'')){
        try{await run(true);say('Done. Gave '+SB(a)+'. This person had no bank account yet, so one was created for them. They claim it from the Bank tab.');return}catch(e2){}
      }
      throw e1}
  }catch(e){say((e.message||fe(e))+(/rules blocked/.test(e.message||'')?' Both an update and a new-account attempt were blocked, so this is the rules, not a missing account. Check that the newest rules are published, and that removing cash would not take them below 0.':''))}
}
async function bankReset(){
  const id=aid($('#g_id').value);if(!aidOk(id))return say('Enter the Discord user ID (or c_ID for a company)');
  if(!confirm('Unlink the bank account of '+id+' from its browser? They can claim it again.'))return;
  try{await authed();await staffWrite('r_'+id,b=>b.update(db.collection('accounts').doc(id),{owner:'',updated:Date.now()}));say('Account unlinked. The owner can claim it again.')}catch(e){say(e.message||fe(e))}
}

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
    <p>${mode=='pub'?(u?`<a class="btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Join this server</a>`:'<span class="mu">No invite link yet</span>')+(S.staff?` <button class="btn s" onclick="delChain('${safeId(x.id)}')">Remove</button>`:''):''}
    ${mode=='staff'?`<button class="btn" onclick="review('${safeId(x.id)}','accepted')">Accept</button> <button class="btn s" onclick="review('${safeId(x.id)}','denied')">Deny</button>${x.review=='denied'?` <button class="btn s" onclick="delChain('${safeId(x.id)}')">Delete</button>`:''}`:''}
    ${mode=='mine'?`<button class="btn" disabled style="opacity:.6;cursor:not-allowed">${x.review=='denied'?'Denied':'Awaiting approval'}</button>`:''}</p></div>`};
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
    if(S.staff){await staffWrite('c_'+ref.id,b=>b.update(ref,{review:'accepted',reviewed_by:S.user.id}));say('Chain server added.')}
    else say('Submitted! Staff will review it soon.');
    chains()}catch(e){say(fe(e))}}
async function review(id,r){if(!S.staff||!id)return;
  try{await staffWrite('c_'+id,b=>b.update(db.collection('chains').doc(id),{review:r,reviewed_by:S.user.id}));say(r=='accepted'?'Accepted. It is now listed.':'Denied.');chains()}catch(e){say(e.message||fe(e))}}
async function delChain(id){if(!S.staff||!id||!confirm('Remove this chain server?'))return;
  try{await staffWrite('c_'+id,b=>b.delete(db.collection('chains').doc(id)));chains()}catch(e){say(e.message||fe(e))}}

// Save progress when leaving the page (and every 15s)
function save(){if(!S.user)return;draft.tab=tab;
  try{localStorage.setItem('rp_draft_'+S.user.id,JSON.stringify(draft))}catch{}}
addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>document.hidden&&save());setInterval(save,15000);
// ===== animation: cards rise in as they appear / scroll into view =====
(function(){
  const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.08}):null;
  const reveal=()=>{document.querySelectorAll('#view .card:not(.rv),#view .cgrid .card:not(.rv)').forEach(c=>{c.classList.add('rv');io?io.observe(c):c.classList.add('in')})};
  new MutationObserver(reveal).observe(document.getElementById('view'),{childList:true});
})();

// ===== first-visit tutorial: civilians only, offered once, completely optional =====
// Police, EMS, other emergency responders and staff never get the tutorial. Logged-out visitors can start it from the Home screen.
const isCivilian=()=>!!S.user&&!S.staff&&!S.ers;
(function(){
  const st=document.createElement('style');
  st.textContent=`
  .ov{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(3,8,20,.82);animation:ovIn .3s ease both}
  .ov .card{max-width:540px;width:100%;margin:0;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:ovUp .35s ease both}
  .ov ul{margin:10px 0 16px;padding-left:20px}.ov li{margin:6px 0}
  .ov .oacts{display:flex;gap:10px;flex-wrap:wrap}
  .th{position:fixed;z-index:1001;border-radius:10px;pointer-events:none;box-shadow:0 0 0 9999px rgba(3,8,20,.8),0 0 0 2px var(--blue),0 0 24px rgba(47,91,209,.7);transition:all .3s ease}
  .tt{position:fixed;z-index:1002;width:min(360px,calc(100vw - 24px));background:var(--panel);border:1px solid var(--bd);border-top:3px solid var(--red);border-radius:12px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.6);animation:ovUp .3s ease both}
  .tt h3{margin:0 0 6px}.tt p{margin:0 0 12px;line-height:1.5}.tt .tacts{display:flex;gap:8px;align-items:center}.tt .tacts .sp{flex:1}.tt .cnt{color:var(--mu);font-size:.8rem}
  .tt .ch{color:var(--mu);font-size:.68rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px}
  .tt .tbar{height:3px;background:var(--bd);border-radius:3px;margin:0 0 12px;overflow:hidden}.tt .tbar i{display:block;height:100%;background:var(--red);transition:width .3s}
  .tclick{position:fixed;inset:0;z-index:1000}
  @keyframes ovIn{from{opacity:0}to{opacity:1}}@keyframes ovUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.ov,.ov .card,.tt{animation:none}.th{transition:none}}`;
  document.head.appendChild(st);

  window.tutSeen=()=>{try{return !!localStorage.getItem(S.user?'ros_tut_'+S.user.id:'ros_seen')}catch{return true}};
  const mark=()=>{try{localStorage.setItem('ros_seen','1');if(S.user)localStorage.setItem('ros_tut_'+S.user.id,'1')}catch{}};

  let ov=null,hl=null,tip=null,steps=[],i=0,onKey=null,onRs=null,busy=false,run=0,curEl=null;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(fn,ms){const t0=Date.now();while(Date.now()-t0<ms){try{const r=fn();if(r)return r}catch{}await sleep(80)}return null}
  const clean=()=>{[ov,hl,tip].forEach(e=>e&&e.remove());ov=hl=tip=null;curEl=null;if(onKey)removeEventListener('keydown',onKey);if(onRs)removeEventListener('resize',onRs);onKey=onRs=null;run++};

  // ---- the one-time offer (logged-in civilians only). Any answer, yes or no, means they are never asked again. ----
  window.startIntro=function(){
    if(!isCivilian())return;
    mark();   // asked once, ever: recorded as soon as the offer is shown, whatever they answer
    clean();ov=document.createElement('div');ov.className='ov';
    ov.innerHTML=`<div class="card" role="dialog" aria-modal="true" aria-label="Welcome"><div class="kick">|+-+| Republic Of Stilton |+-+|</div><h2>Welcome to the Republic of Stilton</h2>
      <p class="mu">Looks like it's your first time here. Would you like a quick tutorial (about 2 minutes)? It is completely optional, and you will not be asked again. It covers:</p>
      <ul><li>Your <b>Portal</b>: bank, driver license and vehicle registration</li><li>Chain servers and the rules</li></ul>
      <div class="oacts"><button class="btn" id="i_go">Yes, show me</button><button class="btn s" id="i_skip">No thanks</button></div></div>`;
    document.body.appendChild(ov);
    const done=()=>{mark();clean()};
    ov.querySelector('#i_go').onclick=()=>{clean();startTour()};
    ov.querySelector('#i_skip').onclick=done;
    ov.addEventListener('click',e=>{if(e.target===ov)done()});
    onKey=e=>{if(e.key==='Escape')done()};addEventListener('keydown',onKey);
    ov.querySelector('#i_go').focus();
  };

  const PT='#view .pt .panel';
  function build(){
    const s=[];
    s.push({ch:'Welcome',t:'Welcome to the Republic of Stilton!',d:'This tutorial walks you through the site and what each part does. Press Next to continue, or the × to leave at any time.',pre:()=>go('home')});
    if(!S.user)s.push({ch:'The basics',sel:'#nav [data-k=home]',t:'Home',d:'Start here. It explains what the Republic of Stilton is: roleplay, government, the economy and how chain servers fit in.',pre:()=>go('home')});
    s.push({ch:'The basics',sel:'#nav [data-k=chains]',t:'Chain Servers',d:'Every city in the Republic. Open cities show a Join button. If you run your own city, you can apply to list it here and staff will review it.',pre:()=>go('chains')});
    s.push({ch:'The basics',sel:'#nav [data-k=terms]',t:'Terms of Service',d:'The rules for everyone in the community. Worth a read before you jump in.',pre:()=>go('terms')});
    if(!S.user){
      s.push({ch:'Your account',sel:'#who',t:'Log in with Discord',d:'Log in to unlock your Portal: your bank, driver license and vehicle registration. You need to be a member of our Discord server.',pre:()=>go('home')});
    }else{
      s.push({ch:'Your Portal',sel:'#nav [data-k=portal]',t:'Portal',d:'Your citizen hub. Everything about your character lives here: money, driver license and vehicles.',pre:()=>go('portal')});
      s.push({ch:'Your Portal',sel:'#view .pt .st-tabs',t:'Portal sections',d:'These tabs move between sections. A number or ! next to a tab means something needs you, like an unpaid ticket. A Tickets tab appears whenever you have a ticket from staff or police.',pre:()=>ptTab('over')});
      s.push({ch:'Your Portal',sel:'#view .pt .kpis',t:'Overview',d:'Your license status, bank total, registered vehicles and unpaid tickets at a glance. Click any box to jump to that section.',pre:()=>ptTab('over')});
      s.push({ch:'Your Portal',sel:'#pbody .card',t:'Bank',d:'StiltonBux (SB) is the money of the Republic. Open your account first, then deposit cash, withdraw, send money to other people by account ID and collect free income every 3 hours. You can also open one company account for a business.',pre:()=>ptTab('bank')});
      s.push({ch:'Your Portal',sel:PT,t:'Driver license',d:'Your license is Active by default, which means you can drive. If staff turn it off, it shows Inactive here and you must not drive until it is turned back on.',pre:()=>ptTab('lic')});
      s.push({ch:'Your Portal',sel:PT,t:'Vehicle registration',d:'Register your cars, SUVs, trucks, vans and buses here. Staff review every new registration, and you will see Pending, Approved or Denied (with a reason). Motorcycles are not allowed.',pre:()=>ptTab('veh')});
    }
    s.push({ch:'Done',t:'You\'re all set!',d:S.user?'That is everything. If you ever want to see this again, use the "Replay the tutorial" link at the bottom of the page.':'That is everything. Log in with Discord to get started.'});
    return s;
  }

  function place(){
    if(!tip||!hl)return;
    const el=curEl,w=tip.offsetWidth,h=tip.offsetHeight;
    if(!el||!document.contains(el)){
      Object.assign(hl.style,{left:'50%',top:'50%',width:'0px',height:'0px'});
      Object.assign(tip.style,{top:Math.max(8,(innerHeight-h)/2)+'px',left:Math.max(12,(innerWidth-w)/2)+'px'});return}
    const r=el.getBoundingClientRect(),p=6;
    Object.assign(hl.style,{left:r.left-p+'px',top:r.top-p+'px',width:r.width+2*p+'px',height:r.height+2*p+'px'});
    let top=r.bottom+p+12;
    if(r.height>innerHeight*.55)top=innerHeight-h-12;
    else if(top+h>innerHeight-8){top=r.top-p-12-h;if(top<8)top=innerHeight-h-12}
    const left=Math.min(Math.max(12,r.left),innerWidth-w-12);
    Object.assign(tip.style,{top:Math.max(8,top)+'px',left:left+'px'});
  }
  function draw(s,el){
    curEl=el;
    tip.innerHTML=`<div class="ch">${esc(s.ch||'')}</div><div class="tbar"><i style="width:${Math.round((i+1)/steps.length*100)}%"></i></div><h3>${esc(s.t)}</h3><p class="mu">${esc(s.d)}</p><div class="tacts"><span class="cnt">${i+1} / ${steps.length}</span><span class="sp"></span>${i?'<button class="btn s" id="t_b">Back</button>':''}<button class="btn" id="t_n">${i==steps.length-1?'Finish':'Next'}</button><button class="btn s" id="t_x" aria-label="Close tutorial">&times;</button></div>`;
    tip.querySelector('#t_n').onclick=()=>{if(busy)return;i==steps.length-1?end():(i++,show())};
    const b=tip.querySelector('#t_b');if(b)b.onclick=()=>{if(busy)return;i--;show()};
    tip.querySelector('#t_x').onclick=()=>end();
    if(el)el.scrollIntoView({block:'center',inline:'nearest'});
    place();setTimeout(place,120);
  }
  async function show(){
    const my=++run;busy=true;
    const s=steps[i],v=document.getElementById('view'),mk=v.firstElementChild;
    if(s.pre){try{await s.pre()}catch{}await waitFor(()=>v.firstElementChild!==mk,2500)}
    const el=s.sel?await waitFor(()=>document.querySelector(s.sel),3500):null;
    if(my!==run||!tip)return;
    busy=false;draw(s,el);
  }
  function end(){mark();clean();go('home');scrollTo(0,0)}
  window.startTour=function(){
    if(BANNED||DOWN||(S.user&&!isCivilian()))return;
    clean();mark();steps=build();i=0;
    ov=document.createElement('div');ov.className='tclick';document.body.appendChild(ov);
    hl=document.createElement('div');hl.className='th';document.body.appendChild(hl);
    tip=document.createElement('div');tip.className='tt';tip.setAttribute('role','dialog');document.body.appendChild(tip);
    onKey=e=>{if(e.key==='Escape')end();else if(!busy&&e.key==='ArrowRight'&&i<steps.length-1){i++;show()}else if(!busy&&e.key==='ArrowLeft'&&i>0){i--;show()}};addEventListener('keydown',onKey);
    onRs=()=>place();addEventListener('resize',onRs);
    show();
  };
})();

// =====================================================================
// CITIZEN PORTAL: bank, license, vehicle registration and tickets in one place
// =====================================================================
(function(){
  const st=document.createElement('style');
  st.textContent=`
  .pt .st-head{border-bottom-color:#2d4f94}
  .pt .panel,.pt .kpis,.pt .card{background:#16305f;border-color:#2d4f94}
  .pt .kpi{border-color:#2d4f94}
  .pt .kpi.click:hover{background:#1b3a73}
  .pt .tbl th,.pt table th{border-bottom-color:#2d4f94}
  .pt .tbl td,.pt table td{border-bottom-color:#243f7a}
  .pt input,.pt select,.pt textarea{background:#0f2347;border-color:#2d4f94}
  .pt .acts button{background:#1a3769;border-color:#2d4f94}
  .pt .acts button:hover{background:#21458a;border-color:#4a72c8}
  .pt .st-tabs button.on{color:#fff}
  .pt .alert{border-left:4px solid var(--red)}
  .pt .okbar{border-left:4px solid #22c55e}
  .pt .big.good{color:#7ee2a1}.pt .big.badc{color:#ff8a8a}
  .pt .st-r .st-stat{white-space:nowrap}`;
  document.head.appendChild(st);
})();

let PT_TAB='over',PCARS=[];
const VTYPES=['Car','SUV','Truck','Van','Bus','Commercial'];            // motorcycles are deliberately NOT here
const MOTO=/motor\s*cycle|motor\s*bike|dirt\s*bike|\bbike\b|scooter|moped|chopper|harley|ducati|vespa|\bquad\b|\batv\b/i;
const normPlate=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const pv=()=>$('#pbody')||$('#view');                                   // bank() and tickets() draw into this
const ptTab=k=>{PT_TAB=k;portal()};
const vst=c=>c.status||'accepted';   // vehicles registered before approvals existed count as approved
const vtag=c=>{const x=vst(c);return `<span class="tag ${x==='accepted'?'g':x==='denied'?'r':'a'}">${x==='accepted'?'Approved':x==='denied'?'Denied':'Pending'}</span>`+(x==='denied'&&c.reason?`<div class="mu" style="font-size:.8em;margin-top:.3em">${esc(c.reason)}</div>`:'')};

async function portal(){
  if(!S.user)return needLogin();
  clearInterval(window.__incT);
  const id=S.user.id;
  $('#view').innerHTML=`<div class="st pt">${LOADER(1)}</div>`;
  try{await authed()}catch(e){say(e.message||fe(e));return}
  let perm=false;
  const sf=p=>Promise.resolve(p).catch(e=>{if(e&&e.code==='permission-denied')perm=true;return null});
  const [l,v,t,a]=await Promise.all([
    sf(db.collection('licenses').doc(id).get()),
    sf(db.collection('vehicles').where('ownerId','==',id).get()),
    sf(db.collection('tickets').where('to','==',id).get()),
    db.collection('accounts').doc(id).get().catch(()=>null)]);
  const lic=l&&l.exists?l.data():null,on=!lic||lic.status!=='inactive';   // active unless staff turn it off
  PCARS=v?v.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>(y.created||0)-(x.created||0)):[];
  const tix=t?t.docs.map(d=>d.data()):[],open=tix.filter(x=>x.status==='unpaid');
  const acct=a&&a.exists?a.data():null,hasAcct=!!acct&&acct.owner!=='';
  const total=acct?(acct.cash||0)+(acct.bank||0):0;
  const tabs=[['over','Overview'],['bank','Bank'],['lic','License'],['veh','Vehicles',PCARS.length||'']];
  if(tix.length)tabs.push(['tix','Tickets',open.length||'']);
  if(!tabs.some(x=>x[0]===PT_TAB))PT_TAB='over';
  const head=`<div class="st-head"><div class="st-title"><h2>Citizen Portal</h2><span>${esc(S.user.name)}</span></div>
    <div class="st-tabs">${tabs.map(([k,lb,n])=>`<button class="${PT_TAB===k?'on':''}" onclick="ptTab('${k}')">${lb}${n?`<b>${n}</b>`:''}</button>`).join('')}</div>
    <div class="st-r"><span class="st-stat ${on?'':'bad'}">License ${on?'active':'inactive'}</span></div></div>`;
  const warn=perm?`<div class="panel alert"><h3>Portal data unavailable</h3><p class="sub" style="margin:0">Some information could not be loaded. Staff need to publish the newest database rules.</p></div>`:'';
  let body='';

  if(PT_TAB==='over'){
    body=warn+`<div class="kpis">
      <div class="kpi click" onclick="ptTab('lic')"><div class="lbl">Driver license</div><div class="big ${on?'good':'badc'}">${on?'Active':'Inactive'}</div><div class="mu">${on?'You can drive':'You cannot drive'}</div></div>
      <div class="kpi click" onclick="ptTab('bank')"><div class="lbl">Bank total</div><div class="big">${hasAcct||acct?esc(SB(total)):'—'}</div><div class="mu">${acct?'cash + bank':'no account yet'}</div></div>
      <div class="kpi click" onclick="ptTab('veh')"><div class="lbl">Vehicles</div><div class="big">${PCARS.length}</div><div class="mu">${PCARS.filter(c=>vst(c)==='pending').length?PCARS.filter(c=>vst(c)==='pending').length+' awaiting review':'registered to you'}</div></div>
      <div class="kpi ${tix.length?'click':''}" ${tix.length?`onclick="ptTab('tix')"`:''}><div class="lbl">Unpaid tickets</div><div class="big ${open.length?'badc':''}">${open.length}</div><div class="mu">${open.length?esc(SB(open.reduce((s,x)=>s+(Number(x.amount)||0),0)))+' owed':'all clear'}</div></div></div>
      ${open.length?`<div class="panel alert"><h3>You have ${open.length} unpaid ticket${open.length>1?'s':''}</h3><p class="sub">Pay them from your bank balance.</p><button class="btn" onclick="ptTab('tix')">View tickets</button></div>`:''}
      ${!on?`<div class="panel alert"><h3>Your license is inactive</h3><p class="sub" style="margin:0">You should not drive until staff activate your license.</p></div>`:''}
      <div class="cols"><div class="panel"><h3>Your vehicles</h3><p class="sub">Registered to your account.</p>
        <table class="tbl"><tr><th>Plate</th><th>Type</th><th>Vehicle</th><th>Status</th></tr>${PCARS.slice(0,5).map(c=>`<tr><td><b>${esc(c.plate)}</b></td><td>${esc(c.type)}</td><td>${esc(c.make)} ${esc(c.model)}</td><td>${vtag(c)}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">No vehicles registered yet.</td></tr>'}</table></div>
       <div class="panel"><h3>Quick actions</h3><p class="sub">Jump to a section.</p><div class="acts">
        <button onclick="ptTab('bank')">Open the bank</button>
        <button onclick="ptTab('veh')">Register a vehicle</button>
        <button onclick="ptTab('lic')">Check my license</button>
        ${tix.length?`<button onclick="ptTab('tix')">My tickets</button>`:''}</div></div></div>`;
  }
  else if(PT_TAB==='lic'){
    body=warn+`<div class="panel ${on?'okbar':'alert'}"><div class="lbl" style="color:var(--mu);font-size:.74em;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Driver license</div>
      <div class="score" style="color:${on?'#7ee2a1':'#ff8a8a'};margin:.3em 0">${on?'ACTIVE':'INACTIVE'}</div>
      <p style="margin:.2em 0 .8em">${on?'Your license is valid. You are allowed to drive in the Republic of Stilton.':'Staff have turned your license off, so you are not allowed to drive.'}</p>
      <p class="mu" style="margin:0">${lic&&lic.updated?'Last updated '+esc(new Date(lic.updated).toLocaleString())+(lic.by_name?' by '+esc(lic.by_name):''):'Your license is active by default. Staff can turn it off.'}${lic&&lic.note?'<br>Note: '+esc(lic.note):''}</p></div>
      <div class="panel"><h3>How it works</h3><p class="sub" style="margin:0">Licenses are issued and managed by staff. If your license is inactive and you think that is a mistake, contact the staff team on Discord.</p></div>`;
  }
  else if(PT_TAB==='veh'){
    body=warn+`<div class="panel"><h3>Register a vehicle</h3><p class="sub">Cars, SUVs, trucks, vans, buses and commercial vehicles. <b>Motorcycles are not allowed</b> and will be removed. New registrations are reviewed by staff before they are approved.</p>
      ${hasAcct?'':'<p class="mu">Open your bank account in the Bank section first. Registration uses it to confirm who you are.</p>'}
      <div class="row"><div><label>License plate *</label><input id="v_plate" maxlength="10" placeholder="e.g. ROS1234"></div><div><label>Type *</label><select id="v_type">${VTYPES.map(x=>`<option>${x}</option>`).join('')}</select></div></div>
      <div class="row"><div><label>Make *</label><input id="v_make" maxlength="30" placeholder="e.g. Ford"></div><div><label>Model *</label><input id="v_model" maxlength="30" placeholder="e.g. Mustang"></div></div>
      <label>Color</label><input id="v_color" maxlength="20" placeholder="e.g. Black">
      <p><button class="btn" onclick="regVehicle()">Register vehicle</button></p></div>
      <div class="panel"><h3>Your vehicles (${PCARS.length})</h3><p class="sub">You can register up to 5.</p>
      <table class="tbl"><tr><th>Plate</th><th>Type</th><th>Vehicle</th><th>Color</th><th>Status</th><th></th></tr>${PCARS.map(c=>`<tr><td><b>${esc(c.plate)}</b></td><td>${esc(c.type)}</td><td>${esc(c.make)} ${esc(c.model)}</td><td>${esc(c.color||'')}</td><td>${vtag(c)}</td><td style="text-align:right"><button class="btn s" onclick="delVehicle('${safeId(c.id)}')">Remove</button></td></tr>`).join('')||'<tr><td colspan="6" class="mu">No vehicles registered yet.</td></tr>'}</table></div>`;
  }
  if(PT_TAB==='bank'||PT_TAB==='tix'){
    $('#view').innerHTML=`<div class="st pt">${head}${warn}<div id="pbody"></div></div>`;
    PT_TAB==='bank'?bank():tickets();
  }else $('#view').innerHTML=`<div class="st pt">${head}${body}</div>`;
}

async function regVehicle(){
  const plate=normPlate($('#v_plate').value),type=$('#v_type').value,make=$('#v_make').value.trim(),model=$('#v_model').value.trim(),color=$('#v_color').value.trim();
  if(plate.length<2||plate.length>8)return say('Enter a license plate of 2 to 8 letters or numbers');
  if(!VTYPES.includes(type))return say('Pick a vehicle type');
  if(!make||!model)return say('Enter the make and model');
  if(MOTO.test([type,make,model,color].join(' ')))return say('Motorcycles are not allowed to be registered.');
  if(PCARS.length>=5)return say('You can register up to 5 vehicles. Remove one first.');
  try{await authed();
    await db.collection('vehicles').doc('p_'+plate).set({ownerId:S.user.id,ownerName:S.user.name.slice(0,80),plate,type,make:make.slice(0,30),model:model.slice(0,30),color:color.slice(0,20),status:'pending',created:Date.now()});
    say('Submitted! Staff will review your registration.');portal()}
  catch(e){say(e&&e.code==='permission-denied'?'Blocked. That plate may already be registered, or you need to open your bank account first (Bank section).':(e.message||fe(e)))}
}
async function delVehicle(vid){
  if(!vid||!confirm('Remove this vehicle from your registration?'))return;
  try{await authed();await db.collection('vehicles').doc(vid).delete();say('Vehicle removed.');portal()}
  catch(e){say(e&&e.code==='permission-denied'?'Blocked by the database rules.':(e.message||fe(e)))}
}

// ---------- staff: licenses + vehicles (used by the "Licenses" tab in mod()) ----------
const fillTicket=id=>{DT='tix';mod().then(()=>{const el=$('#tk_id');if(el&&id){el.value=id;el.scrollIntoView({block:'center'})}})};
function licPanel(lics){
  return `<div class="panel"><h3>Turn a license on or off</h3><p class="sub">Everyone starts with an active license. Turn it off to stop someone from driving, and back on to restore it. Uses the staff PIN at the top right.</p>
    <div class="row"><div><label>Discord user ID *</label><input id="lc_id" inputmode="numeric" placeholder="e.g. 123456789012345678"></div><div><label>Note (optional)</label><input id="lc_note" maxlength="100" placeholder="e.g. Suspended for reckless driving"></div></div>
    <p><button class="btn" onclick="setLicense('active')">Turn ON (Active)</button> <button class="btn s" onclick="setLicense('inactive')">Turn OFF (Inactive)</button></p></div>
    <div class="panel"><h3>Changed by staff (${lics.length})</h3><table class="tbl"><tr><th>User ID</th><th>Status</th><th>Note</th><th>By</th><th>Updated</th><th></th></tr>${lics.map(x=>`<tr><td>${esc(x.id)}</td><td><span class="tag ${x.status==='active'?'g':'r'}">${esc(x.status)}</span></td><td>${esc(x.note||'')}</td><td>${esc(x.by_name||'')}</td><td class="mu">${esc(new Date(x.updated||0).toLocaleString())}</td><td style="text-align:right;white-space:nowrap">${x.status==='active'?`<button class="btn s" onclick="licToggle('${safeId(x.id)}','inactive')">Turn off</button>`:`<button class="btn" onclick="licToggle('${safeId(x.id)}','active')">Turn on</button>`} <button class="btn s" onclick="fillTicket('${safeId(x.id)}')">Ticket</button></td></tr>`).join('')||'<tr><td colspan="6" class="mu">Nobody has had their license changed.</td></tr>'}</table></div>`;
}
function regPanel(vehs,lics){
  const lm={};lics.forEach(l=>lm[l.id]=l.status);
  const lt=id=>lm[id]!=='inactive'?'<span class="tag g">license on</span>':'<span class="tag r">license off</span>';
  const pend=vehs.filter(x=>vst(x)==='pending'),rest=vehs.filter(x=>vst(x)!=='pending');
  const who=x=>`${esc(x.ownerName||'')}<br><span class="mu">${esc(x.ownerId)}</span>`;
  return `<div class="panel"><h3>Waiting for review (${pend.length})</h3><p class="sub">Accept or deny new vehicle registrations. Motorcycles are not allowed: deny them. Uses the staff PIN at the top right.</p>
    <table class="tbl"><tr><th>Plate</th><th>Type</th><th>Vehicle</th><th>Owner</th><th>License</th><th>Sent</th><th></th></tr>${pend.map(x=>`<tr><td><b>${esc(x.plate)}</b></td><td>${esc(x.type)}</td><td>${esc(x.make)} ${esc(x.model)}${x.color?'<br><span class="mu">'+esc(x.color)+'</span>':''}</td><td>${who(x)}</td><td>${lt(x.ownerId)}</td><td class="mu">${ago(x.created)}</td><td style="text-align:right;white-space:nowrap"><button class="btn" onclick="reviewVehicle('${safeId(x.id)}','accepted')">Accept</button> <button class="btn s" onclick="reviewVehicle('${safeId(x.id)}','denied')">Deny</button></td></tr>`).join('')||'<tr><td colspan="7" class="mu">Nothing waiting for review.</td></tr>'}</table></div>
    <div class="panel"><h3>Reviewed and approved vehicles (${rest.length})</h3><p class="sub">Remove anything that should not be registered. Denied registrations can be removed too.</p>
    <table class="tbl"><tr><th>Plate</th><th>Type</th><th>Vehicle</th><th>Owner</th><th>Status</th><th></th></tr>${rest.map(x=>`<tr><td><b>${esc(x.plate)}</b></td><td>${esc(x.type)}</td><td>${esc(x.make)} ${esc(x.model)}</td><td>${who(x)}</td><td>${vtag(x)}</td><td style="text-align:right;white-space:nowrap"><button class="btn s" onclick="fillTicket('${safeId(x.ownerId)}')">Ticket</button> <button class="btn s" onclick="staffDelVehicle('${safeId(x.id)}')">Remove</button></td></tr>`).join('')||'<tr><td colspan="6" class="mu">No vehicles yet.</td></tr>'}</table></div>`;
}
async function reviewVehicle(vid,status){
  if(!S.staff||!vid)return;let reason='';
  if(status==='denied'){const r=prompt('Reason for denying (shown to the owner, optional)');if(r===null)return;reason=r.trim().slice(0,100)}
  try{await staffWrite('v_'+vid,b=>b.update(db.collection('vehicles').doc(vid),{status,reason,reviewed_by:S.user.id,reviewed_name:S.user.name.slice(0,80),reviewed:Date.now()}));
    say(status==='accepted'?'Registration accepted.':'Registration denied.');mod()}catch(e){say(e.message||fe(e))}
}
async function licToggle(id,status){
  if(!S.staff||!id)return;let note='';
  if(status==='inactive'){const r=prompt('Reason for turning this license off (optional)');if(r===null)return;note=r.trim().slice(0,100)}
  try{await staffWrite('l_'+id,b=>b.set(db.collection('licenses').doc(id),{status,by:S.user.id,by_name:S.user.name.slice(0,80),updated:Date.now(),note}));
    say('License turned '+(status==='active'?'on':'off')+'.');mod()}catch(e){say(e.message||fe(e))}
}
async function setLicense(status){
  const id=($('#lc_id').value||'').replace(/\D/g,'');
  if(id.length<15||id.length>25)return say('Enter the Discord user ID');
  if(!confirm('Set the license of '+id+' to '+status+'?'))return;
  try{await staffWrite('l_'+id,b=>b.set(db.collection('licenses').doc(id),{status,by:S.user.id,by_name:S.user.name.slice(0,80),updated:Date.now(),note:($('#lc_note').value||'').trim().slice(0,100)}));
    say('License set to '+status+'.');mod()}catch(e){say(e.message||fe(e))}
}
async function staffDelVehicle(vid){
  if(!vid||!confirm('Remove this vehicle?'))return;
  try{await staffWrite('v_'+vid,b=>b.delete(db.collection('vehicles').doc(vid)));say('Vehicle removed.');mod()}catch(e){say(e.message||fe(e))}
}

// =====================================================================
// MODES: Standard / Emergency Response / Staff  (switcher + color themes)
// =====================================================================
(function(){
  const st=document.createElement('style');
  st.textContent=`
  /* phones: wide tables scroll inside their own box instead of widening the whole page */
  .panel,.card{overflow-x:auto}
  .st-r{flex-wrap:wrap}
  @media(max-width:700px){.st{font-size:14px}.tbl th,.tbl td{padding:.5em .45em}.tbl td .btn,.tbl td button{white-space:nowrap}}
  #who{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
  .modebtn{display:inline-flex;align-items:center;gap:.6em;background:var(--panel2);border:1px solid var(--bd);color:var(--tx);border-radius:8px;padding:8px 12px;font:600 .78rem system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer}
  .modebtn:hover{filter:brightness(1.15)}
  .modebtn i,#modemenu i{width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none}
  .modebtn span{opacity:.7}
  #modemenu{position:fixed;z-index:1500;width:min(300px,calc(100vw - 24px));background:var(--panel);border:1px solid var(--bd);border-radius:12px;padding:8px;box-shadow:0 18px 50px rgba(0,0,0,.6);animation:rise .18s both}
  #modemenu .mm-h{color:var(--mu);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;padding:6px 10px 8px}
  #modemenu button{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center;width:100%;text-align:left;background:none;border:1px solid transparent;border-radius:9px;padding:10px;color:var(--tx);cursor:pointer;font:inherit}
  #modemenu button:hover{background:var(--panel2)}
  #modemenu button.on{border-color:var(--bd);background:var(--panel2)}
  #modemenu button b{font-size:.92rem}#modemenu button small{grid-column:2;color:var(--mu);font-size:.78rem}

  /* ---- STAFF MODE: navy blue with blue accents ---- */
  body.m-staff{--bg:#06122b;--panel:#0c2150;--panel2:#12306d;--bd:#2c58b0;--red:#3b82f6;--blue:#60a5fa;--mu:#a6bbe0;
    background:radial-gradient(1200px 520px at 50% -120px,#1d4ed8aa,transparent 70%),linear-gradient(180deg,#06122b,#081a3d)}
  body.m-staff::before{background:rgba(59,130,246,.30)}body.m-staff::after{background:rgba(96,165,250,.16)}
  body.m-staff header{background:linear-gradient(90deg,#071a3b,#0e2f66)}
  body.m-staff .bar{background:#071a3b;border-bottom-color:#2c58b0}
  body.m-staff .panel,body.m-staff .kpis,body.m-staff .card{background:#0b1f4a;border-color:#2c58b0}
  body.m-staff .kpi,body.m-staff .st-head{border-color:#2c58b0}
  body.m-staff .kpi.click:hover{background:#10285c}
  body.m-staff .tbl th{border-bottom-color:#2c58b0}body.m-staff .tbl td{border-bottom-color:#183a7a}
  body.m-staff input,body.m-staff select,body.m-staff textarea{background:#071634;border-color:#2c58b0}
  body.m-staff .acts button{background:#0f2860;border-color:#2c58b0}body.m-staff .acts button:hover{background:#17357c;border-color:#5b8de0}
  body.m-staff .brand small::after{content:" \\2022  STAFF MODE";color:#8fb6ff}

  /* ---- EMERGENCY RESPONSE MODE: near-black with red/blue emergency lights ---- */
  body.m-er{--bg:#04060a;--panel:#0a0e15;--panel2:#121824;--bd:#242d3d;--tx:#f2f4f8;--mu:#8793a6;--red:#ff2d2d;--blue:#2d6bff;
    background:radial-gradient(900px 420px at 50% -120px,#2a0a10,transparent 70%),linear-gradient(180deg,#04060a,#070a10)}
  body.m-er::before{background:rgba(255,45,45,.20)}body.m-er::after{background:rgba(45,107,255,.22)}
  body.m-er header{background:linear-gradient(90deg,#05070b,#0b0f17)}
  body.m-er header::after{background:linear-gradient(90deg,#ff2d2d 0,#ff2d2d 25%,#2d6bff 25%,#2d6bff 50%,#ff2d2d 50%,#ff2d2d 75%,#2d6bff 75%,#2d6bff 100%);background-size:200% 100%;animation:flow 5s linear infinite;box-shadow:0 0 22px rgba(255,45,45,.45)}
  body.m-er .bar{background:#05070b;border-bottom-color:#242d3d}
  body.m-er .panel,body.m-er .kpis,body.m-er .card{background:#080b11;border-color:#242d3d}
  body.m-er .kpi,body.m-er .st-head{border-color:#242d3d}
  body.m-er .kpi.click:hover{background:#0d121b}
  body.m-er .tbl th{border-bottom-color:#242d3d}body.m-er .tbl td{border-bottom-color:#141b27}
  body.m-er input,body.m-er select,body.m-er textarea{background:#04060a;border-color:#242d3d}
  body.m-er .acts button{background:#0b1019;border-color:#242d3d}body.m-er .acts button:hover{background:#121a28;border-color:#3a4a66}
  body.m-er .brand small::after{content:" \\2022  EMERGENCY RESPONSE MODE";color:#ff6b6b}
  .er .alert{border-left:4px solid var(--red)}
  .tag.p{color:#7aa7ff;border-color:#2d4f94}.tag.e{color:#ff9aa4;border-color:#6d2630}.tag.f{color:#ffb86b;border-color:#6b4520}
  .er .kpi .big.good{color:#7ee2a1}.er .kpi .big.badc{color:#ff8a8a}`;
  document.head.appendChild(st);
  addEventListener('keydown',e=>{if(e.key==='Escape')closeModeMenu()});
})();

const MODES={std:{name:'Standard',desc:'Everyday citizen view: bank, license, vehicles',dot:'#e11d2e'},
  er:{name:'Emergency Response',desc:'Police, EMS and fire: duty hours, warrants, lookups',dot:'#ff2d2d'},
  staff:{name:'Staff',desc:'Staff console: bans, bank, licenses, reviews',dot:'#3b82f6'}};
function modesFor(){return S.user?['std',...(S.ers?['er']:[]),...(S.staff?['staff']:[])]:['std']}
function modeBtn(){return modesFor().length>1?`<button class="modebtn" id="modebtn" onclick="modeMenu(event)"><i style="background:${MODES[MODE].dot}"></i>${MODES[MODE].name}<span>&#9662;</span></button>`:''}
function closeModeMenu(){const m=$('#modemenu');if(m)m.remove()}
function modeMenu(e){
  if(e)e.stopPropagation();
  if($('#modemenu'))return closeModeMenu();
  const b=$('#modebtn');if(!b)return;const r=b.getBoundingClientRect(),m=document.createElement('div');m.id='modemenu';
  m.innerHTML=`<div class="mm-h">Switch mode</div>`+modesFor().map(k=>`<button class="${k===MODE?'on':''}" onclick="setMode('${k}')"><i style="background:${MODES[k].dot}"></i><b>${MODES[k].name}</b><small>${MODES[k].desc}</small></button>`).join('');
  document.body.appendChild(m);
  m.style.top=(r.bottom+8)+'px';m.style.right=Math.max(12,innerWidth-r.right)+'px';
  setTimeout(()=>document.addEventListener('click',closeModeMenu,{once:true}),0);
}
function setMode(m){
  if(BANNED||DOWN||!modesFor().includes(m))return;
  MODE=m;try{localStorage.setItem('ros_mode',m)}catch{}
  closeModeMenu();tab=m==='staff'?'mod':m==='er'?'er':'home';draft.tab=tab;say('');render();scrollTo(0,0);
}

// =====================================================================
// EMERGENCY RESPONSE CONSOLE: duty hours, warrants, lookups, BOLOs
// =====================================================================
let ET='hours',ERPIN='',ERT=null,HB=null,HBWARN=false;
const GRACE=3*60e3;   // a unit is taken off duty this long after its last heartbeat (the person left the site)
const erTab=k=>{ET=k;er()};
const DEPTS=['Police','EMS','Fire','Dispatch','Other'],UST=['Available','En route','On scene','Busy','Off duty'];
const dtag=d=>`<span class="tag ${d==='Police'?'p':d==='EMS'?'e':d==='Fire'?'f':''}">${esc(d||'Other')}</span>`;
const stag=s=>`<span class="tag ${s==='Available'?'g':s==='Off duty'||s==='Pending'||s==='Closed'||s==='Cancelled'?'':'a'}">${esc(s||'')}</span>`;
const fmtMin=m=>{m=Math.max(0,Math.round(m));return m<60?m+'m':Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'};
const myCallsign=()=>{let c='';try{c=localStorage.getItem('ros_cs')||''}catch{}
  if(!c){c=(prompt('Your callsign (for example P-12)')||'').trim().slice(0,12);if(c)try{localStorage.setItem('ros_cs',c)}catch{}}return c};

// ---------- duty time: on duty only while the site stays open ----------
// A unit counts as on duty while its heartbeat is fresh. When the person leaves the site the heartbeat stops,
// they drop to Off duty after GRACE, and the time is logged up to their last heartbeat.
const lastSeen=u=>Math.max((u&&u.seen)||0,(u&&u.updated)||0);
const effSt=u=>u&&u.status&&u.status!=='Off duty'&&Date.now()-lastSeen(u)<GRACE?u.status:'Off duty';
function dutyView(u){
  const now=Date.now();u=u||{};const sess=(u.sessions||[]).map(x=>({s:x.s,e:x.e}));let total=u.totalMin||0,live=0;
  if(u.status&&u.status!=='Off duty'&&u.onSince){
    if(now-lastSeen(u)<GRACE)live=now-u.onSince;
    else{sess.push({s:u.onSince,e:lastSeen(u),auto:true});total+=Math.round((lastSeen(u)-u.onSince)/60000)}}
  const week=sess.filter(x=>x.e>now-7*864e5).reduce((a,x)=>a+Math.max(0,Math.round((x.e-x.s)/60000)),0)+Math.round(live/60000);
  return{sess:sess.sort((a,b)=>b.s-a.s),total:total+Math.round(live/60000),week,live};
}
function dutyBeat(on){
  clearInterval(HB);HB=null;if(!on||!S.user)return;
  const beat=async()=>{if(!S.user||BANNED)return;
    try{await authed();await db.collection('units').doc(S.user.id).update({seen:Date.now()})}
    catch(e){if(e&&e.code==='permission-denied'&&!HBWARN){HBWARN=true;say('The duty heartbeat was blocked by the database rules. Staff need to publish the newest rules, or you will be taken off duty after 3 minutes.')}}};
  HB=setInterval(beat,window.DUTY_BEAT_MS||45000);
}
async function resumeDuty(){   // refreshing the page keeps you on duty; closing it does not
  if(!S.ers||!S.user)return;
  try{await authed();const d=await db.collection('units').doc(S.user.id).get();
    if(d.exists&&effSt(d.data())!=='Off duty'){dutyBeat(true);db.collection('units').doc(S.user.id).update({seen:Date.now()}).catch(()=>{})}}catch{}
}

// same idea as staffWrite, but with the duty PIN that police, EMS and fire share (staff PIN also works)
async function erWrite(id,fn){
  let p=(($('#e_pin')&&$('#e_pin').value)||ERPIN).trim();
  if(!p)p=(prompt('Duty PIN')||'').trim();
  if(!p)throw new Error('Enter the duty PIN first');
  const ref=db.collection('proofs').doc(id);
  try{await ref.set({pin:p})}catch(e){if(e&&e.code==='permission-denied'){ERPIN='';throw new Error('Duty PIN rejected. Check it and try again.')}throw e}
  await ref.delete().catch(()=>{});
  ERPIN=p;
  const b=db.batch();b.set(ref,{pin:p});fn(b);
  try{await b.commit()}
  catch(e){if(e&&e.code==='permission-denied')throw new Error('Your PIN is correct, but the database rules blocked this change ('+id+'). Make sure the newest rules are published.');throw e}
  finally{ref.delete().catch(()=>{})}
}

async function er(){
  if(!S.user||!S.ers)return go('home');
  clearTimeout(ERT);
  const id=S.user.id;let me=null;
  try{await authed();const d=await db.collection('units').doc(id).get();me=d.exists?d.data():null}catch{}
  const duty=effSt(me)!=='Off duty',wasAuto=!!me&&me.status!=='Off duty'&&!duty;
  const nav=[['hours','Hours'],['warr','Warrants'],['look','Lookup'],['bolo','BOLOs']];
  const head=`<div class="st-head"><div class="st-title"><h2>Emergency Response</h2><span>Police &middot; EMS &middot; Fire</span></div>
    <div class="st-tabs">${nav.map(([k,l])=>`<button class="${ET===k?'on':''}" onclick="erTab('${k}')">${l}</button>`).join('')}</div>
    <div class="st-r"><span class="st-stat ${duty?'':'bad'}">${duty?'On duty &middot; '+esc(me.callsign||''):'Off duty'}</span><input id="e_pin" type="password" placeholder="Duty PIN" title="Duty PIN, used for every action here" name="ros-duty-pin" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" oninput="ERPIN=this.value.trim()" value="${esc(ERPIN)}"></div></div>`;
  let form='';
  if(ET==='hours'){let cs='',dp='';try{cs=localStorage.getItem('ros_cs')||'';dp=localStorage.getItem('ros_dept')||''}catch{}
    cs=(me&&me.callsign)||cs;dp=(me&&me.dept)||dp||(S.police?'Police':'EMS');
    form=`${wasAuto?`<div class="panel alert"><h3>You were taken off duty</h3><p class="sub" style="margin:0">You left the site, so your duty ended at ${esc(new Date(lastSeen(me)).toLocaleTimeString())} and the time was logged. Set your status below to go back on duty.</p></div>`:''}
    <div class="panel"><h3>My status</h3><p class="sub">Set your callsign, department and status to go on or off duty. You stay on duty while this site is open, and go off duty about 3 minutes after you leave it. Uses the duty PIN at the top right.</p>
    <div class="row"><div><label>Callsign *</label><input id="u_cs" maxlength="12" placeholder="e.g. P-12" value="${esc(cs)}"></div><div><label>Department</label><select id="u_dept">${DEPTS.map(x=>`<option ${x===dp?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <label>Status</label><select id="u_st">${UST.map(x=>`<option ${(duty?me.status:'Available')===x?'selected':''}>${x}</option>`).join('')}</select>
    <p><button class="btn" onclick="setUnit()">Update status</button></p></div>`}
  else if(ET==='warr')form=(S.police||S.staff)?`<div class="panel"><h3>Request a warrant</h3><p class="sub">Send a request for review. A staff member or judge approves or denies it. Uses the duty PIN at the top right.</p>
    <div class="row"><div><label>Type</label><select id="wr_type"><option>Arrest</option><option>Search</option><option>Other</option></select></div><div><label>Subject (name or description) *</label><input id="wr_sub" maxlength="80" placeholder="e.g. John Miller"></div></div>
    <div class="row"><div><label>Subject Discord ID (optional)</label><input id="wr_pid" inputmode="numeric" placeholder="Lets lookups flag the warrant"></div><div><label>Location (for search warrants)</label><input id="wr_loc" maxlength="80" placeholder="e.g. 12 Harbor Rd"></div></div>
    <label>Reason / probable cause *</label><textarea id="wr_reason" rows="3" maxlength="500" placeholder="What happened and why this warrant is needed"></textarea>
    <p><button class="btn" onclick="requestWarrant()">Request warrant</button></p></div>`
    :`<div class="panel"><p class="sub" style="margin:0">Only police and staff can request warrants. You can still see approved warrants below.</p></div>`;
  else if(ET==='look')form=`<div class="panel"><h3>Lookup</h3><p class="sub">Check a plate or a person: registration, license, tickets, warrants and active BOLOs.</p>
    <div class="row"><div><label>License plate</label><input id="lp_plate" maxlength="10" placeholder="e.g. ROS1234" onkeydown="if(event.key==='Enter')lookPlate()"></div><div><label>Discord user ID</label><input id="lp_pid" inputmode="numeric" placeholder="e.g. 123456789012345678" onkeydown="if(event.key==='Enter')lookPerson()"></div></div>
    <p><button class="btn" onclick="lookPlate()">Search plate</button> <button class="btn s" onclick="lookPerson()">Search person</button></p></div>`;
  else if(ET==='bolo')form=`<div class="panel"><h3>New BOLO</h3><p class="sub">Be on the lookout for a vehicle or a person. Vehicle BOLOs flag automatically in plate lookups. Uses the duty PIN at the top right.</p>
    <div class="row"><div><label>Type</label><select id="bo_kind"><option>Vehicle</option><option>Person</option></select></div><div><label>Plate or description *</label><input id="bo_sub" maxlength="80" placeholder="e.g. ROS1234, or tall man in a red jacket"></div></div>
    <label>Details</label><input id="bo_det" maxlength="200" placeholder="e.g. Fled a traffic stop heading north">
    <p><button class="btn" onclick="newBolo()">Add BOLO</button></p></div>`;
  $('#view').innerHTML=`<div class="st er">${head}${form}<div id="erdata">${ET==='look'?'':'<div class="loader"><span class="spin"></span><span>Loading…</span></div>'}</div></div>`;
  if(ET!=='look')erLoad();
}
async function erLoad(){
  const box=$('#erdata');if(!box||tab!=='er')return;clearTimeout(ERT);
  try{await authed();
    if(ET==='hours')await loadHours(box);
    else if(ET==='warr')await loadWarrants(box);else if(ET==='bolo')await loadBolos(box)}
  catch(e){box.innerHTML=`<div class="panel"><p class="mu" style="margin:0">Could not load: ${esc(e&&e.code==='permission-denied'?'publish the newest Firestore rules':(e&&e.message)||'error')}</p></div>`}
  if(ET!=='look'&&ET!=='hours')ERT=setTimeout(()=>{if(tab==='er')erLoad()},15000);
}

async function setUnit(){
  const cs=$('#u_cs').value.trim().slice(0,12),dept=$('#u_dept').value,status=$('#u_st').value;
  if(!cs)return say('Enter your callsign');
  try{await authed();
    const d=await db.collection('units').doc(S.user.id).get(),old=d.exists?d.data():null,now=Date.now();
    let sessions=(old&&old.sessions)||[],total=(old&&old.totalMin)||0,onSince=(old&&old.onSince)||0;
    const wasOn=!!old&&old.status&&old.status!=='Off duty'&&!!onSince,fresh=wasOn&&now-lastSeen(old)<GRACE;
    const close=end=>{if(onSince&&end>onSince){sessions=[...sessions,{s:onSince,e:end}].slice(-60);total+=Math.round((end-onSince)/60000)}onSince=0};
    if(wasOn&&!fresh)close(lastSeen(old));          // they left the site last time: log it up to their last heartbeat
    else if(wasOn&&status==='Off duty')close(now);  // they signed off
    if(status==='Off duty')onSince=0;else if(!onSince)onSince=now;
    await erWrite('e_u_'+S.user.id,b=>b.set(db.collection('units').doc(S.user.id),{name:S.user.name.slice(0,80),callsign:cs,dept,status,updated:now,seen:now,onSince,sessions,totalMin:total}));
    dutyBeat(status!=='Off duty');
    try{localStorage.setItem('ros_cs',cs);localStorage.setItem('ros_dept',dept)}catch{}
    say(status==='Off duty'?'You are off duty. Your time was logged.':'Status set to '+status+'.');er()}catch(e){say(e.message||fe(e))}
}

// ---------- duty hours ----------
async function loadHours(box){
  const d=await db.collection('units').doc(S.user.id).get(),me=d.exists?d.data():null,v=dutyView(me);
  let all='';
  if(S.staff){const q=await db.collection('units').get(),rows=q.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>dutyView(b).total-dutyView(a).total);
    all=`<div class="panel"><h3>All units (staff)</h3><p class="sub">Total logged duty time for everyone who has gone on duty.</p><table class="tbl"><tr><th>Callsign</th><th>Name</th><th>Dept</th><th>Now</th><th>Last 7 days</th><th>All time</th></tr>${rows.map(u=>{const w=dutyView(u);return `<tr><td><b>${esc(u.callsign||'—')}</b></td><td>${esc(u.name||'')}</td><td>${dtag(u.dept)}</td><td>${stag(effSt(u))}</td><td>${esc(fmtMin(w.week))}</td><td>${esc(fmtMin(w.total))}</td></tr>`}).join('')||'<tr><td colspan="6" class="mu">No duty time logged yet.</td></tr>'}</table></div>`}
  box.innerHTML=`<div class="kpis"><div class="kpi"><div class="lbl">This shift</div><div class="big ${v.live?'good':''}">${v.live?esc(fmtMin(v.live/60000)):'—'}</div><div class="mu">${v.live?'on duty now':'not on duty'}</div></div>
    <div class="kpi"><div class="lbl">Last 7 days</div><div class="big">${esc(fmtMin(v.week))}</div><div class="mu">on duty</div></div>
    <div class="kpi"><div class="lbl">All time</div><div class="big">${esc(fmtMin(v.total))}</div><div class="mu">logged</div></div></div>
    <div class="panel"><h3>My duty log</h3><p class="sub">Time is logged while you are on duty and the site is open. If you close the site, you go off duty after about 3 minutes and the time is logged up to when you left.</p>
    <table class="tbl"><tr><th>Started</th><th>Ended</th><th>Length</th><th>Note</th></tr>${v.live?`<tr><td>${esc(new Date(me.onSince).toLocaleString())}</td><td class="mu">now</td><td>${esc(fmtMin(v.live/60000))}</td><td><span class="tag g">on duty</span></td></tr>`:''}${v.sess.slice(0,15).map(x=>`<tr><td>${esc(new Date(x.s).toLocaleString())}</td><td>${esc(new Date(x.e).toLocaleString())}</td><td>${esc(fmtMin((x.e-x.s)/60000))}</td><td class="mu">${x.auto?'Left the site':'Signed off'}</td></tr>`).join('')||(v.live?'':'<tr><td colspan="4" class="mu">No duty time logged yet. Set your callsign and go on duty above.</td></tr>')}</table></div>${all}`;
}

// ---------- warrants ----------
const wActive=w=>w.status==='approved'&&(!w.expires||w.expires>Date.now());
const wtag=w=>{const x=w.status==='approved'&&w.expires&&w.expires<=Date.now()?'expired':w.status;return `<span class="tag ${x==='approved'?'g':x==='denied'?'r':x==='pending'?'a':''}">${esc(x)}</span>`};
const wrow=(w,mode,rv)=>`<tr><td><span class="tag ${w.type==='Arrest'?'r':w.type==='Search'?'a':''}">${esc(w.type)}</span></td><td><b>${esc(w.subject)}</b>${w.subjectId?`<br><span class="mu">${esc(w.subjectId)}</span>`:''}${w.location?`<br><span class="mu">${esc(w.location)}</span>`:''}</td><td>${esc(w.reason)}${w.decision_note?`<br><span class="mu">Note: ${esc(w.decision_note)}</span>`:''}</td><td>${esc(w.requested_name||'')}<br><span class="mu">${esc(w.callsign||'')} &middot; ${ago(w.created)}</span></td><td>${wtag(w)}${w.status==='approved'&&w.expires?`<br><span class="mu">expires ${esc(new Date(w.expires).toLocaleDateString())}</span>`:''}</td>
  <td style="text-align:right;white-space:nowrap">${mode==='pend'?(rv?`<button class="btn" onclick="decideWarrant('${safeId(w.id)}','approved')">Approve</button> <button class="btn s" onclick="decideWarrant('${safeId(w.id)}','denied')">Deny</button>`:'<span class="mu">Awaiting review</span>'):mode==='act'?`<button class="btn s" onclick="serveWarrant('${safeId(w.id)}')">Mark served</button>`:''}</td></tr>`;
async function loadWarrants(box){
  const q=await db.collection('warrants').orderBy('created','desc').limit(80).get(),rows=q.docs.map(d=>({id:d.id,...d.data()}));
  const pend=rows.filter(w=>w.status==='pending'),act=rows.filter(wActive),rest=rows.filter(w=>!pend.includes(w)&&!act.includes(w)).slice(0,10),rv=S.staff||S.judge;
  const th='<tr><th>Type</th><th>Subject</th><th>Reason</th><th>Requested by</th><th>Status</th><th></th></tr>';
  box.innerHTML=`${rv?`<div class="panel"><h3>Reviewer sign-off</h3><p class="sub">Approve or deny warrant requests. This needs the staff (reviewer) PIN. Approved warrants expire after 7 days.</p><input id="b_pin" type="password" placeholder="Reviewer PIN" name="ros-reviewer-pin" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" oninput="setPin(this.value)" onkeydown="if(event.key==='Enter')unlockStaff()" value="${esc(pin())}" style="max-width:20em"></div>`:''}
    <div class="panel"><div class="hl"><h3>Waiting for review (${pend.length})</h3><span class="mu" style="font-size:.85em">Refreshes every 15 seconds</span></div><table class="tbl">${th}${pend.map(w=>wrow(w,'pend',rv)).join('')||'<tr><td colspan="6" class="mu">No warrant requests waiting.</td></tr>'}</table></div>
    <div class="panel"><h3>Active warrants (${act.length})</h3><table class="tbl">${th}${act.map(w=>wrow(w,'act',rv)).join('')||'<tr><td colspan="6" class="mu">No active warrants.</td></tr>'}</table></div>
    ${rest.length?`<div class="panel"><h3>Recently closed</h3><table class="tbl">${th}${rest.map(w=>wrow(w,'done',rv)).join('')}</table></div>`:''}`;
}
async function requestWarrant(){
  const type=$('#wr_type').value,sub=$('#wr_sub').value.trim(),pid=($('#wr_pid').value||'').replace(/\D/g,''),loc=$('#wr_loc').value.trim(),reason=$('#wr_reason').value.trim();
  if(!sub)return say('Enter who the warrant is for');
  if(pid&&(pid.length<15||pid.length>25))return say('The Discord ID looks wrong. Leave it empty if you do not have it.');
  if(reason.length<10)return say('Explain the reason (at least a sentence)');
  const wid=newId('warrants');let cs='';try{cs=localStorage.getItem('ros_cs')||''}catch{}
  try{await erWrite('e_w_'+wid,b=>b.set(db.collection('warrants').doc(wid),{type,subject:sub.slice(0,80),subjectId:pid,location:loc.slice(0,80),reason:reason.slice(0,500),status:'pending',requested_by:S.user.id,requested_name:S.user.name.slice(0,80),callsign:cs,created:Date.now()}));
    say('Warrant requested. A reviewer will look at it.');er()}catch(e){say(e.message||fe(e))}
}
async function decideWarrant(id,status){
  if(!(S.staff||S.judge)||!id)return;let note='';
  if(status==='denied'){const r=prompt('Reason for denying (optional)');if(r===null)return;note=r.trim().slice(0,200)}
  const now=Date.now();
  try{await staffWrite('w_'+id,b=>b.update(db.collection('warrants').doc(id),{status,decision_note:note,decided_by:S.user.id,decided_name:S.user.name.slice(0,80),decided:now,expires:status==='approved'?now+7*864e5:0}));
    say(status==='approved'?'Warrant approved.':'Warrant denied.');erLoad()}catch(e){say(e.message||fe(e))}
}
async function serveWarrant(id){
  if(!id||!confirm('Mark this warrant as served?'))return;
  try{await erWrite('e_w_'+id,b=>b.update(db.collection('warrants').doc(id),{status:'served',served_by:S.user.name.slice(0,80),served:Date.now()}));say('Warrant marked served.');erLoad()}catch(e){say(e.message||fe(e))}
}

// ---------- lookups ----------
async function lookPlate(){
  const plate=normPlate($('#lp_plate').value),box=$('#erdata');
  if(plate.length<2)return say('Enter a license plate');
  box.innerHTML=LOADER();
  try{await authed();const d=await db.collection('vehicles').doc('p_'+plate).get();
    if(!d.exists){const bq=await db.collection('bolos').orderBy('created','desc').limit(60).get();
      const hit=bq.docs.map(x=>x.data()).find(b=>b.status==='active'&&b.kind==='Vehicle'&&normPlate(b.subject)===plate);
      box.innerHTML=`${hit?`<div class="panel alert"><h3>BOLO on this plate</h3><p class="sub" style="margin:0">${esc(hit.subject)}: ${esc(hit.details||'no details')} (by ${esc(hit.by_name||'')})</p></div>`:''}<div class="panel"><h3>No registration found</h3><p class="sub" style="margin:0">Nothing is registered under plate <b>${esc(plate)}</b>.</p></div>`;return}
    showPerson(d.data().ownerId,plate)}
  catch(e){box.innerHTML=`<div class="panel"><p class="mu" style="margin:0">Could not look up: ${esc(e&&e.code==='permission-denied'?'publish the newest Firestore rules':(e&&e.message)||'error')}</p></div>`}
}
function lookPerson(){
  const id=($('#lp_pid').value||'').replace(/\D/g,'');
  if(id.length<15||id.length>25)return say('Enter the Discord user ID');
  showPerson(id,'')
}
async function showPerson(id,plate){
  const box=$('#erdata');box.innerHTML=LOADER();
  try{await authed();
    const [l,v,t,bq,wq]=await Promise.all([db.collection('licenses').doc(id).get(),db.collection('vehicles').where('ownerId','==',id).get(),db.collection('tickets').where('to','==',id).get(),db.collection('bolos').orderBy('created','desc').limit(60).get(),db.collection('warrants').where('subjectId','==',id).get().catch(()=>null)]);
    const lic=l.exists?l.data():null,licOn=!lic||lic.status!=='inactive';
    const cars=v.docs.map(d=>({id:d.id,...d.data()})),tx=t.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0)),open=tx.filter(x=>x.status==='unpaid');
    const plates=cars.map(c=>normPlate(c.plate)),hits=bq.docs.map(d=>({id:d.id,...d.data()})).filter(b=>b.status==='active'&&b.kind==='Vehicle'&&plates.includes(normPlate(b.subject)));
    const wars=wq?wq.docs.map(d=>({id:d.id,...d.data()})).filter(wActive):[];
    const owner=(cars[0]&&cars[0].ownerName)||'Citizen';
    box.innerHTML=`<div class="panel"><h3>${esc(owner)}</h3><p class="sub" style="margin:0">Discord ID ${esc(id)}${plate?' &middot; found by plate <b>'+esc(plate)+'</b>':''}</p></div>
      ${wars.length?`<div class="panel alert"><h3>Active warrant</h3>${wars.map(w=>`<p class="sub" style="margin:0 0 .4em"><b>${esc(w.type)}</b>: ${esc(w.reason)} (requested by ${esc(w.requested_name||'')})</p>`).join('')}</div>`:''}
      ${hits.length?`<div class="panel alert"><h3>Active BOLO</h3>${hits.map(b=>`<p class="sub" style="margin:0 0 .4em">${esc(b.subject)}: ${esc(b.details||'no details')} (by ${esc(b.by_name||'')})</p>`).join('')}</div>`:''}
      <div class="kpis"><div class="kpi"><div class="lbl">Driver license</div><div class="big ${licOn?'good':'badc'}">${licOn?'Active':'Inactive'}</div><div class="mu">${lic&&lic.note?esc(lic.note):licOn?'valid to drive':'not allowed to drive'}</div></div>
        <div class="kpi"><div class="lbl">Vehicles</div><div class="big">${cars.length}</div><div class="mu">registered</div></div>
        <div class="kpi"><div class="lbl">Unpaid tickets</div><div class="big ${open.length?'badc':''}">${open.length}</div><div class="mu">${open.length?esc(SB(open.reduce((s,x)=>s+(Number(x.amount)||0),0)))+' owed':'none'}</div></div>
        <div class="kpi"><div class="lbl">Warrants</div><div class="big ${wars.length?'badc':'good'}">${wars.length?'Active':'None'}</div><div class="mu">${wars.length?wars.length+' active':'no active warrant'}</div></div>
        <div class="kpi"><div class="lbl">BOLO</div><div class="big ${hits.length?'badc':'good'}">${hits.length?'Flagged':'Clear'}</div><div class="mu">${hits.length?hits.length+' active':'no active BOLO'}</div></div></div>
      <div class="cols"><div class="panel"><h3>Vehicles</h3><table class="tbl"><tr><th>Plate</th><th>Type</th><th>Vehicle</th><th>Registration</th></tr>${cars.map(c=>`<tr><td><b>${esc(c.plate)}</b></td><td>${esc(c.type)}</td><td>${esc(c.make)} ${esc(c.model)}${c.color?'<br><span class="mu">'+esc(c.color)+'</span>':''}</td><td>${vtag(c)}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">No vehicles registered.</td></tr>'}</table></div>
       <div class="panel"><h3>Recent tickets</h3><table class="tbl"><tr><th>Reason</th><th>Amount</th><th>Status</th></tr>${tx.slice(0,6).map(x=>`<tr><td>${esc(x.reason)}</td><td>${esc(SB(x.amount))}</td><td><span class="tag ${x.status==='paid'?'g':x.status==='void'?'':'a'}">${esc(x.status)}</span></td></tr>`).join('')||'<tr><td colspan="3" class="mu">No tickets.</td></tr>'}</table></div></div>
      ${S.police||S.staff?`<div class="panel" style="margin-top:1.2em"><h3>Issue a citation</h3><p class="sub">Adds a ticket the person pays from their bank (up to 25,000 SB). Uses the duty PIN at the top right.</p>
        <div class="row"><div><label>Reason *</label><input id="ci_reason" maxlength="200" placeholder="e.g. Running a red light"></div><div><label>Amount (SB) *</label><input id="ci_amt" inputmode="numeric"></div></div>
        <p><button class="btn" onclick="citeUser('${safeId(id)}')">Issue citation</button></p></div>`:''}`;
  }catch(e){box.innerHTML=`<div class="panel"><p class="mu" style="margin:0">Could not look up: ${esc(e&&e.code==='permission-denied'?'publish the newest Firestore rules':(e&&e.message)||'error')}</p></div>`}
}
async function citeUser(id){
  const a=amt($('#ci_amt').value),reason=($('#ci_reason').value||'').trim().slice(0,200);
  if(!a||a>25000)return say('Enter an amount from 1 to 25,000');if(!reason)return say('Enter the reason');
  if(!confirm('Issue a citation of '+SB(a)+' to '+id+'?'))return;
  const tid=newId('tickets');
  try{await erWrite('e_t_'+tid,b=>b.set(db.collection('tickets').doc(tid),{to:id,by:S.user.id,by_name:S.user.name.slice(0,80),reason,amount:a,created:Date.now(),status:'unpaid',source:'er'}));
    say('Citation issued.');showPerson(id,'')}catch(e){say(e.message||fe(e))}
}

// ---------- BOLOs ----------
async function loadBolos(box){
  const q=await db.collection('bolos').orderBy('created','desc').limit(60).get();
  const rows=q.docs.map(d=>({id:d.id,...d.data()})),act=rows.filter(b=>b.status==='active'),old=rows.filter(b=>b.status!=='active').slice(0,6);
  box.innerHTML=`<div class="panel"><div class="hl"><h3>Active BOLOs (${act.length})</h3><span class="mu" style="font-size:.85em">Refreshes every 15 seconds</span></div>
    <table class="tbl"><tr><th>Type</th><th>Subject</th><th>Details</th><th>By</th><th>Posted</th><th></th></tr>${act.map(b=>`<tr><td><span class="tag ${b.kind==='Vehicle'?'p':'e'}">${esc(b.kind)}</span></td><td><b>${esc(b.subject)}</b></td><td>${esc(b.details||'')}</td><td>${esc(b.by_name||'')}</td><td class="mu">${ago(b.created)}</td><td style="text-align:right"><button class="btn s" onclick="clearBolo('${safeId(b.id)}')">Clear</button></td></tr>`).join('')||'<tr><td colspan="6" class="mu">No active BOLOs.</td></tr>'}</table></div>
    ${old.length?`<div class="panel"><h3>Recently cleared</h3><table class="tbl"><tr><th>Type</th><th>Subject</th><th>Posted</th></tr>${old.map(b=>`<tr><td>${esc(b.kind)}</td><td>${esc(b.subject)}</td><td class="mu">${ago(b.created)}</td></tr>`).join('')}</table></div>`:''}`;
}
async function newBolo(){
  const kind=$('#bo_kind').value,sub=$('#bo_sub').value.trim(),det=$('#bo_det').value.trim();
  if(!sub)return say('Enter the plate or a description');
  const bid=newId('bolos');
  try{await erWrite('e_b_'+bid,b=>b.set(db.collection('bolos').doc(bid),{kind,subject:sub.slice(0,80),details:det.slice(0,200),status:'active',by:S.user.id,by_name:S.user.name.slice(0,80),created:Date.now()}));say('BOLO added.');er()}catch(e){say(e.message||fe(e))}
}
async function clearBolo(id){
  if(!id)return;
  try{await erWrite('e_b_'+id,b=>b.update(db.collection('bolos').doc(id),{status:'cleared',cleared_by:S.user.name.slice(0,80),updated:Date.now()}));say('BOLO cleared.');erLoad()}catch(e){say(e.message||fe(e))}
}

// ===== extra motion: page transitions, staggered rises, count-up numbers, hover lifts, pulses (all off for reduced-motion) =====
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const st=document.createElement('style');
  st.textContent=`
  body{transition:background-color .45s ease,color .45s ease}
  #view.anim>.st>*,#view.anim>.card,#view.anim>.cgrid{animation:mFade .5s cubic-bezier(.2,.7,.2,1) both}
  #view.anim .panel,#view.anim .kpi,#view.anim .st-head{animation:mRise .55s cubic-bezier(.2,.7,.2,1) both}
  #view.anim .kpis .kpi:nth-child(2){animation-delay:.06s}#view.anim .kpis .kpi:nth-child(3){animation-delay:.12s}
  #view.anim .kpis .kpi:nth-child(4){animation-delay:.18s}#view.anim .kpis .kpi:nth-child(5){animation-delay:.24s}
  #view.anim .panel{animation-delay:.08s}#view.anim .panel~.panel{animation-delay:.16s}#view.anim .panel~.panel~.panel{animation-delay:.24s}
  #view.anim .tbl tr{animation:mRow .4s ease both}
  #view.anim .tbl tr:nth-child(2){animation-delay:.12s}#view.anim .tbl tr:nth-child(3){animation-delay:.17s}#view.anim .tbl tr:nth-child(4){animation-delay:.22s}
  #view.anim .tbl tr:nth-child(5){animation-delay:.27s}#view.anim .tbl tr:nth-child(n+6){animation-delay:.32s}
  .btn,.st-tabs button,.acts button,.modebtn{transition:transform .15s ease,box-shadow .2s ease,background-color .2s ease,border-color .2s ease,color .2s ease}
  .btn:hover,.acts button:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.35)}
  .btn:active,.acts button:active,.st-tabs button:active,.modebtn:active{transform:translateY(0) scale(.96);box-shadow:none}
  .st-tabs button:hover{transform:translateY(-1px)}
  .kpi{transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease}
  .kpi.click:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.35)}
  .tbl tr{transition:background-color .18s ease}.tbl tr:hover td{background:rgba(255,255,255,.035)}
  .panel.alert{animation:mGlow 2.8s ease-in-out infinite}
  .st-stat:not(.bad){position:relative}
  .st-stat:not(.bad)::before{content:"";display:inline-block;width:.55em;height:.55em;margin-right:.45em;border-radius:50%;background:#7ee2a1;animation:mPulse 1.8s ease-out infinite;vertical-align:baseline}
  #msg:not(.hide){animation:mToast .4s cubic-bezier(.2,.9,.3,1.2) both}
  #modemenu{animation:mPop .22s cubic-bezier(.2,.9,.3,1.2) both;transform-origin:top right}
  .spin{animation-duration:.8s}
  body.m-er header::after{animation:mLights 6s linear infinite}
  @keyframes mFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes mRise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
  @keyframes mRow{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
  @keyframes mGlow{0%,100%{box-shadow:0 0 0 0 rgba(255,90,90,0)}50%{box-shadow:0 0 18px 0 rgba(255,90,90,.28)}}
  @keyframes mPulse{0%{box-shadow:0 0 0 0 rgba(126,226,161,.7)}100%{box-shadow:0 0 0 .7em rgba(126,226,161,0)}}
  @keyframes mToast{from{opacity:0;transform:translateY(-10px) scale(.97)}to{opacity:1;transform:none}}
  @keyframes mPop{from{opacity:0;transform:translateY(-6px) scale(.95)}to{opacity:1;transform:none}}
  @keyframes mLights{from{background-position:0 0}to{background-position:200px 0}}`;
  document.head.appendChild(st);
  const view=document.getElementById('view');if(!view)return;
  let t=null;
  const countUp=()=>view.querySelectorAll('.kpi .big').forEach(el=>{
    const txt=el.textContent.trim();if(!/^\d{1,6}$/.test(txt)||el.children.length)return;
    const end=+txt,t0=performance.now(),dur=650;if(end<2)return;
    const tick=n=>{const p=Math.min(1,(n-t0)/dur);el.textContent=Math.round(end*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick);else el.textContent=txt};
    el.textContent='0';requestAnimationFrame(tick)});
  const play=()=>{view.classList.add('anim');clearTimeout(t);t=setTimeout(()=>view.classList.remove('anim'),1100);countUp()};
  new MutationObserver(ms=>{
    for(const m of ms){
      const big=m.target===view||m.target.id==='pbody';
      const wasLoading=[...m.removedNodes].some(n=>n.nodeType===1&&(n.classList.contains('loader')||n.querySelector&&n.querySelector('.loader')));
      if((big&&m.addedNodes.length)||(wasLoading&&m.addedNodes.length)){play();break}}
  }).observe(view,{childList:true,subtree:true});
})();

// =====================================================================
// LAW BOT: bottom-left helper. Staff paste the laws as plain text in the Laws tab; the bot searches that text
// (keyword matching, not an AI: it only knows what staff wrote)
// =====================================================================
let LAWS=null,LAWT=0,LAWTEXT='';
const LSTOP=new Set('a an the is are was be been am it its in on at to of for and or but if so do does did can could should would may might will shall i me my we our you your they them their he she his her this that these those there here with without about what whats how when where why who whom any anyone someone legal illegal allowed allow ok okay permitted permit law laws rule rules able get have has had just really very much many some go going'.split(' '));
const lstem=w=>{const r=w.replace(/(ing|es|ed|s)$/,'');return r.length>=4?r:w};
const ltok=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w&&!LSTOP.has(w)&&w.length>1).map(lstem);
function lawVerdict(t){
  t=t.toLowerCase();
  if(/\bnot (illegal|prohibited|banned|forbidden)\b|\b(is|are) legal\b|\blegal to\b/.test(t))return'legal';
  if(/\b(illegal|unlawful|prohibited|forbidden|banned|not (legal|allowed|permitted|ok)|no\b.{0,25}\ballowed|never)\b|\bfine[ds]?\b|\bjail\b|\barrest/.test(t))return'illegal';
  if(/\b(permit|permits|license|licence|licensed|only if|unless|must|required|requires|approval|except)\b/.test(t))return'restricted';
  if(/\b(legal|allowed|permitted|lawful|ok|okay)\b/.test(t))return'legal';
  return'info';
}
const LVERD={illegal:{t:'Illegal',c:'#ff8a8a',i:'⛔'},legal:{t:'Legal',c:'#7ee2a1',i:'✅'},restricted:{t:'Legal with conditions',c:'#ffb86b',i:'⚠️'},info:{t:'Law',c:'#7aa7ff',i:'⚖️'}};
function parseLaws(text){
  const out=[];let head='';
  String(text||'').split(/\r?\n/).forEach(raw=>{
    let l=raw.trim();if(!l)return;
    const isHead=/^#+\s/.test(l)||(/:$/.test(l)&&l.length<60)||(l===l.toUpperCase()&&/[A-Z]/.test(l)&&l.length<60);
    if(isHead){head=l.replace(/^#+\s*/,'').replace(/:$/,'');return}
    l=l.replace(/^[-*•]\s*|^\d+[.)]\s*/,'');
    if(l.length>1)out.push({head,text:l});
  });
  return out;
}
async function loadLaws(force){
  if(LAWS&&!force&&Date.now()-LAWT<60000)return LAWS;
  const d=await db.collection('laws').doc('main').get();
  LAWTEXT=d.exists?String(d.data().text||''):'';LAWS=parseLaws(LAWTEXT);LAWT=Date.now();return LAWS;
}
function lawAnswer(question,laws){
  const t=question.toLowerCase();
  if(!laws.length)return{html:'<p style="margin:0">No laws have been added yet. Ask a staff member on Discord.</p>'};
  if(/\b(list|all|every|show)\b.*\blaws?\b|\bwhat laws\b|\bwhich laws\b/.test(t))
    return{html:'<p style="margin:0 0 .4em"><b>Laws I know about:</b></p><ul style="margin:0;padding-left:1.1em">'+laws.slice(0,25).map(l=>`<li>${esc(l.text.slice(0,110))}</li>`).join('')+'</ul>'+(laws.length>25?`<p class="mu" style="margin:.4em 0 0">…and ${laws.length-25} more. Ask about a specific thing.</p>`:'')};
  const q=[...new Set(ltok(question))];if(!q.length)return{html:'<p style="margin:0">Ask me about an action, like <i>"Is speeding illegal?"</i> or <i>"Can I carry a weapon?"</i></p>'};
  const need=Math.max(1,Math.ceil(q.length*.5));
  const ranked=laws.map(l=>{const set=new Set(ltok(l.head+' '+l.text));let s=0;q.forEach(w=>{if(set.has(w))s++});return{l,s}}).filter(x=>x.s>=need).sort((a,b)=>b.s-a.s);
  if(!ranked.length)return{html:'<p style="margin:0">I could not find a law that covers that. Try different words, type <b>list laws</b>, or ask a staff member on Discord.</p>'};
  const hits=ranked.filter(x=>x.s>=ranked[0].s).slice(0,3);
  return{html:hits.map(({l})=>{const v=LVERD[lawVerdict(l.head+' '+l.text)];
    return `<div style="border-left:3px solid ${v.c};padding:.1em 0 .1em .7em;margin:0 0 .8em"><div style="font-weight:700">${v.i} ${esc(v.t)}</div>${l.head?`<div class="mu" style="font-size:.85em">${esc(l.head)}</div>`:''}<div style="margin:.3em 0">${esc(l.text.slice(0,400))}</div></div>`}).join('')+'<p class="mu" style="margin:0;font-size:.8em">This is only a guide based on the laws staff have written down. Staff and police make the final call.</p>'};
}
function initLawBot(){
  if(document.getElementById('lawbot')||BANNED)return;
  const st=document.createElement('style');
  st.textContent=`
  #lawbtn{position:fixed;left:16px;bottom:16px;z-index:900;display:flex;align-items:center;gap:8px;background:var(--red,#e11d2e);color:#fff;border:0;border-radius:999px;padding:11px 16px;font-weight:700;font-size:.92rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);font-family:inherit;transition:transform .15s ease,box-shadow .2s ease}
  #lawbtn:hover{transform:translateY(-2px)}#lawbtn:active{transform:scale(.96)}
  body.m-staff #lawbtn{background:#2c58b0}body.m-er #lawbtn{background:#c81e1e}
  #lawbox{position:fixed;left:16px;bottom:70px;z-index:900;width:min(370px,calc(100vw - 32px));height:min(520px,calc(100vh - 110px));display:none;flex-direction:column;background:var(--panel,#16305f);border:1px solid var(--bd,#2d4f94);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.6);overflow:hidden}
  #lawbox.open{display:flex;animation:lbIn .25s cubic-bezier(.2,.9,.3,1.1) both;transform-origin:bottom left}
  #lawbox .lh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--bd,#2d4f94);font-weight:700}
  #lawbox .lh button{background:none;border:0;color:var(--mu,#9fb0d0);font-size:1.3rem;cursor:pointer;line-height:1}
  #lawlog{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:.9rem}
  #lawlog .bm{max-width:92%;padding:9px 12px;border-radius:12px;animation:lbMsg .25s ease both}
  #lawlog .bm.bot{background:rgba(255,255,255,.06);align-self:flex-start;border-bottom-left-radius:4px}
  #lawlog .bm.me{background:var(--red,#e11d2e);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  #lawchips{display:flex;gap:6px;flex-wrap:wrap;padding:0 14px 8px}
  #lawchips button{background:rgba(255,255,255,.07);border:1px solid var(--bd,#2d4f94);color:inherit;border-radius:999px;padding:5px 10px;font-size:.78rem;cursor:pointer;font-family:inherit}
  #lawchips button:hover{background:rgba(255,255,255,.14)}
  #lawform{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--bd,#2d4f94)}
  #lawform input{flex:1;min-width:0}
  @keyframes lbIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
  @keyframes lbMsg{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){#lawbox.open,#lawlog .bm{animation:none}}`;
  document.head.appendChild(st);
  const w=document.createElement('div');w.id='lawbot';
  w.innerHTML=`<button id="lawbtn" aria-label="Open the Law Bot" aria-expanded="false"><span aria-hidden="true">⚖️</span><span>Law Bot</span></button>
   <div id="lawbox" role="dialog" aria-label="Law Bot"><div class="lh"><span>⚖️ Law Bot</span><button type="button" id="lawx" aria-label="Close">&times;</button></div>
   <div id="lawlog" aria-live="polite"></div><div id="lawchips"><button type="button">List laws</button></div>
   <form id="lawform"><input id="lawq" maxlength="200" placeholder="Is it legal to&hellip;?" autocomplete="off"><button class="btn" type="submit">Ask</button></form></div>`;
  document.body.appendChild(w);
  const log=w.querySelector('#lawlog'),box=w.querySelector('#lawbox'),btn=w.querySelector('#lawbtn'),inp=w.querySelector('#lawq');
  const add=(cls,html)=>{const d=document.createElement('div');d.className='bm '+cls;d.innerHTML=html;log.appendChild(d);log.scrollTop=log.scrollHeight;return d};
  let started=false;
  const toggle=on=>{box.classList.toggle('open',on);btn.setAttribute('aria-expanded',on);
    if(on&&!started){started=true;add('bot','Hi! I know the laws of the Republic of Stilton that staff have written down. Ask me if something is legal, like <i>"Can I speed?"</i>')}
    if(on)setTimeout(()=>inp.focus(),50)};
  async function ask(text){
    text=String(text||'').trim().slice(0,200);if(!text)return;
    add('me',esc(text));inp.value='';const th=add('bot','<span class="mu">Checking the laws&hellip;</span>');
    try{const ls=await loadLaws(true);th.innerHTML=lawAnswer(text,ls).html}
    catch(e){th.innerHTML='<span class="mu">I could not load the laws right now'+(e&&e.code==='permission-denied'?' (staff need to publish the newest rules)':'')+'.</span>'}
    log.scrollTop=log.scrollHeight}
  w.querySelectorAll('#lawchips button').forEach(b=>b.onclick=()=>ask(b.textContent));
  btn.onclick=()=>toggle(!box.classList.contains('open'));w.querySelector('#lawx').onclick=()=>toggle(false);
  w.querySelector('#lawform').onsubmit=e=>{e.preventDefault();ask(inp.value)};
  addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('open'))toggle(false)});
}

// ---------- staff: Laws tab (one big text box) ----------
function lawsPanel(text,meta){
  return `<div class="panel"><h3>Laws (for the Law Bot)</h3><p class="sub">Copy and paste all of your laws here, in any format. The Law Bot (bottom-left of the site) reads this text and answers civilians. Tips: put <b>one law per line</b>, and say clearly if something is <i>illegal</i>, <i>allowed</i> or needs a <i>permit</i>. A line ending in a colon, like <i>Traffic laws:</i>, works as a heading. Uses the staff PIN at the top right.</p>
    <textarea id="lw_text" rows="18" maxlength="20000" style="width:100%;min-height:300px;font-family:inherit" placeholder="Traffic laws:&#10;Speeding more than 20 over the limit is illegal. Fine of 500 SB.&#10;Driving without an active license is not allowed.&#10;&#10;Weapons:&#10;Carrying a weapon is allowed only with a weapons permit.">${esc(text||'')}</textarea>
    <p><button class="btn" onclick="saveLaws()">Save laws</button> <span class="mu">${meta&&meta.updated?'Last saved '+esc(new Date(meta.updated).toLocaleString())+(meta.by_name?' by '+esc(meta.by_name):''):'Nothing saved yet.'}</span></p></div>`;
}
async function saveLaws(){
  const text=($('#lw_text').value||'').slice(0,20000);
  try{await staffWrite('n_main',b=>b.set(db.collection('laws').doc('main'),{text,by_name:S.user.name.slice(0,80),updated:Date.now()}));
    LAWS=null;say('Laws saved. The Law Bot knows them now.');mod()}catch(e){say(e.message||fe(e))}
}

// staff review links in Staff mode open the normal Chain Servers page (Staff mode only has Console + Terms)
function openChains(){MODE='std';try{localStorage.setItem('ros_mode','std')}catch{}tab='chains';draft.tab='chains';say('');render();scrollTo(0,0)}

init();
