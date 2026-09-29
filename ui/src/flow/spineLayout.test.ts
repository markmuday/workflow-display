import { describe, expect, it } from "vitest"
import type { WorkflowDetail, WorkflowStep } from "@/types/workflow"
import type { WorkflowHints } from "@/types/hints"
import { downstreamOf, layoutWorkflow } from "./spineLayout"

// Shaped like or_matter_status: a main path with an objection detour that
// rejoins at GRANTED, a DENIED terminal fed from both, a back-edge, and
// edge-less exit statuses.
const GRAPH: [string, string[]][] = [
  ["START", ["PAID"]],
  ["PAID", ["DRAFT", "FINGERPRINT"]],
  ["FINGERPRINT", ["DRAFT"]],
  ["DRAFT", ["COURT"]],
  ["COURT", ["GRANTED", "OBJECTION"]],
  ["OBJECTION", ["RESPONSE", "DECLINED"]],
  ["DECLINED", ["DENIED"]],
  ["RESPONSE", ["HEARING"]],
  ["HEARING", ["RESPONSE", "CONFIRMATION"]],
  ["CONFIRMATION", ["GRANTED", "DENIED"]],
  ["GRANTED", ["DISENGAGED"]],
  ["DENIED", []],
  ["DISENGAGED", []],
  ["VOID", []],
]

function fixture(): WorkflowDetail {
  const steps = GRAPH.map(([name, targets], i) => ({
    id: `id-${name}`,
    name,
    display_name: name.toLowerCase(),
    ordinal: i,
    options: targets.map((t, j) => ({
      id: `opt-${name}-${t}`,
      name: `${name}_TO_${t}`,
      display_name: t,
      ordinal: j,
      actions: [{ id: `act-${name}-${t}`, name: `MOVE_TO_${t}`, description: null, next_workflow_step_name: t }],
    })),
  }))
  return { id: "wf", name: "test", steps: steps as unknown as WorkflowStep[] } as WorkflowDetail
}

const hints = (steps: WorkflowHints["steps"], extra: Partial<WorkflowHints> = {}): WorkflowHints => ({
  version: 1,
  steps,
  ...extra,
})

const TWO_SPINES = hints({
  START: { spine: "main" },
  PAID: { spine: "main" },
  DRAFT: { spine: "main" },
  COURT: { spine: "main" },
  GRANTED: { spine: "main" },
  DISENGAGED: { spine: "main" },
  OBJECTION: { spine: "objection" },
  RESPONSE: { spine: "objection" },
  HEARING: { spine: "objection" },
  CONFIRMATION: { spine: "objection" },
})

function place(h: WorkflowHints) {
  const layout = layoutWorkflow(fixture(), h)
  const at = Object.fromEntries(layout.nodes.map((n) => [n.id, n]))
  return { layout, at }
}

describe("layoutWorkflow", () => {
  it("puts edge-less steps in the tray", () => {
    const { layout } = place(hints({}))
    expect(layout.tray.map((n) => n.id)).toEqual(["VOID"])
  })

  it("falls back to the longest path to a non-exit terminal for main", () => {
    const { at } = place(hints({}))
    const main = Object.values(at).filter((n) => n.spine === "main").map((n) => n.id)
    expect(main).toContain("DISENGAGED")
    expect(main).not.toContain("DENIED")
    expect(at.START.autoSpine).toBe(true)
  })

  it("lays out hinted spines in their own columns, main at 0", () => {
    const { at } = place(TWO_SPINES)
    for (const id of ["START", "PAID", "DRAFT", "COURT", "GRANTED", "DISENGAGED"]) expect(at[id].col).toBe(0)
    const objCol = at.OBJECTION.col
    expect(objCol).toBeGreaterThan(0)
    for (const id of ["RESPONSE", "HEARING", "CONFIRMATION"]) expect(at[id].col).toBe(objCol)
  })

  it("keeps every forward edge pointing down or across (option A)", () => {
    const { layout, at } = place(TWO_SPINES)
    for (const e of layout.edges.filter((e) => !e.back)) {
      expect(at[e.dst].row).toBeGreaterThanOrEqual(at[e.src].row)
    }
    // GRANTED waits below the objection detour that rejoins it.
    expect(at.GRANTED.row).toBe(at.CONFIRMATION.row + 1)
  })

  it("starts a branch on the row it leaves from, in a lane beside its spine", () => {
    const { at } = place(TWO_SPINES)
    expect(at.FINGERPRINT.row).toBe(at.PAID.row)
    expect(at.FINGERPRINT.col).toBe(1)
    expect(at.DECLINED.row).toBe(at.OBJECTION.row)
    expect(at.DECLINED.col).toBe(at.OBJECTION.col + 1)
  })

  it("routes back-edges through the gutter", () => {
    const { layout } = place(TWO_SPINES)
    const back = layout.edges.filter((e) => e.back)
    expect(back.map((e) => `${e.fromStep}>${e.toStep}`)).toEqual(["HEARING>RESPONSE"])
    expect(back[0].kind).toBe("gutter")
  })

  it("applies rowNudge to a step and everything downstream of it", () => {
    const base = place(TWO_SPINES).at
    const nudged = place(hints({ ...TWO_SPINES.steps, DRAFT: { spine: "main", rowNudge: 2 } })).at
    expect(nudged.DRAFT.row).toBe(base.DRAFT.row + 2)
    expect(nudged.DISENGAGED.row).toBe(base.DISENGAGED.row + 2)
    expect(nudged.PAID.row).toBe(base.PAID.row)
  })

  it("pins a step to an exact cell", () => {
    const { at } = place(hints({ ...TWO_SPINES.steps, FINGERPRINT: { pin: { col: -1, row: 5 } } }))
    expect(at.FINGERPRINT).toMatchObject({ col: -1, row: 5, pinned: true })
  })

  it("does not let a pinned step push its successors down", () => {
    const base = place(TWO_SPINES).at
    const { at, layout } = place(hints({ ...TWO_SPINES.steps, FINGERPRINT: { pin: { col: 1, row: 5 } } }))
    expect(at.DRAFT.row).toBe(base.DRAFT.row)
    const up = layout.edges.find((e) => e.fromStep === "FINGERPRINT")!
    expect(up.kind).toBe("gutter")
  })

  it("honours lane and side hints", () => {
    const { at } = place(
      hints({ ...TWO_SPINES.steps, FINGERPRINT: { lane: 2 } }, { spines: { objection: { side: "left" } } })
    )
    expect(at.FINGERPRINT.col).toBe(2)
    expect(at.OBJECTION.col).toBeLessThan(0)
  })

  it("contracts collapsed groups into one node", () => {
    const { layout, at } = place(
      hints(
        { ...TWO_SPINES.steps, RESPONSE: { spine: "objection", group: "hearing" }, HEARING: { group: "hearing" } },
        { groups: { hearing: { label: "Hearing loop", collapsed: true } } }
      )
    )
    expect(at["group:hearing"].label).toBe("Hearing loop")
    expect(at.RESPONSE).toBeUndefined()
    expect(layout.nodeOfStep.HEARING).toBe("group:hearing")
    expect(layout.edges.some((e) => e.src === e.dst)).toBe(false)
  })

  it("reports hints for steps that no longer exist", () => {
    const { layout } = place(hints({ ...TWO_SPINES.steps, GONE: { spine: "main" } }))
    expect(layout.warnings.staleHints).toEqual(["GONE"])
  })
})

describe("downstreamOf", () => {
  it("collects everything reachable from an option", () => {
    const { layout } = place(TWO_SPINES)
    const { nodes } = downstreamOf(layout, "opt-OBJECTION-DECLINED")
    expect([...nodes].sort()).toEqual(["DECLINED", "DENIED"])
  })
})
