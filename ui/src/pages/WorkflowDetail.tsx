import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WorkflowGrid } from "@/components/WorkflowGrid"
import type { WorkflowDetail } from "@/types/workflow"

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/v1/workflow/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found")
        return r.json()
      })
      .then((data) => {
        setWorkflow(data)
        setLoading(false)
      })
      .catch(() => {
        setError("Workflow not found")
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (error || !workflow) return <div className="p-8 text-destructive">{error}</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/")}>
          ← Back
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{workflow.display_name}</h1>
          <Badge variant="secondary" className="uppercase text-xs">{workflow.us_state}</Badge>
          <Badge variant="outline" className="text-xs">{workflow.type}</Badge>
        </div>
        {workflow.description && (
          <p className="text-muted-foreground mt-1 text-sm">{workflow.description}</p>
        )}
      </div>

      <WorkflowGrid workflow={workflow} />
    </div>
  )
}
