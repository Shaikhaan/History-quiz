// History Quest - Main JavaScript File
// ======================================
// Content, progress and scoring live in the server's SQLite database.
// This file renders the views, switches the per-country theme and talks
// to the /api endpoints.

const FEEDBACK_DELAY_MS = 2000;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// Presentation details per empire. Colours, fonts and patterns live in
// styles.css under [data-theme="<key>"].
const THEMES = {
  england: { motto: "Dieu et mon droit", native: "", eraWord: "Age" },
  france: { motto: "Liberté, égalité, fraternité", native: "", eraWord: "Époque" },
  italy: { motto: "Senatus Populusque Romanus", native: "S · P · Q · R", eraWord: "Aetas" },
  japan: { motto: "The way of the sword and the brush", native: "日本", eraWord: "Jidai" },
  ottoman: { motto: "Devlet-i Aliyye-i Osmâniyye", native: "", eraWord: "Devir" }
};
const DEFAULT_THEME = { motto: "", native: "", eraWord: "Era" };

// Global State
// ============

const state = {
  playerId: getPlayerId(),
  countries: [],
  badges: {},
  passPercent: 70,
  progress: { totalPoints: 0, quizzesCompleted: 0, winStreak: 0, badges: [], levels: {} },
  selectedCountry: null,
  lesson: null,
  quiz: null,
  advanceTimer: null
};

const elements = {};

function initializeElements() {
  [
    "appError", "homeView", "countryView", "lessonView", "quizView",
    "empireGrid", "allBadges", "countryHero", "eraList", "countryBadge",
    "lessonKicker", "lessonTitle", "lessonContent", "lessonFooter", "startQuiz",
    "brandHome", "backToEmpires", "backToEras", "backToErasLabel", "readingProgress",
    "statBadges", "statPoints", "statStreak"
  ].forEach(id => { elements[id] = document.getElementById(id); });
}

// Helpers
// =======

// A random id identifies this browser's player in the database.
function getPlayerId() {
  const key = "historyQuestPlayerId";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function api(path, body) {
  const options = body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: state.playerId, ...body })
  };
  const res = await fetch(`/api${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function showError(message) {
  elements.appError.textContent = message;
  elements.appError.classList.remove("hidden");
}

function clearError() {
  elements.appError.classList.add("hidden");
}

function getCountry(key) {
  return state.countries.find(c => c.key === key);
}

function themeFor(key) {
  return THEMES[key] || DEFAULT_THEME;
}

function eraLabel(countryKey, level) {
  return `${themeFor(countryKey).eraWord} ${ROMAN[level - 1] || level}`;
}

function getCountryProgress(country) {
  const passed = country.levels.filter(l => state.progress.levels[`${country.key}-${l.level}`]?.passed).length;
  return { passed, total: country.levels.length, percent: Math.round((passed / country.levels.length) * 100) };
}

// SVG progress ring; label defaults to the percentage.
function ring(percent, size, label = `${percent}%`) {
  const stroke = Math.max(4, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);
  return `
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(label)}">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text class="ring-text" x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-size="${Math.round(size / 4.2)}">${escapeHtml(label)}</text>
    </svg>
  `;
}

function badgeCard(badgeKey, earned, index = 0) {
  const badge = state.badges[badgeKey];
  if (!badge) return "";
  // Empire badges take on their country's theme.
  const country = badgeKey.endsWith("Master") ? badgeKey.slice(0, -"Master".length) : null;
  const themeAttr = country && THEMES[country] ? ` data-theme="${escapeHtml(country)}"` : "";
  return `
    <div class="badge ${earned ? "" : "locked"}"${themeAttr} style="--i: ${index}; --badge-color: ${escapeHtml(badge.color)}">
      <div class="badge-icon"><i class="${earned ? escapeHtml(badge.icon) : "fas fa-lock"}"></i></div>
      <div>
        <h4>${escapeHtml(badge.name)}</h4>
        <p>${escapeHtml(badge.description)}</p>
      </div>
    </div>
  `;
}

// Theme
// =====

function setTheme(key) {
  document.body.dataset.theme = key;
  const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

// Progress
// ========

async function refreshProgress() {
  state.progress = await api(`/players/${encodeURIComponent(state.playerId)}/progress`);
  updateUserStats();
}

function updateUserStats() {
  elements.statBadges.textContent = state.progress.badges.length;
  elements.statPoints.textContent = state.progress.totalPoints;
  elements.statStreak.textContent = state.progress.winStreak;
}

// Navigation
// ==========

function showView(view) {
  clearTimeout(state.advanceTimer);
  clearError();
  ["homeView", "countryView", "lessonView", "quizView"].forEach(name => {
    elements[name].classList.toggle("hidden", name !== view);
  });
  elements.readingProgress.style.width = "0";
  window.scrollTo({ top: 0, behavior: "instant" });
}

function showHome() {
  state.quiz = null;
  setTheme("home");
  renderEmpires();
  renderAllBadges();
  showView("homeView");
}

function showCountry(countryKey) {
  state.selectedCountry = countryKey;
  state.quiz = null;
  setTheme(countryKey);
  renderCountryHero();
  renderEras();
  renderCountryBadge();
  showView("countryView");
}

// Home
// ====

function renderEmpires() {
  elements.empireGrid.innerHTML = state.countries.map((country, index) => {
    const theme = themeFor(country.key);
    const progress = getCountryProgress(country);
    return `
      <button class="empire-card reveal" data-theme="${escapeHtml(country.key)}" data-country="${escapeHtml(country.key)}" style="--i: ${index}">
        <span class="medallion"><i class="${escapeHtml(country.icon)}"></i></span>
        <span class="card-title">${escapeHtml(country.name)}</span>
        <span class="motto">${escapeHtml(theme.motto)}</span>
        <span class="desc">${escapeHtml(country.description)}</span>
        <span class="empire-progress">
          <span class="bar"><span style="width: ${progress.percent}%"></span></span>
          <small><span>${progress.passed} of ${progress.total} ${progress.total === 1 ? "era" : "eras"} passed</span><span>${progress.percent}%</span></small>
        </span>
      </button>
    `;
  }).join("");

  elements.empireGrid.querySelectorAll(".empire-card").forEach(card => {
    card.addEventListener("click", () => showCountry(card.dataset.country));
  });
}

function renderAllBadges() {
  const earned = state.progress.badges;
  const keys = Object.keys(state.badges);
  const ordered = [...keys.filter(k => earned.includes(k)), ...keys.filter(k => !earned.includes(k))];
  elements.allBadges.innerHTML = ordered.map((k, i) => badgeCard(k, earned.includes(k), i)).join("");
}

// Country
// =======

function renderCountryHero() {
  const country = getCountry(state.selectedCountry);
  const theme = themeFor(country.key);
  const progress = getCountryProgress(country);
  elements.countryHero.innerHTML = `
    <span class="medallion"><i class="${escapeHtml(country.icon)}"></i></span>
    <p class="kicker">${escapeHtml(theme.motto)}</p>
    <h1 class="hero-title">${escapeHtml(country.name)}</h1>
    ${theme.native ? `<span class="native-name" lang="${country.key === "japan" ? "ja" : "la"}">${escapeHtml(theme.native)}</span>` : ""}
    <div class="divider" aria-hidden="true"><span></span></div>
    <p class="hero-lede">${escapeHtml(country.description)}</p>
    <div class="hero-progress">
      ${ring(progress.percent, 56)}
      <div>
        <strong>${progress.passed} of ${progress.total} eras passed</strong>
        <span>Score ${state.passPercent}% or more in a trial to pass an era</span>
      </div>
    </div>
  `;
}

function renderEras() {
  const country = getCountry(state.selectedCountry);
  elements.eraList.innerHTML = country.levels.map((level, index) => {
    const result = state.progress.levels[`${country.key}-${level.level}`];
    return `
      <li class="era reveal ${result?.passed ? "passed" : ""}" style="--i: ${index}">
        <span class="era-node" aria-hidden="true">${result?.passed ? '<i class="fas fa-check"></i>' : ROMAN[level.level - 1]}</span>
        <button class="era-card" data-level="${level.level}">
          <span class="kicker">${escapeHtml(eraLabel(country.key, level.level))} · ${escapeHtml(level.difficulty)}</span>
          <span class="era-title">${escapeHtml(level.title)}</span>
          <span class="era-meta">
            <span class="tag"><i class="fas fa-star"></i>${level.points} pts</span>
            ${result ? `<span class="tag"><i class="fas fa-trophy"></i>Best ${result.best}%</span>` : ""}
            ${result?.passed
              ? '<span class="tag passed"><i class="fas fa-check"></i>Passed</span>'
              : '<span class="tag"><i class="fas fa-book-open"></i>Read &amp; take the trial</span>'}
          </span>
        </button>
      </li>
    `;
  }).join("");

  elements.eraList.querySelectorAll(".era-card").forEach(btn => {
    btn.addEventListener("click", () => loadLesson(Number(btn.dataset.level)));
  });
}

function renderCountryBadge() {
  const country = getCountry(state.selectedCountry);
  const badgeKey = `${country.key}Master`;
  const earned = state.progress.badges.includes(badgeKey);
  elements.countryBadge.innerHTML = `
    <p class="kicker">Empire badge</p>
    ${badgeCard(badgeKey, earned)}
  `;
}

// Lesson
// ======

async function loadLesson(level) {
  const country = getCountry(state.selectedCountry);
  state.lesson = null;
  elements.backToErasLabel.textContent = country.name;
  elements.lessonKicker.textContent = eraLabel(country.key, level);
  elements.lessonTitle.textContent = "Unrolling the chronicle…";
  elements.lessonContent.innerHTML = "";
  elements.lessonFooter.classList.add("hidden");
  showView("lessonView");

  try {
    const lesson = await api(`/lessons/${encodeURIComponent(country.key)}/${level}`);
    state.lesson = lesson;
    elements.lessonKicker.textContent = `${eraLabel(country.key, level)} · ${lesson.difficulty}`;
    elements.lessonTitle.textContent = lesson.title;
    elements.lessonContent.innerHTML = marked.parse(lesson.reading);
    elements.lessonFooter.classList.remove("hidden");
  } catch (err) {
    elements.lessonTitle.textContent = "This chronicle could not be found";
    elements.lessonContent.innerHTML = `<p>${escapeHtml(err.message)}. Please go back and try again.</p>`;
  }
}

function updateReadingProgress() {
  if (elements.lessonView.classList.contains("hidden")) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const percent = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 100;
  elements.readingProgress.style.width = `${percent}%`;
}

// Quiz
// ====

async function startQuiz() {
  if (!state.lesson) return;
  elements.startQuiz.disabled = true;
  try {
    const { quizId, questions } = await api("/quizzes", {
      country: state.lesson.country,
      level: state.lesson.level
    });
    state.quiz = { id: quizId, questions, current: 0, score: 0, answered: 0, results: [], locked: false };
    showView("quizView");
    renderQuestion();
  } catch (err) {
    showError(`Could not start the trial: ${err.message}`);
  } finally {
    elements.startQuiz.disabled = false;
  }
}

function quitQuiz() {
  state.quiz = null;
  showCountry(state.selectedCountry);
}

function renderQuestion() {
  const quiz = state.quiz;
  const q = quiz.questions[quiz.current];
  const steps = quiz.questions.map((_, i) => {
    const cls = i < quiz.results.length ? (quiz.results[i] ? "right" : "wrong") : (i === quiz.current ? "current" : "");
    return `<li class="${cls}"></li>`;
  }).join("");

  elements.quizView.innerHTML = `
    <div class="quiz-shell">
      <div class="quiz-top">
        <p class="kicker">${escapeHtml(eraLabel(state.lesson.country, state.lesson.level))} · The Trial</p>
        <button class="quit-btn" id="quitQuiz"><i class="fas fa-xmark"></i> Quit</button>
      </div>
      <ol class="quiz-steps" aria-hidden="true">${steps}</ol>
      <p class="quiz-count">
        <span>Question ${quiz.current + 1} of ${quiz.questions.length}</span>
        <span>Score ${quiz.score}/${quiz.answered}</span>
      </p>
      <h2 class="quiz-question">${escapeHtml(q.question)}</h2>
      <div class="choices">
        ${q.choices.map((choice, index) => `
          <button class="choice" data-index="${index}">
            <span class="choice-key">${String.fromCharCode(65 + index)}</span>
            <span>${escapeHtml(choice)}</span>
          </button>
        `).join("")}
      </div>
      <p id="feedback" class="feedback" aria-live="polite"></p>
      <p class="quiz-hint">Tip: press A–${String.fromCharCode(64 + q.choices.length)} or 1–${q.choices.length} to answer</p>
    </div>
  `;

  document.getElementById("quitQuiz").addEventListener("click", quitQuiz);
  elements.quizView.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => checkAnswer(Number(btn.dataset.index)));
  });
}

async function checkAnswer(choiceIndex) {
  const quiz = state.quiz;
  if (!quiz || quiz.locked) return;
  const q = quiz.questions[quiz.current];
  if (choiceIndex < 0 || choiceIndex >= q.choices.length) return;

  quiz.locked = true;
  const buttons = elements.quizView.querySelectorAll(".choice");
  const feedback = document.getElementById("feedback");
  buttons.forEach(btn => { btn.disabled = true; });

  let result;
  try {
    result = await api(`/quizzes/${quiz.id}/answers`, { position: q.position, choice: q.choices[choiceIndex] });
  } catch (err) {
    feedback.textContent = `Could not submit your answer: ${err.message}`;
    feedback.className = "feedback incorrect";
    buttons.forEach(btn => { btn.disabled = false; });
    quiz.locked = false;
    return;
  }
  // The player may have quit while the request was in flight.
  if (state.quiz !== quiz) return;

  quiz.score = result.score;
  quiz.answered = result.answered;
  quiz.results.push(result.correct);

  buttons.forEach((btn, index) => {
    if (q.choices[index] === result.answer) {
      btn.classList.add("correct");
    } else if (index === choiceIndex) {
      btn.classList.add("incorrect");
    } else {
      btn.classList.add("dimmed");
    }
  });

  const step = elements.quizView.querySelectorAll(".quiz-steps li")[quiz.current];
  step.className = result.correct ? "right" : "wrong";

  if (result.correct) {
    feedback.innerHTML = '<i class="fas fa-check-circle"></i> Excellent! That\'s correct!';
    feedback.className = "feedback correct";
  } else {
    feedback.innerHTML = `<i class="fas fa-times-circle"></i> Not quite. The answer is: ${escapeHtml(result.answer)}`;
    feedback.className = "feedback incorrect";
  }
  elements.quizView.querySelector(".quiz-count span:last-child").textContent = `Score ${quiz.score}/${quiz.answered}`;

  state.advanceTimer = setTimeout(() => {
    if (state.quiz !== quiz) return;
    quiz.current++;
    quiz.locked = false;
    if (quiz.current < quiz.questions.length) {
      renderQuestion();
    } else {
      finishQuiz();
    }
  }, FEEDBACK_DELAY_MS);
}

// Keyboard answers: A-D or 1-4
function handleQuizKeys(event) {
  if (!state.quiz || state.quiz.locked || elements.quizView.classList.contains("hidden")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  let index = -1;
  if (/^[1-9]$/.test(key)) index = Number(key) - 1;
  else if (/^[a-z]$/.test(key)) index = key.charCodeAt(0) - 97;
  if (index >= 0 && elements.quizView.querySelectorAll(".choice")[index]) {
    event.preventDefault();
    checkAnswer(index);
  }
}

async function finishQuiz() {
  const quiz = state.quiz;
  try {
    const result = await api(`/quizzes/${quiz.id}/finish`, {});
    state.progress = result.progress;
    updateUserStats();
    renderResults(result);
  } catch (err) {
    elements.quizView.innerHTML = `
      <div class="quiz-shell results">
        <p class="results-message">Could not save your result: ${escapeHtml(err.message)}</p>
        <div class="results-actions">
          <button class="btn btn-primary" id="retryFinish"><i class="fas fa-rotate-right"></i> Try again</button>
        </div>
      </div>
    `;
    document.getElementById("retryFinish").addEventListener("click", finishQuiz);
  }
}

function resultMessage(percentage) {
  if (percentage >= 90) return "Legendary performance! You are a true master of history!";
  if (percentage >= 70) return "Outstanding knowledge! You've proven your historical prowess!";
  if (percentage >= 50) return "Good effort! Continue your studies to master this era!";
  return "Keep practicing! Every great historian started somewhere.";
}

function renderResults(result) {
  const passTag = result.passed
    ? '<span class="tag passed"><i class="fas fa-check"></i>Era passed</span>'
    : `<span class="tag failed"><i class="fas fa-circle-info"></i>${state.passPercent}% needed to pass</span>`;
  const pointsTag = result.pointsGained > 0
    ? `<span class="tag"><i class="fas fa-coins"></i>+${result.pointsGained} points</span>`
    : '<span class="tag"><i class="fas fa-coins"></i>No new points: beat your best to earn more</span>';

  const newBadges = result.newBadges.filter(key => state.badges[key]);
  const newBadgesHTML = newBadges.length > 0 ? `
    <div class="new-badges">
      <h3><i class="fas fa-star"></i> New honours unlocked</h3>
      <div class="badge-gallery">${newBadges.map((key, i) => badgeCard(key, true, i)).join("")}</div>
    </div>
  ` : "";

  elements.quizView.innerHTML = `
    <div class="quiz-shell results">
      <p class="kicker">${escapeHtml(eraLabel(state.lesson.country, state.lesson.level))} · ${escapeHtml(state.lesson.title)}</p>
      ${ring(result.percentage, 150)}
      <h2 class="results-title">${result.passed ? "Victory" : "Trial complete"}</h2>
      <p class="results-score">${result.score} of ${result.total} correct</p>
      <div class="results-chips">${passTag}${pointsTag}</div>
      <p class="results-message">${resultMessage(result.percentage)}</p>
      ${newBadgesHTML}
      <div class="results-actions">
        <button class="btn btn-primary" id="continueJourney"><i class="fas fa-scroll"></i> Back to the chronicles</button>
        <button class="btn btn-ghost" id="retryTrial"><i class="fas fa-rotate-right"></i> Retry this trial</button>
        <button class="btn btn-ghost" id="exploreEmpire"><i class="fas fa-globe"></i> Another empire</button>
      </div>
    </div>
  `;

  document.getElementById("continueJourney").addEventListener("click", () => showCountry(state.selectedCountry));
  document.getElementById("retryTrial").addEventListener("click", startQuiz);
  document.getElementById("exploreEmpire").addEventListener("click", showHome);
}

// App Initialization
// ==================

function setupEventListeners() {
  elements.brandHome.addEventListener("click", showHome);
  elements.backToEmpires.addEventListener("click", showHome);
  elements.backToEras.addEventListener("click", () => showCountry(state.selectedCountry));
  elements.startQuiz.addEventListener("click", startQuiz);
  document.addEventListener("keydown", handleQuizKeys);
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
}

async function initializeApp() {
  initializeElements();
  setupEventListeners();
  try {
    const [meta, countries] = await Promise.all([api("/meta"), api("/countries")]);
    state.badges = meta.badges;
    state.passPercent = meta.passPercent;
    state.countries = countries;
    await refreshProgress();
    showHome();
  } catch (err) {
    showError(`Could not reach the History Quest server (${err.message}). Start it with "npm start".`);
  }
}

document.addEventListener("DOMContentLoaded", initializeApp);
