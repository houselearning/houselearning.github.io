/* ================================
   Nav XML Search (nav-only)
   ================================ */

(() => {
  const XML_PATH = "/search-task.xml";

  function formatUrlToTitle(url) {
    try {
      // Remove protocol and domain
      let path = url.replace(/^https?:\/\/[^\/]+/, "");

      // Special case for root
      if (path === "/" || path === "") return "HouseLearning Home";

      // Basic cleanup
      path = path.replace(/\/$/, "").replace(/\.html$/, "");

      const segments = path.split("/").filter(s => s && s !== "home");

      if (segments.length === 0) return "HouseLearning";

      // Map common paths to pretty names
      const segmentMap = {
        "math": "Math",
        "computerscience": "Computer Science",
        "computer-science-page": "Computer Science",
        "about": "About Us",
        "auth": "Login / Sign Up",
        "games": "Games",
        "blog": "Blog"
      };

      const parts = segments.map(s => {
        if (segmentMap[s]) return segmentMap[s];

        // Convert kebab-case or underscore to Title Case
        return s.split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      });

      // Format based on depth
      if (parts.length > 1) {
        // e.g. Math: Fractions Add Subtract
        return `${parts[0]}: ${parts.slice(1).join(" ")}`;
      }

      return parts[0];
    } catch (e) {
      return url;
    }
  }

  class NavXMLSearch {
    constructor(nav) {
      this.nav = nav;
      this.data = [];
      this.init();
    }

    async init() {
      // Styles are now in style.css

      this.container = document.createElement("div");
      this.container.className = "nav-xml-search";
      this.container.innerHTML = `
        <div class="search-wrapper">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search..." autocomplete="off">
        </div>
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
        const q = this.input.value.toLowerCase().trim();
        this.results.innerHTML = "";

        if (!q) {
          this.results.hidden = true;
          return;
        }

        const matches = this.data
          .filter(url => url.toLowerCase().includes(q))
          .slice(0, 8);

        if (!matches.length) {
          this.results.innerHTML = `<div class="no-results">No matches found for "${q}"</div>`;
          this.results.hidden = false;
          return;
        }

        matches.forEach(url => {
          const a = document.createElement("a");
          const title = formatUrlToTitle(url);
          const shortUrl = url.replace(/^https?:\/\/(www\.)?houselearning\.org/, "");

          a.href = url;
          a.innerHTML = `
            <span class="item-title">${title}</span>
            <span class="item-url">${shortUrl || "/"}</span>
          `;
          this.results.appendChild(a);
        });

        this.results.hidden = false;
      });

      document.addEventListener("click", e => {
        if (!this.container.contains(e.target)) {
          this.results.hidden = true;
        }
      });

      // Close on escape
      this.input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.results.hidden = true;
          this.input.blur();
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const actions = document.querySelector(".nav-actions");
    if (actions) new NavXMLSearch(actions);
  });

})();
