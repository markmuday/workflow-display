import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Workflow } from "@/types/workflow"

export function WorkflowList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch("/api/v1/workflow")
      .then((r) => r.json())
      .then((data) => {
        setWorkflows(data)
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load workflows")
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (error) return <div className="p-8 text-destructive">{error}</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Workflows</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((wf) => (
          <Card
            key={wf.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/workflow/${wf.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{wf.display_name}</CardTitle>
                <Badge variant="secondary" className="shrink-0 uppercase text-xs">
                  {wf.us_state}
                </Badge>
              </div>
              {wf.description && (
                <CardDescription>{wf.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-xs">
                {wf.type}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
