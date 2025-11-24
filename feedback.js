// survey-feedback.js
// Drop-in script. Self-contained. Saves to Firestore (anonymous + user-attached).
// Rate limits: 15/day + 20s cooldown. Auto-trigger logs on cooldown or limit.
// Uses Firebase compat SDK loaded dynamically. Uses base64 for screenshots.

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

  const BETWEEN_SESSION_PROB = 0.5; // 0-1 between sessions chance
  const DURING_SESSION_PROB = 0.2; // extra chance during session
  const MIN_SHOW_DELAY_MS = 2000;
  const MAX_SHOW_DELAY_MS = 10000;
  const DAILY_LIMIT = 15;
  const COOLDOWN_SECONDS = 20;

  const LOCAL_QUEUE_KEY = "survey_save_queue_v1";
  const ANON_ID_KEY = "anonSurveyId_v1";
  const SESSION_BUCKET_KEY = "survey_session_bucket_v1";
  const SURVEY_RATE_COLLECTION = "survey_rate"; // root-level collection

  // -----------------------
  // UTIL: load script
  // -----------------------
  function loadScript(url) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => res();
      s.onerror = (e) => rej(e);
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.apps && window._survey_db) return;
    const base = "https://www.gstatic.com/firebasejs/9.22.2";
    await loadScript(base + "/firebase-app-compat.js");
    await loadScript(base + "/firebase-firestore-compat.js");
    await loadScript(base + "/firebase-auth-compat.js");
    // init
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    window._survey_db = firebase.firestore();
    window._survey_auth = firebase.auth();
  }

  // -----------------------
  // COOKIE CHECK
  // (Replace logic if you have another consent system)
  // -----------------------
  function userAcceptedCookies() {
    try {
      const v = document.cookie.split(";").map(s => s.trim()).find(s => s.startsWith("cookie_consent="));
      if (v) return v.split("=")[1] === "1";
    } catch (e) {}
    // fallback to true for testing; change to strict behavior in production
    return true;
  }

  // -----------------------
  // ACTIVITY TRACKER
  // -----------------------
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
  // QUESTION POOL (+20 extra)
  // -----------------------
  const EXTRA_QUESTIONS = [
    "How clear were the labels and headings on the page?",
    "Did the search feature return useful results?",
    "Was the page load speed acceptable?",
    "Did you find what you came for today?",
    "Was the signup/sign-in flow straightforward?",
    "Did images and media load correctly?",
    "Was the site layout mobile-friendly for you?",
    "Did any button or link not work as expected?",
    "How visually appealing did the site look?",
    "Was the help/FAQ section useful?",
    "Would you recommend this site to a friend?",
    "Was pricing (if shown) clearly explained?",
    "Was the checkout/payment process smooth?",
    "How would you rate our error messages (if any)?",
    "Did you experience any annoying popups?",
    "Would you use this site again?",
    "Was account/profile management easy?",
    "Did content seem accurate and trustworthy?",
    "How intuitive were interactive elements?",
    "Did personalization (recommendations) feel relevant?",
    "Was the newsletter subscription process simple?",
    "Did you try dark mode? If yes — was it good?",
    "Were forms short and easy to fill?",
    "Any accessibility issues (contrast, font size, etc)?",
    "How likely are you to return in the next month?"
  ];

  function generateQuestions(max = 8) {
    const q = [];
    if (activity.pagesViewed > 3) q.push(`You visited ${activity.pagesViewed} pages — how easy was navigation?`);
    if (activity.totalClicks > 8) q.push("You interacted a lot — were interactive controls easy to use?");
    if (activity.scrollDepthPct > 60) q.push("You scrolled through most of the page — did the content feel too long?");
    if (timeSpentSeconds() > 60) q.push("You spent time exploring — was the experience useful?");
    if (activity.featuresUsed.size > 0) q.push(`You used ${Array.from(activity.featuresUsed).slice(0,3).join(", ")} — how did that go?`);

    let i = 0;
    while (q.length < max && i < EXTRA_QUESTIONS.length) {
      q.push(EXTRA_QUESTIONS[i]);
      i++;
    }
    return q;
  }

  // -----------------------
  // UI STYLES
  // -----------------------
  function addStyles() {
    if (document.getElementById("survey-feedback-styles-v1")) return;
    const s = document.createElement("style");
    s.id = "survey-feedback-styles-v1";
    s.innerHTML = `
/* Popup */
.survey-popup { position: fixed; bottom: 24px; right: 24px; width: 360px; max-width: calc(100vw - 40px); background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-family:Inter,ui-sans-serif,system-ui;z-index:999999;padding:10px; }
.survey-header{display:flex;justify-content:space-between;align-items:center;font-weight:700;padding:6px 8px;}
.survey-close{background:transparent;border:0;font-size:18px;cursor:pointer}
.survey-content{padding:8px;max-height:60vh;overflow:auto}
.survey-question{margin:10px 0;font-weight:600}
.survey-answers{display:flex;gap:8px;flex-wrap:wrap}
.survey-answers button{padding:8px 10px;border-radius:8px;border:1px solid #ddd;background:#f7f7f7;cursor:pointer}
.survey-answers button.selected{outline:2px solid #1976d2;background:#e8f0ff}

/* Close warning */
.survey-warning{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000000}
.warning-box{background:#fff;padding:18px;border-radius:10px;text-align:center;width:320px}
.warning-box button{margin:8px;padding:8px 12px;border-radius:8px;cursor:pointer}

/* Sidebar */
.feedback-sidebar{position:fixed;top:0;right:-420px;width:380px;height:100vh;background:#fff;box-shadow:-6px 0 30px rgba(0,0,0,.18);transition:right .36s;z-index:999998;padding:18px;font-family:Inter,system-ui}
.feedback-sidebar.open{right:0}
.side-header{font-weight:800;font-size:18px;margin-bottom:8px}
.side-textbox{width:100%;height:120px;padding:8px;border:1px solid #ddd;border-radius:8px}
.open-survey-btn{width:100%;margin-top:12px;padding:10px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer}
.side-bottom{position:absolute;bottom:18px;left:18px;right:18px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.close-sidebar-btn{padding:6px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer}
.screenshot-upload{margin-top:8px;display:flex;gap:8px;align-items:center}
.mini-caption{font-size:12px;color:#666;margin-top:6px}

/* Toast */
#survey-toast{position:fixed;bottom:20px;left:20px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;z-index:999999}
`;
    document.head.appendChild(s);
  }

  // -----------------------
  // ELEMENT HELPERS
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

  // -----------------------
  // ANON ID
  // -----------------------
  function getAnonId() {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = "anon-" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  }

  // -----------------------
  // RATE LIMIT STORAGE (Firestore doc per user or anon id)
  // doc path: survey_rate/{uid}
  // fields: lastSurvey (timestamp), dailyCount (number), dayStart (timestamp)
  // -----------------------
  async function loadRateDoc(uid) {
    await ensureFirebase();
    const db = window._survey_db;
    const ref = db.collection(SURVEY_RATE_COLLECTION).doc(uid);
    try {
      const snap = await ref.get();
      if (!snap.exists) return null;
      return snap.data();
    } catch (e) {
      console.warn("loadRateDoc error", e);
      return null;
    }
  }

  async function saveRateDoc(uid, data) {
    await ensureFirebase();
    const db = window._survey_db;
    const ref = db.collection(SURVEY_RATE_COLLECTION).doc(uid);
    try {
      await ref.set(data, { merge: true });
    } catch (e) {
      console.warn("saveRateDoc error", e);
    }
  }

  async function canTakeSurvey(uid) {
    const nowMs = Date.now();
    const nowTs = firebase.firestore.Timestamp.fromMillis(nowMs);
    let doc = await loadRateDoc(uid);
    if (!doc) {
      return { ok: true, data: { dailyCount: 0, lastSurvey: null, dayStart: nowTs } };
    }

    let lastSurveyMs = doc.lastSurvey ? doc.lastSurvey.toMillis() : 0;
    let dayStartMs = doc.dayStart ? doc.dayStart.toMillis() : nowMs;
    let dailyCount = doc.dailyCount || 0;

    // reset 24h window if passed
    if ((nowMs - dayStartMs) >= 24 * 3600 * 1000) {
      dailyCount = 0;
      dayStartMs = nowMs;
    }

    if (dailyCount >= DAILY_LIMIT) {
      const expires = dayStartMs + 24 * 3600 * 1000;
      return { ok: false, reason: "DAILY_LIMIT", untilMs: expires };
    }

    const secondsSinceLast = (nowMs - lastSurveyMs) / 1000;
    if (secondsSinceLast < COOLDOWN_SECONDS) {
      const wait = Math.ceil(COOLDOWN_SECONDS - secondsSinceLast);
      return { ok: false, reason: "COOLDOWN", wait };
    }

    return { ok: true, data: { dailyCount, lastSurveyMs, dayStartMs } };
  }

  async function markSurveyUsed(uid) {
    const nowMs = Date.now();
    const nowTs = firebase.firestore.Timestamp.fromMillis(nowMs);
    let doc = await loadRateDoc(uid);
    if (!doc) {
      await saveRateDoc(uid, { dailyCount: 1, lastSurvey: nowTs, dayStart: nowTs });
      return;
    }
    let dayStartMs = doc.dayStart ? doc.dayStart.toMillis() : nowMs;
    let dailyCount = doc.dailyCount || 0;

    if ((nowMs - dayStartMs) >= 24 * 3600 * 1000) {
      dailyCount = 0;
      dayStartMs = nowMs;
    }
    dailyCount += 1;
    await saveRateDoc(uid, {
      dailyCount,
      lastSurvey: nowTs,
      dayStart: firebase.firestore.Timestamp.fromMillis(dayStartMs)
    });
  }

  // -----------------------
  // SAVE SURVEY: queue + cloud
  // saves anonymous copy in /surveys and user copy under /users/{uid}/surveys if signed in
  // -----------------------
  function enqueueSave(payload) {
    const q = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || "[]");
    q.push(payload);
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(q));
    triggerQueueWorker();
  }

  async function saveToFirestore(payload) {
    await ensureFirebase();
    const db = window._survey_db;
    const auth = window._survey_auth;
    const user = auth.currentUser;
    payload._savedAt = new Date().toISOString();
    payload._userId = user ? user.uid : null;

    // write anonymous
    await db.collection("surveys").add(payload);

    // write user copy if signed in
    if (user) {
      await db.collection("users").doc(user.uid).collection("surveys").add(payload);
    }

    // remove from queue by timestamp
    dequeueByTimestamp(payload.timestamp);
  }

  function dequeueByTimestamp(ts) {
    const q = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || "[]");
    const remain = q.filter(item => item.timestamp !== ts);
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(remain));
  }

  let queueWorkerRunning = false;
  async function triggerQueueWorker() {
    if (queueWorkerRunning) return;
    queueWorkerRunning = true;
    try {
      const q = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || "[]");
      if (!q.length) return;
      await ensureFirebase();
      for (const item of q.slice()) {
        try {
          await saveToFirestore(item);
        } catch (e) {
          console.warn("queue save failed for item", item, e);
          break;
        }
      }
    } catch (e) {
      console.warn("queue worker error", e);
    } finally {
      queueWorkerRunning = false;
    }
  }
  window.addEventListener("online", () => triggerQueueWorker());

  // -----------------------
  // UI: create popup and sidebar
  // -----------------------
  addStyles();

  // Create Feedback Sidebar
  function createFeedbackSidebar() {
    if (document.getElementById("feedback-sidebar-v1")) return;
    const sidebar = el("div", { id: "feedback-sidebar-v1", className: "feedback-sidebar" });
    sidebar.innerHTML = `
      <div class="side-header">HouseLearning Feedback</div>
      <label>Describe your feedback</label>
      <textarea class="side-textbox" placeholder="Type your feedback..."></textarea>

      <h4 style="margin-top:10px">Send a screenshot (optional)</h4>
      <p class="mini-caption">A screenshot will help us better understand your feedback.</p>
      <input type="file" accept="image/*" class="side-file" />

      <button class="open-survey-btn">Open Survey</button>

      <div class="side-bottom">
        <div>
          <a href="#" target="_blank">Terms of Service</a> • <a href="#" target="_blank">Privacy Policy</a>
        </div>
        <div>
          <button class="close-sidebar-btn">Close Feedback Window</button>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);

    const box = sidebar.querySelector(".side-textbox");
    const fileInput = sidebar.querySelector(".side-file");
    sidebar.querySelector(".open-survey-btn").onclick = () => {
      const q = generateQuestions(7);
      const popup = createSurveyPopup(q);
      const surveyTxt = popup.querySelector("textarea");
      if (surveyTxt && box.value) surveyTxt.value = box.value;
      sidebar.classList.remove("open");
    };
    sidebar.querySelector(".close-sidebar-btn").onclick = () => sidebar.classList.remove("open");

    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.key.toLowerCase() === "s") {
        sidebar.classList.add("open");
      }
    });
  }
  createFeedbackSidebar();

  // Create Survey Popup builder
  function createSurveyPopup(questions = []) {
    const popup = el("div", { className: "survey-popup", role: "dialog", "aria-modal": "true" });
    popup.innerHTML = `
      <div class="survey-header">
        <div>We'd love your feedback</div>
        <button class="survey-close" aria-label="close">✕</button>
      </div>
      <div class="survey-content"></div>
    `;
    const content = popup.querySelector(".survey-content");

    questions.forEach((qText, qi) => {
      const qDiv = el("div", { className: "survey-block" });
      qDiv.innerHTML = `<div class="survey-question">${escapeHtml(qText)}</div>`;
      const answers = el("div", { className: "survey-answers" });
      ["Excellent", "Good", "Okay", "Bad", "Not applicable"].forEach(opt => {
        const b = el("button", { type: "button", innerText: opt });
        b.dataset.qindex = qi;
        b.dataset.qtext = qText;
        b.onclick = () => {
          Array.from(answers.children).forEach(ch => ch.classList.remove("selected"));
          b.classList.add("selected");
          answers.dataset.selected = opt;
        };
        answers.appendChild(b);
      });
      qDiv.appendChild(answers);
      content.appendChild(qDiv);
    });

    const textArea = el("textarea", { placeholder: "Extra details (optional)", style: "width:100%;margin-top:8px;padding:8px;border-radius:8px" });
    content.appendChild(textArea);

    const screenRow = el("div", { className: "screenshot-upload" });
    screenRow.innerHTML = `<label style="font-size:13px">Attach screenshot (optional)</label>`;
    const fileInput = el("input", { type: "file" });
    fileInput.accept = "image/*";
    screenRow.appendChild(fileInput);
    content.appendChild(screenRow);
    content.appendChild(el("div", { className: "mini-caption" }, "A screenshot helps us understand your feedback."));

    // placeholder rewards
    const rewardsRow = el("div", { style: "margin-top:8px;font-size:13px;color:#444" }, "Rewards: (placeholder)");
    content.appendChild(rewardsRow);

    const submitRow = el("div", { style: "display:flex;gap:8px;margin-top:12px" });
    const submitBtn = el("button", { className: "open-survey-btn", innerText: "Send Feedback" });
    const laterBtn = el("button", { className: "close-sidebar-btn", innerText: "Maybe later" });
    submitRow.appendChild(submitBtn);
    submitRow.appendChild(laterBtn);
    content.appendChild(submitRow);

    popup.querySelector(".survey-close").onclick = () => {
      showCloseSurveyWarning(popup);
    };
    laterBtn.onclick = () => popup.remove();

    submitBtn.onclick = async () => {
      const answers = [];
      content.querySelectorAll(".survey-block").forEach((blk, idx) => {
        const sel = blk.querySelector(".survey-answers").dataset.selected || null;
        const qtext = blk.querySelector(".survey-question").innerText;
        answers.push({ q: qtext, a: sel });
      });

      const payload = {
        timestamp: new Date().toISOString(),
        activitySnapshot: snapshotActivity(),
        questionsAsked: questions,
        answers,
        extraText: textArea.value || null,
        userAgent: navigator.userAgent,
      };

      if (fileInput.files && fileInput.files[0]) {
        try {
          const base = await fileToBase64(fileInput.files[0]);
          payload.screenshotBase64 = base;
        } catch (e) {
          console.warn("screenshot read failed", e);
        }
      }

      enqueueSave(payload);

      try {
        await ensureFirebase();
        await saveToFirestore(payload);
        showTinyToast("Thanks — feedback saved!");
      } catch (err) {
        console.warn("save error", err);
        showTinyToast("Saved locally. We'll retry when online.");
      }

      // mark rate usage
      const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : getAnonId();
      markSurveyUsed(uid).catch(e => console.warn("markSurveyUsed error", e));

      popup.remove();
    };

    document.body.appendChild(popup);
    return popup;
  }

  // Close confirmation modal
  function showCloseSurveyWarning(popup) {
    const warn = el("div", { className: "survey-warning" });
    warn.innerHTML = `
      <div class="warning-box">
        <p style="font-weight:700">Close Survey?</p>
        <p style="margin:6px 0;color:#444">You might not get rewards.</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
          <button class="stay-btn" autofocus style="padding:8px 12px;border-radius:8px">Stay</button>
          <button class="exit-btn" style="padding:8px 12px;border-radius:8px">Exit</button>
        </div>
      </div>
    `;
    document.body.appendChild(warn);
    const stay = warn.querySelector(".stay-btn");
    const exit = warn.querySelector(".exit-btn");
    // autofocus Stay
    setTimeout(() => stay.focus(), 10);
    stay.onclick = () => warn.remove();
    exit.onclick = () => {
      warn.remove();
      if (popup) popup.remove();
    };
  }

  // tiny toast
  function showTinyToast(msg, t = 2500) {
    const id = "survey-toast";
    let elT = document.getElementById(id);
    if (elT) elT.remove();
    elT = document.createElement("div");
    elT.id = id;
    elT.innerText = msg;
    document.body.appendChild(elT);
    setTimeout(() => elT.remove(), t);
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // -----------------------
  // Random popup logic (session bucket etc)
  // -----------------------
  function shouldShowThisSession() {
    if (!localStorage.getItem(SESSION_BUCKET_KEY)) {
      const pick = Math.random() < BETWEEN_SESSION_PROB;
      localStorage.setItem(SESSION_BUCKET_KEY, pick ? "1" : "0");
    }
    const bucket = localStorage.getItem(SESSION_BUCKET_KEY) === "1";
    const extra = Math.random() < DURING_SESSION_PROB;
    return bucket || extra;
  }

  async function tryShowSurveyRandomly() {
    if (!userAcceptedCookies()) return;
    if (!shouldShowThisSession()) return;
    const delay = Math.random() * (MAX_SHOW_DELAY_MS - MIN_SHOW_DELAY_MS) + MIN_SHOW_DELAY_MS;
    setTimeout(async () => {
      // check rate
      const uid = firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : getAnonId();
      try {
        await ensureFirebase();
      } catch (e) {
        // even if firebase not available, still open UI if allowed
      }
      const check = await canTakeSurvey(uid).catch(()=>({ ok: true }));
      if (!check.ok) {
        // auto triggered and blocked -> console warn only
        if (check.reason === "COOLDOWN") {
          const username = firebase.auth && firebase.auth().currentUser ? (firebase.auth().currentUser.email || firebase.auth().currentUser.uid) : uid;
          console.warn(`User ${username} triggered in cooldown. wait ${check.wait} seconds.`);
          return;
        } else if (check.reason === "DAILY_LIMIT") {
          const username = firebase.auth && firebase.auth().currentUser ? (firebase.auth().currentUser.email || firebase.auth().currentUser.uid) : uid;
          const until = new Date(check.untilMs);
          const diffH = Math.ceil((check.untilMs - Date.now()) / (1000 * 60 * 60));
          console.warn(`User ${username} exceeded the HouseLearning Survey rate limit. Try again in ${diffH}h`);
          return;
        }
      }
      // allowed -> open
      const qs = generateQuestions(7);
      const popup = createSurveyPopup(qs);
      // mark used now (so rapid auto duplicates count)
      markSurveyUsed(uid).catch(e => console.warn("markSurveyUsed error", e));
    }, delay);
  }

  // expose manual controls
  window.SurveyFeedback.openSurveyNow = async function () {
    if (!userAcceptedCookies()) return;
    await ensureFirebase().catch(()=>{});
    const uid = firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : getAnonId();
    const check = await canTakeSurvey(uid).catch(()=>({ ok: true }));
    if (!check.ok) {
      if (check.reason === "COOLDOWN") {
        console.log(`survey triggered in cooldown. wait ${check.wait} seconds.`);
        showTinyToast(`Wait ${check.wait}s before next survey`);
        return;
      }
      if (check.reason === "DAILY_LIMIT") {
        const until = new Date(check.untilMs);
        const msLeft = check.untilMs - Date.now();
        const hours = Math.floor(msLeft / (1000*60*60));
        const mins = Math.floor((msLeft % (1000*60*60)) / (1000*60));
        // UI popup (Woah There!)
        const popup = el("div", { className: "survey-popup" });
        popup.innerHTML = `
          <div class="survey-header"><div>Woah There!</div><button class="survey-close">✕</button></div>
          <div class="survey-content"><p>You exceeded the survey rate limit. Please try again in ${hours}h ${mins}m.</p></div>
        `;
        popup.querySelector(".survey-close").onclick = () => popup.remove();
        document.body.appendChild(popup);
        return;
      }
    }

    // allowed
    const qs = generateQuestions(7);
    const popup = createSurveyPopup(qs);
    // mark used now
    markSurveyUsed(uid).catch(e => console.warn("markSurveyUsed error", e));
  };

  // -----------------------
  // Queue worker attempt at load
  // -----------------------
  triggerQueueWorker();

  // -----------------------
  // Auto-run random survey attempt after DOM ready
  // -----------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      createFeedbackSidebar();
      tryShowSurveyRandomly();
    });
  } else {
    createFeedbackSidebar();
    tryShowSurveyRandomly();
  }

  // -----------------------
  // QUEUE + SAVE helper (saveToFirestore used earlier)
  // -----------------------
  async function saveToFirestore(payload) {
    await ensureFirebase();
    const db = window._survey_db;
    const auth = window._survey_auth;
    const user = auth.currentUser;
    payload._savedAt = new Date().toISOString();
    payload._userId = user ? user.uid : null;

    // save anonymous
    await db.collection("surveys").add(payload);

    // save under user if signed in
    if (user) {
      await db.collection("users").doc(user.uid).collection("surveys").add(payload);
    }
    // remove queue
    dequeueByTimestamp(payload.timestamp);
  }

  // -----------------------
  // Rate doc helpers: reuse earlier functions for canTakeSurvey and markSurveyUsed
  // BUT we need access to them here (already defined). If not, they exist above.
  // -----------------------

  // -----------------------
  // Keyboard: Alt+S for sidebar (also added earlier)
  // -----------------------
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "s") {
      const sb = document.getElementById("feedback-sidebar-v1");
      if (sb) sb.classList.add("open");
    }
  });

  // -----------------------
  // Expose API
  // -----------------------
  window.SurveyFeedback.ensureFirebase = ensureFirebase;
  window.SurveyFeedback.openSurveyNow = window.SurveyFeedback.openSurveyNow;
  window.SurveyFeedback.trackFeature = window.SurveyFeedback.trackFeature;

})();
