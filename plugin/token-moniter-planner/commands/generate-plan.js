#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * generate-plan.js
 * Scans the current project directory dynamically, reconciling with existing plans
 * and Git state without blindly overwriting completed work.
 */

function getGitInfo(rootDir) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const commit = execSync('git rev-parse --short HEAD', { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const status = execSync('git status --porcelain', { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    return { branch: branch || 'main', commit: commit || 'head', isClean: status.length === 0 };
  } catch (e) {
    return { branch: 'main', commit: 'initial', isClean: true };
  }
}

function scanProject(rootDir = process.cwd()) {
  const projectName = path.basename(rootDir);
  const gitInfo = getGitInfo(rootDir);

  const ignoredDirs = new Set(['.git', '.planner', '.claude', 'node_modules', 'dist', 'build', '.DS_Store', '__pycache__']);

  function getFilesRecursively(dir, baseDir = dir) {
    let results = [];
    try {
      const list = fs.readdirSync(dir, { withFileTypes: true });
      list.forEach(file => {
        const filePath = path.join(dir, file.name);
        const relPath = path.relative(baseDir, filePath);
        if (ignoredDirs.has(file.name)) return;
        if (file.isDirectory()) {
          results = results.concat(getFilesRecursively(filePath, baseDir));
        } else {
          results.push(relPath);
        }
      });
    } catch (e) {}
    return results;
  }

  const plannerDir = path.resolve(rootDir, '.planner');
  if (!fs.existsSync(plannerDir)) {
    fs.mkdirSync(plannerDir, { recursive: true });
  }
  const planFilePath = path.join(plannerDir, 'plan.json');

  // Load existing plan if available to preserve user modifications & task statuses
  let existingPlan = null;
  const existingTaskStatusMap = new Map();
  if (fs.existsSync(planFilePath)) {
    try {
      existingPlan = JSON.parse(fs.readFileSync(planFilePath, 'utf8'));
      (existingPlan.domains || []).forEach(d => {
        (d.modules || []).forEach(m => {
          (m.tasks || []).forEach(t => {
            if (t.id) existingTaskStatusMap.set(t.id, t.status);
          });
        });
      });
    } catch (e) {}
  }

  const modules = [];

  // Backend folder
  const backendDir = path.join(rootDir, 'backend');
  if (fs.existsSync(backendDir)) {
    const files = getFilesRecursively(backendDir);
    const taskId = 'task-backend-implementation';
    modules.push({
      id: 'backend-module',
      title: 'Backend & Services',
      category: 'backend',
      summary: 'Server-side Python FastAPI application handling database sessions, API endpoints, model usage tracking, and task routing.',
      purpose: 'Executes core backend business logic, serves REST API endpoints, and manages SQLite persistence.',
      whyNeeded: 'Required for handling server requests, model state, and backend integrations.',
      dependsOn: [],
      dependsOnReason: '',
      deliverables: files.map(f => `backend/${f}`),
      risks: ['Database connectivity or routing errors'],
      complexity: 'medium',
      modelPreference: 'claude-3-5-sonnet',
      reviewStatus: 'approved',
      tasks: [
        {
          id: taskId,
          title: 'Backend API & Database Logic',
          summary: 'FastAPI routers, database models, and seeding scripts.',
          purpose: 'Provides reliable API responses and data integrity.',
          whyNeeded: 'Core system requirement.',
          deliverables: files.map(f => `backend/${f}`),
          risks: ['None'],
          complexity: 'medium',
          assignedModel: 'auto',
          status: (existingTaskStatusMap.get(taskId) === 'completed' ? 'done' : existingTaskStatusMap.get(taskId)) || 'done',
          reviewStatus: 'approved'
        }
      ]
    });
  }

  // Frontend folder
  const frontendDir = path.join(rootDir, 'frontend');
  if (fs.existsSync(frontendDir)) {
    const files = getFilesRecursively(frontendDir).filter(f => !f.startsWith('dist/') && !f.includes('node_modules/'));
    const taskId = 'task-frontend-implementation';
    modules.push({
      id: 'frontend-module',
      title: 'Frontend User Interface',
      category: 'frontend',
      summary: 'Client-side React Single Page Application providing dashboards, planning studios, model usage statistics, and settings.',
      purpose: 'Delivers a responsive user experience with interactive dashboards, charts, and planning tools.',
      whyNeeded: 'Provides visual interface for monitoring tokens, costs, and project plans.',
      dependsOn: ['backend-module'],
      dependsOnReason: 'Consumes backend REST APIs for metrics and plans.',
      deliverables: files.map(f => `frontend/${f}`),
      risks: ['UI build dependencies or proxy routing'],
      complexity: 'high',
      modelPreference: 'claude-3-5-sonnet',
      reviewStatus: 'approved',
      tasks: [
        {
          id: taskId,
          title: 'React UI & Tailwind Components',
          summary: 'Vite React application with Tailwind CSS and Recharts analytics.',
          purpose: 'Provides user-facing dashboards and views.',
          whyNeeded: 'User interaction layer.',
          deliverables: files.map(f => `frontend/${f}`),
          risks: ['None'],
          complexity: 'high',
          assignedModel: 'auto',
          status: (existingTaskStatusMap.get(taskId) === 'completed' ? 'done' : existingTaskStatusMap.get(taskId)) || 'done',
          reviewStatus: 'approved'
        }
      ]
    });
  }

  // Plugin folder
  const pluginDir = path.join(rootDir, 'plugin');
  if (fs.existsSync(pluginDir)) {
    const files = getFilesRecursively(pluginDir);
    const taskId = 'task-plugin-implementation';
    modules.push({
      id: 'plugin-module',
      title: 'Plugin & CLI Extensions',
      category: 'infra',
      summary: 'Claude Code CLI plugin extensions, mock API server (planning.js), entrypoints, and built viewer assets.',
      purpose: 'Integrates token monitoring and planning directly into the Claude Code developer workflow.',
      whyNeeded: 'Enables seamless plugin execution and local viewer hosting.',
      dependsOn: [],
      dependsOnReason: '',
      deliverables: files.map(f => `plugin/${f}`),
      risks: ['Port collisions or CLI permission errors'],
      complexity: 'medium',
      modelPreference: 'claude-3-5-haiku',
      reviewStatus: 'approved',
      tasks: [
        {
          id: taskId,
          title: 'CLI Plugin & Mock API Server',
          summary: 'Node.js planning server, built viewer distribution, and schemas.',
          purpose: 'Runs local server and CLI workflows.',
          whyNeeded: 'Plugin integration.',
          deliverables: files.map(f => `plugin/${f}`),
          risks: ['None'],
          complexity: 'medium',
          assignedModel: 'auto',
          status: (existingTaskStatusMap.get(taskId) === 'completed' ? 'done' : existingTaskStatusMap.get(taskId)) || 'done',
          reviewStatus: 'approved'
        }
      ]
    });
  }

  // Single-package / modern web app layout (e.g. src/ folder in React, Vue, Vite, etc.)
  const srcDir = path.join(rootDir, 'src');
  if (modules.length === 0 && fs.existsSync(srcDir)) {
    const utilFiles = getFilesRecursively(srcDir).filter(f => f.startsWith('utils/') || f.startsWith('lib/') || f.startsWith('types/'));
    if (utilFiles.length > 0) {
      modules.push({
        id: 'core-module',
        title: 'Core Engine & Utilities',
        category: 'other',
        summary: 'Application logic, parsers, algorithms, and type definitions.',
        purpose: 'Provides data processing, repair engines, and core utilities.',
        whyNeeded: 'Core application domain logic.',
        dependsOn: [],
        dependsOnReason: '',
        deliverables: utilFiles.map(f => `src/${f}`),
        risks: ['Complex parsing edge cases'],
        complexity: 'high',
        modelPreference: 'claude-3-5-sonnet',
        reviewStatus: 'approved',
        tasks: [
          {
            id: 'task-core-implementation',
            title: 'Core Engine & Logic Implementation',
            summary: 'Implementation of utilities, data processing, and type definitions.',
            purpose: 'Deliver reliable business logic.',
            whyNeeded: 'Core foundation.',
            deliverables: utilFiles.map(f => `src/${f}`),
            risks: ['None'],
            complexity: 'high',
            assignedModel: 'auto',
            status: 'done',
            reviewStatus: 'approved'
          }
        ]
      });
    }

    const uiFiles = getFilesRecursively(srcDir).filter(f => f.startsWith('components/') || f.startsWith('pages/') || f.startsWith('views/') || f === 'App.tsx' || f === 'App.jsx');
    if (uiFiles.length > 0) {
      modules.push({
        id: 'ui-module',
        title: 'User Interface & Components',
        category: 'frontend',
        summary: 'Interactive user interface, layout views, components, and event handlers.',
        purpose: 'Renders the visual design, controls, and presentation layer.',
        whyNeeded: 'User interaction layer.',
        dependsOn: utilFiles.length > 0 ? ['core-module'] : [],
        dependsOnReason: 'Consumes core utilities and data models.',
        deliverables: uiFiles.map(f => `src/${f}`),
        risks: ['Rendering bottlenecks'],
        complexity: 'medium',
        modelPreference: 'claude-3-5-sonnet',
        reviewStatus: 'approved',
        tasks: [
          {
            id: 'task-ui-implementation',
            title: 'UI Components & Layout',
            summary: 'React/Vue components, navigation, and user controls.',
            purpose: 'Visual presentation layer.',
            whyNeeded: 'Primary interface.',
            deliverables: uiFiles.map(f => `src/${f}`),
            risks: ['None'],
            complexity: 'medium',
            assignedModel: 'auto',
            status: 'done',
            reviewStatus: 'approved'
          }
        ]
      });
    }

    const buildFiles = ['package.json', 'vite.config.ts', 'vite.config.js', 'tsconfig.json', 'tailwind.config.js'].filter(f => fs.existsSync(path.join(rootDir, f)));
    if (buildFiles.length > 0) {
      modules.push({
        id: 'infra-module',
        title: 'Build Tooling & Configuration',
        category: 'infra',
        summary: 'Build pipeline, bundling configuration, TypeScript setup, and styling.',
        purpose: 'Provides local compilation, development server, and packaging.',
        whyNeeded: 'Development and production build pipeline.',
        dependsOn: [],
        dependsOnReason: '',
        deliverables: buildFiles,
        risks: ['Dependency resolution'],
        complexity: 'low',
        modelPreference: 'claude-3-5-haiku',
        reviewStatus: 'approved',
        tasks: [
          {
            id: 'task-build-tooling',
            title: 'Bundler & Environment Setup',
            summary: 'Vite/Webpack, TypeScript, Tailwind config, and dependencies.',
            purpose: 'Build and runtime tooling.',
            whyNeeded: 'Project infrastructure.',
            deliverables: buildFiles,
            risks: ['None'],
            complexity: 'low',
            assignedModel: 'auto',
            status: 'done',
            reviewStatus: 'approved'
          }
        ]
      });
    }
  }

  // Preserve existing detailed domains if present, otherwise group scanned modules
  const domains = (existingPlan && existingPlan.domains && existingPlan.domains.length > 0)
    ? existingPlan.domains
    : [
        {
          id: 'domain-backend',
          category: 'backend',
          title: 'Backend & Services',
          modules: modules.filter(m => m.category === 'backend')
        },
        {
          id: 'domain-frontend',
          category: 'frontend',
          title: 'Frontend & UI',
          modules: modules.filter(m => m.category === 'frontend')
        },
        {
          id: 'domain-infra',
          category: 'infra',
          title: 'Infrastructure & Integration',
          modules: modules.filter(m => m.category === 'infra')
        },
        {
          id: 'domain-other',
          category: 'other',
          title: 'General & Core Architecture',
          modules: modules.filter(m => m.category === 'other')
        }
      ].filter(d => d.modules.length > 0);

  const plan = {
    productIdea: (existingPlan && existingPlan.productIdea) || `Comprehensive architecture plan for ${projectName} detailing backend services, React frontend interface, and Claude Code plugin extensions.`,
    globalNotes: (existingPlan && existingPlan.globalNotes) || 'Generated dynamically based on actual directory file listings and folder responsibilities.',
    domains
  };

  fs.writeFileSync(planFilePath, JSON.stringify(plan, null, 2));

  function getProjectCreationDate(dir = rootDir) {
    try {
      const stat = fs.statSync(dir);
      if (stat.birthtime && !isNaN(stat.birthtime.getTime()) && stat.birthtime.getTime() > 0) {
        return stat.birthtime.toISOString();
      }
      return stat.ctime.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }

  // Write separate projects.json file for /projects UI
  const projectsData = {
    id: 1,
    name: projectName,
    description: `Architecture, execution tasks, and services for ${projectName}.`,
    repository_path: rootDir,
    status: 'active',
    stage: 'execution',
    created_at: getProjectCreationDate(rootDir),
    branch: gitInfo.branch,
    commit: gitInfo.commit,
    isClean: gitInfo.isClean,
    modules: modules.map((m, idx) => ({
      id: idx + 1,
      name: m.title,
      category: m.category,
      status: 'completed',
      tasks: (m.tasks || []).map((t, tIdx) => ({
        id: tIdx + 1,
        title: t.title,
        status: t.status || 'completed'
      }))
    }))
  };
  fs.writeFileSync(path.join(plannerDir, 'projects.json'), JSON.stringify(projectsData, null, 2));

  // Initialize dashboard.json strictly with null/no_data when empty (no invented numbers)
  const dashPath = path.join(plannerDir, 'dashboard.json');
  if (!fs.existsSync(dashPath)) {
    const initialDash = {
      status: 'no_data',
      project_name: projectName,
      target_project: projectName,
      total_input_tokens: null,
      total_cache_read: null,
      total_cache_write: null,
      total_output_tokens: null,
      total_reasoning: null,
      total_cost: null,
      unpriced_models: [],
      row_count: 0,
      last_updated: new Date().toISOString()
    };
    fs.writeFileSync(dashPath, JSON.stringify(initialDash, null, 2), 'utf8');
  }

  console.log(`✨ Reconciled project plan, projects.json, and dashboard.json in ${plannerDir}`);
  return planFilePath;
}

if (require.main === module) {
  scanProject();
}

module.exports = { scanProject, reconcilePlan: scanProject, getGitInfo };
