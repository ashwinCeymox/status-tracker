import {
  groupFlatPlanToDomains,
  validatePlanApprovalGate,
  buildHandoffPrompt
} from './planValidator';
import type { FlatModuleInput, Plan } from './planValidator';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('Running comprehensive planValidator unit tests...');

// 1. Normal plan test
const normalModules: FlatModuleInput[] = [
  {
    id: 'mod-db',
    title: 'Database Setup',
    category: 'data',
    summary: 'Setup SQLite database with SQLModel tables.',
    purpose: 'Store tasks and projects.',
    whyNeeded: 'Persists application state across restarts.',
    dependsOn: [],
    deliverables: ['SQLite database file', 'Initial schema migration'],
    risks: ['File permission issues on some OS'],
    complexity: 'medium',
    modelPreference: 'antigravity/claude-sonnet-4-6'
  },
  {
    id: 'mod-api',
    title: 'FastAPI Endpoints',
    category: 'backend',
    summary: 'Create REST endpoints to read and write tasks.',
    purpose: 'API layer for client.',
    whyNeeded: 'Provides interface for frontend UI.',
    dependsOn: ['mod-db'],
    dependsOnReason: 'API requires database tables to exist.',
    deliverables: ['GET /tasks', 'POST /tasks'],
    risks: ['CORS issues with local client'],
    complexity: 'medium',
    modelPreference: 'antigravity/gemini-3-flash'
  },
  {
    id: 'mod-ui',
    title: 'React Dashboard',
    category: 'frontend',
    summary: 'Interactive web UI for task viewing.',
    purpose: 'User facing dashboard.',
    whyNeeded: 'Allows visual monitoring.',
    dependsOn: ['mod-api'],
    dependsOnReason: 'UI calls FastAPI endpoints.',
    deliverables: ['Task list view', 'Status badges'],
    risks: ['Browser compatibility'],
    complexity: 'low',
    modelPreference: 'antigravity/gemini-3-flash'
  }
];

const res1 = groupFlatPlanToDomains(normalModules, 'Task Manager App', 'Keep it simple');
assert(!!res1.plan && !res1.error, 'Normal plan should group and validate successfully');
assert(res1.plan!.domains.length === 3, 'Should have 3 distinct domains (data, backend, frontend)');
console.log('✔ 1. Normal plan grouping: PASS');

// 2. Unknown category falls back or fails gracefully
const unknownCatModules: FlatModuleInput[] = [
  {
    id: 'mod-ml',
    title: 'ML Recommendations',
    category: 'machine_learning',
    summary: 'Suggest tasks based on history.',
    purpose: 'Task suggestions.',
    whyNeeded: 'Improves productivity.',
    dependsOn: []
  }
];
const res2 = groupFlatPlanToDomains(unknownCatModules);
assert(!!res2.plan, 'Plan with unknown category should succeed');
assert(res2.plan!.domains.some(d => d.category === 'other'), 'Unknown category should fall back to "other"');
console.log('✔ 2. Unknown category fallback to "other": PASS');

// 3. Cyclic dependency rejection
const cyclicModules: FlatModuleInput[] = [
  {
    id: 'm1',
    title: 'Module 1',
    category: 'backend',
    dependsOn: ['m2']
  },
  {
    id: 'm2',
    title: 'Module 2',
    category: 'frontend',
    dependsOn: ['m1']
  }
];
const res3 = groupFlatPlanToDomains(cyclicModules);
assert(!!res3.error && res3.error.includes('Cyclic dependency'), 'Cyclic dependency must be rejected');
console.log('✔ 3. Cyclic dependency rejection: PASS');

// 4. Dangling dependency rejection
const danglingModules: FlatModuleInput[] = [
  {
    id: 'm1',
    title: 'Module 1',
    category: 'backend',
    dependsOn: ['m-nonexistent']
  }
];
const res4 = groupFlatPlanToDomains(danglingModules);
assert(!!res4.error && res4.error.includes('depends on non-existent module'), 'Dangling dependency must be rejected');
console.log('✔ 4. Dangling dependency rejection: PASS');

// 5. Duplicate IDs rejection
const duplicateModules: FlatModuleInput[] = [
  {
    id: 'm1',
    title: 'Module 1 A',
    category: 'backend',
    dependsOn: []
  },
  {
    id: 'm1',
    title: 'Module 1 B',
    category: 'frontend',
    dependsOn: []
  }
];
const res5 = groupFlatPlanToDomains(duplicateModules);
assert(!!res5.error && res5.error.includes('Duplicate module ID'), 'Duplicate IDs must be rejected');
console.log('✔ 5. Duplicate module ID rejection: PASS');

// 6. Approval Gate Logic
const testPlan: Plan = res1.plan!;
const gateBefore = validatePlanApprovalGate(testPlan);
assert(!gateBefore.canProceed, 'Gate should block when modules are unapproved');
assert(gateBefore.unapprovedModules.length === 3, 'All 3 modules should be listed as unapproved');

// Approve all modules
testPlan.domains.forEach(d => {
  d.modules.forEach(m => {
    m.reviewStatus = 'approved';
    m.userNote = 'Tested and verified';
  });
});
const gateAfter = validatePlanApprovalGate(testPlan);
assert(gateAfter.canProceed, 'Gate should pass when all modules are approved with assigned models');
console.log('✔ 6. Approval gate logic (unapproved vs approved): PASS');

// 7. Prompt Builder in Topological Order
const promptOutput = buildHandoffPrompt(testPlan);
assert(promptOutput.includes('# Claude Code Implementation Plan: Task Manager App'), 'Header must match product idea');
assert(promptOutput.includes('## User Instructions & Execution Guardrails'), 'Guardrails must be present');
assert(promptOutput.includes('Do NOT start coding everything at once.'), 'Step by step guardrails present');
assert(promptOutput.includes('Keep it simple'), 'Global notes present');
assert(promptOutput.includes('antigravity/claude-sonnet-4-6'), 'Assigned model present');
assert(promptOutput.includes('Tested and verified'), 'User note included');

const idxDb = promptOutput.indexOf('mod-db');
const idxApi = promptOutput.indexOf('mod-api');
const idxUi = promptOutput.indexOf('mod-ui');
assert(idxDb < idxApi && idxApi < idxUi, 'Modules must be listed in topological dependency order');
console.log('✔ 7. Prompt builder topological order and note inclusion: PASS');

console.log('ALL 7 PLAN VALIDATOR TESTS PASSED WITH 100% SUCCESS!');
