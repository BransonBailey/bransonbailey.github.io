/* Easter egg: press ` to open a small shell. Output is built with textContent only (no innerHTML).
   Achievements are stored in this browser's localStorage only; nothing is sent anywhere. */
(function () {
  "use strict";

  var PROJECTS = [
    ["aegis/", "Privacy-first personal AI assistant (in development)"],
    ["graylog-auto-installer/", "One-shot Graylog SIEM deployment script"],
    ["anti-forensics-research/", "Go tool for studying anti-forensic techniques"],
    ["security-onion-lab/", "Security Onion home lab"],
    ["lab-server-firewall/", "Lab server and firewall build"]
  ];
  var LINKEDIN = "https://www.linkedin.com/in/branson-bailey/";
  var EMAIL = "bransonbailey1@gmail.com";
  var SELF = document.currentScript && document.currentScript.src;
  var RESUME = SELF ? new URL("Bailey_Resume.pdf", SELF).href : "Bailey_Resume.pdf";

  var root, out, input, lastFocus, hist = [], hpos = 0, busy = false, reopenNext = false;

  // ---------- achievements (localStorage only) ----------
  var ACH = [
    ["shell", "Found the shell", "Open the terminal"],
    ["tour", "Grand tour", "Visit all four pages"],
    ["hire", "Root access", "Run sudo hire branson"],
    ["lost", "Game over", "Find a page that doesn't exist"],
    ["snake", "Snake charmer", "Score 10 in snake"]
  ];
  var AKEY = "bb-achievements", PKEY = "bb-pages-v2", PAGES = ["home", "about", "projects", "ncl"];
  var TROPHY = "M2 1h12v1h-12zM0 2h16v1h-16zM0 3h1v1h-1zM2 3h12v1h-12zM15 3h1v1h-1zM0 4h1v1h-1zM2 4h12v1h-12zM15 4h1v1h-1zM1 5h1v1h-1zM3 5h10v1h-10zM14 5h1v1h-1zM2 6h12v1h-12zM4 7h8v1h-8zM5 8h6v1h-6zM6 9h4v1h-4zM7 10h2v1h-2zM7 11h2v1h-2zM5 12h6v1h-6zM4 13h8v1h-8zM4 14h8v1h-8z";

  // Storage can be blocked (sandboxed previews, strict privacy modes). Fall back to memory so
  // progress at least survives for the life of the page instead of resetting on every read.
  function store(kind) {
    try { var s = window[kind], k = "__bb"; s.setItem(k, k); s.removeItem(k); return s; } catch (e) { return null; }
  }
  var LS = store("localStorage"), SS = store("sessionStorage"), MEM = {};
  function load(k, s) {
    s = s || LS;
    if (s) { try { return JSON.parse(s.getItem(k)) || {}; } catch (e) {} }
    return MEM[k] ? JSON.parse(MEM[k]) : {};
  }
  function save(k, v, s) {
    s = s || LS;
    MEM[k] = JSON.stringify(v);
    if (s) { try { s.setItem(k, MEM[k]); } catch (e) {} }
  }
  function achName(id) { for (var i = 0; i < ACH.length; i++) if (ACH[i][0] === id) return ACH[i][1]; return id; }


  // ---------- 8-bit sound (Web Audio square waves; no audio files) ----------
  // On by default, but browsers only allow audio after the visitor clicks or types, so nothing
  // plays on page load. The mute choice is stored in this browser only.
  var MKEY = "bb-sound", AC = window.AudioContext || window.webkitAudioContext, actx = null, master = null;
  function soundOn() { return !load(MKEY).off; }
  function setSound(on) { save(MKEY, { off: !on, ts: Date.now() }); paintSnd(); if (on) sfx("on"); }
  function audio() {
    if (!AC || !soundOn()) return null;
    if (!actx) {
      try { actx = new AC(); master = actx.createGain(); master.gain.value = 0.05; master.connect(actx.destination); }
      catch (e) { AC = null; return null; }
    }
    return actx;
  }
  // Wake the audio engine on the visitor's first press/key on each page, so the sound for
  // that same click is audible. Before any interaction the browser may keep audio locked;
  // sounds asked for then are dropped rather than saved up and played on a later click.
  function prime() { var c = audio(); if (c && c.state !== "running") { try { c.resume(); } catch (e) {} } }
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) { document.addEventListener(ev, prime, true); });

  // notes: [frequency Hz, start s, length s, wave, volume]
  // Returns true when the sound will be heard (so link clicks can wait for it to finish).
  function tones(notes, delay) {
    var c = audio();
    if (!c) return false;
    var asked = Date.now();
    function play() {
      if (Date.now() - asked > 400) return; // too late to match the action; skip it
      var t0 = c.currentTime + 0.005 + (delay || 0);
      notes.forEach(function (n) {
        var o = c.createOscillator(), g = c.createGain(), s = t0 + n[1], v = n[4] || 1;
        o.type = n[3] || "square";
        o.frequency.setValueAtTime(n[0], s);
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(v, s + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, s + n[2]);
        o.connect(g); g.connect(master);
        o.start(s); o.stop(s + n[2] + 0.02);
      });
    }
    if (c.state === "running") { play(); return true; }
    try { c.resume().then(play, function () {}); } catch (e) { return false; }
    var ua = navigator.userActivation;
    return !!(ua && ua.isActive); // inside a click/key the resume goes through
  }
  var SFX = {
    open:  [[523, 0, 0.07], [784, 0.06, 0.1]],
    close: [[784, 0, 0.07], [523, 0.06, 0.1]],
    enter: [[880, 0, 0.05, "square", 0.5]],
    tick:  [[600, 0, 0.03, "square", 0.7]],
    on:    [[660, 0, 0.06, "square", 0.6], [990, 0.06, 0.1, "square", 0.6]],
    ach:   [[988, 0, 0.08], [1319, 0.08, 0.35]], // coin: B5 -> E6
    eat:   [[740, 0, 0.04, "square", 0.6], [988, 0.04, 0.05, "square", 0.6]],
    die:   [[392, 0, 0.1], [294, 0.1, 0.1], [196, 0.2, 0.28]]
  };
  function sfx(name, delay) {
    if (name === "key") return tones([[1300 + Math.random() * 500, 0, 0.025, "square", 0.25]]);
    return tones(SFX[name], delay);
  }

  // Pixel speaker toggle, bottom-right on every page.
  var snd, SPK = "M2 6h3v4H2zM5 5h1v6H5zM6 4h1v8H6zM7 3h1v10H7z", WAVES = "M10 6h1v4h-1zM12 4h1v8h-1z",
      XMARK = "M10 6h1v1h-1zM14 6h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM12 8h1v1h-1zM11 9h1v1h-1zM13 9h1v1h-1zM10 10h1v1h-1zM14 10h1v1h-1z";
  function paintSnd() {
    if (!snd) return;
    var on = soundOn();
    snd.setAttribute("aria-pressed", on ? "false" : "true");
    snd.title = on ? "Sound on (click to mute)" : "Sound off (click to unmute)";
    snd.querySelector("path.v").setAttribute("d", on ? WAVES : XMARK);
  }
  function buildSnd() {
    if (!AC) return;
    var NS = "http://www.w3.org/2000/svg";
    snd = document.createElement("button");
    snd.type = "button"; snd.className = "snd";
    snd.setAttribute("aria-label", "Mute sound effects");
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("shape-rendering", "crispEdges"); svg.setAttribute("aria-hidden", "true");
    [["", SPK], ["v", WAVES]].forEach(function (p) {
      var el = document.createElementNS(NS, "path");
      if (p[0]) el.setAttribute("class", p[0]);
      el.setAttribute("fill", "currentColor"); el.setAttribute("d", p[1]);
      svg.appendChild(el);
    });
    snd.appendChild(svg);
    snd.addEventListener("click", function () { setSound(!soundOn()); });
    document.body.appendChild(snd);
    paintSnd();
  }

  var queue = [], showing = false;
  function unlock(id) {
    var got = load(AKEY);
    if (got[id]) return;
    got[id] = Date.now();
    save(AKEY, got);
    queue.push(achName(id));
    if (!showing) nextToast();
  }

  function nextToast() {
    var name = queue.shift();
    if (!name) { showing = false; return; }
    showing = true;
    var t = document.createElement("div");
    t.className = "ach-toast";
    t.setAttribute("role", "status");
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "#ffd700");
    path.setAttribute("d", TROPHY);
    svg.appendChild(path);
    var txt = document.createElement("div");
    var k = document.createElement("div"); k.className = "ach-k"; k.textContent = "ACHIEVEMENT UNLOCKED";
    var n = document.createElement("div"); n.className = "ach-n"; n.textContent = name;
    txt.appendChild(k); txt.appendChild(n);
    t.appendChild(svg); t.appendChild(txt);
    document.body.appendChild(t);
    t.getBoundingClientRect(); // commit the off-screen position so the slide-in animates
    t.classList.add("show");
    if (!(name === achName("tour") && Date.now() - (+lsGet("bb-coin") || 0) < 5000)) sfx("ach");
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); nextToast(); }, 400);
    }, 3800);
  }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Sound for a click that loads another page; returns how long to wait so it isn't cut off.
  // If that page is the last one needed for Grand tour, play the coin now, while the click
  // still lets the browser make sound (the next page can't until the visitor interacts).
  function navSound(url) {
    var base = String(url).split(/[?#]/)[0], links = document.querySelectorAll(".nav-links a"), p = null;
    for (var i = 0; i < links.length; i++) if (links[i].href.split(/[?#]/)[0] === base) p = links[i].textContent.trim().toLowerCase();
    var v = load(PKEY);
    if (p && PAGES.indexOf(p) >= 0 && !load(AKEY).tour && PAGES.every(function (x) { return x === p || v[x]; }) && sfx("ach")) {
      try { localStorage.setItem("bb-coin", String(Date.now())); } catch (e) {}
      return 450;
    }
    return sfx("tick") ? 90 : 0;
  }

  // Which page is this? 404 marks itself; others use the visible nav link marked aria-current.
  function currentPage() {
    var go = document.querySelector(".gameover");
    if (go && go.getClientRects().length) return "404";
    var cur = document.querySelectorAll('.nav-links a[aria-current="page"]');
    for (var i = 0; i < cur.length; i++) {
      if (cur[i].getClientRects().length) return cur[i].textContent.trim().toLowerCase();
    }
    return null;
  }

  function visit() {
    var p = currentPage();
    if (p === "404") { setTimeout(function () { unlock("lost"); }, 900); return; }
    if (PAGES.indexOf(p) < 0) return;
    var v = load(PKEY);
    v[p] = 1; save(PKEY, v);
    if (PAGES.every(function (x) { return v[x]; })) unlock("tour");
  }

  // Page links come from the site's own nav, so they work wherever the page is hosted.
  function pageHref(name) {
    var links = document.querySelectorAll(".nav-links a");
    for (var i = 0; i < links.length; i++) {
      if (links[i].textContent.trim().toLowerCase() === name) return links[i].getAttribute("href");
    }
    return null;
  }

  function line(text, cls) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
    return d;
  }

  function link(prefix, text, href) {
    var d = line(prefix);
    var a = document.createElement("a");
    a.href = href; a.textContent = text; a.rel = "noopener"; a.target = "_blank";
    d.appendChild(a);
    out.scrollTop = out.scrollHeight;
  }

  function slow(lines, done) {
    busy = true;
    var i = 0;
    (function next() {
      if (i >= lines.length) { busy = false; if (done) done(); return; }
      var l = lines[i++];
      line(l[0], l[1]);
      setTimeout(next, l[2] || 260);
    })();
  }

  // ---------- shell session (sessionStorage: this tab only, cleared when it closes) ----------
  var SKEY = "bb-shell", MAXLINES = 200, SAFE_HREF = /^(https?:|mailto:|file:)/i;

  function persist(reopen) {
    if (!out) return;
    var lines = [];
    var rows = out.children;
    for (var i = Math.max(0, rows.length - MAXLINES); i < rows.length; i++) {
      var d = rows[i], a = d.querySelector("a");
      var l = { c: d.className || null, t: d.textContent };
      if (a) { l.t = d.firstChild && d.firstChild.nodeType === 3 ? d.firstChild.nodeValue : ""; l.a = a.textContent; l.h = a.href; }
      lines.push(l);
    }
    save(SKEY, { lines: lines, hist: hist.slice(-50), open: !!reopen, ts: Date.now() }, SS);
  }

  // ---------- carrying state between pages opened from disk ----------
  // Some browsers (Firefox by default) give every file:// page its own storage, which would split
  // the shell and achievements per page. When running from disk, the state rides along with each
  // page change (URL hash + window.name) and is merged into the new page's storage on arrival.
  // On a real web host all pages share storage, so none of this runs there.
  var FILE = location.protocol === "file:", CKEY = "bbstate=", NPFX = "bb:";
  var KNOWN_LINKS = [RESUME, LINKEDIN, "mailto:" + EMAIL];

  function snapshot(reopen) {
    persist(reopen);
    return JSON.stringify({ a: load(AKEY), p: load(PKEY), s: load(SKEY, SS), m: load(MKEY) });
  }

  function carryTo(href, reopen) {
    if (!FILE) return href;
    var json = snapshot(reopen);
    try { window.name = NPFX + json; } catch (e) {}
    return href + (href.indexOf("#") < 0 ? "#" : "&") + CKEY + encodeURIComponent(json);
  }

  function takeCarried() {
    if (!FILE) return null;
    var st = null, m = location.hash.match(/(?:#|&)bbstate=([^&]*)/);
    if (m) {
      try { st = JSON.parse(decodeURIComponent(m[1])); } catch (e) {}
      var rest = location.hash.replace(/[#&]bbstate=[^&]*/, "").replace(/^&/, "");
      try { history.replaceState(null, "", location.pathname + location.search + (rest ? "#" + rest.replace(/^#/, "") : "")); } catch (e) {}
    }
    if (!st && typeof window.name === "string" && window.name.indexOf(NPFX) === 0) {
      try { st = JSON.parse(window.name.slice(NPFX.length)); } catch (e) {}
    }
    return st && typeof st === "object" ? st : null;
  }

  function mergeCarried() {
    var c = takeCarried();
    if (!c) return;
    var got = load(AKEY), pages = load(PKEY), i;
    for (i = 0; i < ACH.length; i++) if (c.a && c.a[ACH[i][0]] && !got[ACH[i][0]]) got[ACH[i][0]] = +c.a[ACH[i][0]] || Date.now();
    for (i = 0; i < PAGES.length; i++) if (c.p && c.p[PAGES[i]]) pages[PAGES[i]] = 1;
    save(AKEY, got); save(PKEY, pages);
    var mm = load(MKEY);
    if (c.m && typeof c.m === "object" && (+c.m.ts || 0) > (+mm.ts || 0)) save(MKEY, { off: !!c.m.off, ts: +c.m.ts });
    var mine = load(SKEY, SS);
    if (c.s && Array.isArray(c.s.lines) && (+c.s.ts || 0) > (+mine.ts || 0)) {
      save(SKEY, {
        lines: c.s.lines.slice(-MAXLINES).filter(function (l) { return l && typeof l.t === "string"; }),
        hist: Array.isArray(c.s.hist) ? c.s.hist.slice(-50) : [],
        open: !!c.s.open, ts: +c.s.ts
      }, SS);
    }
  }

  function restore() {
    var st = load(SKEY, SS);
    if (!st.lines) return false;
    out.textContent = "";
    st.lines.forEach(function (l) {
      if (l.a && SAFE_HREF.test(l.h || "") && KNOWN_LINKS.indexOf(l.h) >= 0) link(l.t || "", l.a, l.h);
      else line(l.t, l.c);
    });
    hist = (Array.isArray(st.hist) ? st.hist : []).filter(function (h) { return typeof h === "string"; });
    hpos = hist.length;
    return !!st.open;
  }

  // ---------- snake (type 'snake') ----------
  // Drawn on a canvas inside the terminal. Best score is kept in this browser only.
  var NKEY = "bb-snake", game = null;
  function cssVar(v, d) { var x = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return x || d; }

  function snake() {
    if (game) return;
    var mm = window.matchMedia ? function (q) { return matchMedia(q).matches; } : function () { return false; };
    var reduce = mm("(prefers-reduced-motion: reduce)"), coarse = mm("(pointer: coarse)");
    var row = root.querySelector(".term-row");
    var avail = out.clientWidth - 24;
    var cols = avail < 480 ? 20 : 30, rows = 14;
    var cell = Math.max(8, Math.floor(Math.min(avail / cols, 224 / rows)));
    var Wpx = cols * cell, Hpx = rows * cell, dpr = Math.min(window.devicePixelRatio || 1, 3);
    var C = { bg: cssVar("--bg", "#0a0a0a"), dot: cssVar("--rule", "#1e1e1e"), body: cssVar("--accent", "#5c8a8a"),
              head: cssVar("--accent-hi", "#8abeb7"), food: cssVar("--gold", "#ffd700"), red: cssVar("--red", "#c43e1c") };

    var wrap = document.createElement("div"); wrap.className = "snake";
    var hud = document.createElement("div"); hud.className = "snake-hud";
    var title = document.createElement("span"); title.textContent = "SNAKE";
    var stat = document.createElement("span"); stat.className = "snake-stat";
    hud.appendChild(title); hud.appendChild(stat);
    var cv = document.createElement("canvas");
    cv.width = Wpx * dpr; cv.height = Hpx * dpr;
    cv.style.width = Wpx + "px"; cv.style.height = Hpx + "px";
    cv.tabIndex = 0; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Snake game");
    var tip = document.createElement("div"); tip.className = "snake-tip";
    tip.textContent = coarse ? "swipe or use the arrows" : "arrows / WASD move   P pause   Q or Esc quit";
    wrap.appendChild(hud); wrap.appendChild(cv);
    if (coarse) {
      var pad = document.createElement("div"); pad.className = "snake-pad";
      [["\u2190", [-1, 0], "Left"], ["\u2191", [0, -1], "Up"], ["\u2193", [0, 1], "Down"], ["\u2192", [1, 0], "Right"], ["quit", null, "Quit snake"]]
        .forEach(function (b) {
          var el = document.createElement("button");
          el.type = "button"; el.textContent = b[0]; el.setAttribute("aria-label", b[2]);
          el.addEventListener("pointerdown", function (e) { e.preventDefault(); b[1] ? turn(b[1]) : end(true); });
          pad.appendChild(el);
        });
      wrap.appendChild(pad);
    }
    wrap.appendChild(tip);
    root.insertBefore(wrap, row);
    out.hidden = true; row.hidden = true; busy = true;

    var ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    var best = +load(NKEY).best || 0, body, dir, q, food, score, started, paused, over, timer;

    function reset() {
      var cy = rows >> 1;
      body = [[4, cy], [3, cy], [2, cy]]; dir = [1, 0]; q = [];
      score = 0; started = false; paused = false; over = false;
      place(); paint(); draw();
    }
    function occupied(x, y, n) { for (var i = 0; i < n; i++) if (body[i][0] === x && body[i][1] === y) return true; return false; }
    function place() {
      var free = [];
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) if (!occupied(x, y, body.length)) free.push([x, y]);
      food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }
    function delay() { return reduce ? 170 : Math.max(65, 125 - score * 3); }
    function loop() { timer = setTimeout(function () { step(); if (started && !paused && !over) loop(); }, delay()); }
    function turn(d) {
      if (over) return;
      var last = q.length ? q[q.length - 1] : dir;
      if (!started) { started = true; if (d[0] !== -dir[0] || d[1] !== -dir[1]) q.push(d); paint(); draw(); loop(); return; }
      if (paused) { paused = false; paint(); loop(); }
      if ((d[0] === last[0] && d[1] === last[1]) || (d[0] === -last[0] && d[1] === -last[1]) || q.length > 2) return;
      q.push(d);
    }
    function step() {
      if (q.length) dir = q.shift();
      var h = body[0], nx = h[0] + dir[0], ny = h[1] + dir[1];
      var eat = food && nx === food[0] && ny === food[1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || occupied(nx, ny, eat ? body.length : body.length - 1)) return die();
      body.unshift([nx, ny]);
      if (eat) {
        score++; sfx("eat");
        if (score >= 10) unlock("snake");
        place();
        if (!food) return die(true);
      } else body.pop();
      paint(); draw();
    }
    function die(won) {
      over = true; clearTimeout(timer);
      var record = score > best;
      if (record) { best = score; save(NKEY, { best: best, ts: Date.now() }); }
      sfx(won ? "ach" : "die");
      if (record && !won) setTimeout(function () { sfx("ach"); }, 520);
      paint(); draw(won ? "YOU WIN" : "GAME OVER", record ? "new best: " + best : "score " + score,
        coarse ? "tap to play again" : "Enter to play again");
    }
    function pause() {
      if (!started || over || paused) return;
      paused = true; clearTimeout(timer); paint(); draw("PAUSED", coarse ? "swipe to resume" : "P or an arrow to resume");
    }
    function paint() { stat.textContent = "score " + score + "   best " + best; }
    function banner(lines) {
      ctx.fillStyle = "rgba(10,10,10,0.78)";
      ctx.fillRect(0, Hpx / 2 - 30, Wpx, 60);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      lines.forEach(function (t, i) {
        if (!t) return;
        ctx.font = (i ? "10px" : "14px") + " Monocraft, monospace";
        ctx.fillStyle = i ? C.head : C.food;
        ctx.fillText(t, Wpx / 2, Hpx / 2 - 14 + i * 15);
      });
    }
    function draw(a, b, c) {
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, Wpx, Hpx);
      ctx.fillStyle = C.dot;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) ctx.fillRect(x * cell + (cell >> 1), y * cell + (cell >> 1), 1, 1);
      if (food) {
        var p = Math.max(2, cell >> 2);
        ctx.fillStyle = C.food; ctx.fillRect(food[0] * cell + p, food[1] * cell + p, cell - 2 * p, cell - 2 * p);
      }
      for (var i = body.length - 1; i >= 0; i--) {
        ctx.fillStyle = i ? C.body : (over ? C.red : C.head);
        ctx.fillRect(body[i][0] * cell + 1, body[i][1] * cell + 1, cell - 2, cell - 2);
      }
      var e = Math.max(2, cell >> 3), hx = body[0][0] * cell, hy = body[0][1] * cell, m = cell >> 1;
      ctx.fillStyle = C.bg; // eyes face the direction of travel
      if (dir[0]) { var ex = hx + (dir[0] > 0 ? cell - 2 * e - 1 : e + 1); ctx.fillRect(ex, hy + m - 2 * e, e, e); ctx.fillRect(ex, hy + m + e, e, e); }
      else { var ey = hy + (dir[1] > 0 ? cell - 2 * e - 1 : e + 1); ctx.fillRect(hx + m - 2 * e, ey, e, e); ctx.fillRect(hx + m + e, ey, e, e); }
      if (a) banner([a, b, c]);
      else if (!started) banner(["READY", coarse ? "swipe to start" : "press an arrow key to start"]);
    }
    function end(focus) {
      if (!game) return;
      clearTimeout(timer); game = null; busy = false;
      wrap.remove(); out.hidden = false; row.hidden = false;
      line("snake: score " + score + " | best " + best, "dim");
      if (focus) input.focus();
    }

    var KEYS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    cv.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (KEYS[k]) { e.preventDefault(); turn(KEYS[k]); }
      else if (k === "q" || k === "escape") { e.preventDefault(); e.stopPropagation(); end(true); }
      else if (k === "p" || k === " ") { e.preventDefault(); paused ? turn(dir) : pause(); }
      else if ((k === "enter" || k === "r") && over) { e.preventDefault(); reset(); }
    });
    cv.addEventListener("blur", function () { if (!coarse) pause(); });
    var t0 = null;
    cv.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; t0 = [t.clientX, t.clientY]; }, { passive: true });
    cv.addEventListener("touchend", function (e) {
      if (!t0) return;
      var t = e.changedTouches[0], dx = t.clientX - t0[0], dy = t.clientY - t0[1]; t0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { if (over) reset(); return; }
      turn(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1]);
    });
    cv.addEventListener("click", function () { if (over) reset(); });

    game = { end: end };
    reset();
    try { cv.focus({ preventScroll: true }); } catch (e) { cv.focus(); }
  }

  var COMMANDS = {
    help: function () {
      [["whoami", "who runs this box"],
       ["ls [projects]", "list files"],
       ["cat resume.pdf", "print the resume"],
       ["cd <home|about|projects|ncl>", "go to a page"],
       ["sudo hire branson", "you know what this does"],
       ["achievements", "show your progress"],
       ["snake", "play snake (arrows / WASD)"],
       ["mute / unmute", "8-bit sound effects off / on"],
       ["clear / exit", "clear the screen / close (or press ` / Esc)"]]
        .forEach(function (c) { line("  " + (c[0] + "                        ").slice(0, 26) + c[1]); });
    },
    whoami: function () {
      line("branson");
      line("IT Security Intern @ Nucleus Security | Penetration Tester", "dim");
      line("B.S. Cybersecurity, Anderson University (SC) | CSAP, CySA+, Security+, AWS CCP", "dim");
      link("", EMAIL, "mailto:" + EMAIL);
    },
    ls: function (args) {
      var a = args[0];
      if (!a) { line("about/  projects/  ncl/  resume.pdf"); return; }
      if (a.replace(/\/$/, "") === "projects") {
        PROJECTS.forEach(function (p) { line("  " + (p[0] + "                          ").slice(0, 28) + p[1]); });
        return;
      }
      if (a.replace(/\/$/, "") === "ncl") { line("8 games, Fall 2023 - Fall 2025. Best: Top 0.4% (team). Try: cd ncl"); return; }
      if (a.replace(/\/$/, "") === "about") { line("story  goals  outside-security. Try: cd about"); return; }
      line("ls: cannot access '" + a + "': No such file or directory", "err");
    },
    cat: function (args) {
      var f = args[0];
      if (!f) { line("cat: missing operand", "err"); return; }
      if (f !== "resume.pdf") { line("cat: " + f + ": No such file or directory", "err"); return; }
      slow([
        ["warning: resume.pdf is a binary file; rendering as text", "dim", 400],
        ["BRANSON BAILEY", "hi"],
        ["Experience", "hi", 120],
        ["  IT Security Intern            Nucleus Security        May 2026 - Present", null, 120],
        ["  Penetration Tester            Self-employed           Apr 2026 - Present", null, 120],
        ["  Cybersecurity Analyst         Anderson University     Dec 2024 - May 2026", null, 120],
        ["  Help Desk Support Specialist  Anderson University     May 2024 - Dec 2024", null, 120],
        ["  Player                        National Cyber League   Oct 2023 - Apr 2026", null, 120],
        ["Education", "hi", 120],
        ["  B.S. Cybersecurity, Anderson University (SC), 2023 - Dec 2026, GPA 3.88", null, 120],
        ["Certifications", "hi", 120],
        ["  CompTIA CSAP, CySA+, Security+  |  AWS Certified Cloud Practitioner", null, 120],
        ["Highlights", "hi", 120],
        ["  NCL Top 0.4% (team) and Top 2.4% (individual) nationally, Fall 2025", null, 120],
        ["  Cybersecurity Club President, 2025 - 2026", null, 120]
      ], function () { link("Full copy: ", "open Bailey_Resume.pdf", RESUME); });
    },
    cd: function (args) {
      var a = (args[0] || "home").replace(/\/$/, "");
      if (a === "~" || a === ".." || a === "/" || a === ".") a = "home";
      var href = pageHref(a);
      if (!href) { line("cd: " + args[0] + ": No such file or directory", "err"); return; }
      reopenNext = true; persist(true); // the next page picks the shell back up, still open
      if (href.charAt(0) === "#") { location.href = href; return; } // same-document jump (combined preview)
      close(true);
      var go = carryTo(href, true);
      setTimeout(function () { location.href = go; }, navSound(go)); // let the sound finish
    },
    sudo: function (args) {
      if (args.join(" ") !== "hire branson") {
        line("branson is the only one allowed to sudo here. This incident will be reported.", "err");
        return;
      }
      slow([
        ["[sudo] password for recruiter: ********", null, 700],
        ["Verifying credentials...", "dim", 500],
        ["  [ok] CompTIA CSAP, CySA+, Security+", "ok", 220],
        ["  [ok] AWS Certified Cloud Practitioner", "ok", 220],
        ["  [ok] NCL Top 2.4% individual, Top 0.4% team", "ok", 220],
        ["  [ok] Real-world pen test experience", "ok", 220],
        ["  [ok] References available (see Recommendations)", "ok", 400],
        ["Access granted. Starting hire sequence...", "hi", 300]
      ], function () { link("Next step: ", "message me on LinkedIn", LINKEDIN); unlock("hire"); });
    },
    achievements: function (args) {
      if (args[0] === "--reset") { save(AKEY, {}); save(PKEY, {}); line("Progress cleared.", "dim"); return; }
      var got = load(AKEY), v = load(PKEY), n = 0;
      ACH.forEach(function (a) { if (got[a[0]]) n++; });
      line("ACHIEVEMENTS " + n + "/" + ACH.length, "hi");
      ACH.forEach(function (a) {
        var ok = !!got[a[0]], hint = a[2];
        if (a[0] === "tour" && !ok) hint += " (" + PAGES.filter(function (x) { return v[x]; }).length + "/" + PAGES.length + ")";
        line("  [" + (ok ? "x" : " ") + "] " + ((ok ? a[1] : "???") + "                    ").slice(0, 20) + hint, ok ? "ok" : "dim");
      });
      line(n === ACH.length ? "100% complete. Thanks for playing." : "Progress is saved in this browser only.", n === ACH.length ? "hi" : "dim");
    },
    clear: function () { out.textContent = ""; persist(false); },
    mute: function () { setSound(false); line("Sound off. Type 'unmute' to turn it back on.", "dim"); },
    unmute: function () {
      if (!AC) { line("unmute: this browser has no Web Audio support", "err"); return; }
      setSound(true); line("Sound on.", "dim");
    },
    snake: function () { snake(); },
    exit: function () { close(); }
  };

  function run(raw) {
    var cmd = raw.trim();
    line("branson@portfolio:~$ " + cmd, "cmd");
    if (!cmd) return;
    hist.push(cmd); hpos = hist.length;
    var parts = cmd.split(/\s+/), name = parts.shift().toLowerCase();
    if (name === "rm" && /-\w*r/.test(parts.join(" "))) { line("Nice try.", "err"); return; }
    if (COMMANDS.hasOwnProperty(name)) COMMANDS[name](parts);
    else line(name + ": command not found. Type 'help'.", "err");
  }

  function build() {
    root = document.createElement("div");
    root.className = "term";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Terminal");
    root.hidden = true;

    var bar = document.createElement("div");
    bar.className = "term-bar";
    bar.textContent = "branson@portfolio: ~";
    var x = document.createElement("button");
    x.type = "button"; x.className = "term-x"; x.textContent = "\u00d7";
    x.setAttribute("aria-label", "Close terminal");
    x.addEventListener("click", function () { close(); });
    bar.appendChild(x);

    out = document.createElement("div");
    out.className = "term-out";
    out.setAttribute("aria-live", "polite");

    var row = document.createElement("label");
    row.className = "term-row";
    var ps = document.createElement("span");
    ps.textContent = "branson@portfolio:~$ ";
    input = document.createElement("input");
    input.type = "text"; input.spellcheck = false; input.autocomplete = "off";
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("aria-label", "Command");
    row.appendChild(ps); row.appendChild(input);

    root.appendChild(bar); root.appendChild(out); root.appendChild(row);
    document.body.appendChild(root);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); if (!busy) { sfx("enter"); run(input.value); input.value = ""; } }
      else if (!e.repeat && e.key !== "`" && (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete")) sfx("key");
      else if (e.key === "ArrowUp" && hpos > 0) { e.preventDefault(); input.value = hist[--hpos]; }
      else if (e.key === "ArrowDown") { e.preventDefault(); hpos = Math.min(hist.length, hpos + 1); input.value = hist[hpos] || ""; }
    });
    if (!restore()) line("Welcome. Type 'help' for commands.", "dim");
  }

  function open() {
    if (!root) build();
    lastFocus = document.activeElement;
    root.hidden = false;
    input.focus();
    sfx("open");
    unlock("shell");
  }

  function close(silent) {
    if (!root || root.hidden) return;
    if (game) game.end(false);
    root.hidden = true;
    if (silent !== true) sfx("close");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  mergeCarried();
  buildSnd();
  visit();
  // Resume the shell if the visitor left this tab's last page with it open (e.g. via cd).
  if (load(SKEY, SS).open) {
    build(); // build() restores scrollback and history
    persist(false);
    root.hidden = false;
    input.focus();
  }
  // Save scrollback/history when leaving by any route (nav links, back button); cd also asks to reopen.
  window.addEventListener("pagehide", function () {
    if (FILE) { try { window.name = NPFX + snapshot(reopenNext); } catch (e) {} } else persist(reopenNext);
  });
  // Pages restored by Back/Forward skip the script, so pull in anything newer from the other page.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    mergeCarried();
    if (root) restore();
  });
  // Plain links between the site's own pages (nav bar, buttons) carry the state as well.
  // Clicking a link or button ticks; same-tab page loads wait a moment so the sound isn't cut off.
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || !e.target.closest) return;
    var a = e.target.closest("a[href], button, summary, [role=button]");
    if (!a || a.closest(".snd, .term")) return; // the speaker and terminal have their own sounds
    var leaves = a.matches("a[href]") && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download"))
      && /^(https?|file):$/.test(a.protocol) // mailto: etc. don't unload the page
      && !(a.pathname === location.pathname && a.host === location.host); // in-page #jumps
    if (!leaves) { sfx("tick"); return; }
    var href = a.href;
    if (FILE && a.protocol === "file:" && /(\.html|\/)$/.test(a.pathname)) {
      href = carryTo(a.href.split("#")[0] + (a.hash || ""), false); // only pages, not the PDF or other files
    }
    var wait = navSound(href);
    if (!wait && href === a.href) return;
    e.preventDefault();
    setTimeout(function () { location.href = href; }, wait);
  });
  window.addEventListener("hashchange", visit); // the combined preview switches pages by #hash

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, inTerm = root && root.contains(t);
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === "`" && (!typing || inTerm)) {
      e.preventDefault();
      (root && !root.hidden) ? close() : open();
    } else if (e.key === "Escape" && inTerm) {
      close();
    }
  });
})();
