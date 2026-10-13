/* ===== Trey Poore Portfolio — shared scripts ===== */

/* ---------- Scroll reveal ---------- */
(function () {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  els.forEach(e => io.observe(e));
})();

/* ---------- Live GitHub code viewer ----------
   Each .viewer element declares:
     data-repo="owner/name"         (required)
     data-branch="main"             (optional, default main)
     data-files="a.py,b/c.py"       (optional, preferred files to show first)
   Files are fetched live from the public GitHub API, so the viewer always
   shows the latest version of the repo. Unauthenticated limit: 60 req/hr/IP.
------------------------------------------------ */
(function () {
  const CODE_EXT = /\.(py|js|ts|json|yml|yaml|sql|md|sh|html|css|toml|txt|ipynb|r|R)$/;
  const SKIP = /(^|\/)(node_modules|\.git|dist|build|archive|logos|img|images|fonts)(\/|$)|package-lock|\.min\./;
  const MAX_TABS = 7;
  const MAX_BYTES = 120000;

  const langFor = (name) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return ({ py: "python", js: "javascript", ts: "typescript", json: "json", yml: "yaml", yaml: "yaml",
      sql: "sql", md: "markdown", sh: "bash", html: "xml", css: "css", toml: "ini", txt: "plaintext",
      ipynb: "json", r: "r" })[ext] || "plaintext";
  };

  async function gh(url) {
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (r.status === 403 && r.headers.get("x-ratelimit-remaining") === "0") throw new Error("ratelimit");
    if (r.status === 404) throw new Error("notfound");
    if (!r.ok) throw new Error("http" + r.status);
    return r.json();
  }

  async function loadViewer(v) {
    const repo = v.dataset.repo;
    const branch = v.dataset.branch || "main";
    const preferred = (v.dataset.files || "").split(",").map(s => s.trim()).filter(Boolean);
    const tabs = v.querySelector(".tabs");
    const body = v.querySelector(".code-wrap");
    const foot = v.querySelector(".viewer-foot .meta");

    const msg = (title, text) => { body.innerHTML = `<div class="viewer-msg"><strong>${title}</strong>${text}</div>`; };

    try {
      const tree = await gh(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
      const blobs = tree.tree.filter(t => t.type === "blob" && CODE_EXT.test(t.path) && !SKIP.test(t.path) && t.size < MAX_BYTES);
      const byPath = Object.fromEntries(blobs.map(b => [b.path, b]));

      let picks = preferred.filter(p => byPath[p]);
      if (picks.length < MAX_TABS) {
        const rest = blobs
          .filter(b => !picks.includes(b.path))
          .sort((a, b) => {
            // shallow files first, README then code
            const score = (x) => (x.path.toLowerCase().startsWith("readme") ? -2 : 0) + x.path.split("/").length + (/\.(py|js|ts|sql|yml|yaml)$/.test(x.path) ? -1 : 0);
            return score(a) - score(b);
          })
          .map(b => b.path);
        picks = picks.concat(rest).slice(0, MAX_TABS);
      }
      if (!picks.length) { msg("No viewable files yet", "This repository doesn't contain code files to display."); return; }

      tabs.innerHTML = "";
      picks.forEach((p, i) => {
        const b = document.createElement("button");
        b.textContent = p.split("/").pop();
        b.title = p;
        b.addEventListener("click", () => show(p, b));
        tabs.appendChild(b);
        if (i === 0) show(p, b);
      });
      if (foot) foot.textContent = `${blobs.length} files · branch ${branch} · live from GitHub`;

      async function show(path, btn) {
        tabs.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        body.innerHTML = `<div class="viewer-msg">Loading ${path}…</div>`;
        try {
          const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`);
          if (!raw.ok) throw new Error("raw");
          let text = await raw.text();
          if (path.endsWith(".ipynb")) {
            try { const nb = JSON.parse(text);
              text = nb.cells.map(c => (c.cell_type === "code" ? "" : "# ") + c.source.join("")).join("\n\n# ───────────\n\n"); } catch (_) {}
          }
          const code = document.createElement("code");
          code.className = "hljs language-" + langFor(path);
          code.textContent = text;
          const pre = document.createElement("pre"); pre.appendChild(code);
          body.innerHTML = ""; body.appendChild(pre);
          if (window.hljs) hljs.highlightElement(code);
        } catch (e) { msg("Couldn't load this file", "Open it on GitHub instead."); }
      }
    } catch (e) {
      if (e.message === "notfound") msg("Repository coming soon", `The code for this project is being published to <code>${repo}</code>. Check back shortly or view the repo link below.`);
      else if (e.message === "ratelimit") msg("GitHub rate limit reached", "Too many views from this network in the past hour. Use the GitHub link below to browse the code directly.");
      else msg("Couldn't reach GitHub", "Use the GitHub link below to browse the code directly.");
    }
  }

  document.querySelectorAll(".viewer[data-repo]").forEach(loadViewer);
})();
