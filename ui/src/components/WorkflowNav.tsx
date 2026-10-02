import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

export type WorkflowView = "flow" | "edit"

const VIEWS: { view: WorkflowView; label: string; path: (id: string) => string }[] = [
  { view: "flow", label: "Flow", path: (id) => `/workflow/${id}` },
  { view: "edit", label: "Edit", path: (id) => `/workflow/${id}/edit` },
]

// Back link to the workflow list plus tabs for switching between a workflow's views.
// When `unsavedChanges` is set, leaving the current view asks for confirmation first.
export function WorkflowNav({
  workflowId,
  current,
  unsavedChanges = false,
}: {
  workflowId: string
  current: WorkflowView
  unsavedChanges?: boolean
}) {
  const navigate = useNavigate()

  function go(path: string) {
    if (unsavedChanges && !window.confirm("You have unsaved changes. Leave without saving?")) return
    navigate(path)
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => go("/")}>
        ← Workflows
      </Button>
      <nav className="inline-flex rounded-md bg-muted p-0.5" aria-label="Workflow views">
        {VIEWS.map(({ view, label, path }) => (
          <button
            key={view}
            type="button"
            aria-current={view === current ? "page" : undefined}
            onClick={() => view !== current && go(path(workflowId))}
            className={
              "rounded px-3 py-1 text-xs font-medium transition-colors " +
              (view === current
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
