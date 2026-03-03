import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PlusIcon, XIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
}

function emptyEditState(): EditState {
  return {
    removedOptionIds: new Set(),
    removedActionLinks: [],
    newSteps: [],
    newOptions: [],
    newActionDefs: [],
    newActionLinks: [],
  }
}

interface OptionDisplay {
  id: string | null
  clientId: string | null
  name: string
  displayName: string
  actions: { id: string | null; clientId: string | null; displayName: string }[]
}

// Minimal step info needed by StepEditCard — works for both existing and new steps
interface StepCardInfo {
  name: string
  displayName: string
  ordinal: number
  isNew?: boolean
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
  onAdd,
  onCancel,
}: {
  allActions: WorkflowAction[]
  steps: WorkflowStep[]
  onAdd: (
    params:
      | { mode: "existing"; action: WorkflowAction }
      | { mode: "new"; name: string; description: string; nextStep: string }
  ) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [selectedId, setSelectedId] = useState("")
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [nextStep, setNextStep] = useState("")

  function handleAdd() {
    if (mode === "existing") {
      const action = allActions.find((a) => a.id === selectedId)
      if (!action) return
      onAdd({ mode: "existing", action })
    } else {
      if (!newName.trim()) return
      onAdd({ mode: "new", name: newName.trim(), description: newDesc.trim(), nextStep })
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

// ── Option edit row ───────────────────────────────────────────────────────────

function OptionEditRow({
  option,
  allActions,
  steps,
  onRemove,
  onRemoveAction,
  onAddAction,
}: {
  option: OptionDisplay
  allActions: WorkflowAction[]
  steps: WorkflowStep[]
  onRemove: () => void
  onRemoveAction: (actionId: string | null, actionClientId: string | null) => void
  onAddAction: (
    params:
      | { mode: "existing"; action: WorkflowAction }
      | { mode: "new"; name: string; description: string; nextStep: string }
  ) => void
}) {
  const [showAddAction, setShowAddAction] = useState(false)

  return (
    <div className="rounded-md border bg-background px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium">{option.displayName}</span>
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
        <div className="pl-1 space-y-0.5">
          {option.actions.map((a, i) => (
            <div key={a.id ?? a.clientId ?? i} className="flex items-center gap-1.5 text-xs group">
              <span className="text-muted-foreground shrink-0">•</span>
              <span className="flex-1 truncate">{a.displayName}</span>
              <button
                onClick={() => onRemoveAction(a.id, a.clientId)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 rounded transition-all"
                title="Remove action"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddAction ? (
        <AddActionForm
          allActions={allActions}
          steps={steps}
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

// ── Step edit card ────────────────────────────────────────────────────────────

function StepEditCard({
  step,
  rank,
  visibleOptions,
  allActions,
  allSteps,
  onRemoveOption,
  onAddOption,
  onRemoveAction,
  onAddAction,
  onRemoveStep,
}: {
  step: StepCardInfo
  rank: number
  visibleOptions: OptionDisplay[]
  allActions: WorkflowAction[]
  allSteps: WorkflowStep[]
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
      | { mode: "new"; name: string; description: string; nextStep: string }
  ) => void
  onRemoveStep?: () => void
}) {
  const [showAddOption, setShowAddOption] = useState(false)

  return (
    <Card className={step.isNew ? "border-primary/30" : undefined}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-0.5">
              {rank}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{step.displayName}</p>
                {step.isNew && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">New</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{step.name}</p>
              <p className="text-xs text-muted-foreground">ordinal: {step.ordinal}</p>
            </div>
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

      <CardContent className="px-4 pb-4 space-y-2">
        {visibleOptions.map((opt) => (
          <OptionEditRow
            key={opt.id ?? opt.clientId}
            option={opt}
            allActions={allActions}
            steps={allSteps}
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
      </CardContent>
    </Card>
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

  const hasChanges =
    editState.removedOptionIds.size > 0 ||
    editState.removedActionLinks.length > 0 ||
    editState.newSteps.length > 0 ||
    editState.newOptions.length > 0 ||
    editState.newActionDefs.length > 0 ||
    editState.newActionLinks.length > 0

  // ── Visible option builders ────────────────────────────────────────────────

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
              displayName: a.description ?? a.name,
            })),
          ...editState.newActionLinks
            .filter((l) => l.optionId === o.id)
            .map((l) => ({ id: l.actionId, clientId: l.actionClientId, displayName: l.displayName })),
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
          .map((l) => ({ id: l.actionId, clientId: l.actionClientId, displayName: l.displayName })),
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
          .map((l) => ({ id: l.actionId, clientId: l.actionClientId, displayName: l.displayName })),
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
      | { mode: "new"; name: string; description: string; nextStep: string }
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
        ordinal: s.ordinal,
      })),
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

  const existingRanks = Object.fromEntries(sortedSteps.map((s, i) => [s.id, i + 1]))

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

      {/* Existing steps */}
      <div className="space-y-4">
        {sortedSteps.map((step) => (
          <StepEditCard
            key={step.id}
            step={{ name: step.name, displayName: step.display_name, ordinal: step.ordinal }}
            rank={existingRanks[step.id]}
            visibleOptions={getVisibleOptionsForStep(step)}
            allActions={allActions}
            allSteps={sortedSteps}
            onRemoveOption={removeOption}
            onAddOption={(name, displayName) =>
              addOption(step.id, null, step.name, name, displayName)
            }
            onRemoveAction={removeAction}
            onAddAction={addAction}
          />
        ))}

        {/* New steps */}
        {editState.newSteps.map((step, i) => (
          <StepEditCard
            key={step.clientId}
            step={{ name: step.name, displayName: step.displayName, ordinal: step.ordinal, isNew: true }}
            rank={sortedSteps.length + i + 1}
            visibleOptions={getVisibleOptionsForNewStep(step)}
            allActions={allActions}
            allSteps={sortedSteps}
            onRemoveOption={removeOption}
            onAddOption={(name, displayName) =>
              addOption(null, step.clientId, step.name, name, displayName)
            }
            onRemoveAction={removeAction}
            onAddAction={addAction}
            onRemoveStep={() => removeNewStep(step.clientId)}
          />
        ))}

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
