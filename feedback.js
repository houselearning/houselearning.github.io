// survey-feedback.js
// Drop-in script. Self-contained. Saves to Firestore.
// Includes 5-point Sentiment Bar (Smileys).
// Fixed "Cannot read properties of null" bug.

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

  function getAnonId() {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = "anon-" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
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
    const popup = el("div", { className: "survey-popup", role: "dialog" });
    popup.innerHTML = `
      <div class="survey-header">
        <div>We'd love your feedback</div>
        <button class="survey-close">✕</button>
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
      labels.innerHTML = `<span>Unhappy</span><span>Delighted</span>`;

      [1, 2, 3, 4, 5].forEach(rating => {
        const btn = el("button", { type: "button", className: "smiley-btn" });
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

    // Buttons
    const submitRow = el("div", { style: "display:flex;gap:8px;margin-top:12px" });
    const submitBtn = el("button", { className: "open-survey-btn", innerText: "Send Feedback" });
    const laterBtn = el("button", { className: "close-sidebar-btn", innerText: "Cancel", style: "margin-top:12px;" });
    
    submitRow.appendChild(submitBtn);
    submitRow.appendChild(laterBtn);
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

    document.body.appendChild(popup);
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
