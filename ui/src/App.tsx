import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom"
import { WorkflowList } from "@/pages/WorkflowList"
import { WorkflowEditPage } from "@/pages/WorkflowEdit"
import { WorkflowFlowPage } from "@/pages/WorkflowFlow"

// Flow is the default view at /workflow/:id; keep old /flow and /grid links working.
function RedirectToFlow() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/workflow/${id}`} replace />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkflowList />} />
        <Route path="/workflow/:id" element={<WorkflowFlowPage />} />
        <Route path="/workflow/:id/edit" element={<WorkflowEditPage />} />
        <Route path="/workflow/:id/flow" element={<RedirectToFlow />} />
        <Route path="/workflow/:id/grid" element={<RedirectToFlow />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
