/* ROS Website - Dedicated Server tab. Load after app.js:  <script src="server-tab.js"></script> */
/*
 * ROS Website - Dedicated Server tab (staff only)
 *
 * Usage (see README for full wiring):
 *   const api = DedicatedServerTab.makeCompatApi(db, "main");               // firebase v8 / compat
 *   // or
 *   const api = DedicatedServerTab.makeModularApi(db, "main", firestoreFns); // firebase v9+ modular
 *   const tab = DedicatedServerTab.mount(containerElement, api, staffDisplayName);
 *   tab.unmount();   // when leaving the tab
 */
(function () {
  "use strict";

  const HEARTBEAT_TIMEOUT_MS = 90 * 1000;

  // ---------------- data adapters ----------------
  function toMs(ts) {
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "number") return ts;
    return null;
  }

  function makeCompatApi(db, serverId) {
    const ref = db.collection("dedicatedServer").doc(serverId);
    const est = { serverTimestamps: "estimate" };
    return {
      watchServer: (cb, err) => ref.onSnapshot((s) => cb(s.exists ? s.data(est) : null), err),
      watchLogs: (cb, err) => ref.collection("logs").orderBy("ts", "desc").limit(150)
        .onSnapshot((q) => cb(q.docs.map((d) => d.data(est))), err),
      watchPending: (cb, err) => ref.collection("commands").where("status", "in", ["pending", "running"])
        .onSnapshot((q) => cb(q.docs.map((d) => ({ id: d.id, ...d.data(est) }))), err),
      sendCommand: (type, by) => ref.collection("commands").add({
        type, by, status: "pending", at: firebase.firestore.FieldValue.serverTimestamp(),
      }),
      saveSettings: (settings) => ref.update({ settings }),
    };
  }

  // fns = { doc, collection, onSnapshot, query, orderBy, limit, where, addDoc, updateDoc, serverTimestamp }
  // Pass in the same functions your app already imports from firebase/firestore.
  function makeModularApi(db, serverId, fns) {
    const ref = fns.doc(db, "dedicatedServer", serverId);
    const est = { serverTimestamps: "estimate" };
    return {
      watchServer: (cb, err) => fns.onSnapshot(ref, (s) => cb(s.exists() ? s.data(est) : null), err),
      watchLogs: (cb, err) => fns.onSnapshot(
        fns.query(fns.collection(ref, "logs"), fns.orderBy("ts", "desc"), fns.limit(150)),
        (q) => cb(q.docs.map((d) => d.data(est))), err),
      watchPending: (cb, err) => fns.onSnapshot(
        fns.query(fns.collection(ref, "commands"), fns.where("status", "in", ["pending", "running"])),
        (q) => cb(q.docs.map((d) => ({ id: d.id, ...d.data(est) }))), err),
      sendCommand: (type, by) => fns.addDoc(fns.collection(ref, "commands"), {
        type, by, status: "pending", at: fns.serverTimestamp(),
      }),
      saveSettings: (settings) => fns.updateDoc(ref, { settings }),
    };
  }

  // ---------------- styles ----------------
  const CSS = `
  .dsv{--dsv-card:var(--panel,#0f2347);--dsv-line:var(--bd,#24407a);
       --dsv-text:var(--tx,#eef3fb);--dsv-dim:var(--mu,#9db0d0);--dsv-accent:var(--blue,#2f5bd1);
       color:var(--dsv-text);display:grid;gap:16px}
  .dsv.dsv-in{animation:dsv-in .25s ease}
  @keyframes dsv-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .dsv h2{margin:0;font-size:22px;letter-spacing:.3px}
  .dsv-sub{color:var(--dsv-dim);font-size:13px;margin-top:4px}
  .dsv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
  .dsv-card{background:var(--dsv-card);border:1px solid var(--dsv-line);border-radius:12px;padding:16px}
  .dsv-card h3{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--dsv-dim)}
  .dsv-state{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:700}
  .dsv-dot{width:12px;height:12px;border-radius:50%;background:#6b7280;flex:none}
  .dsv-dot.running{background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:dsv-pulse 2s infinite}
  .dsv-dot.starting,.dsv-dot.stopping{background:#eab308;animation:dsv-pulse 1s infinite}
  .dsv-dot.frozen{background:#f97316}
  .dsv-dot.offline{background:#ef4444}
  .dsv-dot.agent-offline{background:#6b7280}
  @keyframes dsv-pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.35)}70%{box-shadow:0 0 0 8px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
  .dsv-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin-top:12px;font-size:14px}
  .dsv-kv span:nth-child(odd){color:var(--dsv-dim)}
  .dsv-btns{display:flex;gap:8px;flex-wrap:wrap}
  .dsv-btn{border:1px solid var(--dsv-line);background:var(--panel2,#132b57);color:var(--dsv-text);padding:9px 16px;border-radius:8px;
           font-weight:600;cursor:pointer;transition:transform .1s,background .15s,opacity .15s}
  .dsv-btn:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-1px)}
  .dsv-btn:disabled{opacity:.4;cursor:not-allowed}
  .dsv-btn.go{background:#15803d;border-color:#15803d}.dsv-btn.go:hover:not(:disabled){background:#16a34a}
  .dsv-btn.stop{background:#b91c1c;border-color:#b91c1c}.dsv-btn.stop:hover:not(:disabled){background:#dc2626}
  .dsv-btn.primary{background:var(--dsv-accent);border-color:var(--dsv-accent)}
  .dsv-note{font-size:12px;color:var(--dsv-dim);margin-top:10px;min-height:16px}
  .dsv-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--dsv-line);gap:12px}
  .dsv-row:last-of-type{border-bottom:0}
  .dsv-row small{display:block;color:var(--dsv-dim);font-size:12px;margin-top:2px}
  .dsv-switch{position:relative;width:42px;height:24px;flex:none}
  .dsv-switch input{opacity:0;width:0;height:0}
  .dsv-switch i{position:absolute;inset:0;background:#33415c;border-radius:24px;transition:.2s;cursor:pointer}
  .dsv-switch i:before{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
  .dsv-switch input:checked+i{background:var(--dsv-accent)}
  .dsv-switch input:checked+i:before{transform:translateX(18px)}
  .dsv select{background:#0b1426;color:var(--dsv-text);border:1px solid var(--dsv-line);border-radius:6px;padding:6px 8px}
  .dsv-logs{background:#070d19;border:1px solid var(--dsv-line);border-radius:8px;height:320px;overflow:auto;
            font-family:Consolas,Menlo,monospace;font-size:12.5px;padding:8px 10px}
  .dsv-log{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.03);white-space:pre-wrap;word-break:break-word}
  .dsv-log time{color:var(--dsv-dim);margin-right:8px}
  .dsv-log.warn{color:#fbbf24}.dsv-log.error{color:#f87171}
  .dsv-logbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}
  .dsv-logbar h3{margin:0}
  .dsv-empty{color:var(--dsv-dim);padding:20px;text-align:center}
  `;

  function injectCss() {
    if (document.getElementById("dsv-css")) return;
    const s = document.createElement("style");
    s.id = "dsv-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------------- helpers ----------------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function fmtDuration(ms) {
    if (ms == null || ms < 0) return "-";
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${sec}s`;
    return `${sec}s`;
  }
  function fmtAgo(ms) { return ms == null ? "never" : fmtDuration(Date.now() - ms) + " ago"; }
  function fmtTime(ms) { return ms == null ? "--:--:--" : new Date(ms).toLocaleTimeString(); }
  function hourLabel(h) {
    if (h < 0) return "Off";
    const ampm = h < 12 ? "AM" : "PM", hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:00 ${ampm}`;
  }

  const STATE_LABEL = {
    running: "Running", starting: "Starting", stopping: "Stopping",
    frozen: "Not responding", offline: "Offline", "agent-offline": "Agent offline",
  };

  // ---------------- mount ----------------
  function mount(container, api, staffName) {
    injectCss();
    const hours = [-1].concat([...Array(24).keys()]);
    container.innerHTML = `
      <div class="dsv dsv-in">
        <div>
          <h2>Dedicated Server</h2>
          <div class="dsv-sub">Control the Brick Rigs host PC. Changes reach the server within a few seconds.</div>
        </div>
        <div class="dsv-grid">
          <div class="dsv-card">
            <h3>Status</h3>
            <div class="dsv-state"><span class="dsv-dot" data-dot></span><span data-state>Loading...</span></div>
            <div class="dsv-kv">
              <span>Uptime</span><span data-uptime>-</span>
              <span>Last check-in</span><span data-beat>-</span>
              <span>Watchdog</span><span data-desired>-</span>
              <span>Host PC</span><span data-host>-</span>
            </div>
          </div>
          <div class="dsv-card">
            <h3>Controls</h3>
            <div class="dsv-btns">
              <button class="dsv-btn go" data-cmd="start">Start</button>
              <button class="dsv-btn stop" data-cmd="stop">Stop</button>
              <button class="dsv-btn" data-cmd="restart">Restart</button>
              <button class="dsv-btn" data-cmd="autohost">Run auto-host</button>
            </div>
            <div class="dsv-note" data-cmdnote></div>
          </div>
          <div class="dsv-card">
            <h3>Settings</h3>
            <div class="dsv-row"><div>Auto-restart<small>Relaunch if the game crashes or freezes</small></div>
              <label class="dsv-switch"><input type="checkbox" data-set="autoRestart"><i></i></label></div>
            <div class="dsv-row"><div>Daily restart<small>Host PC local time</small></div>
              <select data-set="dailyRestartHour">${hours.map((h) => `<option value="${h}">${hourLabel(h)}</option>`).join("")}</select></div>
            <div class="dsv-row"><div>Auto-host<small>Click through Host Game after each launch</small></div>
              <label class="dsv-switch"><input type="checkbox" data-set="autoHost"><i></i></label></div>
            <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
              <button class="dsv-btn primary" data-save disabled>Save settings</button>
              <span class="dsv-note" data-setnote style="margin:0"></span>
            </div>
          </div>
        </div>
        <div class="dsv-card">
          <div class="dsv-logbar"><h3>Logs</h3>
            <select data-filter><option value="all">All</option><option value="warn">Warnings + errors</option><option value="error">Errors only</option></select>
          </div>
          <div class="dsv-logs" data-logs><div class="dsv-empty">No logs yet.</div></div>
        </div>
      </div>`;

    const $ = (sel) => container.querySelector(sel);
    const el = {
      dot: $("[data-dot]"), state: $("[data-state]"), uptime: $("[data-uptime]"), beat: $("[data-beat]"),
      desired: $("[data-desired]"), host: $("[data-host]"), cmdNote: $("[data-cmdnote]"),
      save: $("[data-save]"), setNote: $("[data-setnote]"), logs: $("[data-logs]"), filter: $("[data-filter]"),
      autoRestart: $('[data-set="autoRestart"]'), dailyRestartHour: $('[data-set="dailyRestartHour"]'),
      autoHost: $('[data-set="autoHost"]'),
    };

    let server = null, logs = [], pending = [], settingsDirty = false;

    function effectiveState() {
      if (!server || !server.status) return "agent-offline";
      const beat = toMs(server.status.lastHeartbeat);
      if (!beat || Date.now() - beat > HEARTBEAT_TIMEOUT_MS) return "agent-offline";
      return server.status.state || "offline";
    }

    function renderStatus() {
      const st = effectiveState();
      const s = (server && server.status) || {};
      el.dot.className = "dsv-dot " + st;
      el.state.textContent = STATE_LABEL[st] || st;
      const started = toMs(s.startedAt);
      el.uptime.textContent = (st === "running" || st === "frozen") && started ? fmtDuration(Date.now() - started) : "-";
      el.beat.textContent = fmtAgo(toMs(s.lastHeartbeat));
      el.desired.textContent = s.desiredRunning === false ? "Paused (stopped by staff)" : "Keeping server up";
      el.host.textContent = s.host ? `${s.host} (agent ${s.agentVersion || "?"})` : "-";

      const agentUp = st !== "agent-offline";
      const busy = pending.length > 0 || st === "starting" || st === "stopping";
      const up = st === "running" || st === "frozen";
      container.querySelectorAll("[data-cmd]").forEach((b) => {
        const c = b.dataset.cmd;
        let ok = agentUp && !busy;
        if (c === "start") ok = ok && !up;
        if (c === "stop" || c === "restart" || c === "autohost") ok = ok && up;
        b.disabled = !ok;
      });
      if (!agentUp) el.cmdNote.textContent = "The agent on the host PC is not connected. Run start-agent.bat on that PC.";
      else if (pending.length) el.cmdNote.textContent = `Working: ${pending.map((p) => `${p.type} (by ${p.by || "staff"})`).join(", ")}`;
      else if (!el.cmdNote.dataset.keep) el.cmdNote.textContent = "";
    }

    function renderSettings() {
      if (settingsDirty || !server) return;
      const set = server.settings || {};
      el.autoRestart.checked = set.autoRestart !== false;
      el.dailyRestartHour.value = String(set.dailyRestartHour == null ? 5 : set.dailyRestartHour);
      el.autoHost.checked = !!set.autoHost;
    }

    function renderLogs() {
      const f = el.filter.value;
      const list = logs.filter((l) => f === "all" || (f === "warn" ? l.level === "warn" || l.level === "error" : l.level === "error"));
      el.logs.innerHTML = list.length
        ? list.map((l) => `<div class="dsv-log ${esc(l.level)}"><time>${fmtTime(toMs(l.ts))}</time>${esc(l.msg)}</div>`).join("")
        : `<div class="dsv-empty">No logs yet.</div>`;
    }

    // command buttons
    const CONFIRM = {
      stop: "Stop the server? Everyone in the match will be disconnected, and auto-restart will stay paused until someone presses Start.",
      restart: "Restart the server? Everyone in the match will be disconnected.",
    };
    container.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", async () => {
      const c = b.dataset.cmd;
      if (CONFIRM[c] && !confirm(CONFIRM[c])) return;
      b.disabled = true;
      try {
        await api.sendCommand(c, staffName || "staff");
        el.cmdNote.textContent = `Sent ${c}. Waiting for the host PC...`;
      } catch (e) {
        el.cmdNote.textContent = `Could not send ${c}: ${e.message}`;
      }
    }));

    // settings
    const markDirty = () => { settingsDirty = true; el.save.disabled = false; el.setNote.textContent = "Unsaved changes"; };
    [el.autoRestart, el.dailyRestartHour, el.autoHost].forEach((i) => i.addEventListener("change", markDirty));
    el.save.addEventListener("click", async () => {
      el.save.disabled = true;
      try {
        await api.saveSettings({
          autoRestart: el.autoRestart.checked,
          dailyRestartHour: parseInt(el.dailyRestartHour.value, 10),
          autoHost: el.autoHost.checked,
        });
        settingsDirty = false;
        el.setNote.textContent = "Saved";
        setTimeout(() => { if (!settingsDirty) el.setNote.textContent = ""; }, 2000);
      } catch (e) {
        el.save.disabled = false;
        el.setNote.textContent = "Save failed: " + e.message;
      }
    });

    el.filter.addEventListener("change", renderLogs);

    const onErr = (e) => { el.cmdNote.textContent = "Database error: " + e.message; };
    const unsubs = [
      api.watchServer((d) => { server = d; renderStatus(); renderSettings(); }, onErr),
      api.watchLogs((l) => { logs = l; renderLogs(); }, onErr),
      api.watchPending((p) => { pending = p; renderStatus(); }, onErr),
    ];
    const timer = setInterval(renderStatus, 1000);
    setTimeout(() => { const r = container.querySelector(".dsv"); r && r.classList.remove("dsv-in"); }, 400);

    return {
      unmount() {
        clearInterval(timer);
        unsubs.forEach((u) => typeof u === "function" && u());
        container.innerHTML = "";
      },
    };
  }

  window.DedicatedServerTab = { mount, makeCompatApi, makeModularApi };
})();

/* ===== Hook: adds a "Server" tab to Staff mode (next to Console) =====
 * Must load AFTER app.js. Uses app.js globals: render, staffWrite, db, S, MODE, tab, say, BANNED, DOWN.
 */
(function () {
  "use strict";
  if (typeof render !== "function" || typeof staffWrite !== "function" || typeof db === "undefined") {
    console.warn("[server-tab] app.js must be loaded before server-tab.js");
    return;
  }
  const SERVER_ID = "main";
  let open = false;   // is the Server tab showing
  let host = null;    // kept alive between app re-renders so listeners don't restart
  let inst = null;

  function rosApi() {
    const ref = db.collection("dedicatedServer").doc(SERVER_ID);
    const base = DedicatedServerTab.makeCompatApi(db, SERVER_ID);
    return Object.assign({}, base, {
      // Staff-PIN protected writes, same as the rest of the Staff console
      sendCommand: (type, by) => {
        const c = ref.collection("commands").doc();
        return staffWrite("x_" + c.id, (b) => b.set(c, {
          type, by, status: "pending", at: firebase.firestore.FieldValue.serverTimestamp(),
        }));
      },
      saveSettings: (settings) => staffWrite("xs_" + SERVER_ID, (b) => b.set(ref, { settings }, { merge: true })),
    });
  }

  function closeTab() {
    open = false;
    if (inst) { inst.unmount(); inst = null; host = null; }
  }

  const origRender = render;
  window.render = function () {
    const isStaffMode = MODE === "staff" && S && S.staff;
    if (open && !isStaffMode) closeTab();
    if (open) tab = "terms";            // draw a light page underneath, then swap the view
    origRender.apply(this, arguments);
    if (!(MODE === "staff" && S && S.staff)) { if (open) closeTab(); return; }

    const nav = document.getElementById("nav");
    if (!nav) return;
    const btn = document.createElement("button");
    btn.dataset.k = "server";
    btn.textContent = "Server";
    btn.onclick = () => {
      if ((typeof BANNED !== "undefined" && BANNED) || (typeof DOWN !== "undefined" && DOWN)) return;
      open = true;
      if (typeof say === "function") say("");
      window.render();
    };
    const consoleBtn = nav.querySelector('[data-k="mod"]');
    if (consoleBtn) consoleBtn.after(btn); else nav.appendChild(btn);

    if (open) {
      nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
      document.body.classList.add("wide");
      const view = document.getElementById("view");
      if (!inst) {
        host = document.createElement("div");
        inst = DedicatedServerTab.mount(host, rosApi(), (S.user && S.user.name) || "staff");
      }
      view.innerHTML = "";
      view.appendChild(host);
    }
  };

  // The Staff Console loads its data after a delay and then redraws #view even if you've
  // already switched away. If that happens while the Server tab is open, put the tab back.
  const viewEl = document.getElementById("view");
  if (viewEl) {
    new MutationObserver(() => {
      if (open && host && !viewEl.contains(host)) {
        viewEl.innerHTML = "";
        viewEl.appendChild(host);
      }
    }).observe(viewEl, { childList: true });
  }

  // Clicking any other nav button (Console, Terms) leaves the Server tab
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("#nav button");
    if (b && b.dataset.k !== "server" && open) closeTab();
  }, true);
})();
