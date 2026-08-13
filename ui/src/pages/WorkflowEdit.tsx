import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PlusIcon, XIcon, Trash2Icon, GripVerticalIcon, ListCollapseIcon } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { WorkflowDetail, WorkflowStep, WorkflowAction } from "@/types/workflow"

// ── Edit state ────────────────────────────────────────────────────────────────

interface NewStep {
  clientId: string
  name: string
  displayName: string
  ordinal: number
}

interface NewOption {
  clientId: string
  stepId: string | null       // UUID for existing steps; null for new steps
  stepClientId: string | null // clientId for new steps; null for existing steps
  stepName: string
  name: string
  displayName: string
  ordinal: number
}

interface NewActionDef {
  clientId: string
  name: string
  description: string
  nextWorkflowStepName: string
  propertyName: string
  deadlinePropertyName: string
  deadlineOffsetDays: string
}

interface NewActionLink {
  optionId: string | null
  optionClientId: string | null
  actionId: string | null
  actionClientId: string | null
  displayName: string
}

interface EditState {
  removedOptionIds: Set<string>
  removedActionLinks: { optionId: string; actionId: string }[]
  newSteps: NewStep[]
  newOptions: NewOption[]
  newActionDefs: NewActionDef[]
  newActionLinks: NewActionLink[]
  // Ordered list of step keys (existing step id or new step clientId). Empty = default order.
  stepOrder: string[]
  // fw_name is a legacy, otherwise-unused column (formerly "freshworks name")
  // that we repurpose here as a "main path" layout hint: 'main' marks a step
  // as sitting on the workflow's central/happy path, vs. off to the side.
  // Overrides are keyed by step key (existing id or new clientId); presence
  // of a key = an intentional change; value is 'main' or null.
  fwNameByKey: Record<string, string | null>
}

function emptyEditState(): EditState {
  return {
    removedOptionIds: new Set(),
    removedActionLinks: [],
    newSteps: [],
    newOptions: [],
    newActionDefs: [],
    newActionLinks: [],
    stepOrder: [],
    fwNameByKey: {},
  }
}

// The action fields we render, normalized from either an existing
// WorkflowAction or a locally-added new action def.
interface ActionData {
  name: string
  description: string | null
  property_name: string | null
  deadline_property_name: string | null
  deadline_offset_days: number | null
  next_workflow_step_name: string | null
  action_type: string | null
  matter_column_name: string | null
  property_to_check: string | null
  required_workflow_step: string | null
}

interface ActionDisplay {
  id: string | null
  clientId: string | null
  data: ActionData
}

interface OptionDisplay {
  id: string | null
  clientId: string | null
  name: string
  displayName: string
  actions: ActionDisplay[]
}

function actionDataFromAction(a: WorkflowAction): ActionData {
  return {
    name: a.name,
    description: a.description,
    property_name: a.property_name,
    deadline_property_name: a.deadline_property_name,
    deadline_offset_days: a.deadline_offset_days,
    next_workflow_step_name: a.next_workflow_step_name,
    action_type: a.action_type,
    matter_column_name: a.matter_column_name,
    property_to_check: a.property_to_check,
    required_workflow_step: a.required_workflow_step,
  }
}

// Minimal step info needed by StepEditCard — works for both existing and new steps
interface StepCardInfo {
  name: string
  displayName: string
  ordinal: number
  isNew?: boolean
  fwName: string | null
}

let _clientIdSeq = 0
function nextClientId() {
  return `cid-${++_clientIdSeq}`
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

// ── Add action form ───────────────────────────────────────────────────────────

function AddActionForm({
  allActions,
  steps,
  workflowState,
  onAdd,
  onCancel,
}: {
  allActions: WorkflowAction[]
  steps: WorkflowStep[]
  workflowState: string
  onAdd: (
    params:
      | { mode: "existing"; action: WorkflowAction }
      | {
          mode: "new"
          name: string
          description: string
          nextStep: string
          propertyName: string
          deadlinePropertyName: string
          deadlineOffsetDays: string
        }
  ) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [selectedId, setSelectedId] = useState("")
  const [newName, setNewName] = useState(`${workflowState.toUpperCase()}_ACTION_`)
  const [newDesc, setNewDesc] = useState("")
  const [nextStep, setNextStep] = useState("")
  const [propertyName, setPropertyName] = useState("")
  const [hasDeadline, setHasDeadline] = useState(false)
  const [deadlinePropertyName, setDeadlinePropertyName] = useState("")
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState("")

  function handleAdd() {
    if (mode === "existing") {
      const action = allActions.find((a) => a.id === selectedId)
      if (!action) return
      onAdd({ mode: "existing", action })
    } else {
      if (!newName.trim()) return
      onAdd({
        mode: "new",
        name: newName.trim(),
        description: newDesc.trim(),
        nextStep,
        propertyName: propertyName.trim(),
        deadlinePropertyName: deadlinePropertyName.trim(),
        deadlineOffsetDays: deadlineOffsetDays.trim(),
      })
    }
  }

  return (
    <div className="mt-2 rounded-md border border-dashed bg-muted/20 p-3 space-y-2.5">
      <div className="flex gap-1.5 text-xs">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "existing" ? "Select existing" : "Create new"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs h-7 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
        >
          <option value="">Select an action…</option>
          {allActions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.description ? ` — ${a.description.slice(0, 60)}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-1.5">
          <Input
            placeholder="Action name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-xs h-7"
          />
          <Input
            placeholder="Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="text-xs h-7"
          />
          <select
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs h-7 outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
          >
            <option value="">Next step (optional)</option>
            {steps.map((s) => (
              <option key={s.id} value={s.name}>
                {s.display_name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Property name — what property gets set in state_specific_data JSON"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            className="text-xs h-7 font-mono"
          />
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasDeadline}
              onChange={(e) => setHasDeadline(e.target.checked)}
              className="rounded"
            />
            Deadline
          </label>
          {hasDeadline && (
            <div className="pl-4 space-y-1.5 border-l-2 border-muted">
              <Input
                placeholder="Deadline property name — what property name is for deadline date"
                value={deadlinePropertyName}
                onChange={(e) => setDeadlinePropertyName(e.target.value)}
                className="text-xs h-7 font-mono"
              />
              <Input
                placeholder="Deadline offset days — how many days to move out the deadline"
                value={deadlineOffsetDays}
                onChange={(e) => setDeadlineOffsetDays(e.target.value)}
                className="text-xs h-7"
                type="number"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-6 text-xs"
          onClick={handleAdd}
          disabled={mode === "existing" ? !selectedId : !newName.trim()}
        >
          Add
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Add option form ───────────────────────────────────────────────────────────

function AddOptionForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, displayName: string) => void
  onCancel: () => void
}) {
  const [displayName, setDisplayName] = useState("")
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)

  function handleDisplayNameChange(val: string) {
    setDisplayName(val)
    if (!nameTouched) setName(slugify(val))
  }

  return (
    <div className="rounded-md border border-dashed p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">New option</p>
      <Input
        placeholder="Display name *"
        value={displayName}
        onChange={(e) => handleDisplayNameChange(e.target.value)}
        className="text-xs h-7"
        autoFocus
      />
      <Input
        placeholder="Internal name *"
        value={name}
        onChange={(e) => {
          setNameTouched(true)
          setName(e.target.value)
        }}
        className="text-xs h-7 font-mono"
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-6 text-xs"
          onClick={() => onAdd(name.trim(), displayName.trim())}
          disabled={!name.trim() || !displayName.trim()}
        >
          Add
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Add step form ─────────────────────────────────────────────────────────────

function AddStepForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, displayName: string) => void
  onCancel: () => void
}) {
  const [displayName, setDisplayName] = useState("")
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)

  function handleDisplayNameChange(val: string) {
    setDisplayName(val)
    if (!nameTouched) setName(slugify(val))
  }

  return (
    <Card className="border-dashed border-primary/40">
      <CardContent className="px-4 py-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">New step</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Display name *"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            className="text-sm h-8"
            autoFocus
          />
          <Input
            placeholder="Internal name *"
            value={name}
            onChange={(e) => {
              setNameTouched(true)
              setName(e.target.value)
            }}
            className="text-sm h-8 font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onAdd(name.trim(), displayName.trim())}
            disabled={!name.trim() || !displayName.trim()}
          >
            Add step
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Action card ───────────────────────────────────────────────────────────────

function ActionLine({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div>
      <span className="opacity-70">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ActionCard({ action, onRemove }: { action: ActionDisplay; onRemove?: () => void }) {
  const d = action.data
  const isDeadline = d.action_type === "DEADLINE"

  return (
    <div
      className={cn(
        "group rounded-md border px-3 py-2 text-xs",
        isDeadline
          ? "border-yellow-200 bg-yellow-50 text-yellow-900"
          : "border-green-200 bg-green-50 text-green-900"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">
          {isDeadline ? "Deadline Action" : "Action"}: {d.name}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className={cn(
              "opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-all shrink-0",
              isDeadline ? "text-yellow-700/60" : "text-green-700/60"
            )}
            title="Remove action"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>

      {isDeadline ? (
        <div className="mt-1.5 space-y-1.5">
          <div className="space-y-0.5">
            <ActionLine label="description" value={d.description} />
            <ActionLine label="property checked" value={d.property_to_check} />
            {d.required_workflow_step && (
              <div className="opacity-90">{d.required_workflow_step}</div>
            )}
          </div>
          <div className="space-y-0.5">
            <ActionLine label="property set" value={d.property_name} />
            <ActionLine label="matter column name set" value={d.matter_column_name} />
          </div>
          <ActionLine label="move to step" value={d.next_workflow_step_name} />
        </div>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          {d.description && <div className="opacity-90">{d.description}</div>}
          <ActionLine label="property set" value={d.property_name} />
          {d.deadline_property_name && (
            <ActionLine
              label="deadline"
              value={`${d.deadline_property_name} in ${d.deadline_offset_days}`}
            />
          )}
          <ActionLine label="move to step" value={d.next_workflow_step_name} />
        </div>
      )}
    </div>
  )
}

// ── Option edit row ───────────────────────────────────────────────────────────

function OptionEditRow({
  option,
  allActions,
  steps,
  workflowState,
  onRemove,
  onRemoveAction,
  onAddAction,
}: {
  option: OptionDisplay
  allActions: WorkflowAction[]
  steps: WorkflowStep[]
  workflowState: string
  onRemove: () => void
  onRemoveAction: (actionId: string | null, actionClientId: string | null) => void
  onAddAction: (
    params:
      | { mode: "existing"; action: WorkflowAction }
      | {
          mode: "new"
          name: string
          description: string
          nextStep: string
          propertyName: string
          deadlinePropertyName: string
          deadlineOffsetDays: string
        }
  ) => void
}) {
  const [showAddAction, setShowAddAction] = useState(false)

  return (
    <div className="rounded-md border bg-background px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium text-white shadow-sm"
            style={{ backgroundColor: "#eb4395" }}
          >
            {option.displayName}
          </span>
          <span className="ml-2 text-xs text-muted-foreground font-mono">{option.name}</span>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
          title="Remove option"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {option.actions.length > 0 && (
        <div className="space-y-1.5">
          {option.actions.map((a, i) => (
            <ActionCard
              key={a.id ?? a.clientId ?? i}
              action={a}
              onRemove={() => onRemoveAction(a.id, a.clientId)}
            />
          ))}
        </div>
      )}

      {showAddAction ? (
        <AddActionForm
          allActions={allActions}
          steps={steps}
          workflowState={workflowState}
          onAdd={(params) => {
            onAddAction(params)
            setShowAddAction(false)
          }}
          onCancel={() => setShowAddAction(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddAction(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <PlusIcon className="size-3" />
          Add action
        </button>
      )}
    </div>
  )
}

// ── "main path" lozenge ───────────────────────────────────────────────────────

function MainBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-700/10">
      main
    </span>
  )
}

// ── Step edit card ────────────────────────────────────────────────────────────

function StepEditCard({
  dragKey,
  step,
  rank,
  rollup,
  visibleOptions,
  allActions,
  allSteps,
  workflowState,
  onRemoveOption,
  onAddOption,
  onRemoveAction,
  onAddAction,
  onRemoveStep,
  onToggleMainPath,
}: {
  dragKey: string
  step: StepCardInfo
  rank: number
  rollup?: boolean
  visibleOptions: OptionDisplay[]
  allActions: WorkflowAction[]
  allSteps: WorkflowStep[]
  workflowState: string
  onRemoveOption: (optionId: string | null, optionClientId: string | null) => void
  onAddOption: (name: string, displayName: string) => void
  onRemoveAction: (
    optionId: string | null,
    optionClientId: string | null,
    actionId: string | null,
    actionClientId: string | null
  ) => void
  onAddAction: (
    optionId: string | null,
    optionClientId: string | null,
    params:
      | { mode: "existing"; action: WorkflowAction }
      | {
          mode: "new"
          name: string
          description: string
          nextStep: string
          propertyName: string
          deadlinePropertyName: string
          deadlineOffsetDays: string
        }
  ) => void
  onRemoveStep?: () => void
  onToggleMainPath: (checked: boolean) => void
}) {
  const [showAddOption, setShowAddOption] = useState(false)
  // Deadline actions that are unlocked by (require) this step, listed after the
  // step's own default actions.
  const stepDeadlineActions = allActions.filter(
    (a) => a.action_type === "DEADLINE" && a.required_workflow_step === step.name
  )
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dragKey })
  const style = {
    // Translate only — CSS.Transform would bake in scaleX/scaleY from the
    // hovered item's size, distorting cards that differ in height.
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
    <Card
      className={cn(
        "transition-shadow",
        step.isNew && "border-primary/30",
        isDragging && "opacity-60 shadow-lg ring-2 ring-primary"
      )}
    >
      <CardHeader className={cn("px-4", rollup ? "py-2" : "pb-2 pt-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="shrink-0 -ml-1 mt-0.5 flex items-center text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
              title="Drag to reorder"
            >
              <GripVerticalIcon className="size-4" />
            </button>
            <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-0.5">
              {rank}
            </span>
            {rollup ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-sm font-semibold leading-tight">{step.displayName}</p>
                <p className="text-xs text-muted-foreground font-mono">{step.name}</p>
                {step.isNew && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">New</Badge>
                )}
                {step.fwName === "main" && <MainBadge />}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[#eb4395] cursor-pointer"
                    checked={step.fwName === "main"}
                    onChange={(e) => onToggleMainPath(e.target.checked)}
                  />
                  main path
                </label>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold leading-tight">{step.displayName}</p>
                  {step.isNew && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">New</Badge>
                  )}
                  {step.fwName === "main" && <MainBadge />}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{step.name}</p>
                <p className="text-xs text-muted-foreground">ordinal: {step.ordinal}</p>
              </div>
            )}
          </div>
          {onRemoveStep && (
            <button
              onClick={onRemoveStep}
              className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors shrink-0"
              title="Remove step"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      {!rollup && (
      <CardContent className="px-4 pb-4 space-y-2">
        {visibleOptions.map((opt) => (
          <OptionEditRow
            key={opt.id ?? opt.clientId}
            option={opt}
            allActions={allActions}
            steps={allSteps}
            workflowState={workflowState}
            onRemove={() => onRemoveOption(opt.id, opt.clientId)}
            onRemoveAction={(actionId, actionClientId) =>
              onRemoveAction(opt.id, opt.clientId, actionId, actionClientId)
            }
            onAddAction={(params) => onAddAction(opt.id, opt.clientId, params)}
          />
        ))}

        {showAddOption ? (
          <AddOptionForm
            onAdd={(name, displayName) => {
              onAddOption(name, displayName)
              setShowAddOption(false)
            }}
            onCancel={() => setShowAddOption(false)}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs w-full"
            onClick={() => setShowAddOption(true)}
          >
            <PlusIcon className="size-3 mr-1" />
            Add option
          </Button>
        )}

        {stepDeadlineActions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">
              Deadline actions requiring this step
            </p>
            {stepDeadlineActions.map((a) => (
              <ActionCard
                key={a.id}
                action={{ id: a.id, clientId: null, data: actionDataFromAction(a) }}
              />
            ))}
          </div>
        )}
      </CardContent>
      )}
    </Card>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function WorkflowEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  const [allActions, setAllActions] = useState<WorkflowAction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>(emptyEditState)
  const [showAddStep, setShowAddStep] = useState(false)
  const [rollup, setRollup] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/v1/workflow/${id}`).then((r) => {
        if (!r.ok) throw new Error("not found")
        return r.json()
      }),
      fetch(`/api/v1/workflow/${id}/actions`).then((r) => r.json()),
    ])
      .then(([wf, actions]) => {
        setWorkflow(wf)
        setAllActions(actions)
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load workflow")
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (error || !workflow) return <div className="p-8 text-destructive">{error ?? "Not found"}</div>

  const sortedSteps = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal)
  const allStepOrdinals = [...sortedSteps.map((s) => s.ordinal), ...editState.newSteps.map((s) => s.ordinal)]
  const maxOrdinal = Math.max(0, ...allStepOrdinals)

  // ── Step ordering ──────────────────────────────────────────────────────────
  // A "step key" is the existing step's id, or a new step's clientId.
  // baseKeys is the default order (existing by ordinal, then new in creation order).
  // orderedKeys applies any local reordering, appending keys not yet in stepOrder.
  function orderKeys(state: EditState): string[] {
    const base = [
      ...sortedSteps.map((s) => s.id),
      ...state.newSteps.map((s) => s.clientId),
    ]
    if (state.stepOrder.length === 0) return base
    const known = new Set(state.stepOrder)
    return [
      ...state.stepOrder.filter((k) => base.includes(k)),
      ...base.filter((k) => !known.has(k)),
    ]
  }

  const baseKeys = [
    ...sortedSteps.map((s) => s.id),
    ...editState.newSteps.map((s) => s.clientId),
  ]
  const orderedKeys = orderKeys(editState)
  // Contiguous ordinals (1..N, no holes) derived purely from position.
  const ordinalByKey = new Map(orderedKeys.map((k, i) => [k, i + 1]))
  const stepsReordered = orderedKeys.some((k, i) => k !== baseKeys[i])

  const existingStepById = new Map(sortedSteps.map((s) => [s.id, s]))
  const newStepByClientId = new Map(editState.newSteps.map((s) => [s.clientId, s]))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setEditState((prev) => {
      const keys = orderKeys(prev)
      const from = keys.indexOf(String(active.id))
      const to = keys.indexOf(String(over.id))
      if (from === -1 || to === -1) return prev
      return { ...prev, stepOrder: arrayMove(keys, from, to) }
    })
  }

  // Effective fw_name for a step key, applying any local override.
  function effectiveFwName(key: string, original: string | null): string | null {
    return key in editState.fwNameByKey ? editState.fwNameByKey[key] : original
  }

  const fwNamesChanged = sortedSteps.some(
    (s) => effectiveFwName(s.id, s.fw_name) !== s.fw_name
  )

  const hasChanges =
    editState.removedOptionIds.size > 0 ||
    editState.removedActionLinks.length > 0 ||
    editState.newSteps.length > 0 ||
    editState.newOptions.length > 0 ||
    editState.newActionDefs.length > 0 ||
    editState.newActionLinks.length > 0 ||
    stepsReordered ||
    fwNamesChanged

  // ── Visible option builders ────────────────────────────────────────────────

  // Action data for an action referenced by a link — either an existing action
  // (looked up in allActions) or a locally-added new action def.
  function dataForLink(l: NewActionLink): ActionData {
    if (l.actionId) {
      const a = allActions.find((x) => x.id === l.actionId)
      if (a) return actionDataFromAction(a)
    }
    const def = l.actionClientId
      ? editState.newActionDefs.find((d) => d.clientId === l.actionClientId)
      : undefined
    return {
      name: def?.name ?? l.displayName,
      description: def?.description || null,
      property_name: def?.propertyName || null,
      deadline_property_name: def?.deadlinePropertyName || null,
      deadline_offset_days: def?.deadlineOffsetDays ? parseInt(def.deadlineOffsetDays, 10) : null,
      next_workflow_step_name: def?.nextWorkflowStepName || null,
      action_type: null,
      matter_column_name: null,
      property_to_check: null,
      required_workflow_step: null,
    }
  }

  function getVisibleOptionsForStep(step: WorkflowStep): OptionDisplay[] {
    const existing = step.options
      .filter((o) => !editState.removedOptionIds.has(o.id))
      .map((o) => ({
        id: o.id,
        clientId: null as string | null,
        name: o.name,
        displayName: o.display_name,
        actions: [
          ...o.actions
            .filter(
              (a) =>
                !editState.removedActionLinks.some(
                  (r) => r.optionId === o.id && r.actionId === a.id
                )
            )
            .map((a) => ({
              id: a.id,
              clientId: null as string | null,
              data: actionDataFromAction(a),
            })),
          ...editState.newActionLinks
            .filter((l) => l.optionId === o.id)
            .map((l) => ({
              id: l.actionId,
              clientId: l.actionClientId,
              data: dataForLink(l),
            })),
        ],
      }))

    const added = editState.newOptions
      .filter((o) => o.stepId === step.id)
      .map((o) => ({
        id: null as string | null,
        clientId: o.clientId,
        name: o.name,
        displayName: o.displayName,
        actions: editState.newActionLinks
          .filter((l) => l.optionClientId === o.clientId)
          .map((l) => ({
            id: l.actionId,
            clientId: l.actionClientId,
            data: dataForLink(l),
          })),
      }))

    return [...existing, ...added]
  }

  function getVisibleOptionsForNewStep(step: NewStep): OptionDisplay[] {
    return editState.newOptions
      .filter((o) => o.stepClientId === step.clientId)
      .map((o) => ({
        id: null as string | null,
        clientId: o.clientId,
        name: o.name,
        displayName: o.displayName,
        actions: editState.newActionLinks
          .filter((l) => l.optionClientId === o.clientId)
          .map((l) => ({
            id: l.actionId,
            clientId: l.actionClientId,
            data: dataForLink(l),
          })),
      }))
  }

  // ── Mutation helpers ───────────────────────────────────────────────────────

  function addStep(name: string, displayName: string) {
    const newCount = editState.newSteps.length
    setEditState((prev) => ({
      ...prev,
      newSteps: [
        ...prev.newSteps,
        { clientId: nextClientId(), name, displayName, ordinal: maxOrdinal + newCount + 1 },
      ],
    }))
  }

  function removeNewStep(clientId: string) {
    setEditState((prev) => {
      const stepOptionClientIds = new Set(
        prev.newOptions.filter((o) => o.stepClientId === clientId).map((o) => o.clientId)
      )
      return {
        ...prev,
        newSteps: prev.newSteps.filter((s) => s.clientId !== clientId),
        newOptions: prev.newOptions.filter((o) => o.stepClientId !== clientId),
        newActionLinks: prev.newActionLinks.filter(
          (l) => !stepOptionClientIds.has(l.optionClientId ?? "")
        ),
      }
    })
  }

  function removeOption(optionId: string | null, optionClientId: string | null) {
    if (optionId) {
      setEditState((prev) => ({
        ...prev,
        removedOptionIds: new Set([...prev.removedOptionIds, optionId]),
        newActionLinks: prev.newActionLinks.filter((l) => l.optionId !== optionId),
      }))
    } else if (optionClientId) {
      setEditState((prev) => ({
        ...prev,
        newOptions: prev.newOptions.filter((o) => o.clientId !== optionClientId),
        newActionLinks: prev.newActionLinks.filter((l) => l.optionClientId !== optionClientId),
      }))
    }
  }

  function addOption(
    stepId: string | null,
    stepClientId: string | null,
    stepName: string,
    name: string,
    displayName: string
  ) {
    const stepOptions = stepId ? workflow!.steps.find((s) => s.id === stepId)?.options ?? [] : []
    const maxOpt = Math.max(0, ...stepOptions.map((o) => o.ordinal))
    const newCount = editState.newOptions.filter((o) =>
      stepClientId ? o.stepClientId === stepClientId : o.stepId === stepId
    ).length
    setEditState((prev) => ({
      ...prev,
      newOptions: [
        ...prev.newOptions,
        {
          clientId: nextClientId(),
          stepId,
          stepClientId,
          stepName,
          name,
          displayName,
          ordinal: maxOpt + newCount + 1,
        },
      ],
    }))
  }

  function removeAction(
    optionId: string | null,
    optionClientId: string | null,
    actionId: string | null,
    actionClientId: string | null
  ) {
    if (optionId && actionId && !actionClientId) {
      setEditState((prev) => ({
        ...prev,
        removedActionLinks: [...prev.removedActionLinks, { optionId, actionId }],
      }))
    } else {
      setEditState((prev) => ({
        ...prev,
        newActionLinks: prev.newActionLinks.filter((l) => {
          const optMatch = optionId ? l.optionId === optionId : l.optionClientId === optionClientId
          const actMatch = actionId ? l.actionId === actionId : l.actionClientId === actionClientId
          return !(optMatch && actMatch)
        }),
      }))
    }
  }

  function addAction(
    optionId: string | null,
    optionClientId: string | null,
    params:
      | { mode: "existing"; action: WorkflowAction }
      | {
          mode: "new"
          name: string
          description: string
          nextStep: string
          propertyName: string
          deadlinePropertyName: string
          deadlineOffsetDays: string
        }
  ) {
    if (params.mode === "existing") {
      setEditState((prev) => ({
        ...prev,
        newActionLinks: [
          ...prev.newActionLinks,
          {
            optionId,
            optionClientId,
            actionId: params.action.id,
            actionClientId: null,
            displayName: params.action.description ?? params.action.name,
          },
        ],
      }))
    } else {
      const cid = nextClientId()
      setEditState((prev) => ({
        ...prev,
        newActionDefs: [
          ...prev.newActionDefs,
          {
            clientId: cid,
            name: params.name,
            description: params.description,
            nextWorkflowStepName: params.nextStep,
            propertyName: params.propertyName,
            deadlinePropertyName: params.deadlinePropertyName,
            deadlineOffsetDays: params.deadlineOffsetDays,
          },
        ],
        newActionLinks: [
          ...prev.newActionLinks,
          {
            optionId,
            optionClientId,
            actionId: null,
            actionClientId: cid,
            displayName: params.description || params.name,
          },
        ],
      }))
    }
  }

  function setMainPath(key: string, checked: boolean) {
    setEditState((prev) => ({
      ...prev,
      fwNameByKey: { ...prev.fwNameByKey, [key]: checked ? "main" : null },
    }))
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)

    const payload = {
      remove_options: [...editState.removedOptionIds],
      remove_action_links: editState.removedActionLinks.map((r) => ({
        option_id: r.optionId,
        action_id: r.actionId,
      })),
      new_steps: editState.newSteps.map((s) => ({
        name: s.name,
        display_name: s.displayName,
        ordinal: ordinalByKey.get(s.clientId) ?? s.ordinal,
        fw_name: editState.fwNameByKey[s.clientId] ?? null,
      })),
      reorder_steps: sortedSteps
        .filter((s) => (ordinalByKey.get(s.id) ?? s.ordinal) !== s.ordinal)
        .map((s) => ({ id: s.id, ordinal: ordinalByKey.get(s.id) })),
      set_step_fw_name: sortedSteps
        .filter((s) => effectiveFwName(s.id, s.fw_name) !== s.fw_name)
        .map((s) => ({ id: s.id, fw_name: effectiveFwName(s.id, s.fw_name) })),
      new_options: editState.newOptions.map((o) => ({
        client_id: o.clientId,
        step_name: o.stepName,
        name: o.name,
        display_name: o.displayName,
        ordinal: o.ordinal,
      })),
      new_actions: editState.newActionDefs.map((a) => ({
        client_id: a.clientId,
        name: a.name,
        description: a.description || null,
        next_workflow_step_name: a.nextWorkflowStepName || null,
        property_name: a.propertyName || null,
        deadline_property_name: a.deadlinePropertyName || null,
        deadline_offset_days: a.deadlineOffsetDays ? parseInt(a.deadlineOffsetDays, 10) : null,
      })),
      new_action_links: editState.newActionLinks.map((l) => ({
        option_id: l.optionId,
        option_client_id: l.optionClientId,
        action_id: l.actionId,
        action_client_id: l.actionClientId,
      })),
    }

    try {
      const res = await fetch(`/api/v1/workflow/${id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Save failed")
      navigate(`/workflow/${id}`)
    } catch {
      setSaving(false)
      alert("Save failed. Please try again.")
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2"
          onClick={() => navigate(`/workflow/${id}`)}
        >
          ← Back
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{workflow.display_name}</h1>
              <Badge variant="secondary" className="uppercase text-xs">
                {workflow.us_state}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {workflow.type}
              </Badge>
            </div>
            {workflow.description && (
              <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasChanges && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
            <Button
              variant={rollup ? "default" : "outline"}
              size="sm"
              onClick={() => setRollup((v) => !v)}
              title="Toggle rollup mode — show only step names for easier reordering"
            >
              <ListCollapseIcon className="size-4 mr-1" />
              Rollup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditState(emptyEditState())}
              disabled={!hasChanges || saving}
            >
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Steps (existing + new), in display order — drag the grip to reorder */}
      <div className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedKeys} strategy={verticalListSortingStrategy}>
            <div className={rollup ? "space-y-1.5" : "space-y-4"}>
              {orderedKeys.map((key) => {
                const rank = ordinalByKey.get(key)!

                const existing = existingStepById.get(key)
                if (existing) {
                  return (
                    <StepEditCard
                      key={key}
                      dragKey={key}
                      rollup={rollup}
                      step={{ name: existing.name, displayName: existing.display_name, ordinal: rank, fwName: effectiveFwName(existing.id, existing.fw_name) }}
                      rank={rank}
                      visibleOptions={getVisibleOptionsForStep(existing)}
                      allActions={allActions}
                      allSteps={sortedSteps}
                      workflowState={workflow.us_state ?? ""}
                      onRemoveOption={removeOption}
                      onAddOption={(name, displayName) =>
                        addOption(existing.id, null, existing.name, name, displayName)
                      }
                      onRemoveAction={removeAction}
                      onAddAction={addAction}
                      onToggleMainPath={(checked) => setMainPath(existing.id, checked)}
                    />
                  )
                }

                const step = newStepByClientId.get(key)!
                return (
                  <StepEditCard
                    key={key}
                    dragKey={key}
                    rollup={rollup}
                    step={{ name: step.name, displayName: step.displayName, ordinal: rank, isNew: true, fwName: effectiveFwName(step.clientId, null) }}
                    rank={rank}
                    visibleOptions={getVisibleOptionsForNewStep(step)}
                    allActions={allActions}
                    allSteps={sortedSteps}
                    workflowState={workflow.us_state ?? ""}
                    onRemoveOption={removeOption}
                    onAddOption={(name, displayName) =>
                      addOption(null, step.clientId, step.name, name, displayName)
                    }
                    onRemoveAction={removeAction}
                    onAddAction={addAction}
                    onRemoveStep={() => removeNewStep(step.clientId)}
                    onToggleMainPath={(checked) => setMainPath(step.clientId, checked)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add step */}
        {showAddStep ? (
          <AddStepForm
            onAdd={(name, displayName) => {
              addStep(name, displayName)
              setShowAddStep(false)
            }}
            onCancel={() => setShowAddStep(false)}
          />
        ) : (
          <Button
            variant="outline"
            className="w-full border-dashed text-muted-foreground"
            onClick={() => setShowAddStep(true)}
          >
            <PlusIcon className="size-4 mr-2" />
            Add step
          </Button>
        )}
      </div>
    </div>
  )
}
