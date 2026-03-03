import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WorkflowList } from "@/pages/WorkflowList"
import { WorkflowDetailPage } from "@/pages/WorkflowDetail"
import { WorkflowEditPage } from "@/pages/WorkflowEdit"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkflowList />} />
        <Route path="/workflow/:id" element={<WorkflowDetailPage />} />
        <Route path="/workflow/:id/edit" element={<WorkflowEditPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
