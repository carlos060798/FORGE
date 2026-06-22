/* ============================================================
   FORGE Docs — app (routing, render, búsqueda, tema, idioma)
   Sin dependencias. Lee PAGES, UI, GROUP_ORDER de data.js.
   ============================================================ */

(function () {
  "use strict";

  // ---- Estado ----
  // forge-lang-v5: clave versionada para resetear preferencia al cambiar de versión.
  const LANG_KEY = "forge-lang-v5";
  const htmlLang = document.documentElement.getAttribute("data-lang") || "es";
  let lang = localStorage.getItem(LANG_KEY) || htmlLang;
  let theme = localStorage.getItem("forge-theme") || "dark";
  const pageIds = Object.keys(PAGES);
  const defaultPage = pageIds[0];

  // ---- Helpers de DOM ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---- Resaltador de sintaxis simple (sin deps) ----
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(code, lang) {
    let h = escapeHtml(code);
    if (lang === "text" || !lang) return h;

    if (lang === "json") {
      h = h.replace(/"(\\.|[^"\\])*"(\s*:)?/g, (m, _g, colon) =>
        colon !== undefined && m.trim().endsWith(":")
          ? `<span class="tok-key">${m}</span>`
          : `<span class="tok-str">${m}</span>`);
      h = h.replace(/\b(true|false|null)\b/g, '<span class="tok-key">$1</span>');
      h = h.replace(/\b(-?\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
      return h;
    }

    // bash / js / generic
    h = h.replace(/(#.*$)/gm, '<span class="tok-com">$1</span>');
    h = h.replace(/(\/\/.*$)/gm, '<span class="tok-com">$1</span>');
    h = h.replace(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g,
      '<span class="tok-str">$1</span>');
    h = h.replace(/\b(const|let|var|function|return|if|else|for|while|await|async|import|export|from|new|class|node|npm|cat|grep|echo|cd|ls|git)\b/g,
      '<span class="tok-key">$1</span>');
    h = h.replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
    return h;
  }

  // Procesa los <pre><code class="lang-X"> dentro de un contenedor
  function applyHighlight(container) {
    $$("pre code", container).forEach((block) => {
      const cls = block.className || "";
      const m = cls.match(/lang-(\w+)/);
      const language = m ? m[1] : "text";
      const raw = block.textContent;
      block.innerHTML = highlight(raw, language);
    });
  }
  function $$inside(sel, root) { return Array.from(root.querySelectorAll(sel)); }

  // ---- i18n del chrome ----
  function applyUiText() {
    const t = UI[lang];
    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key]) el.textContent = t[key];
    });
    $$("[data-i18n-attr]").forEach((el) => {
      const attr = el.getAttribute("data-i18n-attr");
      const key = el.getAttribute("data-i18n");
      if (t[key]) el.setAttribute(attr, t[key]);
    });
    document.documentElement.setAttribute("lang", lang);
    $("#lang-label").textContent = lang.toUpperCase();
  }

  // ---- Sidebar ----
  function buildSidebar() {
    const nav = $("#sidebar-nav");
    const groups = UI[lang].groups;
    let html = "";

    GROUP_ORDER.forEach((groupKey) => {
      const ids = pageIds.filter((id) => PAGES[id].seccion === groupKey);
      if (!ids.length) return;
      html += `<div class="nav-group-title">${groups[groupKey] || groupKey}</div>`;
      ids.forEach((id) => {
        const title = PAGES[id][lang].titulo;
        html += `<a class="nav-item" href="#${id}" data-page="${id}">${title}</a>`;
      });
    });
    nav.innerHTML = html;
  }

  // ---- Render de página ----
  function renderPage(id) {
    if (!PAGES[id]) id = defaultPage;
    const page = PAGES[id][lang];
    const content = $("#content");
    content.innerHTML = page.html;
    applyHighlight(content);

    // marcar activo
    $$(".nav-item").forEach((el) =>
      el.classList.toggle("active", el.getAttribute("data-page") === id));

    // breadcrumb
    const groupName = UI[lang].groups[PAGES[id].seccion] || "";
    $("#breadcrumb").textContent = groupName.replace(/^[^\s]+\s/, "") + " / " + page.titulo;

    // scroll arriba
    content.scrollTop = 0;
    window.scrollTo(0, 0);

    // cerrar sidebar en móvil
    closeSidebar();
  }

  function currentPageId() {
    const hash = location.hash.replace(/^#/, "");
    return PAGES[hash] ? hash : defaultPage;
  }

  function navigate() {
    renderPage(currentPageId());
  }

  // ---- Toggles ----
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", theme);
    $("#theme-icon").textContent = theme === "dark" ? "☾" : "☀";
  }
  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("forge-theme", theme);
    applyTheme();
  }
  function toggleLang() {
    lang = lang === "es" ? "en" : "es";
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute("data-lang", lang);
    applyUiText();
    buildSidebar();
    renderPage(currentPageId());
  }

  // ---- Sidebar móvil ----
  function openSidebar() {
    $("#sidebar").classList.add("open");
    $("#overlay").classList.add("show");
  }
  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#overlay").classList.remove("show");
  }

  // ---- Búsqueda ----
  let searchSel = 0;
  let searchHits = [];

  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").replace(/\s+/g, " ").trim();
  }

  function runSearch(query) {
    const q = query.toLowerCase().trim();
    const results = $("#search-results");
    if (!q) { results.innerHTML = ""; searchHits = []; return; }

    searchHits = [];
    pageIds.forEach((id) => {
      const page = PAGES[id][lang];
      const title = page.titulo;
      const text = stripHtml(page.html);
      const hay = (title + " " + text).toLowerCase();
      const idx = hay.indexOf(q);
      if (idx !== -1) {
        const plain = stripHtml(page.html);
        const at = plain.toLowerCase().indexOf(q);
        let snip = at !== -1
          ? plain.slice(Math.max(0, at - 30), at + 50)
          : plain.slice(0, 80);
        searchHits.push({ id, title, snip });
      }
    });

    if (!searchHits.length) {
      results.innerHTML = `<div class="search-empty">${UI[lang].search_no_results}</div>`;
      return;
    }
    searchSel = 0;
    results.innerHTML = searchHits.map((h, i) =>
      `<div class="search-result ${i === 0 ? "sel" : ""}" data-id="${h.id}" data-i="${i}">
        <div class="search-result-title">${h.title}</div>
        <div class="search-result-snip">…${escapeHtml(h.snip)}…</div>
      </div>`).join("");

    $$(".search-result").forEach((el) => {
      el.addEventListener("click", () => {
        location.hash = "#" + el.getAttribute("data-id");
        closeSearch();
      });
    });
  }

  function openSearch() {
    $("#search-modal").classList.add("open");
    const input = $("#search-input");
    input.value = "";
    $("#search-results").innerHTML = "";
    setTimeout(() => input.focus(), 30);
  }
  function closeSearch() {
    $("#search-modal").classList.remove("open");
  }
  function moveSearchSel(dir) {
    if (!searchHits.length) return;
    searchSel = (searchSel + dir + searchHits.length) % searchHits.length;
    $$(".search-result").forEach((el, i) =>
      el.classList.toggle("sel", i === searchSel));
    const sel = $$(".search-result")[searchSel];
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }
  function confirmSearch() {
    if (!searchHits.length) return;
    location.hash = "#" + searchHits[searchSel].id;
    closeSearch();
  }

  // ---- Eventos ----
  function bindEvents() {
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#lang-toggle").addEventListener("click", toggleLang);
    $("#menu-toggle").addEventListener("click", openSidebar);
    $("#overlay").addEventListener("click", closeSidebar);
    $("#search-trigger").addEventListener("click", openSearch);
    $("#search-input").addEventListener("input", (e) => runSearch(e.target.value));

    window.addEventListener("hashchange", navigate);

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); openSearch();
      } else if (e.key === "Escape") {
        closeSearch();
      } else if ($("#search-modal").classList.contains("open")) {
        if (e.key === "ArrowDown") { e.preventDefault(); moveSearchSel(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveSearchSel(-1); }
        else if (e.key === "Enter") { e.preventDefault(); confirmSearch(); }
      }
    });
  }

  // ---- Init ----
  function init() {
    applyTheme();
    applyUiText();
    buildSidebar();
    bindEvents();
    navigate();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
