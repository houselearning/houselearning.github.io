/* ================================
   Nav XML Search (nav-only)
   ================================ */

(() => {
  const XML_PATH = "/search-task.xml";

  const CSS = `
  nav {
    position: relative;
  }

  .nav-xml-search {
    position: relative;
    max-width: 260px;
    margin-left: auto;
    font-family: system-ui, sans-serif;
  }

  .nav-xml-search input {
    width: 100%;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid #ddd;
    outline: none;
    font-size: 14px;
    background: #fff;
    transition: all 0.2s ease;
  }

  .nav-xml-search input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
  }

  .nav-xml-results {
    position: absolute;
    top: 110%;
    left: 0;
    right: 0;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    overflow: hidden;
    z-index: 9999;
  }

  .nav-xml-results a {
    display: block;
    padding: 10px 14px;
    font-size: 14px;
    color: #111;
    text-decoration: none;
  }

  .nav-xml-results a:hover {
    background: #f3f4f6;
  }
  `;

  function injectCSS() {
    if (document.getElementById("nav-xml-search-css")) return;
    const style = document.createElement("style");
    style.id = "nav-xml-search-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  class NavXMLSearch {
    constructor(nav) {
      this.nav = nav;
      this.data = [];
      this.init();
    }

    async init() {
      injectCSS();

      this.container = document.createElement("div");
      this.container.className = "nav-xml-search";
      this.container.innerHTML = `
        <input type="text" placeholder="Search..." autocomplete="off">
        <div class="nav-xml-results" hidden></div>
      `;

      this.nav.appendChild(this.container);

      this.input = this.container.querySelector("input");
      this.results = this.container.querySelector(".nav-xml-results");

      await this.loadXML();
      this.bind();
    }

    async loadXML() {
      try {
        const res = await fetch(XML_PATH, { cache: "force-cache" });
        const txt = await res.text();
        const xml = new DOMParser().parseFromString(txt, "text/xml");
        this.data = [...xml.querySelectorAll("loc")]
          .map(n => n.textContent.trim());
      } catch (e) {
        console.error("[NavXMLSearch] Failed to load XML", e);
      }
    }

    bind() {
      this.input.addEventListener("input", () => {
        const q = this.input.value.toLowerCase();
        this.results.innerHTML = "";

        if (!q) {
          this.results.hidden = true;
          return;
        }

        const matches = this.data
          .filter(url => url.toLowerCase().includes(q))
          .slice(0, 6);

        if (!matches.length) {
          this.results.hidden = true;
          return;
        }

        matches.forEach(url => {
          const a = document.createElement("a");
          a.href = url;
          a.textContent = url;
          this.results.appendChild(a);
        });

        this.results.hidden = false;
      });

      document.addEventListener("click", e => {
        if (!this.container.contains(e.target)) {
          this.results.hidden = true;
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector("nav");
    if (nav) new NavXMLSearch(nav);
  });

})();
