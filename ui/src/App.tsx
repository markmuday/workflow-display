import { BrowserRouter, Routes, Route } from "react-router-dom"
import { WorkflowList } from "@/pages/WorkflowList"
import { WorkflowDetailPage } from "@/pages/WorkflowDetail"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkflowList />} />
        <Route path="/workflow/:id" element={<WorkflowDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
