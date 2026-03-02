export interface Workflow {
  id: string
  name: string
  display_name: string
  description: string | null
  type: string
  us_state: string
  created_at: string
  updated_at: string
}

export interface WorkflowAction {
  id: string
  name: string
  description: string | null
  property_name: string | null
  property_display_name: string | null
  next_workflow_step_name: string | null
  action_type: string | null
  matter_column_name: string | null
  deadline_offset_days: number | null
  deadline_property_name: string | null
  deadline_property_display_name: string | null
  workflow_name: string
  workflow_option_id: string
}

export interface WorkflowOption {
  id: string
  name: string
  display_name: string
  description: string | null
  type: string
  ordinal: number
  workflow_step_name: string
  workflow_name: string
  created_at: string
  updated_at: string
  actions: WorkflowAction[]
}

export interface WorkflowStep {
  id: string
  name: string
  fw_name: string | null
  ordinal: number
  display_step: string | null
  display_name: string
  workflow_name: string
  workflow_id: string
  created_at: string
  updated_at: string
  options: WorkflowOption[]
}

export interface WorkflowDetail extends Workflow {
  steps: WorkflowStep[]
}
