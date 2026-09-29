// Layout hints overlay, stored in api/hints/<workflow_name>.json.
// Auto-layout runs first; hints are applied on top. All step keys are step
// names (not UUIDs) because actions reference steps by name.

export interface StepHint {
  /** Spine this step belongs to. "main" is the central column. */
  spine?: string
  /** Preferred lane (1 = nearest the spine) for a step that isn't on a spine. */
  lane?: number
  /** Rows to push this step (and everything downstream of it) down. */
  rowNudge?: number
  /** Absolute grid position; col is relative to the main spine (0). */
  pin?: { col: number; row: number }
  /** Group this step belongs to; see WorkflowHints.groups. */
  group?: string
  /** Replaces the step's display_name in the view. */
  label?: string
}

export interface SpineConfig {
  label?: string
  side?: "left" | "right"
  /** Lower comes first (nearest the main spine). */
  order?: number
}

export interface GroupConfig {
  label?: string
  collapsed?: boolean
}

export interface WorkflowHints {
  version: 1
  steps: Record<string, StepHint>
  spines?: Record<string, SpineConfig>
  groups?: Record<string, GroupConfig>
}

export const EMPTY_HINTS: WorkflowHints = { version: 1, steps: {}, spines: {}, groups: {} }
