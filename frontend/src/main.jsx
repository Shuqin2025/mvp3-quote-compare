import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <div style={{ padding: '1rem' }}>
      <h1>MVP3 — App</h1>
      <p>如果你看到这段话，说明 React/Vite 已成功挂载到 #root。</p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
