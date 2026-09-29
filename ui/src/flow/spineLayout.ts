// Spine layout for workflow graphs.
//
// Pure function: (workflow, hints) -> positioned nodes, routed edges, warnings.
//
// 1. Graph: one edge per option action with a next_workflow_step_name.
//    Collapsed groups are contracted into a single node first.
// 2. Tray: steps with no edges at all (VOID, CLIENT_WITHDREW, ...) are pulled
//    out of the grid.
// 3. Back-edges: DFS from the start step in ordinal order; edges into a step
//    still on the DFS stack are back-edges and route through a side gutter.
// 4. Spines: steps hinted with `spine`. If nothing is hinted "main", main falls
//    back to the longest forward path from start to a non-exit terminal.
// 5. Rows ("option A"): every forward edge points down or across. A spine step
//    sits one row below all of its predecessors; a branch step leaving a spine
//    sits on the same row as that spine step, and continues downward.
// 6. Columns: main at 0. Each spine owns a band = its column plus lanes for the
//    branches that leave it. Main's lanes go right; other spines' bands are
//    stacked outward on their configured side.
// 7. Hints: rowNudge shifts a step and its descendants; pin fixes a cell
//    and takes the step out of flow (it doesn't move anything else).

import type { WorkflowAction, WorkflowDetail, WorkflowOption, WorkflowStep } from "@/types/workflow"
import type { WorkflowHints } from "@/types/hints"

export const MAIN = "main"

export const CARD_W = 240
export const COL_GAP = 96
export const ROW_GAP = 56
export const HEADER_H = 52
export const OPTION_H = 28
export const OPTION_GAP = 6
export const CARD_PAD = 10
const TOP_PAD = 48
const SIDE_PAD = 48
const GUTTER_OFFSET = 18
const GUTTER_STEP = 10
const CHANNEL_OFFSET = 16
/** Parallel vertical tracks per column gap before they start to reuse offsets. */
const CHANNEL_LANES = 7
const EMPTY_ROW_H = 80
const LABEL_MAX = 45

/** Terminal names treated as exits when choosing a fallback main spine. */
const EXIT_RE = /VOID|WITHDR|INTERRUPT|DENIED|DECLINED/

// ── Public types ──────────────────────────────────────────────────────────────

export interface LayoutNode {
  /** Step name, or "group:<name>" for a collapsed group. */
  id: string
  kind: "step" | "group"
  step: WorkflowStep | null
  members: WorkflowStep[]
  label: string
  spine: string | null
  /** True when the spine came from the fallback, not a hint. */
  autoSpine: boolean
  pinned: boolean
  row: number
  /** Column relative to the main spine (0). */
  col: number
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutEdge {
  id: string
  src: string
  dst: string
  fromStep: string
  toStep: string
  optionId: string
  action: WorkflowAction
  back: boolean
  kind: "down" | "across" | "gutter"
  d: string
  labelX: number
  labelY: number
  /** Gutter labels are drawn rotated -90° around (labelX, labelY). */
  labelAnchor: "start" | "middle" | "end"
  label: string
}

export interface SpineBand {
  name: string
  label: string
  x: number
  top: number
  bottom: number
}

export interface GroupBox {
  name: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

export interface FlowLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  spines: SpineBand[]
  groups: GroupBox[]
  tray: LayoutNode[]
  /** stepName -> node id (differs for members of collapsed groups). */
  nodeOfStep: Record<string, string>
  /** Grid cells; in edit mode includes a spare column each side and extra rows. */
  grid: { cols: { col: number; x: number }[]; rows: { row: number; y: number; h: number }[] }
  width: number
  height: number
  warnings: {
    staleHints: string[]
    messages: string[]
  }
}

export function sortedOptions(step: WorkflowStep): WorkflowOption[] {
  return [...step.options].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
}

export function cardHeight(optionCount: number): number {
  const opts = optionCount ? optionCount * (OPTION_H + OPTION_GAP) - OPTION_GAP : 0
  return HEADER_H + opts + CARD_PAD
}

function groupHeight(memberCount: number): number {
  return HEADER_H + memberCount * 18 + CARD_PAD
}

function byOrdinal(a: WorkflowStep, b: WorkflowStep): number {
  const ao = a.ordinal ?? Number.MAX_SAFE_INTEGER
  const bo = b.ordinal ?? Number.MAX_SAFE_INTEGER
  return ao - bo || a.name.localeCompare(b.name)
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

// ── Layout ────────────────────────────────────────────────────────────────────

interface GEdge {
  id: string
  src: string
  dst: string
  fromStep: string
  toStep: string
  optionId: string
  optionIndex: number
  action: WorkflowAction
  back: boolean
}

export function layoutWorkflow(
  workflow: WorkflowDetail,
  hints: WorkflowHints,
  opts: { editing?: boolean } = {}
): FlowLayout {
  // Edit mode exposes spare rows and columns as drop targets.
  const editing = opts.editing ?? false
  const extraRows = editing ? 3 : 0
  const stepHints = hints.steps ?? {}
  const groupCfg = hints.groups ?? {}
  const spineCfg = hints.spines ?? {}
  const messages: string[] = []

  const steps = [...workflow.steps].sort(byOrdinal)
  const stepByName = new Map(steps.map((s) => [s.name, s]))
  const staleHints = Object.keys(stepHints).filter((name) => !stepByName.has(name))

  // ── 1. Nodes (with collapsed groups contracted) ──
  const rep = (name: string): string => {
    const g = stepHints[name]?.group
    return g && groupCfg[g]?.collapsed ? `group:${g}` : name
  }
  const nodeOfStep: Record<string, string> = {}
  const nodeOrder: string[] = []
  const members = new Map<string, WorkflowStep[]>()
  for (const s of steps) {
    const id = rep(s.name)
    nodeOfStep[s.name] = id
    if (!members.has(id)) {
      members.set(id, [])
      nodeOrder.push(id)
    }
    members.get(id)!.push(s)
  }
  // A node's hints come from its first member (by ordinal).
  const hintOf = (id: string) => stepHints[members.get(id)![0].name] ?? {}
  const orderIdx = new Map(nodeOrder.map((id, i) => [id, i]))

  // ── Edges ──
  const edges: GEdge[] = []
  for (const s of steps) {
    sortedOptions(s).forEach((o, optionIndex) => {
      for (const a of o.actions) {
        const target = a.next_workflow_step_name
        if (!target) continue
        if (!stepByName.has(target)) {
          messages.push(`${s.name} › "${o.display_name}" points to missing step ${target}`)
          continue
        }
        const src = rep(s.name)
        const dst = rep(target)
        if (src === dst && src.startsWith("group:")) continue
        edges.push({
          id: `${o.id}:${a.id}`,
          src,
          dst,
          fromStep: s.name,
          toStep: target,
          optionId: o.id,
          optionIndex,
          action: a,
          back: false,
        })
      }
    })
  }
  const outs = new Map<string, GEdge[]>(nodeOrder.map((id) => [id, []]))
  const ins = new Map<string, GEdge[]>(nodeOrder.map((id) => [id, []]))
  for (const e of edges) {
    outs.get(e.src)!.push(e)
    ins.get(e.dst)!.push(e)
  }

  // ── 2. Tray ──
  const inTray = (id: string) =>
    outs.get(id)!.length === 0 &&
    ins.get(id)!.length === 0 &&
    !hintOf(id).spine &&
    !hintOf(id).pin
  const gridIds = nodeOrder.filter((id) => !inTray(id))
  const trayIds = nodeOrder.filter(inTray)

  // ── 3. Back-edges ──
  const start =
    gridIds.find((id) => ins.get(id)!.length === 0 && outs.get(id)!.length > 0) ?? gridIds[0]
  const color = new Map<string, 1 | 2>()
  const dfs = (u: string) => {
    color.set(u, 1)
    for (const e of outs.get(u)!) {
      const c = color.get(e.dst)
      if (c === 1) e.back = true
      else if (c === undefined) dfs(e.dst)
    }
    color.set(u, 2)
  }
  if (start) dfs(start)
  for (const id of gridIds) if (!color.has(id) && ins.get(id)!.length === 0) dfs(id)
  for (const id of gridIds) if (!color.has(id)) dfs(id)

  const fwdIns = (id: string) => ins.get(id)!.filter((e) => !e.back)
  const fwdOuts = (id: string) => outs.get(id)!.filter((e) => !e.back)

  // Topological order over forward edges, ties by ordinal.
  const indeg = new Map(gridIds.map((id) => [id, fwdIns(id).length]))
  const ready = gridIds.filter((id) => indeg.get(id) === 0)
  const topo: string[] = []
  while (ready.length) {
    ready.sort((a, b) => orderIdx.get(a)! - orderIdx.get(b)!)
    const u = ready.shift()!
    topo.push(u)
    for (const e of fwdOuts(u)) {
      const d = indeg.get(e.dst)! - 1
      indeg.set(e.dst, d)
      if (d === 0) ready.push(e.dst)
    }
  }

  // ── 4. Spines ──
  const spineOf = new Map<string, string>()
  for (const id of gridIds) {
    const s = hintOf(id).spine
    if (s) spineOf.set(id, s)
  }
  const autoSpine = new Set<string>()
  if (![...spineOf.values()].includes(MAIN) && start) {
    const memo = new Map<string, string[] | null>()
    const longest = (u: string): string[] | null => {
      if (memo.has(u)) return memo.get(u)!
      const next = fwdOuts(u)
      let best: string[] | null = next.length === 0 && !EXIT_RE.test(u) ? [u] : null
      for (const e of next) {
        const p = longest(e.dst)
        if (p && (!best || p.length + 1 > best.length)) best = [u, ...p]
      }
      memo.set(u, best)
      return best
    }
    for (const id of longest(start) ?? [start]) {
      if (!spineOf.has(id)) {
        spineOf.set(id, MAIN)
        autoSpine.add(id)
      }
    }
  }

  // ── 5. Rows ──
  const row = new Map<string, number>()
  const spineRows = new Map<string, Set<number>>()
  for (const id of topo) {
    const h = hintOf(id)
    if (h.pin) {
      row.set(id, Math.max(0, h.pin.row))
      continue
    }
    const spine = spineOf.get(id)
    let r = 0
    for (const e of fwdIns(id)) {
      // Pinned steps are out of flow: they never push other steps around.
      if (hintOf(e.src).pin) continue
      const pr = row.get(e.src)!
      r = Math.max(r, spine || !spineOf.has(e.src) ? pr + 1 : pr)
    }
    r = Math.max(0, r + (h.rowNudge ?? 0))
    if (spine) {
      const used = spineRows.get(spine) ?? new Set<number>()
      while (used.has(r)) r++
      used.add(r)
      spineRows.set(spine, used)
    }
    row.set(id, r)
  }
  // Off-spine entry points (nothing leads to them) sit just above the first
  // step they feed instead of at the top of the chart.
  for (const id of topo) {
    if (spineOf.has(id) || hintOf(id).pin || fwdIns(id).length) continue
    const succRows = fwdOuts(id).map((e) => row.get(e.dst)!)
    if (succRows.length) row.set(id, Math.max(row.get(id)!, Math.min(...succRows) - 1))
  }

  // ── 6. Columns ──
  // Band = the spine a branch step hangs off. Its anchor is the predecessor
  // that set its row (the edge into it is horizontal).
  const band = new Map<string, string>()
  const lane = new Map<string, number>()
  const laneUsed = new Map<string, Set<string>>()
  const maxLane = new Map<string, number>()
  for (const id of topo) {
    if (hintOf(id).pin) continue
    const spine = spineOf.get(id)
    if (spine) {
      band.set(id, spine)
      lane.set(id, 0)
      continue
    }
    let anchor: string | null = null
    let anchorRow = -1
    for (const e of fwdIns(id)) {
      if (hintOf(e.src).pin) continue
      const r = row.get(e.src)!
      if (r > anchorRow) {
        anchor = e.src
        anchorRow = r
      }
    }
    let b = anchor ? band.get(anchor)! : undefined
    if (!b) {
      const spineSucc = fwdOuts(id).find((e) => spineOf.has(e.dst))
      b = spineSucc ? spineOf.get(spineSucc.dst)! : MAIN
    }
    band.set(id, b)
    const used = laneUsed.get(b) ?? new Set<string>()
    laneUsed.set(b, used)
    const r = row.get(id)!
    let k = hintOf(id).lane ?? (anchor && !spineOf.has(anchor) ? lane.get(anchor)! : 1)
    k = Math.max(1, k)
    while (used.has(`${k}:${r}`)) k++
    used.add(`${k}:${r}`)
    lane.set(id, k)
    maxLane.set(b, Math.max(maxLane.get(b) ?? 0, k))
  }

  const otherSpines = [...new Set([...spineOf.values(), ...band.values()])]
    .filter((s) => s !== MAIN)
    .sort((a, b) => {
      const oa = spineCfg[a]?.order ?? Infinity
      const ob = spineCfg[b]?.order ?? Infinity
      if (oa !== ob) return oa - ob
      const ra = Math.min(...[...(spineRows.get(a) ?? [0])])
      const rb = Math.min(...[...(spineRows.get(b) ?? [0])])
      return ra - rb || a.localeCompare(b)
    })
  // spine -> { column of the spine, direction lanes grow in }
  const bandCol = new Map<string, { col: number; dir: 1 | -1 }>()
  bandCol.set(MAIN, { col: 0, dir: 1 })
  let nextRight = 1 + (maxLane.get(MAIN) ?? 0)
  let nextLeft = -1
  for (const s of otherSpines) {
    const lanes = maxLane.get(s) ?? 0
    if (spineCfg[s]?.side === "left") {
      bandCol.set(s, { col: nextLeft, dir: -1 })
      nextLeft -= 1 + lanes
    } else {
      bandCol.set(s, { col: nextRight, dir: 1 })
      nextRight += 1 + lanes
    }
  }
  const col = new Map<string, number>()
  for (const id of gridIds) {
    const pin = hintOf(id).pin
    if (pin) {
      col.set(id, pin.col)
      continue
    }
    const b = bandCol.get(band.get(id)!)!
    col.set(id, b.col + b.dir * lane.get(id)!)
  }

  const cellOwner = new Map<string, string>()
  for (const id of gridIds) {
    const key = `${col.get(id)}:${row.get(id)}`
    const other = cellOwner.get(key)
    if (other) messages.push(`${members.get(id)![0].name} overlaps ${members.get(other)![0].name} at ${key}`)
    else cellOwner.set(key, id)
  }

  // ── Geometry ──
  const heightOf = (id: string) =>
    id.startsWith("group:")
      ? groupHeight(members.get(id)!.length)
      : cardHeight(members.get(id)![0].options.length)
  const cols = gridIds.map((id) => col.get(id)!)
  const minCol = Math.min(0, ...cols) - 1
  const maxCol = Math.max(0, ...cols) + 1
  const lastRow = Math.max(0, ...gridIds.map((id) => row.get(id)!))
  const rowH: number[] = Array(lastRow + 1 + extraRows).fill(EMPTY_ROW_H)
  const rowHasNode: boolean[] = Array(rowH.length).fill(false)
  for (const id of gridIds) {
    const r = row.get(id)!
    rowH[r] = rowHasNode[r] ? Math.max(rowH[r], heightOf(id)) : heightOf(id)
    rowHasNode[r] = true
  }
  const rowY: number[] = []
  let y = TOP_PAD
  for (const h of rowH) {
    rowY.push(y)
    y += h + ROW_GAP
  }
  const backCount = edges.filter((e) => e.back).length
  const leftPad = SIDE_PAD + GUTTER_OFFSET + GUTTER_STEP * backCount
  const firstCol = editing ? minCol : minCol + 1
  const lastCol = editing ? maxCol : maxCol - 1
  const colX = (c: number) => leftPad + (c - firstCol) * (CARD_W + COL_GAP)

  const nodeById = new Map<string, LayoutNode>()
  const mkNode = (id: string, r: number, c: number, x: number, yy: number): LayoutNode => {
    const ms = members.get(id)!
    const isGroup = id.startsWith("group:")
    const g = isGroup ? id.slice("group:".length) : null
    return {
      id,
      kind: isGroup ? "group" : "step",
      step: isGroup ? null : ms[0],
      members: ms,
      label: g ? groupCfg[g]?.label ?? g : stepHints[id]?.label ?? ms[0].display_name ?? ms[0].name,
      spine: spineOf.get(id) ?? null,
      autoSpine: autoSpine.has(id),
      pinned: !!hintOf(id).pin,
      row: r,
      col: c,
      x,
      y: yy,
      w: CARD_W,
      h: heightOf(id),
    }
  }
  const nodes = gridIds.map((id) => {
    const n = mkNode(id, row.get(id)!, col.get(id)!, colX(col.get(id)!), rowY[row.get(id)!])
    nodeById.set(id, n)
    return n
  })
  const tray = trayIds.map((id) => mkNode(id, -1, 0, 0, 0))

  // ── Edge routing ──
  const anchorY = (n: LayoutNode, optionIndex: number) =>
    n.kind === "group"
      ? n.y + HEADER_H / 2
      : n.y + HEADER_H + optionIndex * (OPTION_H + OPTION_GAP) + OPTION_H / 2

  const classify = (e: GEdge, s: LayoutNode, t: LayoutNode): LayoutEdge["kind"] => {
    if (e.back || t.row < s.row || (t.row === s.row && t.col === s.col)) return "gutter"
    return t.row === s.row ? "across" : "down"
  }

  // Spread arrival points of downward edges across the target's top edge.
  const arrivals = new Map<string, GEdge[]>()
  for (const e of edges) {
    const s = nodeById.get(e.src)
    const t = nodeById.get(e.dst)
    if (!s || !t || classify(e, s, t) !== "down") continue
    if (!arrivals.has(e.dst)) arrivals.set(e.dst, [])
    arrivals.get(e.dst)!.push(e)
  }
  const arrivalX = new Map<string, number>()
  const arrivalShift = new Map<string, number>()
  for (const [dst, list] of arrivals) {
    const t = nodeById.get(dst)!
    list.sort((a, b) => {
      const sa = nodeById.get(a.src)!
      const sb = nodeById.get(b.src)!
      return sa.x - sb.x || anchorY(sa, a.optionIndex) - anchorY(sb, b.optionIndex)
    })
    const step = Math.min(24, (CARD_W * 0.6) / list.length)
    list.forEach((e, i) => {
      const offset = i - (list.length - 1) / 2
      arrivalX.set(e.id, t.x + t.w / 2 + offset * step)
      arrivalShift.set(e.id, offset * 5)
    })
  }

  const gutterUse = new Map<number, number>()
  const channelUse = new Map<number, number>()
  const routed: LayoutEdge[] = []
  for (const e of edges) {
    const s = nodeById.get(e.src)
    const t = nodeById.get(e.dst)
    if (!s || !t) continue
    const kind = classify(e, s, t)
    const ay = anchorY(s, e.optionIndex)
    let d: string
    let lx: number
    let ly: number
    let labelAnchor: LayoutEdge["labelAnchor"] = "middle"
    if (kind === "down") {
      // Out the side facing the target, down the channel in the column gap,
      // across in the row gap just above the target, then into its top.
      const goLeft = t.col < s.col
      const gap = goLeft ? s.col - 1 : s.col
      const k = channelUse.get(gap) ?? 0
      channelUse.set(gap, k + 1)
      const sx = goLeft ? s.x : s.x + s.w
      const cx = colX(gap) + CARD_W + CHANNEL_OFFSET + GUTTER_STEP * (k % CHANNEL_LANES)
      const tx = arrivalX.get(e.id)!
      const my = t.y - ROW_GAP / 2 + arrivalShift.get(e.id)!
      d = roundedPath([
        [sx, ay],
        [cx, ay],
        [cx, my],
        [tx, my],
        [tx, t.y],
      ])
      lx = goLeft ? cx - 6 : cx + 6
      ly = (ay + my) / 2
      labelAnchor = goLeft ? "end" : "start"
    } else if (kind === "across") {
      const goLeft = t.col < s.col
      const sx = goLeft ? s.x : s.x + s.w
      const tx = goLeft ? t.x + t.w : t.x
      const ty = t.y + HEADER_H / 2
      const mx = (sx + tx) / 2
      d = `M ${sx} ${ay} C ${mx} ${ay}, ${mx} ${ty}, ${tx} ${ty}`
      lx = mx
      ly = (ay + ty) / 2
    } else {
      const gcol = Math.min(s.col, t.col)
      const k = gutterUse.get(gcol) ?? 0
      gutterUse.set(gcol, k + 1)
      const gx = Math.min(s.x, t.x) - GUTTER_OFFSET - GUTTER_STEP * k
      const sx = s.x
      const tx = t.x
      const ty = t.y + HEADER_H / 2
      const r = 8
      const dir = ty < ay ? -1 : 1
      d = [
        `M ${sx} ${ay}`,
        `H ${gx + r}`,
        `Q ${gx} ${ay} ${gx} ${ay + dir * r}`,
        `V ${ty - dir * r}`,
        `Q ${gx} ${ty} ${gx + r} ${ty}`,
        `H ${tx}`,
      ].join(" ")
      // Rendered rotated along the gutter line.
      lx = gx - 6
      ly = (ay + ty) / 2
    }
    routed.push({
      id: e.id,
      src: e.src,
      dst: e.dst,
      fromStep: e.fromStep,
      toStep: e.toStep,
      optionId: e.optionId,
      action: e.action,
      back: e.back,
      kind,
      d,
      labelX: lx,
      labelY: ly,
      labelAnchor,
      label: truncate(e.action.description || e.action.name, LABEL_MAX),
    })
  }

  // ── Spine bands and group boxes ──
  const spines: SpineBand[] = []
  for (const name of [MAIN, ...otherSpines]) {
    const onSpine = nodes.filter((n) => n.spine === name && !n.pinned)
    if (!onSpine.length) continue
    spines.push({
      name,
      label: spineCfg[name]?.label ?? (name === MAIN ? "Main" : name),
      x: colX(bandCol.get(name)!.col),
      top: Math.min(...onSpine.map((n) => n.y)),
      bottom: Math.max(...onSpine.map((n) => n.y + n.h)),
    })
  }
  const groupMembers = new Map<string, LayoutNode[]>()
  for (const n of nodes) {
    if (n.kind !== "step") continue
    const g = stepHints[n.id]?.group
    if (!g) continue
    if (!groupMembers.has(g)) groupMembers.set(g, [])
    groupMembers.get(g)!.push(n)
  }
  const groups: GroupBox[] = [...groupMembers].map(([name, ns]) => {
    const pad = 12
    const x0 = Math.min(...ns.map((n) => n.x)) - pad
    const y0 = Math.min(...ns.map((n) => n.y)) - pad - 16
    const x1 = Math.max(...ns.map((n) => n.x + n.w)) + pad
    const y1 = Math.max(...ns.map((n) => n.y + n.h)) + pad
    return { name, label: groupCfg[name]?.label ?? name, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  })

  const gridCols: { col: number; x: number }[] = []
  for (let c = firstCol; c <= lastCol; c++) gridCols.push({ col: c, x: colX(c) })
  const gridRows = rowH.map((h, r) => ({ row: r, y: rowY[r], h }))

  return {
    nodes,
    edges: routed,
    spines,
    groups,
    tray,
    nodeOfStep,
    grid: { cols: gridCols, rows: gridRows },
    width: colX(lastCol) + CARD_W + SIDE_PAD,
    height: y - ROW_GAP + TOP_PAD,
    warnings: { staleHints, messages },
  }
}

/** SVG path through orthogonal points with rounded corners. */
function roundedPath(pts: [number, number][], radius = 8): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    const r = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2)
    const inX = x - Math.sign(x - px) * r
    const inY = y - Math.sign(y - py) * r
    const outX = x + Math.sign(nx - x) * r
    const outY = y + Math.sign(ny - y) * r
    d += ` L ${inX} ${inY} Q ${x} ${y} ${outX} ${outY}`
  }
  const [lx, ly] = pts[pts.length - 1]
  return d + ` L ${lx} ${ly}`
}

/** Nodes and edges reachable from an option (the option's own edges included). */
export function downstreamOf(layout: FlowLayout, optionId: string): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>()
  const edgeIds = new Set<string>()
  const outs = new Map<string, LayoutEdge[]>()
  for (const e of layout.edges) {
    if (!outs.has(e.src)) outs.set(e.src, [])
    outs.get(e.src)!.push(e)
  }
  const queue: string[] = []
  for (const e of layout.edges) {
    if (e.optionId !== optionId) continue
    edgeIds.add(e.id)
    if (!nodes.has(e.dst)) {
      nodes.add(e.dst)
      queue.push(e.dst)
    }
  }
  while (queue.length) {
    const u = queue.shift()!
    for (const e of outs.get(u) ?? []) {
      edgeIds.add(e.id)
      if (!nodes.has(e.dst)) {
        nodes.add(e.dst)
        queue.push(e.dst)
      }
    }
  }
  return { nodes, edges: edgeIds }
}
