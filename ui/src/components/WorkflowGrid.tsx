import { useState, useEffect, useRef, type RefObject } from "react"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import type { WorkflowDetail, WorkflowStep } from "@/types/workflow"

// ── Constants ─────────────────────────────────────────────────────────────────

const NUM_COLS = 5
const GAP = 64
const EXTRA_ROWS = 4

// ── Layout state ──────────────────────────────────────────────────────────────

type Position = { row: number; col: number }
type LayoutState = Record<string, Position>
type NoteOffset = { x: number; y: number }

function initLayout(steps: WorkflowStep[]): LayoutState {
  const sorted = [...steps].sort((a, b) => a.ordinal - b.ordinal)
  return Object.fromEntries(sorted.map((s, i) => [s.id, { row: i, col: 0 }]))
}

function loadLayout(workflowId: string, steps: WorkflowStep[]): LayoutState {
  try {
    const saved = localStorage.getItem(`workflow-grid-${workflowId}`)
    if (saved) {
      const parsed = JSON.parse(saved) as LayoutState
      const savedIds = new Set(Object.keys(parsed))
      const stepIds = new Set(steps.map((s) => s.id))
      const valid =
        [...stepIds].every((id) => savedIds.has(id)) &&
        [...savedIds].every((id) => stepIds.has(id))
      if (valid) return parsed
    }
  } catch {
    // ignore
  }
  return initLayout(steps)
}

function saveLayout(workflowId: string, layout: LayoutState) {
  localStorage.setItem(`workflow-grid-${workflowId}`, JSON.stringify(layout))
}

// ── Muted steps persistence ───────────────────────────────────────────────────

function loadMutedSteps(workflowId: string): Set<string> {
  try {
    const saved = localStorage.getItem(`workflow-muted-${workflowId}`)
    if (saved) return new Set(JSON.parse(saved) as string[])
  } catch {
    // ignore
  }
  return new Set()
}

function saveMutedSteps(workflowId: string, muted: Set<string>) {
  localStorage.setItem(`workflow-muted-${workflowId}`, JSON.stringify([...muted]))
}

// ── Notes persistence ─────────────────────────────────────────────────────────

function loadNotes(workflowId: string): Record<string, string> {
  try {
    const saved = localStorage.getItem(`workflow-notes-${workflowId}`)
    if (saved) return JSON.parse(saved) as Record<string, string>
  } catch {
    // ignore
  }
  return {}
}

function saveNotes(workflowId: string, notes: Record<string, string>) {
  localStorage.setItem(`workflow-notes-${workflowId}`, JSON.stringify(notes))
}

function loadNoteOffsets(workflowId: string): Record<string, NoteOffset> {
  try {
    const saved = localStorage.getItem(`workflow-note-positions-${workflowId}`)
    if (saved) return JSON.parse(saved) as Record<string, NoteOffset>
  } catch {
    // ignore
  }
  return {}
}

function saveNoteOffsets(workflowId: string, positions: Record<string, NoteOffset>) {
  localStorage.setItem(`workflow-note-positions-${workflowId}`, JSON.stringify(positions))
}

// ── Arrow computation ─────────────────────────────────────────────────────────

interface ArrowPath {
  id: string
  d: string
  labelX: number
  labelY: number
  label: string
  sourceStepId: string
  targetStepId: string
}

function useArrowPaths(
  workflow: WorkflowDetail,
  layout: LayoutState,
  containerRef: RefObject<HTMLDivElement | null>,
  mutedSteps: Set<string>
): ArrowPath[] {
  const [paths, setPaths] = useState<ArrowPath[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function compute() {
      const cr = container!.getBoundingClientRect()

      const stepByName = Object.fromEntries(workflow.steps.map((s) => [s.name, s]))

      function cardBounds(stepId: string) {
        const el = container!.querySelector(`[data-step-id="${stepId}"]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
          left: r.left - cr.left,
          right: r.right - cr.left,
          top: r.top - cr.top,
          bottom: r.bottom - cr.top,
          midX: (r.left + r.right) / 2 - cr.left,
          midY: (r.top + r.bottom) / 2 - cr.top,
        }
      }

      const newPaths: ArrowPath[] = []

      for (const step of workflow.steps) {
        if (mutedSteps.has(step.id)) continue
        const srcPos = layout[step.id]
        if (!srcPos) continue
        const src = cardBounds(step.id)
        if (!src) continue

        for (const opt of step.options) {
          for (const action of opt.actions) {
            if (!action.next_workflow_step_name) continue
            const tgt = stepByName[action.next_workflow_step_name]
            if (!tgt || tgt.id === step.id) continue
            if (mutedSteps.has(tgt.id)) continue
            const tgtPos = layout[tgt.id]
            if (!tgtPos) continue
            const tgtB = cardBounds(tgt.id)
            if (!tgtB) continue

            const optEl = container!.querySelector(`[data-option-id="${opt.id}"]`)
            if (!optEl) continue
            const optR = optEl.getBoundingClientRect()
            const optMidY = (optR.top + optR.bottom) / 2 - cr.top

            const dc = tgtPos.col - srcPos.col
            const dr = tgtPos.row - srcPos.row

            let sx: number, sy: number, ex: number, ey: number

            if (dc > 0) {
              sx = src.right; sy = optMidY
              ex = tgtB.left; ey = tgtB.midY
            } else if (dc < 0) {
              sx = src.left; sy = optMidY
              ex = tgtB.right; ey = tgtB.midY
            } else if (dr > 0) {
              sx = src.midX; sy = src.bottom
              ex = tgtB.midX; ey = tgtB.top
            } else {
              sx = src.midX; sy = src.top
              ex = tgtB.midX; ey = tgtB.bottom
            }

            let cpx1: number, cpy1: number, cpx2: number, cpy2: number
            if (dc !== 0) {
              const bend = Math.max(Math.abs(ex - sx) * 0.45, 60)
              cpx1 = dc > 0 ? sx + bend : sx - bend; cpy1 = sy
              cpx2 = dc > 0 ? ex - bend : ex + bend; cpy2 = ey
            } else {
              const bend = Math.max(Math.abs(ey - sy) * 0.45, 40)
              cpx1 = sx; cpy1 = dr > 0 ? sy + bend : sy - bend
              cpx2 = ex; cpy2 = dr > 0 ? ey - bend : ey + bend
            }

            const d = `M ${sx} ${sy} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${ex} ${ey}`

            const t = 0.5
            const lx =
              (1 - t) ** 3 * sx +
              3 * (1 - t) ** 2 * t * cpx1 +
              3 * (1 - t) * t ** 2 * cpx2 +
              t ** 3 * ex
            const ly =
              (1 - t) ** 3 * sy +
              3 * (1 - t) ** 2 * t * cpy1 +
              3 * (1 - t) * t ** 2 * cpy2 +
              t ** 3 * ey

            const label = action.description ?? action.name

            newPaths.push({
              id: `${opt.id}-${action.id}`,
              d,
              labelX: lx,
              labelY: ly - 6,
              label: label.length > 45 ? label.slice(0, 42) + "…" : label,
              sourceStepId: step.id,
              targetStepId: tgt.id,
            })
          }
        }
      }

      setPaths(newPaths)
    }

    compute()

    const observer = new ResizeObserver(compute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [workflow, layout, mutedSteps])

  return paths
}

const DEFAULT_NOTE_OFFSET: NoteOffset = { x: 6, y: 80 }

// ── Mute button ───────────────────────────────────────────────────────────────

function MuteButton({
  muted,
  onClick,
}: {
  muted: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 p-0.5 rounded transition-colors hover:bg-muted/60 ${
        muted ? "text-red-500" : "text-gray-400"
      }`}
      title={muted ? "Unmute" : "Mute"}
      aria-label={muted ? "Unmute this step" : "Mute this step"}
    >
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    </button>
  )
}

// ── Pencil button ─────────────────────────────────────────────────────────────

function PencilButton({
  hasNote,
  onClick,
}: {
  hasNote: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 p-0.5 rounded transition-colors hover:bg-muted/60 ${
        hasNote ? "text-amber-500" : "text-gray-400"
      }`}
      title={hasNote ? "Edit note" : "Add note"}
      aria-label={hasNote ? "Edit note" : "Add note"}
    >
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </button>
  )
}

// ── Post-it note ──────────────────────────────────────────────────────────────

function PostIt({
  stepId,
  content,
  offset,
  isEditing,
  onContentChange,
  onStartEdit,
  onBlur,
  onDelete,
}: {
  stepId: string
  content: string
  offset: NoteOffset
  isEditing: boolean
  onContentChange: (text: string) => void
  onStartEdit: () => void
  onBlur: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `note-${stepId}`,
    data: { type: "note", stepId },
    disabled: isEditing,
  })

  // Extract onPointerDown from listeners to merge with stopPropagation
  const dndPointerDown = (
    listeners as Record<string, (e: React.PointerEvent) => void> | undefined
  )?.onPointerDown

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      data-postit-step-id={stepId}
      style={{
        position: "absolute",
        left: offset.x,
        top: offset.y,
        width: 160,
        transform: isDragging
          ? `translate(${transform?.x ?? 0}px, ${transform?.y ?? 0}px) rotate(2deg)`
          : "rotate(1.5deg)",
        background: "#fef9c3",
        borderRadius: 3,
        padding: "5px 7px 8px",
        boxShadow: isDragging
          ? "3px 6px 14px rgba(0,0,0,0.22)"
          : "1px 2px 5px rgba(0,0,0,0.14)",
        fontSize: 11,
        minHeight: 52,
        cursor: isEditing ? "default" : isDragging ? "grabbing" : "grab",
        userSelect: isEditing ? "text" : "none",
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (!isEditing) dndPointerDown?.(e)
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 9, color: "#92400e", opacity: 0.5, letterSpacing: "0.02em" }}>
          drag to reposition
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#92400e",
            opacity: 0.45,
            fontSize: 13,
            lineHeight: 1,
            padding: "0 1px",
          }}
        >
          ×
        </button>
      </div>

      {isEditing ? (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onBlur={onBlur}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Write a note…"
          rows={3}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            width: "100%",
            fontFamily: "inherit",
            fontSize: "inherit",
            color: "#451a03",
            lineHeight: 1.5,
          }}
        />
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onStartEdit()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            whiteSpace: "pre-wrap",
            color: content ? "#451a03" : "#a16207",
            fontStyle: content ? "normal" : "italic",
            minHeight: 28,
            cursor: "text",
            lineHeight: 1.5,
          }}
        >
          {content || "Click to add note…"}
        </div>
      )}
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  rank,
  stepId,
  isMuted,
  isSelected,
  hasNote,
  onToggleMute,
  onSelect,
  onOpenNote,
}: {
  step: WorkflowStep
  rank: number
  stepId?: string
  isMuted?: boolean
  isSelected?: boolean
  hasNote?: boolean
  onToggleMute?: (e: React.MouseEvent) => void
  onSelect?: () => void
  onOpenNote?: (e: React.MouseEvent) => void
}) {
  return (
    <div
      data-step-id={stepId}
      onClick={onSelect}
      className="rounded-lg border bg-card p-3 shadow-sm select-none"
      style={
        isSelected
          ? { boxShadow: "0 0 0 2px #60a5fa, 0 0 14px 4px rgba(96,165,250,0.35)" }
          : undefined
      }
    >
      <div className="flex items-start gap-2 mb-1">
        <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-0.5">
          {rank}
        </span>
        <span className="text-sm font-medium leading-tight flex-1">{step.display_name}</span>
        {onOpenNote && (
          <PencilButton hasNote={!!hasNote} onClick={onOpenNote} />
        )}
        {onToggleMute && (
          <MuteButton muted={!!isMuted} onClick={onToggleMute} />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate pl-7 mb-2">
        {step.name}
      </p>
      {step.options.length > 0 && (
        <div className="flex flex-col gap-1">
          {step.options.map((opt) => {
            const hasTransition = opt.actions.some((a) => a.next_workflow_step_name)
            return (
              <div
                key={opt.id}
                data-option-id={opt.id}
                className={`flex items-center text-xs px-2 py-1.5 rounded ${
                  hasTransition ? "bg-muted" : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <span className="flex-1 truncate">{opt.display_name}</span>
                {hasTransition && (
                  <span className="ml-1 shrink-0 text-muted-foreground">→</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Draggable wrapper ─────────────────────────────────────────────────────────

function DraggableStep({
  step,
  rank,
  isMuted,
  isSelected,
  onToggleMute,
  onSelect,
  note,
  noteOffset,
  isEditingNote,
  onNoteContentChange,
  onStartEditNote,
  onStopEditNote,
  onDeleteNote,
  onOpenNote,
}: {
  step: WorkflowStep
  rank: number
  isMuted: boolean
  isSelected: boolean
  onToggleMute: (e: React.MouseEvent) => void
  onSelect: () => void
  note: string | undefined
  noteOffset: NoteOffset
  isEditingNote: boolean
  onNoteContentChange: (text: string) => void
  onStartEditNote: () => void
  onStopEditNote: () => void
  onDeleteNote: () => void
  onOpenNote: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: step.id })

  const hasNote = note !== undefined

  const postItEl = hasNote ? (
    <PostIt
      stepId={step.id}
      content={note}
      offset={noteOffset}
      isEditing={isEditingNote}
      onContentChange={onNoteContentChange}
      onStartEdit={onStartEditNote}
      onBlur={onStopEditNote}
      onDelete={onDeleteNote}
    />
  ) : null

  return (
    <div
      ref={setNodeRef}
      className="cursor-grab active:cursor-grabbing"
      style={{ opacity: isDragging ? 0 : 1, position: "relative" }}
      {...attributes}
      {...listeners}
    >
      {/* Post-it always rendered BEFORE card so card naturally paints on top */}
      {postItEl}

      {/* Card wrapped in positioned div so DOM-order stacking works correctly */}
      <div style={{ position: "relative" }}>
        <StepCard
          step={step}
          rank={rank}
          stepId={step.id}
          isMuted={isMuted}
          isSelected={isSelected}
          hasNote={hasNote}
          onToggleMute={onToggleMute}
          onSelect={onSelect}
          onOpenNote={onOpenNote}
        />
      </div>
    </div>
  )
}

// ── Grid cell (droppable) ─────────────────────────────────────────────────────

function GridCell({
  row,
  col,
  step,
  rank,
  isMuted,
  isSelected,
  onToggleMute,
  onSelect,
  note,
  noteOffset,
  isEditingNote,
  onNoteContentChange,
  onStartEditNote,
  onStopEditNote,
  onDeleteNote,
  onOpenNote,
}: {
  row: number
  col: number
  step?: WorkflowStep
  rank?: number
  isMuted?: boolean
  isSelected?: boolean
  onToggleMute?: (e: React.MouseEvent) => void
  onSelect?: () => void
  note?: string
  noteOffset?: NoteOffset
  isEditingNote?: boolean
  onNoteContentChange?: (text: string) => void
  onStartEditNote?: () => void
  onStopEditNote?: () => void
  onDeleteNote?: () => void
  onOpenNote?: (e: React.MouseEvent) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${row}-${col}` })
  const occupied = !!step

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg min-h-[72px] transition-all ${
        isOver
          ? occupied
            ? "ring-2 ring-destructive/50 bg-destructive/5"
            : "ring-2 ring-primary/50 bg-primary/8"
          : occupied
          ? ""
          : "border border-dashed border-border/30"
      }`}
    >
      {step &&
        rank !== undefined &&
        onToggleMute &&
        onSelect &&
        onNoteContentChange &&
        onStartEditNote &&
        onStopEditNote &&
        onDeleteNote &&
        onOpenNote && (
          <DraggableStep
            step={step}
            rank={rank}
            isMuted={!!isMuted}
            isSelected={!!isSelected}
            onToggleMute={onToggleMute}
            onSelect={onSelect}
            note={note}
            noteOffset={noteOffset ?? DEFAULT_NOTE_OFFSET}
            isEditingNote={!!isEditingNote}
            onNoteContentChange={onNoteContentChange}
            onStartEditNote={onStartEditNote}
            onStopEditNote={onStopEditNote}
            onDeleteNote={onDeleteNote}
            onOpenNote={onOpenNote}
          />
        )}
    </div>
  )
}

// ── SVG arrow overlay ─────────────────────────────────────────────────────────

function WorkflowArrows({
  paths,
  selectedStepId,
}: {
  paths: ArrowPath[]
  selectedStepId: string | null
}) {
  if (paths.length === 0) return null

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="wf-arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,3 L0,6 Z" fill="#9ca3af" />
        </marker>
        <marker
          id="wf-arrowhead-in"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,3 L0,6 Z" fill="#3b82f6" />
        </marker>
        <marker
          id="wf-arrowhead-out"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,3 L0,6 Z" fill="#ef4444" />
        </marker>
      </defs>
      {paths.map((p) => {
        const isIncoming = selectedStepId !== null && p.targetStepId === selectedStepId
        const isOutgoing = selectedStepId !== null && p.sourceStepId === selectedStepId
        const stroke = isIncoming ? "#3b82f6" : isOutgoing ? "#ef4444" : "#9ca3af"
        const strokeWidth = isIncoming || isOutgoing ? 2.5 : 1.5
        const marker = isIncoming
          ? "url(#wf-arrowhead-in)"
          : isOutgoing
          ? "url(#wf-arrowhead-out)"
          : "url(#wf-arrowhead)"

        return (
          <g key={p.id}>
            <path
              d={p.d}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              markerEnd={marker}
            />
            <text
              x={p.labelX}
              y={p.labelY}
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="auto"
              stroke="white"
              strokeWidth={4}
              strokeLinejoin="round"
              paintOrder="stroke"
              fill="#6b7280"
            >
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Column headers ────────────────────────────────────────────────────────────

function ColumnHeaders() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${NUM_COLS}, minmax(0, 230px))`,
        gap: GAP,
        marginBottom: 4,
      }}
    >
      {Array.from({ length: NUM_COLS }, (_, i) => (
        <p
          key={i}
          className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide"
        >
          Column {i + 1}
        </p>
      ))}
    </div>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────

export function WorkflowGrid({ workflow }: { workflow: WorkflowDetail }) {
  const [layout, setLayout] = useState<LayoutState>(() =>
    loadLayout(workflow.id, workflow.steps)
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [mutedSteps, setMutedSteps] = useState<Set<string>>(() =>
    loadMutedSteps(workflow.id)
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    loadNotes(workflow.id)
  )
  const [noteOffsets, setNoteOffsets] = useState<Record<string, NoteOffset>>(() =>
    loadNoteOffsets(workflow.id)
  )
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const arrowPaths = useArrowPaths(workflow, layout, containerRef, mutedSteps)

  const stepsById = Object.fromEntries(workflow.steps.map((s) => [s.id, s]))
  const ranks = Object.fromEntries(
    [...workflow.steps]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s, i) => [s.id, i + 1])
  )

  useEffect(() => { saveLayout(workflow.id, layout) }, [workflow.id, layout])
  useEffect(() => { saveMutedSteps(workflow.id, mutedSteps) }, [workflow.id, mutedSteps])
  useEffect(() => { saveNotes(workflow.id, notes) }, [workflow.id, notes])
  useEffect(() => { saveNoteOffsets(workflow.id, noteOffsets) }, [workflow.id, noteOffsets])

  const cellToStep = Object.fromEntries(
    Object.entries(layout).map(([id, pos]) => [`${pos.row},${pos.col}`, id])
  )
  const maxRow = Math.max(...Object.values(layout).map((p) => p.row), 0)
  const totalRows = maxRow + 1 + EXTRA_ROWS

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart({ active }: DragStartEvent) {
    if (!String(active.id).startsWith("note-")) {
      setActiveId(active.id as string)
    }
  }

  function handleDragEnd({ active, over, delta }: DragEndEvent) {
    // Note drag — accumulate x/y offset, clamp so center stays outside the card
    if (String(active.id).startsWith("note-")) {
      const stepId = String(active.id).slice(5)
      setNoteOffsets((prev) => {
        const cur = prev[stepId] ?? DEFAULT_NOTE_OFFSET
        let nx = cur.x + delta.x
        let ny = cur.y + delta.y

        // Measure card and note to enforce visibility constraint
        const cardEl = containerRef.current?.querySelector(`[data-step-id="${stepId}"]`)
        const noteEl = containerRef.current?.querySelector(`[data-postit-step-id="${stepId}"]`)
        if (cardEl && noteEl) {
          const cw = (cardEl as HTMLElement).offsetWidth
          const ch = (cardEl as HTMLElement).offsetHeight
          const nw = (noteEl as HTMLElement).offsetWidth
          const nh = (noteEl as HTMLElement).offsetHeight
          const cx = nx + nw / 2
          const cy = ny + nh / 2
          // If note center is inside the card, push it out to the nearest edge
          if (cx >= 0 && cx <= cw && cy >= 0 && cy <= ch) {
            const dLeft   = cx
            const dRight  = cw - cx
            const dTop    = cy
            const dBottom = ch - cy
            const min = Math.min(dLeft, dRight, dTop, dBottom)
            if      (min === dLeft)   nx = -nw / 2
            else if (min === dRight)  nx = cw - nw / 2
            else if (min === dTop)    ny = -nh / 2
            else                      ny = ch - nh / 2
          }
        }

        return { ...prev, [stepId]: { x: nx, y: ny } }
      })
      return
    }

    // Card drag
    setActiveId(null)
    if (!over) return
    const match = String(over.id).match(/^cell-(\d+)-(\d+)$/)
    if (!match) return
    const row = parseInt(match[1])
    const col = parseInt(match[2])
    const occupant = cellToStep[`${row},${col}`]
    if (occupant && occupant !== active.id) return
    setLayout((prev) => ({ ...prev, [active.id as string]: { row, col } }))
  }

  function handleExport() {
    const state = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      exportedAt: new Date().toISOString(),
      layout,
      mutedSteps: [...mutedSteps],
      notes,
      noteOffsets,
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${workflow.name}-display.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    localStorage.removeItem(`workflow-grid-${workflow.id}`)
    localStorage.removeItem(`workflow-muted-${workflow.id}`)
    localStorage.removeItem(`workflow-notes-${workflow.id}`)
    localStorage.removeItem(`workflow-note-positions-${workflow.id}`)
    setLayout(initLayout(workflow.steps))
    setMutedSteps(new Set())
    setNotes({})
    setNoteOffsets({})
    setEditingNoteId(null)
  }

  function handleSelect(stepId: string) {
    setSelectedStepId((prev) => (prev === stepId ? null : stepId))
  }

  function handleToggleMute(stepId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setMutedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  function handleOpenNote(stepId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (notes[stepId] === undefined) {
      setNotes((prev) => ({ ...prev, [stepId]: "" }))
      setNoteOffsets((prev) => ({ ...prev, [stepId]: DEFAULT_NOTE_OFFSET }))
    }
    setEditingNoteId(stepId)
  }

  function handleNoteContentChange(stepId: string, text: string) {
    setNotes((prev) => ({ ...prev, [stepId]: text }))
  }

  function handleStopEditNote() {
    setEditingNoteId(null)
  }

  function handleDeleteNote(stepId: string) {
    setNotes((prev) => {
      const next = { ...prev }
      delete next[stepId]
      return next
    })
    setNoteOffsets((prev) => {
      const next = { ...prev }
      delete next[stepId]
      return next
    })
    if (editingNoteId === stepId) setEditingNoteId(null)
  }

  const activeStep = activeId ? stepsById[activeId] : null

  return (
    <>
      <div className="flex justify-end gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleExport}
        >
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleReset}
        >
          Reset layout
        </Button>
      </div>

      <ColumnHeaders />

      <div ref={containerRef} className="relative">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${NUM_COLS}, minmax(0, 230px))`,
              gridAutoRows: "auto",
              gap: GAP,
            }}
          >
            {Array.from({ length: totalRows }, (_, row) =>
              Array.from({ length: NUM_COLS }, (_, col) => {
                const stepId = cellToStep[`${row},${col}`]
                const step = stepId ? stepsById[stepId] : undefined
                return (
                  <GridCell
                    key={`${row}-${col}`}
                    row={row}
                    col={col}
                    step={step}
                    rank={step ? ranks[step.id] : undefined}
                    isMuted={step ? mutedSteps.has(step.id) : false}
                    isSelected={step ? selectedStepId === step.id : false}
                    onToggleMute={step ? (e) => handleToggleMute(step.id, e) : undefined}
                    onSelect={step ? () => handleSelect(step.id) : undefined}
                    note={step ? notes[step.id] : undefined}
                    noteOffset={step ? (noteOffsets[step.id] ?? DEFAULT_NOTE_OFFSET) : undefined}
                    isEditingNote={step ? editingNoteId === step.id : false}
                    onNoteContentChange={
                      step ? (text) => handleNoteContentChange(step.id, text) : undefined
                    }
                    onStartEditNote={step ? () => setEditingNoteId(step.id) : undefined}
                    onStopEditNote={handleStopEditNote}
                    onDeleteNote={step ? () => handleDeleteNote(step.id) : undefined}
                    onOpenNote={step ? (e) => handleOpenNote(step.id, e) : undefined}
                  />
                )
              })
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeStep && (
              <div style={{ width: 280, opacity: 0.9 }}>
                <StepCard step={activeStep} rank={ranks[activeStep.id]} stepId={activeStep.id} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <WorkflowArrows paths={arrowPaths} selectedStepId={selectedStepId} />
      </div>
    </>
  )
}
