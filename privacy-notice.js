/* ROS Website - privacy notice, cookie banner and visitor IP log.
 * Load AFTER app.js:  <script src="privacy-notice.js?v=5"></script>
 *
 * - Shows a cookie / privacy banner until the visitor clicks "Got it".
 * - A small "Privacy" button (bottom-left) reopens the full disclaimer at any time.
 * - Records each browser's public IP in Firestore (visits/<ip>) at most once per day,
 *   with the logged-in Discord name/id if there is one. Only you can read it, in the
 *   Firebase console (Firestore > visits). The website itself cannot read it back.
 */
(function () {
  "use strict";

  const SITE = "Stilton County";
  const CONSENT_KEY = "ros_privacy_ok_v2";   // changed so everyone sees the updated notice once
  const LOGGED_KEY = "ros_ip_logged_day";
  const SECURITY_KEY = "ros_security_update_2026_11";   // change to show a new security bar
  const CONTACT = "a staff member on our Discord";

  // ---------------- storage helpers (never throw) ----------------
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  // ---------------- styles ----------------
  const css = document.createElement("style");
  css.textContent = `
  .rpn-bar{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:760px;margin:0 auto;
    background:var(--panel,#0f2347);color:var(--tx,#eef3fb);border:1px solid var(--bd,#24407a);
    border-radius:12px;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:14px;line-height:1.5}
  .rpn-bar p{margin:0 0 12px}
  .rpn-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
  .rpn-btn{border:0;border-radius:8px;padding:8px 16px;font:inherit;font-weight:600;cursor:pointer}
  .rpn-ok{background:var(--blue,#2f5bd1);color:#fff}
  .rpn-more{background:transparent;color:var(--tx,#eef3fb);border:1px solid var(--bd,#24407a)}
  .rpn-pill{position:fixed;left:12px;bottom:12px;z-index:9998;background:var(--panel,#0f2347);
    color:var(--mu,#9db0d0);border:1px solid var(--bd,#24407a);border-radius:999px;padding:4px 12px;
    font-size:12px;cursor:pointer}
  .rpn-pill:hover{color:var(--tx,#eef3fb)}
  .rpn-shade{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;
    align-items:center;justify-content:center;padding:16px}
  .rpn-modal{background:var(--panel,#0f2347);color:var(--tx,#eef3fb);border:1px solid var(--bd,#24407a);
    border-radius:12px;max-width:620px;max-height:85vh;overflow:auto;padding:22px 24px;font-size:14px;line-height:1.55}
  .rpn-modal h2{margin:0 0 10px;font-size:20px}
  .rpn-modal h3{margin:16px 0 6px;font-size:15px}
  .rpn-modal ul{margin:0;padding-left:20px}
  .rpn-modal p{margin:0 0 8px}
  .rpn-sec{display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;
    background:linear-gradient(90deg,#14532d,#166534);color:#ecfdf5;border-bottom:1px solid #22c55e;
    padding:9px 44px 9px 16px;font-size:14px;line-height:1.4;position:relative;text-align:center}
  .rpn-sec b{color:#fff}
  .rpn-sec a{color:#bbf7d0;font-weight:600;text-decoration:underline;cursor:pointer}
  .rpn-sec-x{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:0;
    color:#d1fae5;font-size:20px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px}
  .rpn-sec-x:hover{background:rgba(255,255,255,.12)}`;
  document.head.appendChild(css);

  // ---------------- disclaimer text ----------------
  const DETAILS = `
    <h2>Privacy &amp; cookies</h2>
    <h3>&#128274; Security update (November 2026)</h3>
    <p>After a denial-of-service attack on November 16, we strengthened the site's protections: our database now
       rejects malformed or tampered data, ban records can no longer be erased, and we keep a security log of
       visitor IP addresses to spot attacks and enforce bans. No action is needed from you.</p>

    <p>${SITE} is a fan-run roleplay community. It is not affiliated with any real government,
       police force or emergency service, or with the makers of Brick Rigs.</p>

    <h3>What we record</h3>
    <p>Like most websites, we keep a security log of visitors' public IP addresses, whether or not you are logged in.</p>
    <ul>
      <li><b>Your public IP address</b> and how many days you have visited.</li>
      <li>Your Discord name and ID, if you are logged in.</li>
      <li>Your browser type (for example "Chrome on Windows") and when you last visited.</li>
    </ul>

    <h3>Why</h3>
    <p>To protect the site from attacks and abuse, and to enforce bans. We do not sell it,
       share it for advertising, or use it for anything else.</p>

    <h3>Who can see it</h3>
    <p>Only the site owner, through the site's Google Firebase account. To find your IP address,
       your browser asks the free service ipify.org, which also sees your IP when it answers.</p>

    <h3>Cookies and storage</h3>
    <p>We use your browser's storage only for things the site needs to work: keeping you logged in
       (Firebase / Discord login), remembering your settings, and remembering that you closed this notice.
       There are no advertising or tracking cookies.</p>

    <h3>How long we keep it</h3>
    <p>IP records are kept for up to 90 days, or longer if they are tied to a ban or an investigation of an attack.</p>

    <h3>Questions or removal</h3>
    <p>Contact ${CONTACT} to ask what we hold about you or to have it removed.</p>

    <div class="rpn-row" style="margin-top:16px"><button class="rpn-btn rpn-ok" data-close>Close</button></div>`;

  function openDetails() {
    const shade = document.createElement("div");
    shade.className = "rpn-shade";
    shade.innerHTML = `<div class="rpn-modal" role="dialog" aria-modal="true" aria-label="Privacy and cookies">${DETAILS}</div>`;
    const close = () => shade.remove();
    shade.addEventListener("click", (e) => { if (e.target === shade || e.target.hasAttribute("data-close")) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    document.body.appendChild(shade);
  }

  function showPill() {
    if (document.querySelector(".rpn-pill")) return;
    const pill = document.createElement("button");
    pill.className = "rpn-pill";
    pill.textContent = "Privacy";
    pill.onclick = openDetails;
    document.body.appendChild(pill);
  }

  function showBanner() {
    const bar = document.createElement("div");
    bar.className = "rpn-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Privacy notice");
    bar.innerHTML = `
      <p><b>Keeping the site safe.</b> Like most websites, we keep a security log of visitor IP addresses
         (and Discord names when you're logged in) so we can stop attacks and enforce bans. We also use cookies
         to keep you signed in. By using the site, you agree to this.</p>
      <div class="rpn-row">
        <button class="rpn-btn rpn-more" data-more>Read more</button>
        <button class="rpn-btn rpn-ok" data-ok>Got it</button>
      </div>`;
    bar.querySelector("[data-more]").onclick = openDetails;
    bar.querySelector("[data-ok]").onclick = () => {
      store.set(CONSENT_KEY, String(Date.now()));
      bar.remove();
      showPill();
    };
    document.body.appendChild(bar);
  }

  // ---------------- "Security update!" bar at the top of every page ----------------
  function showSecurityBar() {
    if (store.get(SECURITY_KEY) || document.querySelector(".rpn-sec")) return;
    const bar = document.createElement("div");
    bar.className = "rpn-sec";
    bar.setAttribute("role", "status");
    bar.innerHTML = `
      <span>&#128274; <b>Security update!</b> We've strengthened the site's protections to keep your accounts and the community safe.</span>
      <a data-more>Learn more</a>
      <button class="rpn-sec-x" aria-label="Dismiss security update" data-x>&times;</button>`;
    bar.querySelector("[data-more]").onclick = openDetails;
    bar.querySelector("[data-x]").onclick = () => { store.set(SECURITY_KEY, "1"); bar.remove(); };
    document.body.prepend(bar);
  }

  // ---------------- IP log ----------------
  function currentUser() {
    try {
      if (typeof S !== "undefined" && S && S.user) {
        const id = String(S.user.id || S.user.discordId || "");
        return {
          name: String(S.user.name || "").slice(0, 80),
          discordId: /^[0-9]{15,25}$/.test(id) ? id : "",
        };
      }
    } catch (e) { /* ignore */ }
    return { name: "", discordId: "" };
  }

  async function logVisit() {
    const today = new Date().toISOString().slice(0, 10);
    if (store.get(LOGGED_KEY) === today) return;           // once per browser per day: keeps Firestore usage tiny
    if (typeof db === "undefined" || typeof firebase === "undefined") return;
    try {
      const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      const ip = String((await res.json()).ip || "");
      if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return;
      const u = currentUser();
      const FV = firebase.firestore.FieldValue;
      await db.collection("visits").doc(ip.replace(/[.:]/g, "_")).set({
        ip,
        name: u.name,
        discordId: u.discordId,
        ua: navigator.userAgent.slice(0, 200),
        lastSeen: FV.serverTimestamp(),
        count: FV.increment(1),
      }, { merge: true });
      store.set(LOGGED_KEY, today);
    } catch (e) { /* lookup blocked (ad blocker) or quota out: try again next visit */ }
  }

  // ---------------- start ----------------
  function start() {
    showSecurityBar();
    if (store.get(CONSENT_KEY)) showPill(); else showBanner();
    // Wait a few seconds so a logged-in user's Discord name is known before recording.
    setTimeout(logVisit, 8000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
