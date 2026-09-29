import { useRef, useState } from "react"
import { Pin } from "lucide-react"
import {
  CARD_W,
  HEADER_H,
  OPTION_GAP,
  OPTION_H,
  sortedOptions,
  type FlowLayout,
  type LayoutEdge,
  type LayoutNode,
} from "./spineLayout"

export type Selection =
  | { type: "step"; nodeId: string }
  | { type: "option"; optionId: string; nodeId: string }
  | null

interface Highlight {
  optionId: string
  nodes: Set<string>
  edges: Set<string>
}

interface Props {
  layout: FlowLayout
  selection: Selection
  highlight: Highlight | null
  editing: boolean
  showAllLabels: boolean
  onSelect: (s: Selection) => void
  onDrop: (node: LayoutNode, cell: { col: number; row: number }) => void
}

const DRAG_THRESHOLD = 4

export function SpineCanvas({ layout, selection, highlight, editing, showAllLabels, onSelect, onDrop }: Props) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const occupied = new Map(layout.nodes.map((n) => [`${n.col}:${n.row}`, n.id]))

  // Nearest grid cell to the dragged card's top-left corner.
  function cellFor(x: number, y: number) {
    const col = layout.grid.cols.reduce((best, c) => (Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best)).col
    const row = layout.grid.rows.reduce((best, r) => (Math.abs(r.y - y) < Math.abs(best.y - y) ? r : best)).row
    return { col, row }
  }

  function onPointerDown(e: React.PointerEvent, node: LayoutNode) {
    if (!editing || e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY }
    setDrag({ id: node.id, dx: 0, dy: 0, moved: false })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD })
  }

  function onPointerUp(node: LayoutNode) {
    if (!drag) return
    if (drag.moved) {
      const cell = cellFor(node.x + drag.dx, node.y + drag.dy)
      const owner = occupied.get(`${cell.col}:${cell.row}`)
      if ((!owner || owner === node.id) && (cell.col !== node.col || cell.row !== node.row)) onDrop(node, cell)
    } else {
      onSelect({ type: "step", nodeId: node.id })
    }
    setDrag(null)
    dragStart.current = null
  }

  const dropCell =
    drag?.moved && layout.nodes.find((n) => n.id === drag.id)
      ? (() => {
          const n = layout.nodes.find((n) => n.id === drag.id)!
          const cell = cellFor(n.x + drag.dx, n.y + drag.dy)
          const owner = occupied.get(`${cell.col}:${cell.row}`)
          return { ...cell, ok: !owner || owner === n.id }
        })()
      : null

  const dimmed = (nodeId: string) =>
    !!highlight && !highlight.nodes.has(nodeId) && selection?.nodeId !== nodeId

  const edgeActive = (e: LayoutEdge) => !highlight || highlight.edges.has(e.id)
  const showLabel = (e: LayoutEdge) =>
    highlight ? highlight.edges.has(e.id) : showAllLabels || !!e.action.description

  return (
    <div
      className="relative"
      style={{ width: layout.width, height: layout.height }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
    >
      {/* Spine bands */}
      {layout.spines.map((s) => (
        <div
          key={s.name}
          className={`absolute rounded-xl pointer-events-none ${
            s.name === "main" ? "bg-primary/5 border border-primary/15" : "bg-sky-500/5 border border-sky-500/20"
          }`}
          style={{ left: s.x - 14, top: s.top - 14, width: CARD_W + 28, height: s.bottom - s.top + 28 }}
        >
          <div
            className={`absolute -top-2.5 left-3 rounded-full border bg-background px-2 text-[10px] font-semibold uppercase leading-4 tracking-wide ${
              s.name === "main" ? "border-primary/30 text-primary/80" : "border-sky-500/30 text-sky-600"
            }`}
          >
            {s.label}
          </div>
        </div>
      ))}

      {/* Group boxes */}
      {layout.groups.map((g) => (
        <div
          key={g.name}
          className="absolute rounded-lg border-2 border-dashed border-amber-400/60 pointer-events-none"
          style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
        >
          <span className="absolute -top-2.5 left-3 bg-background px-1 text-[11px] font-medium text-amber-600">
            {g.label}
          </span>
        </div>
      ))}

      {/* Edit-mode grid */}
      {editing &&
        layout.grid.cols.flatMap((c) =>
          layout.grid.rows.map((r) => {
            const isDrop = dropCell && dropCell.col === c.col && dropCell.row === r.row
            return (
              <div
                key={`${c.col}:${r.row}`}
                className={`absolute rounded-lg border border-dashed pointer-events-none ${
                  isDrop ? (dropCell.ok ? "border-primary bg-primary/10" : "border-destructive bg-destructive/10") : "border-border"
                }`}
                style={{ left: c.x, top: r.y, width: CARD_W, height: Math.max(r.h, 60) }}
              />
            )
          })
        )}

      {/* Edges (behind cards) */}
      <svg className="absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
          </marker>
          <marker id="arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
          </marker>
        </defs>
        {layout.edges.map((e) => {
          const hl = !!highlight && highlight.edges.has(e.id)
          return (
            <g key={e.id} opacity={edgeActive(e) ? 1 : 0.12}>
              <path
                d={e.d}
                fill="none"
                strokeWidth={hl ? 2.5 : 1.5}
                strokeDasharray={e.kind === "gutter" ? "5 4" : undefined}
                className={hl ? "stroke-primary" : "stroke-muted-foreground/70"}
                markerEnd={hl ? "url(#arrow-hl)" : "url(#arrow)"}
              />
              <path
                d={e.d}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onClick={() => onSelect({ type: "option", optionId: e.optionId, nodeId: e.src })}
              >
                <title>{`${e.fromStep} → ${e.toStep}\n${e.action.name}${e.action.description ? "\n" + e.action.description : ""}`}</title>
              </path>
            </g>
          )
        })}
      </svg>

      {/* Step cards */}
      {layout.nodes.map((n) => {
        const isDragging = drag?.id === n.id && drag.moved
        const selected = selection?.type === "step" && selection.nodeId === n.id
        return (
          <div
            key={n.id}
            className={`absolute rounded-lg border bg-card shadow-sm select-none transition-opacity ${
              editing ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            } ${selected ? "ring-2 ring-sky-400" : ""} ${n.kind === "group" ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20" : ""}`}
            style={{
              left: n.x,
              top: n.y,
              width: n.w,
              height: n.h,
              opacity: dimmed(n.id) ? 0.3 : 1,
              transform: isDragging ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
              zIndex: isDragging ? 30 : 10,
              boxShadow: isDragging ? "0 12px 24px rgba(0,0,0,0.15)" : undefined,
            }}
            onPointerDown={(e) => onPointerDown(e, n)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(n)}
            onClick={(e) => {
              e.stopPropagation()
              if (!editing) onSelect({ type: "step", nodeId: n.id })
            }}
          >
            <StepHeader node={n} />
            {n.kind === "step" && n.step && (
              <div className="flex flex-col px-2" style={{ gap: OPTION_GAP }}>
                {sortedOptions(n.step).map((o) => {
                  const hasTarget = o.actions.some((a) => a.next_workflow_step_name)
                  const active = highlight?.optionId === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`flex items-center rounded-md px-2.5 text-xs font-medium text-left truncate transition ${
                        hasTarget
                          ? "bg-primary text-primary-foreground hover:bg-primary/85"
                          : "border border-primary/40 text-primary bg-primary/5"
                      } ${active ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                      style={{ height: OPTION_H }}
                      title={o.description ?? o.display_name}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect({ type: "option", optionId: o.id, nodeId: n.id })
                      }}
                    >
                      <span className="flex-1 truncate">{o.display_name || o.name}</span>
                      {!hasTarget && <span className="ml-1 text-[10px] opacity-70">no transition</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {n.kind === "group" && (
              <ul className="px-3 text-[11px] text-muted-foreground">
                {n.members.map((m) => (
                  <li key={m.id} className="truncate leading-[18px]">
                    {m.display_name || m.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {/* Edge labels (above cards) */}
      <svg className="absolute inset-0 overflow-visible pointer-events-none" width={layout.width} height={layout.height} style={{ zIndex: 20 }}>
        {layout.edges.filter(showLabel).map((e) => (
          <text
            key={e.id}
            x={e.labelX}
            y={e.labelY}
            textAnchor={e.labelAnchor}
            transform={e.kind === "gutter" ? `rotate(-90 ${e.labelX} ${e.labelY})` : undefined}
            dominantBaseline="middle"
            className="fill-foreground text-[10.5px]"
            style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4, strokeLinejoin: "round" }}
          >
            {e.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function StepHeader({ node }: { node: LayoutNode }) {
  const subtitle = node.kind === "group" ? `${node.members.length} steps` : node.id
  return (
    <div className="px-3 pt-2" style={{ height: HEADER_H }}>
      <div className="flex items-center gap-1.5">
        <span className="flex-1 truncate text-sm font-medium leading-tight">{node.label}</span>
        {node.pinned && <Pin className="size-3 text-muted-foreground" aria-label="Pinned" />}
      </div>
      <p className="truncate font-mono text-[10.5px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
}
