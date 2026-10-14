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
    ["lost", "Game over", "Find a page that doesn't exist"]
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
  // Achievements unlocked on page load (Grand tour, Game over) fire before the visitor has
  // clicked or typed on that page, when the browser still holds audio back. Those sounds wait
  // for the first click/key and play then, as long as it's within a few seconds.
  var pend = [];
  function flush() { var p = pend; pend = []; p.forEach(function (f) { f(); }); }
  function wake() { if (actx && actx.state !== "running") { try { actx.resume().then(flush, function () {}); } catch (e) {} } }
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) { document.addEventListener(ev, wake, true); });

  // notes: [frequency Hz, start s, length s, wave, volume]
  function tones(notes, delay, maxWait) {
    var c = audio();
    if (!c) return false;
    var asked = Date.now();
    function play() {
      if (Date.now() - asked > (maxWait || 1500)) return; // never play a stale sound long after the action
      var t0 = c.currentTime + 0.01 + (delay || 0);
      notes.forEach(function (n) {
        var o = c.createOscillator(), g = c.createGain(), s = t0 + n[1], v = n[4] || 1;
        o.type = n[3] || "square";
        o.frequency.setValueAtTime(n[0], s);
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(v, s + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, s + n[2]);
        o.connect(g); g.connect(master);
        o.start(s); o.stop(s + n[2] + 0.02);
      });
    }
    if (c.state === "running") { play(); return true; }
    pend.push(play);
    try { c.resume().then(flush, function () {}); } catch (e) {}
    return false; // not audible yet, so callers shouldn't hold up navigation for it
  }
  var SFX = {
    open:  [[523, 0, 0.07], [784, 0.06, 0.1]],
    close: [[784, 0, 0.07], [523, 0.06, 0.1]],
    enter: [[880, 0, 0.05, "square", 0.5]],
    link:  [[660, 0, 0.035, "triangle", 0.5]],
    on:    [[660, 0, 0.06, "square", 0.6], [990, 0.06, 0.1, "square", 0.6]],
    ach:   [[988, 0, 0.08], [1319, 0.08, 0.35]] // coin: B5 -> E6
  };
  function sfx(name, delay) {
    if (name === "key") return tones([[1300 + Math.random() * 500, 0, 0.025, "square", 0.25]]);
    return tones(SFX[name], delay, name === "ach" ? 4000 : 0);
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
    sfx("ach", 0.12);
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); nextToast(); }, 400);
    }, 3800);
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

  var COMMANDS = {
    help: function () {
      [["whoami", "who runs this box"],
       ["ls [projects]", "list files"],
       ["cat resume.pdf", "print the resume"],
       ["cd <home|about|projects|ncl>", "go to a page"],
       ["sudo hire branson", "you know what this does"],
       ["achievements", "show your progress"],
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
      setTimeout(function () { location.href = go; }, sfx("link") ? 160 : 0); // let the blip finish
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
        ["  [ok] References available (see Recommendation)", "ok", 400],
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
  // Every link click gets a blip; same-tab page loads wait ~150 ms so the sound isn't cut off.
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var played = sfx("link");
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
    if (!/^(https?|file):$/.test(a.protocol)) return; // mailto: etc. don't unload the page
    if (a.pathname === location.pathname && a.host === location.host) return; // in-page #jumps
    var href = a.href;
    if (FILE && a.protocol === "file:" && /(\.html|\/)$/.test(a.pathname)) {
      href = carryTo(a.href.split("#")[0] + (a.hash || ""), false); // only pages, not the PDF or other files
    } else if (!played) return;
    e.preventDefault();
    setTimeout(function () { location.href = href; }, played ? 150 : 0);
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
