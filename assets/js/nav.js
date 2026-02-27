(() => {
  const toggle = document.querySelector(".nav-toggle");
  if (!toggle) return;

  const navId = toggle.getAttribute("aria-controls") || "site-nav";
  const nav = document.getElementById(navId);
  if (!nav) return;

  const root = document.documentElement;

  let backdrop = document.querySelector(".nav-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);
  }

  function setOpen(open) {
    root.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    if (open) {
      setTimeout(() => {
        const firstFocusable = nav.querySelector("a, button, [tabindex]:not([tabindex='-1'])");
        if (firstFocusable && typeof firstFocusable.focus === "function") {
          firstFocusable.focus();
        }
      }, 0);
    }
  }

  toggle.addEventListener("click", () => {
    setOpen(!root.classList.contains("nav-open"));
  });

  backdrop.addEventListener("click", () => setOpen(false));

  nav.addEventListener("click", (e) => {
    const target = e.target;
    if (target instanceof Element && target.closest("a")) setOpen(false);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  const mq = window.matchMedia("(max-width: 980px)");
  const onMqChange = () => {
    if (!mq.matches) setOpen(false);
  };
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", onMqChange);
  else if (typeof mq.addListener === "function") mq.addListener(onMqChange);
})();

