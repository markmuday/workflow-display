import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PlusIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Workflow } from "@/types/workflow"

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

function CreateWorkflowForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void
  onCancel: () => void
}) {
  const [displayName, setDisplayName] = useState("")
  const [name, setName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)
  const [usState, setUsState] = useState("")
  const [type, setType] = useState("matter")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleDisplayNameChange(val: string) {
    setDisplayName(val)
    if (!nameTouched) setName(slugify(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim() || !name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          name: name.trim(),
          description: description.trim() || null,
          us_state: usState.trim() || null,
          type: type || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to create workflow")
      const wf = await res.json()
      onCreated(wf.id)
    } catch {
      setError("Failed to create workflow. Please try again.")
      setSubmitting(false)
    }
  }

  const canSubmit = displayName.trim() && name.trim() && !submitting

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base">New workflow</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Display name *</label>
              <Input
                placeholder="AZ Legal Workflow"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Internal name *</label>
              <Input
                placeholder="az_legal_workflow"
                value={name}
                onChange={(e) => {
                  setNameTouched(true)
                  setName(e.target.value)
                }}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">State</label>
              <Input
                placeholder="AZ"
                value={usState}
                onChange={(e) => setUsState(e.target.value.toUpperCase())}
                className="h-8 text-sm"
                maxLength={5}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              >
                <option value="matter">matter</option>
                <option value="client">client</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              placeholder="Optional description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm min-h-0 h-16"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {submitting ? "Creating…" : "Create workflow"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function WorkflowList() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Workflows</h1>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PlusIcon className="size-3.5 mr-1" />
            New workflow
          </Button>
        )}
      </div>

      {showCreate && (
        <CreateWorkflowForm
          onCreated={(id) => navigate(`/workflow/${id}/edit`)}
          onCancel={() => setShowCreate(false)}
        />
      )}

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
