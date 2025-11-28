import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

(function () {
  // -----------------------
  // CSS STYLES (Moved from <style> block)
  // -----------------------
    const CSS_STYLES = `
        /* --- General Demo Styles --- */
        body { font-family: 'Inter', sans-serif; background-color: #f7f7f7; padding: 50px; text-align: center; }
        .main-content { max-width: 600px; margin: 0 auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .hint { margin-top: 20px; padding: 10px; background: #e3f2fd; border-left: 5px solid #1976d2; text-align: left; border-radius: 4px; }

        /* --- Survey Feedback Widget Styles --- */
        
        /* Popup */
        .survey-popup { position: fixed; bottom: 24px; right: 24px; width: 380px; max-width: calc(100vw - 40px); background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-family:Inter,ui-sans-serif,system-ui;z-index:999999;padding:10px; }
        .survey-header{display:flex;justify-content:space-between;align-items:center;font-weight:700;padding:6px 8px; position: relative;}
        .survey-close{background:transparent;border:0;font-size:18px;cursor:pointer}
        .survey-content{padding:8px;max-height:60vh;overflow-y:auto;overflow-x:hidden}
        .survey-question{margin:15px 0 10px 0;font-weight:600;font-size:15px;color:#222;}
        
        /* New Header Controls */
        .feedback-header-controls { display: flex; align-items: center; gap: 8px; }
        .stop-feedback-btn { background: #f0f8ff; color: #1976d2; border: 1px solid #1976d2; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; white-space: nowrap;}
        .stop-feedback-btn:hover { background: #e3f2ff; }
        
        /* Tooltip */
        .tooltip-container { position: relative; display: inline-block; cursor: pointer; }
        .tooltip-icon { font-size: 14px; font-weight: 800; color: #555; line-height: 1; border: 1px solid #555; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; user-select: none; }
        .tooltip-text {
            visibility: hidden; width: 280px; background-color: #333; color: #fff; text-align: left; padding: 8px 12px; border-radius: 6px; position: absolute; z-index: 1000001; top: 100%; right: 0; margin-top: 5px; opacity: 0; transition: opacity 0.3s; font-size: 12px; font-weight: 400; white-space: normal;
        }
        .tooltip-container:hover .tooltip-text { visibility: visible; opacity: 1; }

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
        .open-survey-btn{width:100%;margin-top:12px;padding:10px;border-radius:8px;border:0;background:#1976d2;color:#fff;cursor:pointer;font-weight:600}
        .close-sidebar-btn{padding:6px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer}
        .screenshot-upload{margin-top:8px;display:flex;gap:8px;align-items:center}
        
        /* Warnings & Toast */
        .survey-warning{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000000}
        .warning-box{background:#fff;padding:18px;border-radius:10px;text-align:center;width:320px}
        #survey-toast {
            position: fixed; 
            bottom: 24px; 
            right: 24px; 
            background: #1f2937; /* Darker background */
            color: #fff; 
            padding: 10px 15px; 
            border-radius: 8px; 
            z-index: 999999;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        #survey-toast-close {
            background: none;
            border: none;
            color: #fff;
            font-weight: bold;
            cursor: pointer;
            padding: 0 4px;
            font-size: 16px;
            line-height: 1;
            opacity: 0.8;
        }
        #survey-toast-close:hover {
            opacity: 1;
        }
    `;

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = CSS_STYLES;
        document.head.appendChild(style);
    }

  // -----------------------
  // CONFIG & CONSTANTS
  // -----------------------
  const MIN_SHOW_DELAY_MS = 2000;
  const MAX_SHOW_DELAY_MS = 10000;
  const DAILY_LIMIT = 15;
  const COOLDOWN_SECONDS = 20;

  const ANON_ID_KEY = "anonSurveyId_v1";
  const FEEDBACK_TOGGLE_KEY = "isFeedbackWindowEnabled"; 
 
  let firestoreContext = {
      db: null,
      auth: null,
      appId: null,
      userId: null,
      isReady: false
  };

  // -----------------------
  // FIREBASE INITIALIZATION (Canvas-compliant)
  // -----------------------
  async function initializeFirebase() {
      if (firestoreContext.isReady) return;

      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (!firebaseConfig) {
          console.error("Firebase configuration is missing.");
          return;
      }

      try {
          const app = initializeApp(firebaseConfig);
          const auth = getAuth(app);
          const db = getFirestore(app);

          await new Promise(resolve => {
              const unsubscribe = onAuthStateChanged(auth, async (user) => {
                  if (!user) {
                      if (initialAuthToken) {
                          await signInWithCustomToken(auth, initialAuthToken).catch(e => console.error("Custom token sign-in failed:", e));
                      } else {
                          await signInAnonymously(auth).catch(e => console.error("Anonymous sign-in failed:", e));
                      }
                  }
                  
                  // Re-check user after attempted sign-in
                  const finalUser = auth.currentUser;
                  const userId = finalUser?.uid || getAnonId();

                  firestoreContext = { db, auth, appId, userId, isReady: true };
                  unsubscribe();
                  resolve();
              });
          });
          
      } catch (e) {
          console.error("Firebase initialization or authentication failed:", e);
      }
  }

  // -----------------------
  // ICONS (SVGs for Smiley Bar)
  // -----------------------
  const SMILEYS = {
    1: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 9v.01"></path><path d="M8 9v.01"></path><path d="M16 16c-.5-1.5-1.5-3-4-3s-3.5 1.5-4 3"></path></svg>`, 
    2: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><path d="M15 16c-.5-1-2-1.5-3-1.5s-2.5.5-3 1.5"></path></svg>`, 
    3: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`, 
    4: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><path d="M9 14c1.5 2 4.5 2 6 0"></path></svg>`, 
    5: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`
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
  // TOGGLE & PERSISTENCE LOGIC
  // -----------------------
  function getFeedbackState() {
    // Default is enabled (true).
    const state = localStorage.getItem(FEEDBACK_TOGGLE_KEY);
    return state === null ? true : state === 'true';
  }

  function setFeedbackState(isEnabled) {
    localStorage.setItem(FEEDBACK_TOGGLE_KEY, isEnabled ? 'true' : 'false');
    showToggleToast(isEnabled);
    if (!isEnabled) {
      // Hide any open popup when disabling
      document.querySelector('.survey-popup')?.remove();
    }
  }

  function showToggleToast(isEnabled) {
    let t = document.getElementById("survey-toast");
    if (t) t.remove();

    const msg = `Feedback window will be ${isEnabled ? 'enabled' : 'disabled'}`;
    t = el("div", { id: "survey-toast" });
    t.innerHTML = `
      <span>${msg}</span>
      <button id="survey-toast-close">✕</button>
    `;
    document.body.appendChild(t);
    
    t.querySelector('#survey-toast-close').onclick = () => t.remove();

    setTimeout(() => {
      if (t.parentElement) t.remove();
    }, 5000);
  }

  function setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Check for ALT + W
      if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault(); // Prevent browser shortcuts
        const newState = !getFeedbackState();
        setFeedbackState(newState);
      }
    });
  }

  // -----------------------
  // FIRESTORE CRUD HELPERS
  // -----------------------
  const getRateDocRef = (db, appId, userId) => doc(db, 'artifacts', appId, 'users', userId, 'survey_rate', 'limit');
  const getSurveysCollection = (db, appId) => collection(db, 'artifacts', appId, 'users', firestoreContext.userId, 'surveys');

  async function loadRateDoc() {
    await initializeFirebase();
    const { db, appId, userId, isReady } = firestoreContext;
    if (!isReady) return null;

    try {
      const docRef = getRateDocRef(db, appId, userId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (e) { 
        console.error("Error loading rate doc:", e);
        return null; 
    }
  }

  async function saveRateDoc(data) {
    await initializeFirebase();
    const { db, appId, userId, isReady } = firestoreContext;
    if (!isReady) return;

    try { 
        const docRef = getRateDocRef(db, appId, userId);
        await setDoc(docRef, data, { merge: true }); 
    } catch (e) {
        console.error("Error saving rate doc:", e);
    }
  }

  async function canTakeSurvey() {
    const nowMs = Date.now();
    let docData = await loadRateDoc();
    
    // Default fresh start data if no doc exists
    if (!docData) return { ok: true, data: { dailyCount: 0, lastSurvey: null, dayStart: Timestamp.fromMillis(nowMs) } };

    let lastSurveyMs = docData.lastSurvey instanceof Timestamp ? docData.lastSurvey.toMillis() : 0;
    let dayStartMs = docData.dayStart instanceof Timestamp ? docData.dayStart.toMillis() : nowMs;
    let dailyCount = docData.dailyCount || 0;

    // Check if 24 hours have passed since dayStart
    if ((nowMs - dayStartMs) >= 24 * 3600 * 1000) {
        dailyCount = 0;
        dayStartMs = nowMs;
    }

    if (dailyCount >= DAILY_LIMIT) return { ok: false, reason: "DAILY_LIMIT", untilMs: dayStartMs + 86400000 };
    
    const timeSinceLastSurvey = (nowMs - lastSurveyMs) / 1000;
    if (timeSinceLastSurvey < COOLDOWN_SECONDS) return { ok: false, reason: "COOLDOWN", wait: Math.ceil(COOLDOWN_SECONDS - timeSinceLastSurvey) };

    return { ok: true };
  }

  async function markSurveyUsed() {
    const nowMs = Date.now();
    let docData = await loadRateDoc();
    
    let dayStartMs = docData && docData.dayStart instanceof Timestamp ? docData.dayStart.toMillis() : nowMs;
    let dailyCount = docData ? (docData.dailyCount || 0) : 0;
    
    if ((nowMs - dayStartMs) >= 86400000) { dailyCount = 0; dayStartMs = nowMs; }
    
    await saveRateDoc({
        dailyCount: dailyCount + 1,
        lastSurvey: Timestamp.fromMillis(nowMs),
        dayStart: Timestamp.fromMillis(dayStartMs)
    });
  }

  async function saveToFirestore(payload) {
    await initializeFirebase();
    const { db, appId, userId, isReady } = firestoreContext;
    if (!isReady) return;

    payload.timestamp = Timestamp.now();
    payload.userId = userId;

    try {
        const surveysCol = getSurveysCollection(db, appId);
        await addDoc(surveysCol, payload);
    } catch (err) {
        console.error("Error saving feedback to Firestore:", err);
        throw new Error("Failed to save data.");
    }
  }

  // -----------------------
  // UI LOGIC
  // -----------------------
  function createSurveyPopup(questions = []) {
    const popup = el("div", { className: "survey-popup", role: "dialog" });
    
    // UPDATED HEADER structure
    popup.innerHTML = `
      <div class="survey-header">
        <div>We'd love your feedback</div>
        <div class="feedback-header-controls">
            <button class="stop-feedback-btn" id="stop-feedback-btn">Stop Feedback Window</button>
            <div class="tooltip-container">
                <span class="tooltip-icon">?</span>
                <span class="tooltip-text">Pressing this button will prevent this feedback window from opening. Toggle ALT+W to enable / disable the feedback window.</span>
            </div>
            <button class="survey-close">✕</button>
        </div>
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

    // Buttons (UPDATED labels)
    const submitRow = el("div", { style: "display:flex;gap:8px;margin-top:12px" });
    const submitBtn = el("button", { className: "open-survey-btn", innerText: "Submit" }); 
    const laterBtn = el("button", { className: "close-sidebar-btn", innerText: "Close", style: "margin-top:12px;" }); 
    
    submitRow.appendChild(submitBtn);
    submitRow.appendChild(laterBtn);
    content.appendChild(submitRow);

    // Events
    popup.querySelector(".survey-close").onclick = () => showCloseSurveyWarning(popup);
    laterBtn.onclick = () => popup.remove();
    
    // Stop Feedback Button Handler
    popup.querySelector("#stop-feedback-btn").onclick = () => {
        setFeedbackState(false); // Disable feedback and show toast
        popup.remove(); // Close the window
    };

    submitBtn.onclick = async () => {
      const answers = [];
      content.querySelectorAll(".survey-block").forEach(blk => {
        const q = blk.querySelector(".survey-question").innerText;
        const val = blk.querySelector(".smiley-container").dataset.value;
        if(val) answers.push({ q, rating: parseInt(val) });
      });

      const payload = {
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
        showTinyToast("Feedback Submitted!");
      } catch (err) {
        showTinyToast("Error saving feedback.");
        console.error(err);
      }
      
      await markSurveyUsed();
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
    let t = el("div", { id: "survey-toast" });
    t.innerHTML = `<span>${msg}</span>`;

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
    if (!getFeedbackState()) return;

    setTimeout(async () => {
      try { await initializeFirebase(); } catch(e){}
      
      if (!firestoreContext.isReady) {
          console.warn("Skipping survey trigger due to Firebase initialization failure.");
          return;
      }
      
      if (!getFeedbackState()) return;

      const check = await canTakeSurvey().catch(()=>({ok:true}));
      
      if (!getFeedbackState()) return;

      if (check.ok) {
        const qs = generateQuestions(3);
        createSurveyPopup(qs);
      }
    }, Math.random() * (MAX_SHOW_DELAY_MS - MIN_SHOW_DELAY_MS) + MIN_SHOW_DELAY_MS);
  }

  // Expose API
  window.SurveyFeedback.openSurveyNow = async () => {
    if (!getFeedbackState()) return;
    const qs = generateQuestions(4);
    createSurveyPopup(qs);
  };

  // -----------------------
  // INITIALIZATION
  // -----------------------
  function init() {
    injectStyles();
    setupKeyboardShortcut(); // Initialize keyboard shortcut listener
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tryShowSurveyRandomly);
    } else {
      tryShowSurveyRandomly();
    }
  }

  init();
})();
