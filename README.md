# History Quest

Interactive history lessons and quizzes for five civilizations (England, France, Italy, Japan, Ottoman Empire). Read a lesson, take a 10-question quiz, earn points and badges.

## Requirements

- Node.js 22.13 or newer. The app uses the built-in `node:sqlite` module, so there is nothing to install.

## Run it

```bash
npm start
```

Then open http://localhost:3000. Set `PORT` to use another port.

On first start, the server creates `data/history-quest.db` and fills it from `content/`.

## Project layout

| Path | What it is |
| --- | --- |
| `server.js` | HTTP server: serves `public/` and the JSON API |
| `game.js` | Quiz flow, scoring, progress and badge rules |
| `db.js` | SQLite schema and connection |
| `seed.js` | Imports `content/` into the database |
| `content/<country>/` | Lesson source files: `*-levelN.json` (title, questions) and `*-levelN.md` (reading) |
| `public/` | Frontend (HTML, CSS, JS) |
| `data/` | The SQLite database (not committed) |

## Editing lessons

Edit the files in `content/`, then run:

```bash
npm run seed
```

The seed updates countries, lessons and questions in place. Player progress is kept.

## Rules

- Each quiz picks 10 random questions from the lesson. Answers are checked on the server.
- Score 70% or more to pass an era. An empire badge needs all five eras passed.
- Points per era come from your best attempt. Replaying only adds points when you beat your best.
- Each browser gets an anonymous player id. Progress is stored in the database under that id.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/meta` | Badge definitions and pass mark |
| GET | `/api/countries` | Countries with their levels |
| GET | `/api/lessons/:country/:level` | Lesson title and reading (Markdown) |
| GET | `/api/players/:id/progress` | Points, streak, badges, best score per level |
| POST | `/api/quizzes` | Start a quiz: `{ playerId, country, level }` |
| POST | `/api/quizzes/:id/answers` | Answer: `{ playerId, position, choice }` |
| POST | `/api/quizzes/:id/finish` | Finish and score: `{ playerId }` |
