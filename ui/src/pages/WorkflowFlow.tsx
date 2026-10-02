import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EMPTY_HINTS, type StepHint, type WorkflowHints } from "@/types/hints"
import type { WorkflowDetail } from "@/types/workflow"
import { InspectPanel } from "@/flow/InspectPanel"
import { SpineCanvas, StepHeader, type Selection } from "@/flow/SpineCanvas"
import { patchGroup, patchStepHint, removeStepHints } from "@/flow/hints"
import { downstreamOf, layoutWorkflow } from "@/flow/spineLayout"

type SaveState = "idle" | "saving" | "saved" | "error"

export function WorkflowFlowPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  const [hints, setHints] = useState<WorkflowHints>(EMPTY_HINTS)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [showAllLabels, setShowAllLabels] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/v1/workflow/${id}`).then((r) => {
        if (!r.ok) throw new Error("Workflow not found")
        return r.json()
      }),
      fetch(`/api/v1/workflow/${id}/hints`).then((r) => {
        if (!r.ok) throw new Error("Could not load layout hints")
        return r.json()
      }),
    ])
      .then(([wf, h]) => {
        setWorkflow(wf)
        setHints({ ...EMPTY_HINTS, ...h })
      })
      .catch((e: Error) => setError(e.message))
  }, [id])

  const layout = useMemo(
    () => (workflow ? layoutWorkflow(workflow, hints, { editing }) : null),
    [workflow, hints, editing]
  )

  const highlight = useMemo(() => {
    if (!layout || selection?.type !== "option") return null
    return { optionId: selection.optionId, ...downstreamOf(layout, selection.optionId) }
  }, [layout, selection])

  function saveHints(next: WorkflowHints) {
    setHints(next)
    setSaveState("saving")
    fetch(`/api/v1/workflow/${id}/hints`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((r) => setSaveState(r.ok ? "saved" : "error"))
      .catch(() => setSaveState("error"))
  }

  const patchStep = (stepName: string, patch: Partial<StepHint>) => saveHints(patchStepHint(hints, stepName, patch))

  if (error) return <div className="p-8 text-destructive">{error}</div>
  if (!workflow || !layout) return <div className="p-8 text-muted-foreground">Loading…</div>

  const { staleHints, messages } = layout.warnings

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ "--primary": "#ffbdd5", "--primary-foreground": "#4a1026" } as React.CSSProperties}
    >
      <header className="sticky top-0 left-0 z-40 flex h-14 items-center justify-between gap-4 border-b bg-background px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(`/workflow/${workflow.id}`)}>
            ← Grid view
          </Button>
          <h1 className="text-lg font-semibold truncate">{workflow.display_name}</h1>
          <Badge variant="secondary" className="uppercase text-xs">{workflow.us_state}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showAllLabels} onChange={(e) => setShowAllLabels(e.target.checked)} />
            Show all action names
          </label>
          {editing && (
            <span className="text-xs text-muted-foreground">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && `Saved to hints/${workflow.name}.json`}
              {saveState === "error" && <span className="text-destructive">Save failed</span>}
            </span>
          )}
          <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing(!editing)}>
            {editing ? "Done editing" : "Edit layout"}
          </Button>
        </div>
      </header>

      {staleHints.length > 0 && (
        <div className="flex items-center gap-3 border-b bg-amber-50 px-6 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            Hints reference {staleHints.length} step{staleHints.length > 1 ? "s" : ""} that no longer exist:{" "}
            <span className="font-mono">{staleHints.join(", ")}</span>
          </span>
          <Button size="xs" variant="outline" onClick={() => saveHints(removeStepHints(hints, staleHints))}>
            Remove stale hints
          </Button>
        </div>
      )}
      {messages.length > 0 && (
        <details className="border-b bg-muted/40 px-6 py-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">{messages.length} layout warning(s)</summary>
          <ul className="mt-1 list-disc pl-5 font-mono">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-1">
        <main className={`flex-1 ${selection ? "pr-80" : ""}`} onClick={(e) => e.target === e.currentTarget && setSelection(null)}>
          {editing && (
            <p className="px-6 pt-3 text-xs text-muted-foreground">
              Drag a step into an empty cell to pin it there. Select a step to set its spine, label, group, lane or row nudge.
            </p>
          )}
          <SpineCanvas
            layout={layout}
            selection={selection}
            highlight={highlight}
            editing={editing}
            showAllLabels={showAllLabels}
            onSelect={setSelection}
            onDrop={(node, cell) => patchStep(node.members[0].name, { pin: cell })}
          />
          {layout.tray.length > 0 && (
            <section className="border-t px-6 py-4">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Exits &amp; unconnected steps
              </h2>
              <div className="flex flex-wrap gap-3">
                {layout.tray.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-60 rounded-lg border bg-card text-left shadow-sm ${
                      selection?.nodeId === n.id ? "ring-2 ring-sky-400" : ""
                    }`}
                    onClick={() => setSelection({ type: "step", nodeId: n.id })}
                  >
                    <StepHeader node={n} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
        {selection && (
          <InspectPanel
            layout={layout}
            selection={selection}
            hints={hints}
            editing={editing}
            onSelect={setSelection}
            onPatchStep={patchStep}
            onToggleGroup={(group, collapsed) => {
              saveHints(patchGroup(hints, group, { collapsed }))
              setSelection(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
