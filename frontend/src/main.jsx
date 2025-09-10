import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <div style={{padding:'16px'}}>
      <h1>MVP3 — 应用已正常挂载</h1>
      <p>如果你看到这句话，说明 React/Vite 首屏已成功。</p>
    </div>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
