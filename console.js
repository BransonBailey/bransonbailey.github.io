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

  var root, out, input, lastFocus, hist = [], hpos = 0, busy = false;

  // ---------- achievements (localStorage only) ----------
  var ACH = [
    ["shell", "Found the shell", "Open the terminal"],
    ["tour", "Grand tour", "Visit all three pages"],
    ["hire", "Root access", "Run sudo hire branson"],
    ["lost", "Game over", "Find a page that doesn't exist"]
  ];
  var AKEY = "bb-achievements", PKEY = "bb-pages", PAGES = ["about", "projects", "ncl"];
  var TROPHY = "M2 1h12v1h-12zM0 2h16v1h-16zM0 3h1v1h-1zM2 3h12v1h-12zM15 3h1v1h-1zM0 4h1v1h-1zM2 4h12v1h-12zM15 4h1v1h-1zM1 5h1v1h-1zM3 5h10v1h-10zM14 5h1v1h-1zM2 6h12v1h-12zM4 7h8v1h-8zM5 8h6v1h-6zM6 9h4v1h-4zM7 10h2v1h-2zM7 11h2v1h-2zM5 12h6v1h-6zM4 13h8v1h-8zM4 14h8v1h-8z";

  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function achName(id) { for (var i = 0; i < ACH.length; i++) if (ACH[i][0] === id) return ACH[i][1]; return id; }

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

  var COMMANDS = {
    help: function () {
      [["whoami", "who runs this box"],
       ["ls [projects]", "list files"],
       ["cat resume.pdf", "print the resume"],
       ["cd <about|projects|ncl>", "go to a page"],
       ["sudo hire branson", "you know what this does"],
       ["achievements", "show your progress"],
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
      if (a.replace(/\/$/, "") === "about") { line("experience  education  certifications  recommendation  contact"); return; }
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
        ["  B.S. Cybersecurity, Anderson University (SC), 2023 - 2027, GPA 3.88", null, 120],
        ["Certifications", "hi", 120],
        ["  CompTIA CSAP, CySA+, Security+  |  AWS Certified Cloud Practitioner", null, 120],
        ["Highlights", "hi", 120],
        ["  NCL Top 0.4% (team) and Top 2.4% (individual) nationally, Fall 2025", null, 120],
        ["  Cybersecurity Club President, 2025 - 2026", null, 120]
      ], function () { link("Full copy: ", "open Bailey_Resume.pdf", RESUME); });
    },
    cd: function (args) {
      var a = (args[0] || "about").replace(/\/$/, "").replace(/^~$/, "about");
      var href = pageHref(a === "about" || a === ".." ? "about" : a);
      if (!href) { line("cd: " + args[0] + ": No such file or directory", "err"); return; }
      close();
      location.href = href;
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
        ["  [ok] NCL Top 0.4% nationally", "ok", 220],
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
        if (a[0] === "tour" && !ok) hint += " (" + PAGES.filter(function (x) { return v[x]; }).length + "/3)";
        line("  [" + (ok ? "x" : " ") + "] " + ((ok ? a[1] : "???") + "                    ").slice(0, 20) + hint, ok ? "ok" : "dim");
      });
      line(n === ACH.length ? "100% complete. Thanks for playing." : "Progress is saved in this browser only.", n === ACH.length ? "hi" : "dim");
    },
    clear: function () { out.textContent = ""; },
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
    x.addEventListener("click", close);
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
      if (e.key === "Enter") { e.preventDefault(); if (!busy) { run(input.value); input.value = ""; } }
      else if (e.key === "ArrowUp" && hpos > 0) { e.preventDefault(); input.value = hist[--hpos]; }
      else if (e.key === "ArrowDown") { e.preventDefault(); hpos = Math.min(hist.length, hpos + 1); input.value = hist[hpos] || ""; }
    });
    line("Welcome. Type 'help' for commands.", "dim");
  }

  function open() {
    if (!root) build();
    lastFocus = document.activeElement;
    root.hidden = false;
    input.focus();
    unlock("shell");
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  visit();
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
