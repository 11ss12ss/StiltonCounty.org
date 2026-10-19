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
  BANNED=true;
  $('#nav').innerHTML='';$('#who').innerHTML='';
  $('#view').innerHTML=`<div class="card hero"><div class="kick">ACCESS DENIED</div><h2>You are banned</h2>
    <p>You have been banned from the Republic of Stilton website.</p>
    ${b&&b.reason?`<p class="mu">Reason: ${esc(b.reason)}</p>`:''}
    <p class="mu">Using another account or browser to get around a ban is against the Terms of Service (Section 3, Ban Evasion).</p>
    <p class="mu">If you think this is a mistake, contact the staff team on Discord.</p></div>`;
}
let DEV=null,BANNED=false;
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
  watchBan(u&&u.id);
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
  const tabs=[['home','Home'],['chains','Chain Servers'],['terms','Terms']];
  if(S.staff)tabs.push(['mod','Moderation']);
  if(!tabs.some(x=>x[0]==tab))tab='home';
  $('#nav').innerHTML=tabs.map(([k,l])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#who').innerHTML=S.user?`<span class="user">${S.user.avatar?`<img src="${esc(S.user.avatar)}">`:''}${esc(S.user.name)}${S.staff?'<span class="badge">Staff</span>':''} <button class="btn s" onclick="logout()">Log out</button></span>`:`<a class="btn" href="${loginUrl()}">Log in with Discord</a>`;
  ({home,chains,terms,mod})[tab]();
}
const go=k=>{if(BANNED)return;tab=k;draft.tab=k;say('');render()};
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
