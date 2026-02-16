
(function () {
  // -----------------------
  // CONFIG
  // -----------------------
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
    authDomain: "contract-center-llc-10.firebaseapp.com",
    projectId: "contract-center-llc-10",
    storageBucket: "contract-center-llc-10.firebasestorage.app",
    messagingSenderId: "323221512767",
    appId: "1:323221512767:web:6421260f875997dbf64e8a",
  };

  const BETWEEN_SESSION_PROB = 0.5;
  const DURING_SESSION_PROB = 0.2;
  const MIN_SHOW_DELAY_MS = 2000;
  const MAX_SHOW_DELAY_MS = 10000;
  const DAILY_LIMIT = 15;
  const COOLDOWN_SECONDS = 20;

  const LOCAL_QUEUE_KEY = "survey_save_queue_v1";
  const ANON_ID_KEY = "anonSurveyId_v1";
  const SESSION_BUCKET_KEY = "survey_session_bucket_v1";
  const SURVEY_RATE_COLLECTION = "survey_rate";

  // -----------------------
  // UTIL: load script (FIXED)
  // -----------------------
  function loadScript(url) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => res();
      s.onerror = (e) => rej(e);
      // FIX: Check if head exists, otherwise use documentElement
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.apps && window._survey_db) return;
    const base = "https://www.gstatic.com/firebasejs/9.22.2";
    await loadScript(base + "/firebase-app-compat.js");
    await loadScript(base + "/firebase-firestore-compat.js");
    await loadScript(base + "/firebase-auth-compat.js");
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    window._survey_db = firebase.firestore();
    window._survey_auth = firebase.auth();
  }

  // -----------------------
  // ICONS (SVGs for Smiley Bar)
  // -----------------------
  const SMILEYS = {
    1: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 9v.01"></path><path d="M8 9v.01"></path><path d="M16 16c-.5-1.5-1.5-3-4-3s-3.5 1.5-4 3"></path></svg>`, // Unhappy
    2: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><path d="M15 16c-.5-1-2-1.5-3-1.5s-2.5.5-3 1.5"></path></svg>`, // Sad
    3: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`, // Neutral
    4: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><path d="M9 14c1.5 2 4.5 2 6 0"></path></svg>`, // Happy
    5: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`  // Delighted
  };

  // -----------------------
  // COOKIE & ACTIVITY
  // -----------------------
  function userAcceptedCookies() {
    try {
      const v = document.cookie.split(";").map(s => s.trim()).find(s => s.startsWith("cookie_consent="));
      if (v) return v.split("=")[1] === "1";
    } catch (e) {}
    return true; 
  }

  let activity = {
    pagesViewed: parseInt(localStorage.getItem("survey_pagesViewed_v1") || "0", 10) + 1,
    totalClicks: 0,
    scrollDepthPct: 0,
    timeOnPageStart: Date.now(),
    featuresUsed: new Set(),
    lastVisitedPath: location.pathname + location.search,
  };
  localStorage.setItem("survey_pagesViewed_v1", String(activity.pagesViewed));

  document.addEventListener("click", () => activity.totalClicks++);
  window.addEventListener("scroll", () => {
    const denom = Math.max(document.body.scrollHeight - window.innerHeight, 1);
    const depth = Math.floor((window.scrollY / denom) * 100);
    if (depth > activity.scrollDepthPct) activity.scrollDepthPct = depth;
  });
  window.SurveyFeedback = window.SurveyFeedback || {};
  window.SurveyFeedback.trackFeature = function (name) {
    if (!name) return;
    activity.featuresUsed.add(name);
  };

  function timeSpentSeconds() {
    return Math.round((Date.now() - activity.timeOnPageStart) / 1000);
  }

  function snapshotActivity() {
    return {
      pagesViewed: activity.pagesViewed,
      totalClicks: activity.totalClicks,
      scrollDepthPct: activity.scrollDepthPct,
      timeOnPageSec: timeSpentSeconds(),
      featuresUsed: Array.from(activity.featuresUsed),
      path: activity.lastVisitedPath,
      userAgent: navigator.userAgent,
    };
  }

  // -----------------------
  // QUESTION POOL
  // -----------------------
  const EXTRA_QUESTIONS = [
    "How clear were the labels and headings?",
    "Did the search feature return useful results?",
    "Was the page load speed acceptable?",
    "Did you find what you came for today?",
    "Was the signup/sign-in flow straightforward?",
    "Did images and media load correctly?",
    "Was the site layout mobile-friendly?",
    "How visually appealing did the site look?",
    "Was the help/FAQ section useful?",
    "Would you recommend this site to a friend?",
  ];

  function generateQuestions(max = 5) {
    const q = [];
    if (activity.pagesViewed > 3) q.push(`You visited ${activity.pagesViewed} pages — how easy was navigation?`);
    else if (timeSpentSeconds() > 60) q.push("You spent time exploring — was the experience useful?");
    else q.push("How would you rate your experience so far?");

    let i = 0;
    while (q.length < max && i < EXTRA_QUESTIONS.length) {
      q.push(EXTRA_QUESTIONS[i]);
      i++;
    }
    return q;
  }

  // -----------------------
  // UI STYLES (FIXED)
  // -----------------------
  function addStyles() {
    if (document.getElementById("survey-feedback-styles-v1")) return;
    const s = document.createElement("style");
    s.id = "survey-feedback-styles-v1";
    s.innerHTML = `
      /* Popup */
      .survey-popup { position: fixed; bottom: 24px; right: 24px; width: 380px; max-width: calc(100vw - 40px); background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-family:Inter,ui-sans-serif,system-ui;z-index:999999;padding:10px; }
      .survey-header{display:flex;justify-content:space-between;align-items:center;font-weight:700;padding:6px 8px;}
      .survey-close{background:transparent;border:0;font-size:18px;cursor:pointer}
      .survey-content{padding:8px;max-height:60vh;overflow-y:auto;overflow-x:hidden}
      .survey-question{margin:15px 0 10px 0;font-weight:600;font-size:15px;color:#222;}
      
      /* Smiley Bar */
      .smiley-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; position: relative; padding: 0 5px; }
      .smiley-btn { background: transparent; border: none; cursor: pointer; color: #888; transition: all 0.2s; padding: 5px; border-radius: 50%; }
      .smiley-btn svg { width: 36px; height: 36px; stroke-width: 1.5px; }
      .smiley-btn:hover { color: #555; transform: scale(1.1); background: #f0f0f0; }
      .smiley-btn.selected { color: #1976d2; transform: scale(1.15); background: #e3f2fd; stroke-width: 2.5px; }
      
      .smiley-labels { display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-top: -10px; padding: 0 8px; font-weight: 500; }
      
      /* Standard buttons fallback */
      .survey-answers button.text-opt{padding:8px 10px;border-radius:8px;border:1px solid #ddd;background:#f7f7f7;cursor:pointer;margin-right:6px;margin-bottom:6px}
      .survey-answers button.text-opt.selected{outline:2px solid #1976d2;background:#e8f0ff}

      /* Sidebar & Others */
      .feedback-sidebar{position:fixed;top:0;right:-420px;width:380px;height:100vh;background:#fff;box-shadow:-6px 0 30px rgba(0,0,0,.18);transition:right .36s;z-index:999998;padding:18px;font-family:Inter,system-ui}
      .feedback-sidebar.open{right:0}
      .open-survey-btn{width:100%;margin-top:12px;padding:10px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer;font-weight:600}
      .close-sidebar-btn{padding:6px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer}
      .screenshot-upload{margin-top:8px;display:flex;gap:8px;align-items:center}
      
      /* Warnings & Toast */
      .survey-warning{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000000}
      .warning-box{background:#fff;padding:18px;border-radius:10px;text-align:center;width:320px}
      #survey-toast{position:fixed;bottom:20px;left:20px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;z-index:999999}

      /* --- New styles for feedback toggle button and toast --- */
      .stop-feedback-btn {
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid #ddd;
        background: #fff;
        cursor: pointer;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .stop-feedback-btn.disabled {
        opacity: 0.6;
        pointer-events: none;
      }
      #survey-toggle-toast {
        position: fixed;
        bottom: 16px;
        right: 16px;
        background: #111;
        color: #fff;
        padding: 10px 12px;
        border-radius: 8px;
        z-index: 1000001;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #survey-toggle-toast .close-sidebar-btn {
        padding: 4px 8px;
        border: 0;
        background: transparent;
        color: #fff;
        cursor: pointer;
        border-radius: 6px;
      }

      /* Mobile bottom-sheet styles (applies automatically on small screens) */
      @media (max-width: 600px) {
        .survey-popup {
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 90vh;
          max-height: 90vh;
          border-radius: 12px 12px 0 0;
          padding: 12px 12px 18px;
          box-sizing: border-box;
          overflow: hidden;
          transform: translateY(100%);
          transition: transform 320ms cubic-bezier(.22,.9,.31,1);
          -webkit-transition: transform 320ms cubic-bezier(.22,.9,.31,1);
          will-change: transform;
        }
        .survey-popup.sheet-open {
          transform: translateY(0);
        }

        /* handle at the top so it looks like a sheet */
        .survey-popup .sheet-handle {
          width: 100%;
          display:flex;
          justify-content:center;
          margin-bottom:8px;
        }
        .survey-popup .sheet-handle .handle-bar {
          width: 56px;
          height: 6px;
          background: #e0e0e0;
          border-radius: 6px;
        }

        /* content area scrolls, leave space for footer */
        .survey-content {
          max-height: calc(90vh - 120px); /* header + footer + handle */
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 12px;
        }

        /* footer fixed inside the sheet */
        .survey-popup .sheet-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 12px;
          box-shadow: 0 -8px 20px rgba(0,0,0,0.06);
          background: #fff;
          display:flex;
          gap:8px;
          justify-content:space-between;
          align-items:center;
        }
        .survey-popup .sheet-footer .open-survey-btn {
          flex: 1 1 auto;
          margin: 0;
        }
        .survey-popup .sheet-footer .close-sidebar-btn {
          flex: 0 0 auto;
          margin: 0;
        }

        /* make smileys larger and easier to tap */
        .smiley-container { gap: 6px; justify-content: space-around; padding: 6px 6px; }
        .smiley-btn { padding: 10px; border-radius: 10px; }
        .smiley-btn svg { width: 48px; height: 48px; }

        /* show a caption row with five evenly spaced captions under the icons */
        .smiley-labels { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-top: 6px; padding: 0 6px; width: 100%; box-sizing: border-box; }
        .smiley-labels span { width: 20%; text-align: center; }

        /* small adjustments to header */
        .survey-header { padding: 8px 6px; gap:8px; }
        .survey-close { font-size: 20px; padding: 6px; }

        /* Ensure body isn't scrollable behind full sheet on open */
        body.survey-sheet-active { overflow: hidden; }
      }

      /* Forced-mobile: same mobile styles but applied whenever the page is in "forced mobile" mode */
      .survey-forced-mobile .survey-popup {
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        height: 90vh;
        max-height: 90vh;
        border-radius: 12px 12px 0 0;
        padding: 12px 12px 18px;
        box-sizing: border-box;
        overflow: hidden;
        transform: translateY(100%);
        transition: transform 320ms cubic-bezier(.22,.9,.31,1);
        -webkit-transition: transform 320ms cubic-bezier(.22,.9,.31,1);
        will-change: transform;
      }
      .survey-forced-mobile .survey-popup.sheet-open { transform: translateY(0); }

      .survey-forced-mobile .survey-popup .sheet-handle {
        width: 100%;
        display:flex;
        justify-content:center;
        margin-bottom:8px;
      }
      .survey-forced-mobile .survey-popup .sheet-handle .handle-bar {
        width: 56px;
        height: 6px;
        background: #e0e0e0;
        border-radius: 6px;
      }

      .survey-forced-mobile .survey-content {
        max-height: calc(90vh - 120px);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 12px;
      }

      .survey-forced-mobile .survey-popup .sheet-footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 12px;
        box-shadow: 0 -8px 20px rgba(0,0,0,0.06);
        background: #fff;
        display:flex;
        gap:8px;
        justify-content:space-between;
        align-items:center;
      }
      .survey-forced-mobile .survey-popup .sheet-footer .open-survey-btn { flex: 1 1 auto; margin: 0; }
      .survey-forced-mobile .survey-popup .sheet-footer .close-sidebar-btn { flex: 0 0 auto; margin: 0; }

      .survey-forced-mobile .smiley-container { gap: 6px; justify-content: space-around; padding: 6px 6px; }
      .survey-forced-mobile .smiley-btn { padding: 10px; border-radius: 10px; }
      .survey-forced-mobile .smiley-btn svg { width: 48px; height: 48px; }

      .survey-forced-mobile .smiley-labels { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-top: 6px; padding: 0 6px; width: 100%; box-sizing: border-box; }
      .survey-forced-mobile .smiley-labels span { width: 20%; text-align: center; }

      .survey-forced-mobile .survey-header { padding: 8px 6px; gap:8px; }
      .survey-forced-mobile .survey-close { font-size: 20px; padding: 6px; }

      .survey-forced-mobile body.survey-sheet-active, .survey-forced-mobile .survey-sheet-active { overflow: hidden; }

    `;
    // FIX: Check if head exists
    (document.head || document.documentElement).appendChild(s);
  }

  // -----------------------
  // HELPERS
  // -----------------------
  function el(tag, attrs = {}, html = "") {
    const e = document.createElement(tag);
    Object.assign(e, attrs);
    e.innerHTML = html;
    return e;
  }
  
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // NEW: persistent force-mobile helpers (null = auto)
  function getForceMobile() {
    const v = localStorage.getItem('survey_force_mobile_v1');
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  }
  function setForceMobile(val) {
    if (val === null) localStorage.removeItem('survey_force_mobile_v1');
    else localStorage.setItem('survey_force_mobile_v1', val ? '1' : '0');

    // Apply/remove class immediately so popups pick up styles
    try {
      if (val === true) document.documentElement.classList.add('survey-forced-mobile');
      else document.documentElement.classList.remove('survey-forced-mobile');
    } catch(e){}

    // show toast summarizing new mode
    if (val === null) showToggleToast('View mode: auto');
    else showToggleToast(val ? 'Forced mobile view' : 'Forced desktop view');
  }
  function toggleForceMobile() {
    const curr = getForceMobile();
    const next = curr === true ? false : true;
    setForceMobile(next);
    // if a popup is open, refresh it so layout adapts
    try {
      if (window._survey_feedback_popup && document.body.contains(window._survey_feedback_popup)) {
        window._survey_feedback_popup.remove();
        setTimeout(() => { try { window.SurveyFeedback.openSurveyNow(); } catch(e){} }, 220);
      }
    } catch(e){}
  }

  // UPDATED: small-screen detector used by createSurveyPopup
  function isSmallScreen() {
    try {
      const forced = getForceMobile();
      if (forced === true) return true;
      if (forced === false) return false;
      return window.innerWidth <= 600;
    } catch (e) { return false; }
  }

  // Generate a cryptographically secure random string of the given length
  function secureRandomString(length) {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    const alphabetLength = alphabet.length;
    let result = "";
    // Each byte from crypto.getRandomValues gives us a value 0-255.
    // We map it into the alphabet range while avoiding modulo bias by discarding
    // values that would make the distribution uneven.
    const bytes = new Uint8Array(length * 2);
    let i = 0;
    while (result.length < length) {
      window.crypto.getRandomValues(bytes);
      while (i < bytes.length && result.length < length) {
        const randomByte = bytes[i++];
        // 36 * 7 = 252, so discard 252-255 to keep selection uniform
        if (randomByte < alphabetLength * 7) {
          result += alphabet.charAt(randomByte % alphabetLength);
        }
      }
      i = 0;
    }
    return result;
  }

  function getAnonId() {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = "anon-" + secureRandomString(10);
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  }

  // --- FOLLOWUP: Add feedback-enabled helpers, keyboard toggle and toast functions ---

  {
    // Add helpers to persist whether the survey popup is enabled (default true)
    function getFeedbackEnabled() {
      const v = localStorage.getItem('survey_window_enabled_v1');
      return v === null ? true : v === '1';
    }
    function setFeedbackEnabled(enabled) {
      localStorage.setItem('survey_window_enabled_v1', enabled ? '1' : '0');
      const stopBtns = document.querySelectorAll('.stop-feedback-btn');
      stopBtns.forEach(b => b.classList.toggle('disabled', !enabled));
      showToggleToast(`Feedback window will be ${enabled ? 'enabled' : 'disabled'}`, enabled);
    }

    function showToggleToast(text, enabled) {
      const existing = document.getElementById('survey-toggle-toast');
      if (existing) existing.remove();
      const wrap = el('div', { id: 'survey-toggle-toast', style: 'position:fixed;bottom:16px;right:16px;background:#111;color:#fff;padding:10px 12px;border-radius:8px;z-index:1000001;display:flex;align-items:center;gap:10px' });
      wrap.innerHTML = `<div style="font-weight:600">${escapeHtml(text)}</div>`;
      const closeBtn = el('button', { className: 'close-sidebar-btn', innerText: '✕', style: 'padding:4px 8px;border:0;background:transparent;color:#fff;cursor:pointer;border-radius:6px' });
      closeBtn.onclick = () => { wrap.remove(); };
      wrap.appendChild(closeBtn);
      document.body.appendChild(wrap);
      setTimeout(() => { try { wrap.remove(); } catch(e){} }, 5000);
    }

    // Keyboard shortcuts: ALT+W toggles enable/disable; ALT+F opens the feedback dialog
    // NEW: track pressed keys to detect Alt+T+M simultaneously
    const _survey_pressedKeys = new Set();
    document.addEventListener('keydown', (ev) => {
      // add key to pressed set
      const k = (ev.key || '').toLowerCase();
      _survey_pressedKeys.add(k);

      // ignore if typing in inputs/textarea or contentEditable
      const tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : null;
      if (tag === 'input' || tag === 'textarea' || ev.target.isContentEditable) return;

      // ALT+W toggles the feedback window on/off
      if (ev.altKey && (ev.key === 'w' || ev.key === 'W')) {
        ev.preventDefault();
        setFeedbackEnabled(!getFeedbackEnabled());
        return;
      }

      // ALT+F opens the feedback dialog (always attempt to open)
      if (ev.altKey && (ev.key === 'f' || ev.key === 'F')) {
        ev.preventDefault();
        // Prefer public API if available, otherwise call createSurveyPopup fallback
        if (window.SurveyFeedback && typeof window.SurveyFeedback.openSurveyNow === 'function') {
          try { window.SurveyFeedback.openSurveyNow(); } catch (e) { /* ignore */ }
        } else if (typeof createSurveyPopup === 'function') {
          try { createSurveyPopup(generateQuestions(4)); } catch (e) { /* ignore */ }
        }
        return;
      }

      // ALT + T + M (pressed together) toggles forced mobile/desktop
      if (ev.altKey && _survey_pressedKeys.has('t') && _survey_pressedKeys.has('m')) {
        ev.preventDefault();
        toggleForceMobile();
        return;
      }
    });

    // remove keys on keyup so the pressed set stays accurate
    document.addEventListener('keyup', (ev) => {
      const k = (ev.key || '').toLowerCase();
      _survey_pressedKeys.delete(k);
    });
  }

  // -----------------------
  // FIRESTORE LOGIC
  // -----------------------
  async function loadRateDoc(uid) {
    await ensureFirebase();
    const db = window._survey_db;
    try {
      const snap = await db.collection(SURVEY_RATE_COLLECTION).doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (e) { return null; }
  }

  async function saveRateDoc(uid, data) {
    await ensureFirebase();
    try { await window._survey_db.collection(SURVEY_RATE_COLLECTION).doc(uid).set(data, { merge: true }); } catch (e) {}
  }

  async function canTakeSurvey(uid) {
    const nowMs = Date.now();
    let doc = await loadRateDoc(uid);
    if (!doc) return { ok: true, data: { dailyCount: 0, lastSurvey: null, dayStart: nowMs } };

    let lastSurveyMs = doc.lastSurvey ? doc.lastSurvey.toMillis() : 0;
    let dayStartMs = doc.dayStart ? doc.dayStart.toMillis() : nowMs;
    let dailyCount = doc.dailyCount || 0;

    if ((nowMs - dayStartMs) >= 24 * 3600 * 1000) {
      dailyCount = 0;
      dayStartMs = nowMs;
    }

    if (dailyCount >= DAILY_LIMIT) return { ok: false, reason: "DAILY_LIMIT", untilMs: dayStartMs + 86400000 };
    if ((nowMs - lastSurveyMs) / 1000 < COOLDOWN_SECONDS) return { ok: false, reason: "COOLDOWN", wait: Math.ceil(COOLDOWN_SECONDS - ((nowMs - lastSurveyMs)/1000)) };

    return { ok: true };
  }

  async function markSurveyUsed(uid) {
    const nowMs = Date.now();
    let doc = await loadRateDoc(uid);
    let dayStartMs = doc && doc.dayStart ? doc.dayStart.toMillis() : nowMs;
    let dailyCount = doc ? (doc.dailyCount || 0) : 0;
    if ((nowMs - dayStartMs) >= 86400000) { dailyCount = 0; dayStartMs = nowMs; }
    
    await saveRateDoc(uid, {
      dailyCount: dailyCount + 1,
      lastSurvey: firebase.firestore.Timestamp.fromMillis(nowMs),
      dayStart: firebase.firestore.Timestamp.fromMillis(dayStartMs)
    });
  }

  async function saveToFirestore(payload) {
    await ensureFirebase();
    const db = window._survey_db;
    const user = window._survey_auth.currentUser;
    payload._savedAt = new Date().toISOString();
    payload._userId = user ? user.uid : null;
    await db.collection("surveys").add(payload);
    if (user) await db.collection("users").doc(user.uid).collection("surveys").add(payload);
  }

  // -----------------------
  // UI LOGIC
  // -----------------------
  addStyles();

  function createSurveyPopup(questions = []) {
    // Prevent multiple instances: return existing popup if still in DOM
    if (window._survey_feedback_popup && document.body.contains(window._survey_feedback_popup)) {
      // bring it to front slightly
      try { window._survey_feedback_popup.style.zIndex = String(parseInt(window._survey_feedback_popup.style.zIndex || "999999") + 1); } catch(e){}
      return window._survey_feedback_popup;
    }

    const popup = el("div", { className: "survey-popup", role: "dialog" });

    // Monkey-patch remove now so any event handlers that call popup.remove() will also clear the singleton ref
    (function (p) {
      const origRemove = p.remove ? p.remove.bind(p) : null;
      p.remove = function () {
        try { if (origRemove) origRemove(); } catch (e) {}
        if (window._survey_feedback_popup === p) window._survey_feedback_popup = null;
      };
    })(popup);

    // Add a Stop Feedback Window button to the right of the title.
    popup.innerHTML = `
      <div class="survey-header" style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:16px;font-weight:700">We'd love your feedback</div>
          <button type="button" class="stop-feedback-btn" title="Pressing this button will prevent this feedback window from opening. Toggle ALT+W to enable / disable the feedback window." style="padding:6px 8px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:12px">
            Stop Feedback Window <sup style="margin-left:6px;font-weight:700">?</sup>
          </button>
        </div>
        <button class="survey-close">Close</button>
      </div>
      <div class="survey-content"></div>
    `;
    const content = popup.querySelector(".survey-content");

    questions.forEach((qText, qi) => {
      const qDiv = el("div", { className: "survey-block" });
      qDiv.innerHTML = `<div class="survey-question">${escapeHtml(qText)}</div>`;
      
      // INSERT SMILEY BAR
      const smileyCont = el("div", { className: "smiley-container" });
      const labels = el("div", { className: "smiley-labels" });

      // On mobile we want 5 captions (one under each icon); on desktop keep the original left/right labels
      const mobileMode = isSmallScreen();
      if (mobileMode) {
        // five captions evenly spaced (first = Unhappy, last = Delighted)
        labels.innerHTML = `<span>Unhappy</span><span></span><span></span><span></span><span>Delighted</span>`;
      } else {
        labels.innerHTML = `<span style="text-align:left">Unhappy</span><span style="text-align:right">Delighted</span>`;
      }

      [1, 2, 3, 4, 5].forEach(rating => {
        const btn = el("button", { type: "button", className: "smiley-btn", title: String(rating) });
        btn.innerHTML = SMILEYS[rating];
        btn.onclick = () => {
          // Deselect others
          Array.from(smileyCont.children).forEach(c => c.classList.remove("selected"));
          btn.classList.add("selected");
          smileyCont.dataset.value = rating; // Save logic
        };
        smileyCont.appendChild(btn);
      });

      qDiv.appendChild(smileyCont);
      qDiv.appendChild(labels);
      content.appendChild(qDiv);
    });

    // Optional Comment
    const textArea = el("textarea", { placeholder: "Tell us more... (optional)", style: "width:100%;margin-top:15px;padding:8px;border-radius:8px;border:1px solid #ccc;" });
    content.appendChild(textArea);

    // Screenshot
    const screenRow = el("div", { className: "screenshot-upload" });
    const fileInput = el("input", { type: "file", accept: "image/*" });
    screenRow.appendChild(el("label", {}, "Attach screenshot (optional)"));
    screenRow.appendChild(fileInput);
    content.appendChild(screenRow);

    // Buttons (created but may be moved into footer on mobile)
    const submitRow = el("div", { style: "display:flex;gap:8px;margin-top:12px" });
    const submitBtn = el("button", { className: "open-survey-btn", innerText: "Submit" });
    const laterBtn = el("button", { className: "close-sidebar-btn", innerText: "Close", style: "margin-top:12px;" });
    
    submitRow.appendChild(submitBtn);
    submitRow.appendChild(laterBtn);
    // by default append to content; on mobile we'll move into a fixed footer
    content.appendChild(submitRow);

    // Events
    popup.querySelector(".survey-close").onclick = () => showCloseSurveyWarning(popup);
    laterBtn.onclick = () => popup.remove();

    submitBtn.onclick = async () => {
      const answers = [];
      content.querySelectorAll(".survey-block").forEach(blk => {
        const q = blk.querySelector(".survey-question").innerText;
        const val = blk.querySelector(".smiley-container").dataset.value;
        if(val) answers.push({ q, rating: parseInt(val) });
      });

      const payload = {
        timestamp: new Date().toISOString(),
        activity: snapshotActivity(),
        answers,
        comment: textArea.value,
        userAgent: navigator.userAgent
      };

      if (fileInput.files[0]) {
        try { payload.screenshot = await fileToBase64(fileInput.files[0]); } catch(e){}
      }

      try {
        await saveToFirestore(payload);
        showTinyToast("Feedback Sent!");
      } catch (err) {
        showTinyToast("Error saving feedback.");
        console.error(err);
      }
      
      const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : getAnonId();
      markSurveyUsed(uid);
      popup.remove();
    };

    // After building UI elements, wire stop button behavior + initial state
    const stopBtn = popup.querySelector('.stop-feedback-btn');
    if (stopBtn) {
      stopBtn.classList.toggle('disabled', !getFeedbackEnabled());
      stopBtn.onclick = (e) => {
        e.stopPropagation();
        const newState = !getFeedbackEnabled();
        setFeedbackEnabled(newState);
      };
    }

    // Mobile: bottom-sheet behavior with swipe to dismiss + handle + footer
    const mobile = isSmallScreen();
    if (mobile) {
      popup.classList.add('mobile-sheet');

      // add top handle for visual affordance
      const handle = el('div', { className: 'sheet-handle' });
      handle.innerHTML = '<div class="handle-bar"></div>';
      popup.insertBefore(handle, popup.firstChild);

      // create a fixed footer and move buttons into it
      const footer = el('div', { className: 'sheet-footer' });
      // remove submitRow from content (if appended) and put into footer
      try { submitRow.parentElement && submitRow.parentElement.removeChild(submitRow); } catch(e){}
      footer.appendChild(submitRow);
      popup.appendChild(footer);

      // append hidden first so we can measure
      document.body.appendChild(popup);
      // register as active popup
      window._survey_feedback_popup = popup;

      // prevent background scroll while sheet active
      setTimeout(() => {
        document.body.classList.add('survey-sheet-active');
        // trigger open animation
        requestAnimationFrame(() => popup.classList.add('sheet-open'));
      }, 10);

      // handle close with animation
      function animateCloseAndRemove() {
        popup.classList.remove('sheet-open');
        const onEnd = () => {
          try { popup.removeEventListener('transitionend', onEnd); } catch(e){}
          try { document.body.classList.remove('survey-sheet-active'); } catch(e){}
          try { popup.remove(); } catch(e){}
        };
        popup.addEventListener('transitionend', onEnd);
      }

      // wire close buttons to animate down first
      const closeBtn = popup.querySelector('.survey-close');
      if (closeBtn) {
        closeBtn.onclick = () => {
          const result = showCloseSurveyWarning(popup);
          const shouldClose = (result !== false);
          if (shouldClose) {
            animateCloseAndRemove();
          }
        };
      }

      if (laterBtn) laterBtn.onclick = () => animateCloseAndRemove();

      // Touch drag to dismiss (existing logic retained)
      let startY = 0, currentY = 0, dragging = false, sheetHeight = popup.getBoundingClientRect().height;
      const contentEl = popup.querySelector('.survey-content');

      popup.addEventListener('touchstart', (ev) => {
        if (ev.touches.length !== 1) return;
        startY = ev.touches[0].clientY;
        sheetHeight = popup.getBoundingClientRect().height;
        const target = ev.target;
        const allowPull = contentEl.scrollTop === 0 || target.closest('.survey-header') || target.closest('.sheet-handle');
        if (!allowPull) return;
        dragging = true;
        popup.style.transition = 'none';
      }, { passive: true });

      popup.addEventListener('touchmove', (ev) => {
        if (!dragging || ev.touches.length !== 1) return;
        currentY = ev.touches[0].clientY;
        const delta = Math.max(0, currentY - startY);
        popup.style.transform = `translateY(${delta}px)`;
        ev.preventDefault();
      }, { passive: false });

      popup.addEventListener('touchend', (ev) => {
        if (!dragging) return;
        dragging = false;
        popup.style.transition = '';
        const delta = Math.max(0, currentY - startY);
        const dismissThreshold = sheetHeight * 0.25;
        if (delta > dismissThreshold) {
          popup.style.transform = `translateY(100%)`;
          popup.addEventListener('transitionend', function _t() {
            popup.removeEventListener('transitionend', _t);
            try { document.body.classList.remove('survey-sheet-active'); } catch(e){}
            try { popup.remove(); } catch(e){}
          });
        } else {
          popup.style.transform = `translateY(0)`;
        }
      }, { passive: true });

    } else {
      // Desktop: normal append + close wiring (unchanged)
      document.body.appendChild(popup);
      window._survey_feedback_popup = popup;

      popup.querySelector(".survey-close").onclick = () => showCloseSurveyWarning(popup);
      const laterBtnDesktop = popup.querySelector(".close-sidebar-btn");
      if (laterBtnDesktop) laterBtnDesktop.onclick = () => popup.remove();
    }

    return popup;
  }

  function showCloseSurveyWarning(popup) {
    const warn = el("div", { className: "survey-warning" });
    warn.innerHTML = `
      <div class="warning-box">
        <p style="font-weight:700">Discard Feedback?</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
          <button class="close-sidebar-btn" id="warn-stay">Keep Editing</button>
          <button class="close-sidebar-btn" id="warn-exit" style="background:#fdeeee;color:#c00;border:1px solid #faa">Discard</button>
        </div>
      </div>
    `;
    document.body.appendChild(warn);
    warn.querySelector("#warn-stay").onclick = () => warn.remove();
    warn.querySelector("#warn-exit").onclick = () => { warn.remove(); popup.remove(); };
  }

  function showTinyToast(msg) {
    const t = el("div", { id: "survey-toast", innerText: msg });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function fileToBase64(file) {
    return new Promise((r, j) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.onerror = j;
      fr.readAsDataURL(file);
    });
  }

  // -----------------------
  // TRIGGER LOGIC
  // -----------------------
  function tryShowSurveyRandomly() {
    if (!userAcceptedCookies()) return;
    // check persisted enabled flag
    if (!getFeedbackEnabled()) return;

    // NEW: roll probability so the popup appears less commonly when enabled.
    // Use DURING_SESSION_PROB when the user has visited more than 1 page in this session,
    // otherwise use BETWEEN_SESSION_PROB.
    const rollProb = (activity.pagesViewed > 1) ? DURING_SESSION_PROB : BETWEEN_SESSION_PROB;
    if (Math.random() > rollProb) return;

    setTimeout(async () => {
      try { await ensureFirebase(); } catch(e){}
      const uid = firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : getAnonId();
      const check = await canTakeSurvey(uid).catch(()=>({ok:true}));
      if (check.ok) {
        const qs = generateQuestions(3); // Less questions for smiley bar
        createSurveyPopup(qs);
        markSurveyUsed(uid);
      }
    }, Math.random() * (MAX_SHOW_DELAY_MS - MIN_SHOW_DELAY_MS) + MIN_SHOW_DELAY_MS);
  }

  // Expose API
  window.SurveyFeedback.openSurveyNow = async () => {
    const qs = generateQuestions(4);
    createSurveyPopup(qs);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryShowSurveyRandomly);
  } else {
    tryShowSurveyRandomly();
  }

})();
