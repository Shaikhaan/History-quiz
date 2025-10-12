// History Quest - Main JavaScript File
// ======================================

// Configuration Data
// ==================

const countries = {
  england: { 
    name: "Kingdom of England", 
    icon: "fas fa-crown", 
    color: "#C41E3A",
    description: "Rule the seas and build an empire where the sun never sets"
  },
  france: { 
    name: "French Empire", 
    icon: "fas fa-balance-scale", 
    color: "#002654",
    description: "Lead the revolution and spread enlightenment across Europe"
  },
  italy: { 
    name: "Roman Legacy", 
    icon: "fas fa-columns", 
    color: "#009246",
    description: "Command the eternal city and forge a lasting civilization"
  },
  japan: { 
    name: "Land of the Rising Sun", 
    icon: "fas fa-torii-gate", 
    color: "#BC002D",
    description: "Honor the samurai code and modernize the ancient traditions"
  },
  ottoman: { 
    name: "Ottoman Empire", 
    icon: "fas fa-mosque", 
    color: "#E30A17",
    description: "Bridge East and West while commanding vast territories"
  }
};

const levels = [
  { name: "Foundations", icon: "fas fa-seedling", difficulty: "Novice", points: 100, description: "Learn the origins and early developments" },
  { name: "Conflict & Kingdoms", icon: "fas fa-crossed-swords", difficulty: "Apprentice", points: 150, description: "Master the art of war and diplomacy" },
  { name: "Reformation & Empire", icon: "fas fa-flag", difficulty: "Scholar", points: 200, description: "Navigate religious upheaval and expansion" },
  { name: "Revolution & Reform", icon: "fas fa-fist-raised", difficulty: "Expert", points: 250, description: "Lead transformative social changes" },
  { name: "Modern Era", icon: "fas fa-rocket", difficulty: "Master", points: 300, description: "Understand the path to contemporary times" }
];

const badges = {
  // Performance badges
  perfectScore: { name: "Perfectionist", icon: "fas fa-gem", color: "#9b59b6", description: "Achieve 100% on any quiz" },
  scholar: { name: "Scholar", icon: "fas fa-graduation-cap", color: "#3498db", description: "Score 90% or higher" },
  historian: { name: "Historian", icon: "fas fa-scroll", color: "#e67e22", description: "Complete 5 quizzes" },
  expert: { name: "History Expert", icon: "fas fa-crown", color: "#f39c12", description: "Score 80% or higher on 3 consecutive quizzes" },
  
  // Country-specific badges
  englishMaster: { name: "Master of Albion", icon: "fas fa-crown", color: "#C41E3A", description: "Complete all England levels" },
  frenchMaster: { name: "Liberté Champion", icon: "fas fa-balance-scale", color: "#002654", description: "Complete all France levels" },
  italianMaster: { name: "Caesar's Heir", icon: "fas fa-columns", color: "#009246", description: "Complete all Italy levels" },
  japaneseMaster: { name: "Shogun Supreme", icon: "fas fa-torii-gate", color: "#BC002D", description: "Complete all Japan levels" },
  ottomanMaster: { name: "Sultan of Knowledge", icon: "fas fa-mosque", color: "#E30A17", description: "Complete all Ottoman levels" },
  
  // Special achievements
  speedster: { name: "Lightning Scholar", icon: "fas fa-bolt", color: "#e74c3c", description: "Complete a quiz in under 2 minutes" },
  dedication: { name: "Dedicated Learner", icon: "fas fa-medal", color: "#2ecc71", description: "Complete 10 quizzes" },
  streakMaster: { name: "Unstoppable", icon: "fas fa-fire", color: "#ff6b6b", description: "Achieve 5 quiz win streak" }
};

// Global State
// ============

let userProgress = {
  badges: [],
  totalPoints: 0,
  quizzesCompleted: 0,
  perfectScores: 0,
  winStreak: 0,
  completedLevels: {},
  bestScores: {}
};

let selectedCountry = "";
let lessonData = null;
let quizQuestions = [];
let currentQuestion = 0;
let score = 0;
let quizStartTime = 0;

// DOM Elements
// ============

const elements = {
  countryList: null,
  levelList: null,
  lessonDiv: null,
  lessonTitle: null,
  lessonContent: null,
  countryButtons: null,
  levelButtons: null,
  countryBadges: null,
  backToCountries: null,
  backToLevels: null
};

// Initialize DOM elements
function initializeElements() {
  elements.countryList = document.getElementById("countryList");
  elements.levelList = document.getElementById("levelList");
  elements.lessonDiv = document.getElementById("lesson");
  elements.lessonTitle = document.getElementById("lessonTitle");
  elements.lessonContent = document.getElementById("lessonContent");
  elements.countryButtons = document.getElementById("countryButtons");
  elements.levelButtons = document.getElementById("levelButtons");
  elements.countryBadges = document.getElementById("countryBadges");
  elements.backToCountries = document.getElementById("backToCountries");
  elements.backToLevels = document.getElementById("backToLevels");
}

// Progress Management
// ===================

function loadUserProgress() {
  const saved = localStorage.getItem('historyQuestProgress');
  if (saved) {
    userProgress = { ...userProgress, ...JSON.parse(saved) };
  }
  updateUserStats();
}

function saveUserProgress() {
  localStorage.setItem('historyQuestProgress', JSON.stringify(userProgress));
  updateUserStats();
}

function updateUserStats() {
  document.getElementById('totalBadges').textContent = userProgress.badges.length;
  document.getElementById('totalPoints').textContent = userProgress.totalPoints;
  document.getElementById('streakCount').textContent = userProgress.winStreak;
}

function getCountryProgress(countryKey) {
  const completed = userProgress.completedLevels[countryKey] || [];
  return Math.round((completed.length / levels.length) * 100);
}

// Navigation Functions
// ====================

function showCountries() {
  elements.countryList.classList.remove("hidden");
  elements.levelList.classList.add("hidden");
  elements.lessonDiv.classList.add("hidden");
  removeQuizSection();
}

function showLevels(countryKey) {
  selectedCountry = countryKey;
  elements.countryList.classList.add("hidden");
  elements.levelList.classList.remove("hidden");
  elements.lessonDiv.classList.add("hidden");
  removeQuizSection();

  renderLevelButtons();
  displayCountryBadges(countryKey);
}

function removeQuizSection() {
  const quizSection = document.getElementById("quizSection");
  if (quizSection) {
    quizSection.remove();
  }
}

// Rendering Functions
// ===================

function initializeCountries() {
  elements.countryButtons.innerHTML = '';
  
  Object.entries(countries).forEach(([key, country]) => {
    const btn = document.createElement("button");
    btn.className = "country-card";
    btn.style.borderColor = country.color;
    btn.innerHTML = `
      <i class="${country.icon}" style="color: ${country.color}"></i>
      <h3>${country.name}</h3>
      <p class="country-description">${country.description}</p>
      <div class="country-progress">
        <span class="progress-text">Progress: ${getCountryProgress(key)}%</span>
      </div>
    `;
    btn.addEventListener('click', () => showLevels(key));
    elements.countryButtons.appendChild(btn);
  });
}

function renderLevelButtons() {
  elements.levelButtons.innerHTML = "";

  levels.forEach((level, index) => {
    const levelNum = index + 1;
    const isCompleted = userProgress.completedLevels[selectedCountry]?.includes(levelNum);
    const bestScore = userProgress.bestScores[`${selectedCountry}-${levelNum}`] || 0;
    
    const btn = document.createElement("button");
    btn.className = `level-card ${isCompleted ? 'completed' : ''}`;
    btn.innerHTML = `
      <div class="level-header">
        <i class="${level.icon}"></i>
        <span class="difficulty ${level.difficulty.toLowerCase()}">${level.difficulty}</span>
        ${isCompleted ? '<i class="fas fa-check-circle completed-icon"></i>' : ''}
      </div>
      <h3>Era ${levelNum}: ${level.name}</h3>
      <p class="level-description">${level.description}</p>
      <div class="level-stats">
        <div class="stat">
          <i class="fas fa-star"></i>
          <span>${level.points} pts</span>
        </div>
        ${bestScore > 0 ? `
          <div class="stat">
            <i class="fas fa-trophy"></i>
            <span>Best: ${bestScore}%</span>
          </div>
        ` : ''}
      </div>
    `;
    btn.addEventListener('click', () => loadLesson(levelNum));
    elements.levelButtons.appendChild(btn);
  });
}

function displayCountryBadges(countryKey) {
  elements.countryBadges.innerHTML = '<h3 class="badges-title"><i class="fas fa-trophy"></i> Your Achievements</h3>';
  
  const earnedBadges = userProgress.badges.filter(badge => 
    badge === `${countryKey}Master` || 
    ['perfectScore', 'scholar', 'historian', 'expert', 'speedster', 'dedication', 'streakMaster'].includes(badge)
  );

  if (earnedBadges.length === 0) {
    elements.countryBadges.innerHTML += '<p class="no-badges">Complete quizzes to earn legendary badges!</p>';
    return;
  }

  const badgesGrid = document.createElement('div');
  badgesGrid.className = 'badges-grid';
  
  earnedBadges.forEach(badgeKey => {
    const badge = badges[badgeKey];
    if (badge) {
      const badgeElement = document.createElement('div');
      badgeElement.className = 'badge-item';
      badgeElement.innerHTML = `
        <div class="badge-icon" style="color: ${badge.color}">
          <i class="${badge.icon}"></i>
        </div>
        <div class="badge-info">
          <h4>${badge.name}</h4>
          <p>${badge.description}</p>
        </div>
      `;
      badgesGrid.appendChild(badgeElement);
    }
  });
  
  elements.countryBadges.appendChild(badgesGrid);
}

// Lesson Loading
// ==============

function loadLesson(level) {
  const jsonPath = `${selectedCountry}/${selectedCountry}-level${level}.json`;

  // Hide other sections
  elements.countryList.classList.add("hidden");
  elements.levelList.classList.add("hidden");
  removeQuizSection();

  fetch(jsonPath)
    .then(res => res.json())
    .then(data => {
      lessonData = data;
      elements.lessonTitle.textContent = data.title || "Lesson";

      if (data.readingFile) {
        loadMarkdownContent(data.readingFile);
      } else if (data.reading) {
        displayTextContent(data.reading);
      } else {
        displayFallbackContent();
      }
    })
    .catch(() => {
      displayErrorContent();
    });
}

function loadMarkdownContent(filename) {
  const mdPath = `${selectedCountry}/${filename}`;
  fetch(mdPath)
    .then(res => res.text())
    .then(md => {
      elements.lessonContent.innerHTML = marked.parse(md);
      addStartQuizButton();
      elements.lessonDiv.classList.remove("hidden");
    })
    .catch(() => {
      displayErrorContent();
    });
}

function displayTextContent(text) {
  elements.lessonContent.innerHTML = `<p>${text.replaceAll("\\n", "<br><br>")}</p>`;
  addStartQuizButton();
  elements.lessonDiv.classList.remove("hidden");
}

function displayFallbackContent() {
  elements.lessonContent.innerHTML = "<p>No reading content available.</p>";
  addStartQuizButton();
  elements.lessonDiv.classList.remove("hidden");
}

function displayErrorContent() {
  elements.lessonTitle.textContent = "Error loading lesson";
  elements.lessonContent.innerHTML = "<p>Make sure your JSON and Markdown files are in the correct folder.</p>";
  addStartQuizButton();
  elements.lessonDiv.classList.remove("hidden");
}

function addStartQuizButton() {
  const startQuizBtn = document.createElement("button");
  startQuizBtn.className = "quiz-start-btn";
  startQuizBtn.innerHTML = '<i class="fas fa-sword"></i> Begin Your Trial';
  startQuizBtn.addEventListener('click', startQuiz);
  elements.lessonContent.appendChild(startQuizBtn);
}

// Quiz Functions
// ==============

function startQuiz() {
  elements.levelList.classList.add("hidden");
  elements.lessonDiv.classList.add("hidden");
  removeQuizSection();

  currentQuestion = 0;
  score = 0;
  quizStartTime = Date.now();
  quizQuestions = [...lessonData.questions].sort(() => 0.5 - Math.random()).slice(0, 10);

  const quizDiv = document.createElement("div");
  quizDiv.id = "quizSection";
  quizDiv.className = "quiz-container";
  document.querySelector(".container").appendChild(quizDiv);

  loadQuestion();
}

function loadQuestion() {
  const q = quizQuestions[currentQuestion];
  const quizDiv = document.getElementById("quizSection");
  const progressPercentage = (currentQuestion / quizQuestions.length) * 100;

  quizDiv.innerHTML = `
    <div class="quiz-header">
      <div class="quiz-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercentage}%"></div>
        </div>
        <span class="question-counter">Question ${currentQuestion + 1} of ${quizQuestions.length}</span>
      </div>
      <div class="score-display">Score: ${score}/${currentQuestion}</div>
    </div>
    <div class="question-container">
      <h3 class="question-text">${q.question}</h3>
      <div class="choices-grid">
        ${q.choices.map((choice, index) => `
          <button class="choice-btn" data-choice="${choice}">
            <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
            <span class="choice-text">${choice}</span>
          </button>
        `).join("")}
      </div>
      <div id="feedback" class="feedback"></div>
    </div>
  `;

  // Add event listeners to choice buttons
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      checkAnswer(this.dataset.choice);
    });
  });
}

function checkAnswer(choice) {
  const q = quizQuestions[currentQuestion];
  const feedback = document.getElementById("feedback");
  const buttons = document.querySelectorAll("#quizSection .choice-btn");

  // Disable all buttons and mark correct/incorrect
  buttons.forEach(btn => {
    btn.disabled = true;
    const choiceText = btn.querySelector('.choice-text').textContent;
    if (choiceText === q.answer) {
      btn.classList.add("correct");
    } else if (choiceText === choice && choice !== q.answer) {
      btn.classList.add("incorrect");
    }
  });

  // Show feedback
  if (choice === q.answer) {
    score++;
    feedback.innerHTML = '<i class="fas fa-check-circle"></i> Excellent! That\'s correct!';
    feedback.className = "feedback correct";
  } else {
    feedback.innerHTML = `<i class="fas fa-times-circle"></i> Not quite right. The correct answer is: ${q.answer}`;
    feedback.className = "feedback incorrect";
  }

  // Update score display
  document.querySelector('.score-display').textContent = `Score: ${score}/${currentQuestion + 1}`;

  // Move to next question or show results
  setTimeout(() => {
    currentQuestion++;
    if (currentQuestion < quizQuestions.length) {
      loadQuestion();
    } else {
      showResults();
    }
  }, 2000);
}

function showResults() {
  const quizDiv = document.getElementById("quizSection");
  const percentage = Math.round((score / quizQuestions.length) * 100);
  const levelNum = parseInt(lessonData.level);
  const points = levels[levelNum - 1].points;
  const quizDuration = Math.floor((Date.now() - quizStartTime) / 1000);
  
  const { resultMessage, resultClass, earnedPoints } = calculateResults(percentage, points);
  const newBadges = [];

  updateUserProgress(percentage, levelNum, earnedPoints, quizDuration, newBadges);
  renderResults(quizDiv, percentage, earnedPoints, resultMessage, resultClass, newBadges);
}

function calculateResults(percentage, points) {
  let resultMessage, resultClass, earnedPoints;

  if (percentage >= 90) {
    resultMessage = "Legendary performance! You are a true master of history!";
    resultClass = "excellent";
    earnedPoints = points;
  } else if (percentage >= 70) {
    resultMessage = "Outstanding knowledge! You've proven your historical prowess!";
    resultClass = "good";
    earnedPoints = Math.round(points * 0.8);
  } else if (percentage >= 50) {
    resultMessage = "Good effort! Continue your studies to master this era!";
    resultClass = "average";
    earnedPoints = Math.round(points * 0.6);
  } else {
    resultMessage = "Keep practicing! Every great historian started somewhere.";
    resultClass = "needs-improvement";
    earnedPoints = Math.round(points * 0.3);
  }

  return { resultMessage, resultClass, earnedPoints };
}

function updateUserProgress(percentage, levelNum, earnedPoints, quizDuration, newBadges) {
  userProgress.quizzesCompleted++;
  userProgress.totalPoints += earnedPoints;
  
  // Track best score
  const levelKey = `${selectedCountry}-${levelNum}`;
  const previousBest = userProgress.bestScores[levelKey] || 0;
  if (percentage > previousBest) {
    userProgress.bestScores[levelKey] = percentage;
  }

  // Track completed levels
  if (!userProgress.completedLevels[selectedCountry]) {
    userProgress.completedLevels[selectedCountry] = [];
  }
  if (!userProgress.completedLevels[selectedCountry].includes(levelNum)) {
    userProgress.completedLevels[selectedCountry].push(levelNum);
  }

  // Update streak
  userProgress.winStreak = percentage >= 70 ? userProgress.winStreak + 1 : 0;

  // Check for new badges
  checkAndAwardBadges(percentage, quizDuration, newBadges);
  saveUserProgress();
}

function checkAndAwardBadges(percentage, quizDuration, newBadges) {
  const badgeChecks = [
    { condition: percentage === 100, badge: 'perfectScore' },
    { condition: percentage >= 90, badge: 'scholar' },
    { condition: userProgress.quizzesCompleted >= 5, badge: 'historian' },
    { condition: userProgress.winStreak >= 3 && percentage >= 80, badge: 'expert' },
    { condition: userProgress.winStreak >= 5, badge: 'streakMaster' },
    { condition: userProgress.quizzesCompleted >= 10, badge: 'dedication' },
    { condition: quizDuration < 120, badge: 'speedster' } // Under 2 minutes
  ];

  badgeChecks.forEach(({ condition, badge }) => {
    if (condition && !userProgress.badges.includes(badge)) {
      userProgress.badges.push(badge);
      newBadges.push(badge);
    }
  });

  // Country master badge
  const completedLevels = userProgress.completedLevels[selectedCountry] || [];
  if (completedLevels.length === levels.length) {
    const masterBadge = `${selectedCountry}Master`;
    if (!userProgress.badges.includes(masterBadge)) {
      userProgress.badges.push(masterBadge);
      newBadges.push(masterBadge);
    }
  }
}

function renderResults(quizDiv, percentage, earnedPoints, resultMessage, resultClass, newBadges) {
  const newBadgesHTML = newBadges.length > 0 ? `
    <div class="new-badges">
      <h3><i class="fas fa-star"></i> New Achievements Unlocked!</h3>
      <div class="badges-showcase">
        ${newBadges.map(badgeKey => {
          const badge = badges[badgeKey];
          return `
            <div class="new-badge">
              <div class="badge-icon" style="color: ${badge.color}">
                <i class="${badge.icon}"></i>
              </div>
              <h4>${badge.name}</h4>
              <p>${badge.description}</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  quizDiv.innerHTML = `
    <div class="results-container ${resultClass}">
      <div class="results-icon">
        <i class="fas fa-trophy"></i>
      </div>
      <h2 class="results-title">Quest Complete!</h2>
      <div class="results-score">
        <span class="score-number">${score}</span>
        <span class="score-total">/ ${quizQuestions.length}</span>
      </div>
      <div class="results-percentage">${percentage}%</div>
      <div class="points-earned">
        <i class="fas fa-coins"></i>
        +${earnedPoints} points earned
      </div>
      <p class="results-message">${resultMessage}</p>
      ${newBadgesHTML}
      <div class="results-actions">
        <button class="btn-primary" id="continueJourney">
          <i class="fas fa-redo"></i> Continue Your Journey
        </button>
        <button class="btn-secondary" id="exploreEmpire">
          <i class="fas fa-globe"></i> Explore New Empire
        </button>
      </div>
    </div>
  `;

  // Add event listeners to result buttons
  document.getElementById('continueJourney').addEventListener('click', () => showLevels(selectedCountry));
  document.getElementById('exploreEmpire').addEventListener('click', showCountries);
}

// Event Listeners
// ===============

function setupEventListeners() {
  elements.backToCountries.addEventListener('click', showCountries);
  elements.backToLevels.addEventListener('click', () => showLevels(selectedCountry));
}

// App Initialization
// ==================

function initializeApp() {
  initializeElements();
  loadUserProgress();
  initializeCountries();
  setupEventListeners();
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);