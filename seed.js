// History Quest - Database Seeder
// ===============================
// Imports the lesson content in content/<country>/ into the database.
// Safe to re-run: countries, lessons and questions are updated in place,
// so player progress is kept.

const fs = require("node:fs");
const path = require("node:path");
const { openDatabase, transaction, DB_PATH } = require("./db");

const CONTENT_DIR = path.join(__dirname, "content");

const countries = [
  { key: "england", name: "Kingdom of England", icon: "fas fa-crown", color: "#C41E3A",
    description: "Rule the seas and build an empire where the sun never sets" },
  { key: "france", name: "French Empire", icon: "fas fa-scale-balanced", color: "#002654",
    description: "Lead the revolution and spread enlightenment across Europe" },
  { key: "italy", name: "Roman Legacy", icon: "fas fa-landmark-dome", color: "#009246",
    description: "Command the eternal city and forge a lasting civilization" },
  { key: "japan", name: "Land of the Rising Sun", icon: "fas fa-torii-gate", color: "#BC002D",
    description: "Honor the samurai code and modernize the ancient traditions" },
  { key: "ottoman", name: "Ottoman Empire", icon: "fas fa-mosque", color: "#E30A17",
    description: "Bridge East and West while commanding vast territories" }
];

// Per-level difficulty, icon and points (same for every country).
const levelInfo = [
  { difficulty: "Novice", icon: "fas fa-seedling", points: 100 },
  { difficulty: "Apprentice", icon: "fas fa-shield-halved", points: 150 },
  { difficulty: "Scholar", icon: "fas fa-flag", points: 200 },
  { difficulty: "Expert", icon: "fas fa-fist-raised", points: 250 },
  { difficulty: "Master", icon: "fas fa-rocket", points: 300 }
];

function readLesson(countryKey, level) {
  const jsonPath = path.join(CONTENT_DIR, countryKey, `${countryKey}-level${level}.json`);
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const mdPath = path.join(CONTENT_DIR, countryKey, data.readingFile);
  const reading = fs.readFileSync(mdPath, "utf8");

  data.questions.forEach((q, i) => {
    if (!q.choices.includes(q.answer)) {
      throw new Error(`${jsonPath} question ${i + 1}: answer is not one of the choices`);
    }
  });

  return { title: data.title, reading, questions: data.questions };
}

function seed(db) {
  const upsertCountry = db.prepare(`
    INSERT INTO countries (key, name, icon, color, description, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name, icon = excluded.icon, color = excluded.color,
      description = excluded.description, sort_order = excluded.sort_order
  `);
  const upsertLesson = db.prepare(`
    INSERT INTO lessons (country_key, level, title, difficulty, icon, points, reading_md)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(country_key, level) DO UPDATE SET
      title = excluded.title, difficulty = excluded.difficulty, icon = excluded.icon,
      points = excluded.points, reading_md = excluded.reading_md
    RETURNING id
  `);
  const upsertQuestion = db.prepare(`
    INSERT INTO questions (lesson_id, position, question, choices, answer)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(lesson_id, position) DO UPDATE SET
      question = excluded.question, choices = excluded.choices, answer = excluded.answer
  `);
  const deleteExtraQuestions = db.prepare("DELETE FROM questions WHERE lesson_id = ? AND position > ?");

  let lessonCount = 0;
  let questionCount = 0;

  transaction(db, () => {
    countries.forEach((c, i) => {
      upsertCountry.run(c.key, c.name, c.icon, c.color, c.description, i);

      levelInfo.forEach((info, idx) => {
        const level = idx + 1;
        const lesson = readLesson(c.key, level);
        const { id: lessonId } = upsertLesson.get(
          c.key, level, lesson.title, info.difficulty, info.icon, info.points, lesson.reading
        );
        lesson.questions.forEach((q, pos) => {
          upsertQuestion.run(lessonId, pos + 1, q.question, JSON.stringify(q.choices), q.answer);
        });
        deleteExtraQuestions.run(lessonId, lesson.questions.length);
        lessonCount++;
        questionCount += lesson.questions.length;
      });
    });
  });

  return { countries: countries.length, lessons: lessonCount, questions: questionCount };
}

if (require.main === module) {
  const db = openDatabase();
  const counts = seed(db);
  db.close();
  console.log(`Seeded ${DB_PATH}: ${counts.countries} countries, ${counts.lessons} lessons, ${counts.questions} questions.`);
}

module.exports = { seed };
