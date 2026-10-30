// History Quest - Game Rules
// ==========================
// Quiz flow, scoring, progress and badges. All checks happen on the server
// so the browser cannot award itself points or badges.

const { transaction } = require("./db");

const QUESTIONS_PER_QUIZ = 10;
const PASS_PERCENT = 70;
const SPEED_LIMIT_SECONDS = 120;

const badges = {
  // Performance badges
  perfectScore: { name: "Perfectionist", icon: "fas fa-gem", color: "#9b59b6", description: "Achieve 100% on any quiz" },
  scholar: { name: "Scholar", icon: "fas fa-graduation-cap", color: "#3498db", description: "Score 90% or higher" },
  historian: { name: "Historian", icon: "fas fa-scroll", color: "#e67e22", description: "Complete 5 quizzes" },
  expert: { name: "History Expert", icon: "fas fa-crown", color: "#f39c12", description: "Score 80% or higher on 3 consecutive quizzes" },

  // Country badges: key is `${countryKey}Master`
  englandMaster: { name: "Master of Albion", icon: "fas fa-crown", color: "#C41E3A", description: "Pass all England levels" },
  franceMaster: { name: "Liberté Champion", icon: "fas fa-scale-balanced", color: "#002654", description: "Pass all France levels" },
  italyMaster: { name: "Caesar's Heir", icon: "fas fa-landmark-dome", color: "#009246", description: "Pass all Italy levels" },
  japanMaster: { name: "Shogun Supreme", icon: "fas fa-torii-gate", color: "#BC002D", description: "Pass all Japan levels" },
  ottomanMaster: { name: "Sultan of Knowledge", icon: "fas fa-mosque", color: "#E30A17", description: "Pass all Ottoman levels" },

  // Special achievements
  speedster: { name: "Lightning Scholar", icon: "fas fa-bolt", color: "#e74c3c", description: "Score 90% or higher in under 2 minutes" },
  dedication: { name: "Dedicated Learner", icon: "fas fa-medal", color: "#2ecc71", description: "Complete 10 quizzes" },
  streakMaster: { name: "Unstoppable", icon: "fas fa-fire", color: "#ff6b6b", description: `Pass 5 quizzes in a row (${PASS_PERCENT}%+)` }
};

class GameError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function pointsFor(percentage, levelPoints) {
  if (percentage >= 90) return levelPoints;
  if (percentage >= 70) return Math.round(levelPoints * 0.8);
  if (percentage >= 50) return Math.round(levelPoints * 0.6);
  return Math.round(levelPoints * 0.3);
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createGame(db) {
  const q = {
    countries: db.prepare("SELECT key, name, icon, color, description FROM countries ORDER BY sort_order"),
    lessonsForCountry: db.prepare("SELECT level, title, difficulty, icon, points FROM lessons WHERE country_key = ? ORDER BY level"),
    lesson: db.prepare("SELECT * FROM lessons WHERE country_key = ? AND level = ?"),
    lessonCount: db.prepare("SELECT country_key, COUNT(*) AS n FROM lessons GROUP BY country_key"),
    questionsForLesson: db.prepare("SELECT id, question, choices FROM questions WHERE lesson_id = ?"),
    ensurePlayer: db.prepare("INSERT OR IGNORE INTO players (id, created_at) VALUES (?, ?)"),
    insertQuiz: db.prepare("INSERT INTO quizzes (player_id, lesson_id, started_at, total) VALUES (?, ?, ?, ?) RETURNING id"),
    insertQuizQuestion: db.prepare("INSERT INTO quiz_questions (quiz_id, position, question_id) VALUES (?, ?, ?)"),
    quiz: db.prepare(`
      SELECT qz.*, l.country_key, l.level, l.points AS level_points
      FROM quizzes qz JOIN lessons l ON l.id = qz.lesson_id
      WHERE qz.id = ?
    `),
    quizQuestion: db.prepare(`
      SELECT qq.chosen, q.choices, q.answer
      FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id
      WHERE qq.quiz_id = ? AND qq.position = ?
    `),
    recordAnswer: db.prepare("UPDATE quiz_questions SET chosen = ?, correct = ? WHERE quiz_id = ? AND position = ? AND chosen IS NULL"),
    quizTally: db.prepare("SELECT COUNT(chosen) AS answered, COALESCE(SUM(correct), 0) AS score FROM quiz_questions WHERE quiz_id = ?"),
    bestPointsForLesson: db.prepare(`
      SELECT COALESCE(MAX(points_earned), 0) AS best FROM quizzes
      WHERE player_id = ? AND lesson_id = ? AND finished_at IS NOT NULL
    `),
    finishQuiz: db.prepare("UPDATE quizzes SET finished_at = ?, score = ?, percentage = ?, points_earned = ? WHERE id = ? AND finished_at IS NULL"),
    finishedCount: db.prepare("SELECT COUNT(*) AS n FROM quizzes WHERE player_id = ? AND finished_at IS NOT NULL"),
    recentPercentages: db.prepare("SELECT percentage FROM quizzes WHERE player_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC, id DESC"),
    totalPoints: db.prepare(`
      SELECT COALESCE(SUM(best), 0) AS total FROM (
        SELECT MAX(points_earned) AS best FROM quizzes
        WHERE player_id = ? AND finished_at IS NOT NULL GROUP BY lesson_id
      )
    `),
    levelBests: db.prepare(`
      SELECT l.country_key, l.level, MAX(qz.percentage) AS best
      FROM quizzes qz JOIN lessons l ON l.id = qz.lesson_id
      WHERE qz.player_id = ? AND qz.finished_at IS NOT NULL
      GROUP BY l.id
    `),
    playerBadges: db.prepare("SELECT badge_key FROM player_badges WHERE player_id = ? ORDER BY earned_at"),
    awardBadge: db.prepare("INSERT OR IGNORE INTO player_badges (player_id, badge_key, earned_at) VALUES (?, ?, ?)")
  };

  function listCountries() {
    return q.countries.all().map(c => ({ ...c, levels: q.lessonsForCountry.all(c.key) }));
  }

  function getLesson(countryKey, level) {
    const lesson = q.lesson.get(countryKey, level);
    if (!lesson) throw new GameError(404, "Lesson not found");
    return {
      country: lesson.country_key,
      level: lesson.level,
      title: lesson.title,
      difficulty: lesson.difficulty,
      points: lesson.points,
      reading: lesson.reading_md
    };
  }

  function getProgress(playerId) {
    const percentages = q.recentPercentages.all(playerId).map(r => r.percentage);
    let winStreak = 0;
    while (winStreak < percentages.length && percentages[winStreak] >= PASS_PERCENT) winStreak++;

    const levels = {};
    for (const row of q.levelBests.all(playerId)) {
      levels[`${row.country_key}-${row.level}`] = { best: row.best, passed: row.best >= PASS_PERCENT };
    }

    return {
      totalPoints: q.totalPoints.get(playerId).total,
      quizzesCompleted: percentages.length,
      winStreak,
      badges: q.playerBadges.all(playerId).map(r => r.badge_key),
      levels
    };
  }

  function startQuiz(playerId, countryKey, level) {
    const lesson = q.lesson.get(countryKey, level);
    if (!lesson) throw new GameError(404, "Lesson not found");

    const picked = shuffle(q.questionsForLesson.all(lesson.id)).slice(0, QUESTIONS_PER_QUIZ);
    if (picked.length === 0) throw new GameError(409, "This lesson has no questions yet");

    return transaction(db, () => {
      q.ensurePlayer.run(playerId, Date.now());
      const { id: quizId } = q.insertQuiz.get(playerId, lesson.id, Date.now(), picked.length);
      picked.forEach((question, i) => q.insertQuizQuestion.run(quizId, i + 1, question.id));
      return {
        quizId,
        questions: picked.map((question, i) => ({
          position: i + 1,
          question: question.question,
          choices: JSON.parse(question.choices)
        }))
      };
    });
  }

  function loadOwnQuiz(quizId, playerId) {
    const quiz = q.quiz.get(quizId);
    if (!quiz || quiz.player_id !== playerId) throw new GameError(404, "Quiz not found");
    if (quiz.finished_at) throw new GameError(409, "Quiz already finished");
    return quiz;
  }

  function answerQuestion(quizId, playerId, position, choice) {
    loadOwnQuiz(quizId, playerId);
    const row = q.quizQuestion.get(quizId, position);
    if (!row) throw new GameError(404, "Question not found");
    if (row.chosen !== null) throw new GameError(409, "Question already answered");
    if (!JSON.parse(row.choices).includes(choice)) throw new GameError(400, "Choice is not an option for this question");

    const correct = choice === row.answer;
    q.recordAnswer.run(choice, correct ? 1 : 0, quizId, position);
    const tally = q.quizTally.get(quizId);
    return { correct, answer: row.answer, score: tally.score, answered: tally.answered };
  }

  function finishQuiz(quizId, playerId) {
    return transaction(db, () => {
      const quiz = loadOwnQuiz(quizId, playerId);
      const tally = q.quizTally.get(quizId);
      if (tally.answered < quiz.total) throw new GameError(409, "Answer every question before finishing");

      const now = Date.now();
      const percentage = Math.round((tally.score / quiz.total) * 100);
      const durationSec = Math.floor((now - quiz.started_at) / 1000);
      const attemptPoints = pointsFor(percentage, quiz.level_points);

      // Only improvements on a level's best result add to the total, so
      // replaying a level cannot farm points.
      const previousBest = q.bestPointsForLesson.get(playerId, quiz.lesson_id).best;
      const pointsGained = Math.max(0, attemptPoints - previousBest);

      q.finishQuiz.run(now, tally.score, percentage, attemptPoints, quizId);

      const progress = getProgress(playerId);
      const recent = q.recentPercentages.all(playerId).slice(0, 3).map(r => r.percentage);
      const countryLevels = q.lessonCount.all().find(r => r.country_key === quiz.country_key)?.n || 0;
      const passedInCountry = Object.entries(progress.levels)
        .filter(([key, v]) => key.startsWith(`${quiz.country_key}-`) && v.passed).length;

      const checks = [
        [percentage === 100, "perfectScore"],
        [percentage >= 90, "scholar"],
        [progress.quizzesCompleted >= 5, "historian"],
        [recent.length === 3 && recent.every(p => p >= 80), "expert"],
        [progress.winStreak >= 5, "streakMaster"],
        [progress.quizzesCompleted >= 10, "dedication"],
        [percentage >= 90 && durationSec < SPEED_LIMIT_SECONDS, "speedster"],
        [countryLevels > 0 && passedInCountry === countryLevels, `${quiz.country_key}Master`]
      ];

      const newBadges = [];
      for (const [earned, key] of checks) {
        if (earned && badges[key] && !progress.badges.includes(key)) {
          q.awardBadge.run(playerId, key, now);
          newBadges.push(key);
        }
      }
      progress.badges.push(...newBadges);

      return {
        score: tally.score,
        total: quiz.total,
        percentage,
        passed: percentage >= PASS_PERCENT,
        pointsGained,
        durationSec,
        newBadges,
        progress
      };
    });
  }

  return { listCountries, getLesson, getProgress, startQuiz, answerQuestion, finishQuiz };
}

module.exports = { createGame, GameError, badges, PASS_PERCENT, QUESTIONS_PER_QUIZ };
