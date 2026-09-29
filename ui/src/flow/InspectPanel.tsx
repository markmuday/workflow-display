import { useState } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StepHint, WorkflowHints } from "@/types/hints"
import type { WorkflowAction, WorkflowOption } from "@/types/workflow"
import { MAIN, sortedOptions, type FlowLayout, type LayoutNode } from "./spineLayout"
import type { Selection } from "./SpineCanvas"

interface Props {
  layout: FlowLayout
  selection: NonNullable<Selection>
  hints: WorkflowHints
  editing: boolean
  onSelect: (s: Selection) => void
  onPatchStep: (stepName: string, patch: Partial<StepHint>) => void
  onToggleGroup: (group: string, collapsed: boolean) => void
}

export function InspectPanel({ layout, selection, hints, editing, onSelect, onPatchStep, onToggleGroup }: Props) {
  const node = [...layout.nodes, ...layout.tray].find((n) => n.id === selection.nodeId)
  if (!node) return null
  const option =
    selection.type === "option" && node.step
      ? node.step.options.find((o) => o.id === selection.optionId)
      : undefined

  const selectStepByName = (name: string) => {
    const nodeId = layout.nodeOfStep[name]
    if (nodeId) onSelect({ type: "step", nodeId })
  }

  return (
    <aside className="fixed right-0 top-14 bottom-0 z-30 w-80 border-l bg-card shadow-lg overflow-y-auto">
      <div className="flex items-start justify-between gap-2 p-4 border-b">
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight truncate">{option ? option.display_name : node.label}</h2>
          <p className="font-mono text-[11px] text-muted-foreground truncate">{option ? option.name : node.id}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => onSelect(null)} aria-label="Close">
          <X />
        </Button>
      </div>
      {option ? (
        <OptionDetails option={option} node={node} onSelectStep={selectStepByName} onBack={() => onSelect({ type: "step", nodeId: node.id })} />
      ) : (
        <StepDetails
          node={node}
          layout={layout}
          hints={hints}
          editing={editing}
          onSelectStep={selectStepByName}
          onSelectOption={(o) => onSelect({ type: "option", optionId: o.id, nodeId: node.id })}
          onPatchStep={onPatchStep}
          onToggleGroup={onToggleGroup}
        />
      )}
    </aside>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-xs py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-4 border-b">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </section>
  )
}

function StepLink({ name, onClick }: { name: string; onClick: (name: string) => void }) {
  return (
    <button type="button" className="font-mono text-[11px] text-sky-600 hover:underline text-left break-all" onClick={() => onClick(name)}>
      {name}
    </button>
  )
}

function OptionDetails({
  option,
  node,
  onSelectStep,
  onBack,
}: {
  option: WorkflowOption
  node: LayoutNode
  onSelectStep: (name: string) => void
  onBack: () => void
}) {
  return (
    <>
      <Section title="Option">
        <Row label="On step">
          <StepLink name={node.id} onClick={onBack} />
        </Row>
        {option.description && <Row label="Description">{option.description}</Row>}
        <p className="text-[11px] text-muted-foreground mt-2">Everything reachable from this option is highlighted.</p>
      </Section>
      {option.actions.length === 0 && (
        <Section title="Actions">
          <p className="text-xs text-muted-foreground">No actions — this option doesn't transition anywhere.</p>
        </Section>
      )}
      {option.actions.map((a) => (
        <ActionDetails key={a.id} action={a} onSelectStep={onSelectStep} />
      ))}
    </>
  )
}

function ActionDetails({ action, onSelectStep }: { action: WorkflowAction; onSelectStep: (name: string) => void }) {
  return (
    <Section title="Action">
      <Row label="Name">
        <span className="font-mono text-[11px]">{action.name}</span>
      </Row>
      {action.description && <Row label="Description">{action.description}</Row>}
      {action.next_workflow_step_name && (
        <Row label="Next step">
          <StepLink name={action.next_workflow_step_name} onClick={onSelectStep} />
        </Row>
      )}
      {action.property_name && (
        <Row label="Sets property">
          {action.property_display_name ?? action.property_name}
          <span className="block font-mono text-[10.5px] text-muted-foreground">{action.property_name}</span>
        </Row>
      )}
      {action.deadline_property_name && (
        <Row label="Deadline">
          {action.deadline_property_display_name ?? action.deadline_property_name}
          {action.deadline_offset_days != null && ` (+${action.deadline_offset_days} days)`}
        </Row>
      )}
      {action.matter_column_name && <Row label="Matter column">{action.matter_column_name}</Row>}
    </Section>
  )
}

function StepDetails({
  node,
  layout,
  hints,
  editing,
  onSelectStep,
  onSelectOption,
  onPatchStep,
  onToggleGroup,
}: {
  node: LayoutNode
  layout: FlowLayout
  hints: WorkflowHints
  editing: boolean
  onSelectStep: (name: string) => void
  onSelectOption: (o: WorkflowOption) => void
  onPatchStep: (stepName: string, patch: Partial<StepHint>) => void
  onToggleGroup: (group: string, collapsed: boolean) => void
}) {
  const incoming = layout.edges.filter((e) => e.dst === node.id)
  const hintKey = node.members[0].name
  const hint = hints.steps[hintKey] ?? {}
  const inTray = node.row < 0
  return (
    <>
      <Section title="Placement">
        <Row label="Spine">
          {node.spine ? (
            <Badge variant={node.spine === MAIN ? "default" : "secondary"}>
              {node.spine}
              {node.autoSpine && " (auto)"}
            </Badge>
          ) : inTray ? (
            "Exits & unconnected tray"
          ) : (
            "Branch lane"
          )}
        </Row>
        {!inTray && (
          <Row label="Cell">
            col {node.col}, row {node.row}
            {node.pinned && " · pinned"}
          </Row>
        )}
        {node.step && <Row label="Ordinal">{node.step.ordinal}</Row>}
      </Section>

      {node.kind === "group" && (
        <Section title="Collapsed group">
          <ul className="flex flex-col gap-1 mb-3">
            {node.members.map((m) => (
              <li key={m.id}>
                <span className="font-mono text-[11px]">{m.name}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={() => onToggleGroup(node.id.slice("group:".length), false)}>
            Expand group
          </Button>
        </Section>
      )}

      {node.step && (
        <Section title={`Options (${node.step.options.length})`}>
          <div className="flex flex-col gap-1.5">
            {sortedOptions(node.step).map((o) => (
              <button
                key={o.id}
                type="button"
                className="rounded-md bg-primary text-primary-foreground text-xs px-2.5 py-1.5 text-left hover:bg-primary/85"
                onClick={() => onSelectOption(o)}
              >
                {o.display_name}
                {o.actions[0]?.next_workflow_step_name && (
                  <span className="block font-mono text-[10px] opacity-80">→ {o.actions[0].next_workflow_step_name}</span>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Incoming (${incoming.length})`}>
        {incoming.length === 0 && <p className="text-xs text-muted-foreground">Nothing transitions here.</p>}
        <ul className="flex flex-col gap-1">
          {incoming.map((e) => (
            <li key={e.id} className="text-xs">
              <StepLink name={e.fromStep} onClick={onSelectStep} />
              {e.back && <span className="ml-1 text-[10px] text-muted-foreground">(loop back)</span>}
            </li>
          ))}
        </ul>
      </Section>

      {editing && (
        <HintEditor
          key={hintKey}
          hint={hint}
          spineNames={[...new Set([MAIN, ...layout.spines.map((s) => s.name), ...Object.keys(hints.spines ?? {})])]}
          groupNames={Object.keys(hints.groups ?? {})}
          onPatch={(patch) => onPatchStep(hintKey, patch)}
          onToggleGroup={onToggleGroup}
          collapsed={!!(hint.group && hints.groups?.[hint.group]?.collapsed)}
        />
      )}
    </>
  )
}

function HintEditor({
  hint,
  spineNames,
  groupNames,
  collapsed,
  onPatch,
  onToggleGroup,
}: {
  hint: StepHint
  spineNames: string[]
  groupNames: string[]
  collapsed: boolean
  onPatch: (patch: Partial<StepHint>) => void
  onToggleGroup: (group: string, collapsed: boolean) => void
}) {
  const [spine, setSpine] = useState(hint.spine ?? "")
  const [label, setLabel] = useState(hint.label ?? "")
  const [group, setGroup] = useState(hint.group ?? "")

  const commit = (field: "spine" | "label" | "group", value: string) =>
    onPatch({ [field]: value.trim() || undefined })

  const onEnter = (field: "spine" | "label" | "group", value: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit(field, value)
  }

  return (
    <Section title="Layout hints">
      <div className="flex flex-col gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Spine</span>
          <div className="flex gap-1.5">
            <Input
              list="spine-names"
              value={spine}
              placeholder="none (branch lane)"
              onChange={(e) => setSpine(e.target.value)}
              onBlur={() => commit("spine", spine)}
              onKeyDown={onEnter("spine", spine)}
            />
            <datalist id="spine-names">
              {spineNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="flex gap-1.5">
            <Button size="xs" variant={hint.spine === MAIN ? "default" : "outline"} onClick={() => { setSpine(MAIN); onPatch({ spine: MAIN }) }}>
              Mark as main
            </Button>
            <Button size="xs" variant="outline" disabled={!hint.spine} onClick={() => { setSpine(""); onPatch({ spine: undefined }) }}>
              Clear spine
            </Button>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Label override</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => commit("label", label)} onKeyDown={onEnter("label", label)} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Row nudge</span>
            <Input
              type="number"
              value={hint.rowNudge ?? 0}
              onChange={(e) => onPatch({ rowNudge: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Lane</span>
            <Input
              type="number"
              min={1}
              value={hint.lane ?? ""}
              placeholder="auto"
              onChange={(e) => onPatch({ lane: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Group</span>
          <Input
            list="group-names"
            value={group}
            placeholder="none"
            onChange={(e) => setGroup(e.target.value)}
            onBlur={() => commit("group", group)}
            onKeyDown={onEnter("group", group)}
          />
          <datalist id="group-names">
            {groupNames.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          {hint.group && (
            <Button size="xs" variant="outline" className="self-start" onClick={() => onToggleGroup(hint.group!, !collapsed)}>
              {collapsed ? "Expand" : "Collapse"} “{hint.group}”
            </Button>
          )}
        </label>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {hint.pin ? `Pinned at col ${hint.pin.col}, row ${hint.pin.row}` : "Drag the card to pin it"}
          </span>
          {hint.pin && (
            <Button size="xs" variant="outline" onClick={() => onPatch({ pin: undefined })}>
              Unpin
            </Button>
          )}
        </div>
      </div>
    </Section>
  )
}
