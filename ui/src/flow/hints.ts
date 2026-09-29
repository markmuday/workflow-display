import type { GroupConfig, StepHint, WorkflowHints } from "@/types/hints"

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v))
}

/** Merge a patch into one step's hint; undefined/empty values remove the field. */
export function patchStepHint(hints: WorkflowHints, stepName: string, patch: Partial<StepHint>): WorkflowHints {
  const merged: Record<string, unknown> = { ...hints.steps[stepName], ...patch }
  for (const k of Object.keys(merged)) if (isEmpty(merged[k]) || (k === "rowNudge" && merged[k] === 0)) delete merged[k]
  const steps = { ...hints.steps }
  if (Object.keys(merged).length) steps[stepName] = merged as StepHint
  else delete steps[stepName]
  return { ...hints, steps }
}

export function patchGroup(hints: WorkflowHints, group: string, patch: Partial<GroupConfig>): WorkflowHints {
  return { ...hints, groups: { ...hints.groups, [group]: { ...hints.groups?.[group], ...patch } } }
}

export function removeStepHints(hints: WorkflowHints, stepNames: string[]): WorkflowHints {
  const steps = { ...hints.steps }
  for (const n of stepNames) delete steps[n]
  return { ...hints, steps }
}
