import { z } from 'zod';

export const CategoryEnum = z.enum(['backend', 'frontend', 'infra', 'data', 'other']);
export type Category = z.infer<typeof CategoryEnum>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  purpose: z.string().optional(),
  whyNeeded: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
  dependsOnReason: z.string().optional().default(''),
  deliverables: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  complexity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assignedModel: z.string().default('auto'),
  userNote: z.string().default(''),
  reviewStatus: z.enum(['unreviewed', 'approved', 'reviewed', 'needs-change']).default('unreviewed'),
  status: z.preprocess(
    (val) => (val === 'completed' ? 'done' : val),
    z.enum(['pending', 'running', 'done', 'completed', 'failed', 'blocked'])
  ).default('pending'),
  tokens: z.number().optional(),
  cost: z.number().optional(),
  error: z.string().optional()
});

export const ModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: CategoryEnum.default('other'),
  summary: z.string().default(''),
  purpose: z.string().default(''),
  whyNeeded: z.string().default(''),
  dependsOn: z.array(z.string()).default([]),
  dependsOnReason: z.string().optional().default(''),
  deliverables: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  complexity: z.enum(['low', 'medium', 'high']).default('medium'),
  effortHint: z.string().optional().default(''),
  modelPreference: z.string().default('auto'),
  userNote: z.string().default(''),
  reviewStatus: z.enum(['unreviewed', 'approved', 'reviewed', 'needs-change']).default('unreviewed'),
  tasks: z.array(TaskSchema).default([])
});

export const DomainSchema = z.object({
  id: z.string(),
  category: CategoryEnum.default('other'),
  title: z.string(),
  modules: z.array(ModuleSchema).default([])
});

export const PlanSchema = z.object({
  productIdea: z.string().default(''),
  globalNotes: z.string().default(''),
  domains: z.array(DomainSchema)
});

export type Task = z.infer<typeof TaskSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type Domain = z.infer<typeof DomainSchema>;
export type Plan = z.infer<typeof PlanSchema>;

// Flat module representation for AI planner responses
export const FlatModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional().default('other'),
  summary: z.string().optional().default(''),
  purpose: z.string().optional().default(''),
  whyNeeded: z.string().optional().default(''),
  dependsOn: z.array(z.string()).optional().default([]),
  dependsOnReason: z.string().optional().default(''),
  deliverables: z.union([z.array(z.string()), z.string()]).optional().default([]),
  risks: z.union([z.array(z.string()), z.string()]).optional().default([]),
  complexity: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  effortHint: z.string().optional().default(''),
  modelPreference: z.string().optional().default('auto'),
  reviewStatus: z.enum(['unreviewed', 'approved', 'reviewed', 'needs-change']).optional().default('unreviewed'),
  tasks: z.array(TaskSchema).optional().default([])
});

export type FlatModule = z.infer<typeof FlatModuleSchema>;
export type FlatModuleInput = z.input<typeof FlatModuleSchema>;

/**
 * Pure function: Groups flat modules into domain sections and validates structure,
 * unique IDs, dangling dependencies, and dependency cycles.
 */
export function groupFlatPlanToDomains(
  rawFlatModules: any[],
  productIdea: string = '',
  globalNotes: string = ''
): { plan?: Plan; error?: string } {
  try {
    const flatModules: FlatModule[] = [];
    for (const raw of rawFlatModules) {
      const parsed = FlatModuleSchema.parse(raw);
      flatModules.push(parsed);
    }

    const allModuleIds = new Set<string>();

    for (const mod of flatModules) {
      if (allModuleIds.has(mod.id)) {
        return { error: `Duplicate module ID detected: '${mod.id}'` };
      }
      allModuleIds.add(mod.id);
    }

    for (const mod of flatModules) {
      const deps = mod.dependsOn || [];
      for (const dep of deps) {
        if (!allModuleIds.has(dep)) {
          return { error: `Module '${mod.id}' depends on non-existent module '${dep}'` };
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const moduleMap = new Map<string, FlatModule>(flatModules.map(m => [m.id, m]));

    function dfs(modId: string): boolean {
      if (visiting.has(modId)) return true;
      if (visited.has(modId)) return false;

      visiting.add(modId);
      const m = moduleMap.get(modId);
      if (m && m.dependsOn) {
        for (const dep of m.dependsOn) {
          if (dfs(dep)) return true;
        }
      }
      visiting.delete(modId);
      visited.add(modId);
      return false;
    }

    for (const modId of allModuleIds) {
      if (!visited.has(modId)) {
        if (dfs(modId)) {
          return { error: `Cyclic dependency detected involving module '${modId}'` };
        }
      }
    }

    const categoryTitleMap: Record<Category, string> = {
      backend: 'Backend & Services',
      frontend: 'Frontend & UI',
      infra: 'Infrastructure & Routing',
      data: 'Database & Data Storage',
      other: 'General & Core Architecture'
    };

    const grouped: Record<Category, Module[]> = {
      backend: [],
      frontend: [],
      infra: [],
      data: [],
      other: []
    };

    for (const raw of flatModules) {
      let cat: Category = 'other';
      if (raw.category && CategoryEnum.safeParse(raw.category.toLowerCase()).success) {
        cat = raw.category.toLowerCase() as Category;
      }

      const deliverables = Array.isArray(raw.deliverables)
        ? raw.deliverables
        : raw.deliverables ? [raw.deliverables] : [];

      const risks = Array.isArray(raw.risks)
        ? raw.risks
        : raw.risks ? [raw.risks] : [];

      grouped[cat].push({
        id: raw.id,
        title: raw.title,
        category: cat,
        summary: raw.summary || raw.title,
        purpose: raw.purpose || raw.title,
        whyNeeded: raw.whyNeeded || 'Essential component of the application architecture.',
        dependsOn: raw.dependsOn || [],
        dependsOnReason: raw.dependsOnReason || '',
        deliverables,
        risks,
        complexity: raw.complexity || 'medium',
        effortHint: raw.effortHint || '',
        modelPreference: raw.modelPreference || 'auto',
        userNote: '',
        reviewStatus: (raw as any).reviewStatus || 'unreviewed',
        tasks: raw.tasks || []
      });
    }

    const domains: Domain[] = (Object.keys(grouped) as Category[])
      .filter(cat => grouped[cat].length > 0)
      .map(cat => ({
        id: `domain-${cat}`,
        category: cat,
        title: categoryTitleMap[cat],
        modules: grouped[cat]
      }));

    return {
      plan: {
        productIdea,
        globalNotes,
        domains
      }
    };
  } catch (err: any) {
    return { error: `Plan grouping error: ${err.message}` };
  }
}

export function groupAndValidatePlan(rawPlan: unknown): { plan?: Plan; error?: string } {
  try {
    const parsed = PlanSchema.parse(rawPlan);
    const allModules: FlatModule[] = [];
    for (const d of parsed.domains) {
      for (const m of d.modules) {
        allModules.push(m);
      }
    }
    return groupFlatPlanToDomains(allModules, parsed.productIdea, parsed.globalNotes);
  } catch (err: any) {
    return { error: `Plan validation error: ${err.message}` };
  }
}

export function validatePlanApprovalGate(plan: Plan): {
  canProceed: boolean;
  unapprovedModules: string[];
  missingModelModules: string[];
} {
  const unapproved: string[] = [];
  const missingModel: string[] = [];

  for (const domain of plan.domains) {
    for (const mod of domain.modules) {
      if (mod.reviewStatus !== 'approved') {
        unapproved.push(mod.title);
      }
      if (!mod.modelPreference || mod.modelPreference.trim() === '') {
        missingModel.push(mod.title);
      }
    }
  }

  return {
    canProceed: unapproved.length === 0 && missingModel.length === 0,
    unapprovedModules: unapproved,
    missingModelModules: missingModel
  };
}

export function buildHandoffPrompt(plan: Plan): string {
  const allModules: Module[] = [];
  for (const domain of plan.domains) {
    for (const mod of domain.modules) {
      allModules.push(mod);
    }
  }

  const sorted: Module[] = [];
  const visited = new Set<string>();
  const moduleMap = new Map<string, Module>(allModules.map(m => [m.id, m]));

  function visit(modId: string) {
    if (visited.has(modId)) return;
    visited.add(modId);
    const m = moduleMap.get(modId);
    if (m && m.dependsOn) {
      for (const dep of m.dependsOn) {
        visit(dep);
      }
    }
    if (m) sorted.push(m);
  }

  for (const m of allModules) {
    visit(m.id);
  }

  const lines: string[] = [];
  lines.push('# Claude Code Implementation Plan: ' + (plan.productIdea || 'Software Application'));
  lines.push('');
  lines.push('## User Instructions & Execution Guardrails');
  lines.push('- Do NOT start coding everything at once.');
  lines.push('- First output an ordered feature sequence/milestones list.');
  lines.push('- Work in small steps and stop at each major block for user testing and verification.');
  lines.push('- Never claim something works without running it and showing the actual output.');
  lines.push('');

  if (plan.globalNotes && plan.globalNotes.trim() !== '') {
    lines.push('## Global User Notes & Constraints');
    lines.push(plan.globalNotes.trim());
    lines.push('');
  }

  lines.push('## Approved Modules (In Dependency Order)');
  sorted.forEach((mod, idx) => {
    lines.push(`### Step ${idx + 1}: [${mod.category.toUpperCase()}] ${mod.title} (${mod.id})`);
    lines.push(`- **Summary**: ${mod.summary}`);
    lines.push(`- **Purpose**: ${mod.purpose}`);
    lines.push(`- **Why Needed**: ${mod.whyNeeded}`);
    if (mod.dependsOn && mod.dependsOn.length > 0) {
      lines.push(`- **Prerequisites**: ${mod.dependsOn.join(', ')} (${mod.dependsOnReason || 'required dependency'})`);
    }
    if (mod.deliverables && mod.deliverables.length > 0) {
      lines.push(`- **Deliverables**: ${mod.deliverables.join('; ')}`);
    }
    if (mod.risks && mod.risks.length > 0) {
      lines.push(`- **Risks**: ${mod.risks.join('; ')}`);
    }
    lines.push(`- **Assigned Model**: ${mod.modelPreference}`);
    if (mod.userNote && mod.userNote.trim() !== '') {
      lines.push(`- **User Note**: ${mod.userNote.trim()}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
