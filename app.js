// ===== CONFIG =====
const CFG={DISCORD_CLIENT_ID:'1542247332899455006',GUILD_ID:'1462548365907722252',POLICE_ROLE_ID:'1554679644102332506',STAFF_ROLE_ID:'1554679627342159922',JOIN_URL:''}; // JOIN_URL = your main Discord invite link (optional)
// Firebase web config (public by design; access is controlled by Firestore rules)
firebase.initializeApp({apiKey:"AIzaSyAtjPX7727zNlvBh85jzTeAqPs5LfvuYr0",authDomain:"rossite.firebaseapp.com",projectId:"rossite",storageBucket:"rossite.firebasestorage.app",messagingSenderId:"812413188846",appId:"1:812413188846:web:a3e3d7e65697ff290c91ff"});
const db=firebase.firestore();
// ==================
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
safeId=s=>/^[A-Za-z0-9_-]+$/.test(String(s??''))?String(s):'';
let S={user:null,staff:false},tab='home',draft={};
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
      draft=JSON.parse(localStorage.getItem('rp_draft_'+u.id)||'{}');
      tab=['home','chains','bank','tickets','terms','mod'].includes(draft.tab)?draft.tab:tab;
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
  setTimeout(()=>{try{if(!BANNED&&!DOWN&&!localStorage.getItem('ros_seen'))startIntro()}catch{}},500);
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
  const tabs=[['home','Home'],['chains','Chain Servers']];
  if(S.user)tabs.push(['bank','Bank'],['tickets','Tickets']);
  tabs.push(['terms','Terms']);
  if(S.staff)tabs.push(['mod','Staff']);
  if(!tabs.some(x=>x[0]==tab))tab='home';
  $('#nav').innerHTML=tabs.map(([k,l])=>`<button data-k="${k}" class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#who').innerHTML=S.user?`<span class="user">${S.user.avatar?`<img src="${esc(S.user.avatar)}">`:''}${esc(S.user.name)}${S.staff?'<span class="badge">Staff</span>':''} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn" href="${loginUrl()}">Log in with Discord</a>`;
  document.body.classList.toggle('wide',tab==='mod');
  ({home,chains,bank,tickets,terms,mod})[tab]();
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
   <p><button class="btn" onclick="go('chains')">Explore Chain Servers</button> <button class="btn s" onclick="startTour()">Take a tour</button> ${safeUrl(CFG.JOIN_URL)?`<a class="btn s" href="${esc(safeUrl(CFG.JOIN_URL))}" target="_blank" rel="noopener noreferrer">Join the Discord</a>`:''}</p></div>

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

let PIN='';const pin=()=>PIN;
// Staff actions are checked by the database rules: the staff PIN must be sent along with the change.
async function staffWrite(id,fn){
  let p=(($('#b_pin')&&$('#b_pin').value)||PIN).trim();
  if(!p)p=(prompt('Staff PIN')||'').trim();
  if(!p)throw new Error('Enter the staff PIN first');
  const ref=db.collection('proofs').doc(id);
  // step 1: check the PIN on its own, so a wrong PIN can be told apart from a blocked change
  try{await ref.set({pin:p})}catch(e){if(e&&e.code==='permission-denied'){PIN='';throw new Error('Staff PIN rejected. Check it and try again.')}throw e}
  await ref.delete().catch(()=>{}); // no leftover proof, so it cannot be reused
  PIN=p;
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
  const down=!!(SITE&&SITE.down);
  const nav=[['over','Overview'],['look','Lookup'],['bank','Bank'],['tix','Tickets'],['bans','Bans'],['adm','Admins'],['site','Site']];
  let adm=[];if(DT==='adm'){try{adm=(await db.collection('admins').get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))}catch(e){say(e&&e.code==='permission-denied'?'Publish the newest rules':fe(e))}}
  let tix=[];if(DT==='tix'){try{await authed();tix=(await db.collection('tickets').orderBy('created','desc').limit(60).get()).docs.map(d=>({id:d.id,...d.data()}))}catch(e){say(e&&e.code==='permission-denied'?'Publish the newest rules':fe(e))}}
  const head=`<div class="st-head"><div class="st-title"><h2>Staff Console</h2><span>Republic of Stilton</span></div>
    <div class="st-tabs">${nav.map(([k,l])=>`<button class="${DT===k?'on':''}" onclick="dashTab('${k}')">${l}${k==='bans'?`<b>${list.length}</b>`:''}</button>`).join('')}</div>
    <div class="st-r"><span class="st-stat ${down?'bad':''}">${down?'Site shut down':'Site operational'}</span><input id="b_pin" type="password" placeholder="Staff PIN" title="Staff PIN, used for every action" name="ros-staff-pin" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" oninput="PIN=this.value.trim()" value="${esc(pin())}"></div></div>`;
  let body='';
  if(DT==='over')body=`<div class="panel" id="health"></div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">Online now</div><div class="big" id="t_online">…</div><div class="mu">logged in right now</div></div>
      <div class="kpi"><div class="lbl">SB in circulation</div><div class="big" id="t_econ">…</div><div class="mu" id="t_econ_s">counting…</div></div>
      <div class="kpi click" onclick="dashTab('bans')"><div class="lbl">Banned</div><div class="big">${list.length}</div><div class="mu">people banned</div></div>
      <div class="kpi click" onclick="go('chains')"><div class="lbl">Chain applications</div><div class="big">${pend}</div><div class="mu">waiting for review</div></div></div>
    <div class="cols">
      <div class="panel"><div class="hl"><h3>Recent activity</h3><span class="mu" style="font-size:.85em">Refreshes every 30 seconds</span></div><p class="sub">Bank activity and bans, newest first.</p><div id="pulse"><div class="loader"><span class="spin"></span><span>Loading…</span></div></div></div>
      <div class="panel"><h3>Actions</h3><p class="sub">Common staff tasks.</p><div class="acts">
        <button onclick="copySite()">Copy site link</button>
        <button onclick="dashTab('site')">${down?'Reopen the site':'Shut the site down'}</button>
        <button onclick="dashTab('bans')">Ban a user</button>
        <button onclick="dashTab('bank')">Give or remove cash</button>
        <button onclick="dashTab('look')">Look up a user</button>
        <button onclick="go('chains')">Review chain applications</button></div></div></div>
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
    const b=document.querySelector('#nav [data-k=tickets]');if(b)b.textContent='Tickets'+(n?' ('+n+')':'')}catch{}
}
async function tickets(){
  if(!S.user)return needLogin();
  $('#view').innerHTML=LOADER(1);let rows=[];
  try{await authed();rows=(await db.collection('tickets').where('to','==',S.user.id).get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))}
  catch(e){$('#view').innerHTML=`<div class="card"><h2>Tickets</h2><p class="mu">${esc(e&&e.code==='permission-denied'?'Publish the newest Firestore rules to use tickets.':(e&&e.message)||'Could not load tickets.')}</p></div>`;return}
  const open=rows.filter(x=>x.status==='unpaid'),done=rows.filter(x=>x.status!=='unpaid');
  $('#view').innerHTML=`<div class="card"><h2>Tickets</h2><p class="mu">Tickets issued to you by staff. Unpaid tickets are paid from your personal bank balance.</p></div>
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
  if(!S.user){$('#view').innerHTML=`<div class="card"><h2>Bank</h2><p class="mu">Log in with Discord to use the bank.</p><a class="btn" href="${loginUrl()}">Log in with Discord</a></div>`;return}
  $('#view').innerHTML=LOADER(1);
  const pid=S.user.id,cid='c_'+pid;let acct=null,comp=null,coLocked=false,state='ok';
  try{await authed();const d=await db.collection('accounts').doc(pid).get();
    if(!d.exists)state='new';else{acct=d.data();if(acct.owner==='')state='claim'}
  }catch(e){if(e&&e.code==='permission-denied')state='locked';else{state='err';say(e.message||fe(e))}}
  if(state!=='ok'){
    const m={new:['Open your bank account','You do not have a bank account yet. It starts at 0 SB.','Open account','openAcct()'],
      claim:['Claim your bank account','An account is waiting for you (staff created or reset it). Claim it on this browser to use it.','Claim account','openAcct(true)'],
      locked:['Account locked to another browser','This bank account is linked to a different browser or device. If that was you (for example you cleared your browser data), ask staff to reset it, then come back and claim it.','',''],
      err:['Bank unavailable','Something went wrong. Reload the page and try again.','','']}[state];
    $('#view').innerHTML=`<div class="card"><h2>${m[0]}</h2><p class="mu">${esc(m[1])}</p>${m[2]?`<button class="btn" onclick="${m[3]}">${m[2]}</button>`:''}</div>`;return}
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
  $('#view').innerHTML=`<div class="card"><h2>${BK==='co'?esc(String(cur.name||'Company')):'Bank'}</h2><p class="mu">StiltonBux (SB) &bull; ${BK==='co'?'Company account of '+esc(S.user.name):esc(S.user.name)}<br>Account ID to give others: <b>${esc(id)}</b></p>${switcher}
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

// ===== first-visit welcome + guided tour =====
(function(){
  const st=document.createElement('style');
  st.textContent=`
  .ov{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(3,8,20,.82);animation:ovIn .3s ease both}
  .ov .card{max-width:520px;width:100%;margin:0;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:ovUp .35s ease both}
  .ov ul{margin:10px 0 16px;padding-left:20px}.ov li{margin:6px 0}
  .ov .acts{display:flex;gap:10px;flex-wrap:wrap}
  .th{position:fixed;z-index:1001;border-radius:10px;pointer-events:none;box-shadow:0 0 0 9999px rgba(3,8,20,.8),0 0 0 2px var(--blue),0 0 24px rgba(47,91,209,.7);transition:all .3s ease}
  .tt{position:fixed;z-index:1002;width:min(340px,calc(100vw - 24px));background:var(--panel);border:1px solid var(--bd);border-top:3px solid var(--red);border-radius:12px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.6);animation:ovUp .3s ease both}
  .tt h3{margin:0 0 6px}.tt p{margin:0 0 12px}.tt .acts{display:flex;gap:8px;align-items:center}.tt .acts .sp{flex:1}.tt .cnt{color:var(--mu);font-size:.8rem}
  .tclick{position:fixed;inset:0;z-index:1000}
  @keyframes ovIn{from{opacity:0}to{opacity:1}}@keyframes ovUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.ov,.ov .card,.tt{animation:none}.th{transition:none}}`;
  document.head.appendChild(st);
  const mark=()=>{try{localStorage.setItem('ros_seen','1')}catch{}};
  let ov=null,hl=null,tip=null,steps=[],i=0,onKey=null,onRs=null;
  const clean=()=>{[ov,hl,tip].forEach(e=>e&&e.remove());ov=hl=tip=null;if(onKey)removeEventListener('keydown',onKey);if(onRs)removeEventListener('resize',onRs);onKey=onRs=null};
  window.startIntro=function(){
    clean();ov=document.createElement('div');ov.className='ov';
    ov.innerHTML=`<div class="card" role="dialog" aria-modal="true" aria-label="Welcome"><div class="kick">|+-+| Republic Of Stilton |+-+|</div><h2>Welcome to the Republic of Stilton</h2>
      <p class="mu">Looks like it's your first time here. This site is the hub for the whole Republic.</p>
      <ul><li>Learn what ROS is and how it works</li><li>Browse every chain server (city) in one place</li><li>Log in with Discord to use the bank, collect income every 3 hours, open a company account and see your tickets</li><li>Apply to list your own chain server</li></ul>
      <div class="acts"><button class="btn" id="i_go">Take the quick tour</button><button class="btn s" id="i_skip">Skip</button></div></div>`;
    document.body.appendChild(ov);
    const done=()=>{mark();clean()};
    ov.querySelector('#i_go').onclick=()=>{mark();clean();startTour()};
    ov.querySelector('#i_skip').onclick=done;
    ov.addEventListener('click',e=>{if(e.target===ov)done()});
    onKey=e=>{if(e.key==='Escape')done()};addEventListener('keydown',onKey);
    ov.querySelector('#i_go').focus();
  };
  const build=()=>{const s=[
    {k:'home',sel:'#nav [data-k=home]',t:'Home',d:'Start here. It explains what the Republic of Stilton is: roleplay, government, the economy and how chain servers fit in.'},
    {k:'chains',sel:'#nav [data-k=chains]',t:'Chain Servers',d:'Every city in the Republic. Open ones show a Join button. If you run a city, log in and apply here, and staff will review it.'},
    {k:'terms',sel:'#nav [data-k=terms]',t:'Terms of Service',d:'The rules for everyone in the community, including international members. Worth a read before you join in.'},
    ...(S.user?[{k:'bank',sel:'#nav [data-k=bank]',t:'Bank',d:'Open your account, then deposit, withdraw and send StiltonBux (SB). Collect free income every 3 hours, and open one company account.'},{k:'tickets',sel:'#nav [data-k=tickets]',t:'Tickets',d:'Tickets issued to you by staff appear here. Pay them from your bank.'}]:[]),
    {k:null,sel:'#who',t:S.user?'Your account':'Log in',d:S.user?'This is you. Your Discord name shows here, and you can log out any time.':'Log in with Discord to prove you are in our server. You need this to apply for a chain server.'}];
    if(S.staff)s.push({k:'mod',sel:'#nav [data-k=mod]',t:'Staff',d:'Staff only. See the site at a glance, manage the bank, ban or unban people and shut the site down. Chain applications are reviewed on the Chain Servers tab.'});
    return s};
  function place(){
    const s=steps[i],el=document.querySelector(s.sel);if(!el)return;
    el.scrollIntoView({block:'nearest',inline:'nearest'});
    const r=el.getBoundingClientRect(),p=6;
    Object.assign(hl.style,{left:r.left-p+'px',top:r.top-p+'px',width:r.width+2*p+'px',height:r.height+2*p+'px'});
    const w=tip.offsetWidth,h=tip.offsetHeight;
    let top=r.bottom+p+12;if(top+h>innerHeight-8)top=Math.max(8,r.top-p-12-h);
    let left=Math.min(Math.max(12,r.left),innerWidth-w-12);
    Object.assign(tip.style,{top:top+'px',left:left+'px'});
  }
  function show(){
    const s=steps[i];if(s.k&&typeof go==='function'){go(s.k);}
    setTimeout(()=>{
      tip.innerHTML=`<h3>${esc(s.t)}</h3><p class="mu">${esc(s.d)}</p><div class="acts"><span class="cnt">${i+1} / ${steps.length}</span><span class="sp"></span>${i?'<button class="btn s" id="t_b">Back</button>':''}<button class="btn" id="t_n">${i==steps.length-1?'Done':'Next'}</button><button class="btn s" id="t_x" aria-label="Close tour">&times;</button></div>`;
      tip.querySelector('#t_n').onclick=()=>{i==steps.length-1?end():(i++,show())};
      const b=tip.querySelector('#t_b');if(b)b.onclick=()=>{i--;show()};
      tip.querySelector('#t_x').onclick=end;
      place();
    },60);
  }
  function end(){clean();go('home');scrollTo(0,0)}
  window.startTour=function(){
    if(BANNED||DOWN)return;clean();mark();steps=build();i=0;
    ov=document.createElement('div');ov.className='tclick';document.body.appendChild(ov);
    hl=document.createElement('div');hl.className='th';document.body.appendChild(hl);
    tip=document.createElement('div');tip.className='tt';tip.setAttribute('role','dialog');document.body.appendChild(tip);
    onKey=e=>{if(e.key==='Escape')end();else if(e.key==='ArrowRight'&&i<steps.length-1){i++;show()}else if(e.key==='ArrowLeft'&&i>0){i--;show()}};addEventListener('keydown',onKey);
    onRs=()=>place();addEventListener('resize',onRs);
    show();
  };
})();
init();
