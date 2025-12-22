/* cookiebanner.js with Alt+C shortcut to open settings
   Drop in /cookiebanner.js and include <script src="/cookiebanner.js" defer></scriept>
*/

(function () {
  var PRIVACY_URL = "/privacy.html";
  var COOKIE_NAME = "hl_cookie_consent";
  var COOKIE_EXPIRE_DAYS = 365;
  var BANNER_ID = "hl-cookie-banner";
  var MODAL_ID = "hl-cookie-modal";
  var FOOTER_ID = "hl-site-footer"; // ID for the footer

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function ce(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function(c){ 
      if (typeof c === "string") el.appendChild(document.createTextNode(c)); 
      else el.appendChild(c); 
    });
    return el;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days||365)*24*60*60*1000);
    document.cookie = name + "=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function parseConsent() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  
  var changeCallbacks = [];
  
  function notifyChange(obj) { 
    changeCallbacks.forEach(fn => { try { fn(obj); } catch(e){} }); 
    if (obj && obj.analytics) {
      loadGA();
    }
  }

  function saveConsent(obj) {
    setCookie(COOKIE_NAME, JSON.stringify(obj), COOKIE_EXPIRE_DAYS);
    notifyChange(obj);
  }

  window.cookieConsent = {
    get: function(){ return parseConsent(); },
    isAllowed: function(cat){ var c = parseConsent(); return c ? !!c[cat] : false; },
    onChange: function(fn){ if (typeof fn==="function") changeCallbacks.push(fn); },
    openSettings: function(){ openModal(); },
    acceptAll: function(){ 
      var c={analytics:true,marketing:true,accepted:true,savedAt:new Date().toISOString()}; 
      saveConsent(c); hideBanner(); 
    },
    rejectAll: function(){ 
      var c={analytics:false,marketing:false,accepted:false,savedAt:new Date().toISOString()}; 
      saveConsent(c); hideBanner(); 
    }
  };

  // 🚀 COMPACTED CSS INTO A SINGLE LINE TO ENSURE RELIABLE APPLICATION 🚀
  var css = `
  #${BANNER_ID}{position:fixed;left:16px;right:16px;bottom:16px;background:#0f1724;color:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.5);z-index:2147483646;padding:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;}
  #${BANNER_ID} .hl-left{flex:1;min-width:200px}
  #${BANNER_ID} h4{margin:0 0 6px 0;font-size:15px}
  #${BANNER_ID} p{margin:0;font-size:13px;opacity:0.95}
  #${BANNER_ID} .hl-actions{display:flex;gap:8px;align-items:center}
  .hl-btn{background:#fff;color:#071021;border:none;padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer}
  .hl-btn.secondary{background:transparent;border:1px solid rgba(255,255,255,0.12);color:#fff}
  .hl-link{color:rgba(255,255,255,0.9);text-decoration:underline;cursor:pointer;font-size:13px}
  #${MODAL_ID}{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#fff;color:#0b1220;border-radius:12px;box-shadow:0 20px 60px rgba(2,6,23,0.35);padding:20px;max-width:560px;width:calc(100% - 40px);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;display:none}
  #${MODAL_ID} h3{margin:0 0 8px 0;font-size:18px;color:#071021}
  .hl-toggle-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid #eef3f7}
  .hl-toggle-row:first-of-type{border-top:0}
  .hl-switch{display:inline-block;width:46px;height:28px;border-radius:999px;background:#e6eef6;position:relative;cursor:pointer}
  .hl-switch .dot{position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(11,17,34,0.08);transition:all 0.18s ease}
  .hl-switch.on{background:#c9f6e6}
  .hl-switch.on .dot{left:22px}
  .hl-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
  #${FOOTER_ID}{padding:24px 16px;margin-top:40px;border-top:1px solid #eef3f7;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#475569;font-size:14px;background:#fcfcfc;}
  #${FOOTER_ID} .hl-footer-content{display:flex;justify-content:space-between;align-items:center;max-width:1200px;margin:0 auto;flex-wrap:wrap;gap:16px;}
  #${FOOTER_ID} .hl-footer-links{flex-grow:1;text-align:center;min-width: 250px;} 
  #${FOOTER_ID} .hl-footer-links a{color:#475569;text-decoration:none;margin:0 10px;transition:color 0.15s ease}
  #${FOOTER_ID} .hl-footer-links a:hover{color:#071021}
  #${FOOTER_ID} .hl-footer-logo{flex-basis:auto;order:3;} 
  #${FOOTER_ID} .hl-footer-logo img{width:32px;height:32px;display:block;margin-left:auto;} /* Added margin-left:auto to push logo right on desktop */
  @media (max-width: 600px) {
    #${FOOTER_ID} .hl-footer-content{justify-content:center;flex-direction:column-reverse;}
    #${FOOTER_ID} .hl-footer-logo{order:1;margin-bottom:10px;text-align:center;}
    #${FOOTER_ID} .hl-footer-logo img{margin-left:auto;margin-right:auto;} /* Center logo on mobile */
    #${FOOTER_ID} .hl-footer-links{order:2;margin-bottom:10px;}
  }
  `;
  
  var s = document.createElement("style"); 
  s.textContent = css.replace(/[\n\r\t]/g, '').replace(/\s{2,}/g, ' ').trim(); // Final compacting step
  document.head.appendChild(s); 

  function buildBanner() {
    if (qs("#" + BANNER_ID)) return;
    var banner = ce("div", { id: BANNER_ID });
    var left = ce("div", { class: "hl-left" }, [
      ce("h4", {}, ["HouseLearning uses cookies"]),
      ce("p", {}, [
        "We use cookies to analyze traffic (via Google Analytics), enable logins, and improve the site experience. ",
        "We may process personal info you provide (like email, name, and login details). ",
        "Manage your preferences, accept all, or reject all. ",
        "Tip: Press Alt + C anytime to reopen settings."
      ])
    ]);
    var actions = ce("div", { class: "hl-actions" });
    var manage = ce("button", { class: "hl-btn secondary" }, ["Manage"]);
    manage.addEventListener("click", openModal);
    var reject = ce("button", { class: "hl-btn secondary" }, ["Reject All"]);
    reject.addEventListener("click", function(){ window.cookieConsent.rejectAll(); });
    var accept = ce("button", { class: "hl-btn" }, ["Accept All"]);
    accept.addEventListener("click", function(){ window.cookieConsent.acceptAll(); });
    var privacy = ce("a", { class: "hl-link", href: PRIVACY_URL, target: "_blank" }, ["Privacy Policy"]);
    [privacy, manage, reject, accept].forEach(x=>actions.appendChild(x));
    banner.appendChild(left); banner.appendChild(actions);
    document.body.appendChild(banner);
  }
  
  function buildFooter() {
    if (qs("#" + FOOTER_ID)) return;
    
    var footer = ce("footer", { id: FOOTER_ID });
    var content = ce("div", { class: "hl-footer-content" });

    // Middle Links
    var links = ce("div", { class: "hl-footer-links" });
    links.appendChild(ce("a", { href: "/privacy.html" }, ["Privacy"]));
    links.appendChild(ce("a", { href: "/index.html" }, ["Home"]));
    links.appendChild(ce("a", { href: "/apply/" }, ["Apply"]));
    links.appendChild(ce("a", { href: "/staff/" }, ["Staff"]));
    links.appendChild(ce("a", { href: "/docs/" }, ["Documentation"]));
    links.appendChild(ce("a", { href: "https://forms.gle/4rdPFAX4g8apGFpv6", target: "_blank" }, ["Contact"]));

    // Right Logo
    var logoContainer = ce("div", { class: "hl-footer-logo" });
    var logo = ce("img", { src: "https://houselearning.org/android-chrome-192x192.png", alt: "HouseLearning Logo" });
    logoContainer.appendChild(logo);

    content.appendChild(links);
    content.appendChild(logoContainer);

    footer.appendChild(content);
    document.body.appendChild(footer);
  }

  function buildModal() {
    if (qs("#" + MODAL_ID)) return;
    var modal = ce("div", { id: MODAL_ID, role: "dialog", "aria-modal": "true" });
    modal.innerHTML = `
      <h3>Cookie preferences</h3>
      <div class="hl-toggle-row">
        <div><strong>Analytics cookies</strong><br><span style="font-size:13px;color:#425466">Helps us understand site usage via Google Analytics.</span></div>
        <div id="switch-analytics" class="hl-switch"><div class="dot"></div></div>
      </div>
      <div class="hl-toggle-row">
        <div><strong>Essential cookies</strong><br><span style="font-size:13px;color:#425466">Required for login forms and saving your account session.</span></div>
        <div class="hl-switch on"><div class="dot"></div></div>
      </div>
      <div class="hl-toggle-row">
        <div><strong>Marketing cookies</strong><br><span style="font-size:13px;color:#425466">Used for personalized content/ads (currently not used).</span></div>
        <div id="switch-marketing" class="hl-switch"><div class="dot"></div></div>
      </div>
      <div class="hl-modal-actions">
        <button id="hl-reject" class="hl-btn secondary">Reject All</button>
        <button id="hl-cancel" class="hl-btn secondary">Cancel</button>
        <button id="hl-save" class="hl-btn">Save preferences</button>
      </div>`;
    document.body.appendChild(modal);

    function toggleSwitch(id) {
      var sw = qs(id);
      if (sw) sw.addEventListener("click", ()=>sw.classList.toggle("on"));
    }
    toggleSwitch("#switch-analytics");
    toggleSwitch("#switch-marketing");

    qs("#hl-save").addEventListener("click", function(){
      var c = {
        analytics: qs("#switch-analytics").classList.contains("on"),
        marketing: qs("#switch-marketing").classList.contains("on"),
        accepted:true,
        savedAt:new Date().toISOString()
      };
      saveConsent(c); closeModal(); hideBanner();
    });
    qs("#hl-cancel").addEventListener("click", closeModal);
    qs("#hl-reject").addEventListener("click", function(){ window.cookieConsent.rejectAll(); closeModal(); });
  }

  function openModal() {
    buildModal();
    var modal = qs("#"+MODAL_ID);
    modal.style.display = "block";
    var c = parseConsent()||{};
    if(c.analytics) qs("#switch-analytics").classList.add("on"); else qs("#switch-analytics").classList.remove("on");
    if(c.marketing) qs("#switch-marketing").classList.add("on"); else qs("#switch-marketing").classList.remove("on");
  }
  function closeModal() { var m=qs("#"+MODAL_ID); if(m) m.style.display="none"; }
  function hideBanner() { var b=qs("#"+BANNER_ID); if(b) b.style.display="none"; }

  function init() {
    var c = parseConsent(); 
    buildFooter(); 
    buildBanner();
    if(c) hideBanner();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();

  // Alt + C shortcut to open settings
  document.addEventListener("keydown", function(e){
    if(e.altKey && (e.key==="c"||e.key==="C")) {
      e.preventDefault();
      openModal();
    }
  });

function loadGA() {
  if (window._gaLoaded) return; 
  window._gaLoaded = true;
  var gtagScript = document.createElement("script");
  gtagScript.async = true;
  gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=G-P42LD5XN48"; 
  document.head.appendChild(gtagScript);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", "G-P42LD5XN48"); 
}

var initialConsent = parseConsent();
if (initialConsent && initialConsent.analytics) {
  loadGA();
}

})();
