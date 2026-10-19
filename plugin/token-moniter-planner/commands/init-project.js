const fs = require('fs');
const path = require('path');

/**
 * init-project.js
 * Automatically verifies and initializes all prerequisites for any target project on the fly.
 * Called automatically when the user types `/planning` in Claude Code.
 *
 * STRICT PRIVACY & ISOLATION:
 * - Credentials and API gateway keys are NOT written to project folders.
 * - All authentication and proxy settings are read from ~/.claude/settings.json or process.env.
 * - Only project-specific artifacts (.planner/, app.db) are created.
 */

function ensureProjectInitialized(projectDir = process.cwd(), pluginRootDir = path.resolve(__dirname, '..')) {
  const plannerDir = path.resolve(projectDir, '.planner');
  const isNewProject = !fs.existsSync(plannerDir);

  if (isNewProject) {
    fs.mkdirSync(plannerDir, { recursive: true });
    console.log(`📦 Setting up Planning Studio for: ${path.basename(projectDir)}...`);
  }

  // 1. Ensure .planner/prices.json exists
  const localPrices = path.join(plannerDir, 'prices.json');
  const schemaPrices = path.join(pluginRootDir, 'schema', 'prices.json');
  if (!fs.existsSync(localPrices) && fs.existsSync(schemaPrices)) {
    try {
      fs.copyFileSync(schemaPrices, localPrices);
    } catch (e) {}
  }

  // 2. Scan project and initialize plan.json, projects.json, dashboard.json
  try {
    const { scanProject } = require('./generate-plan.js');
    scanProject(projectDir);
  } catch (e) {
    console.error('Error generating project plan:', e.message);
  }

  // 3. Initialize SQLite app.db if not present
  try {
    const dbPath = path.resolve(projectDir, 'app.db');
    if (!fs.existsSync(dbPath)) {
      let db = null;
      try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(dbPath);
      } catch (e) {}

      if (db) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS project (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR NOT NULL,
            description VARCHAR,
            repository_path VARCHAR,
            status VARCHAR DEFAULT 'active',
            stage VARCHAR DEFAULT 'planning',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS sessionrecord (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid VARCHAR UNIQUE NOT NULL,
            project_id INTEGER,
            status VARCHAR DEFAULT 'active',
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME,
            summary VARCHAR
          );

          CREATE TABLE IF NOT EXISTS activitylog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            session_id INTEGER,
            model_name VARCHAR,
            event_type VARCHAR NOT NULL,
            status VARCHAR DEFAULT 'info',
            summary VARCHAR NOT NULL,
            details VARCHAR,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        db.prepare('INSERT INTO project (name, description, repository_path, status, stage) VALUES (?, ?, ?, ?, ?)').run(
          path.basename(projectDir),
          'AI development project tracked by Token Monitor & Planner',
          projectDir,
          'active',
          'execution'
        );

        db.prepare('INSERT INTO sessionrecord (session_uuid, project_id, status, summary) VALUES (?, 1, ?, ?)').run(
          'session-initial-1',
          'active',
          'Initial Claude session'
        );

        db.close();
      }
    }
  } catch (e) {}

  // 4. Configure npm start script if package.json exists
  try {
    const pkgPath = path.resolve(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.scripts = pkg.scripts || {};
      const planningJsPath = path.resolve(pluginRootDir, 'commands', 'planning.js');
      if (!pkg.scripts.start) {
        pkg.scripts.start = `node "${planningJsPath}"`;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      }
    }
  } catch (e) {}

  if (isNewProject) {
    console.log(`✅ Prerequisites automatically initialized for ${path.basename(projectDir)}.`);
  }

  return true;
}

module.exports = { ensureProjectInitialized };
