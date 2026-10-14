import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pwaManager } from './pwa/pwaManager'

// Start listening for install / update events before React renders (a beforeinstallprompt fired early is otherwise lost)
pwaManager.init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
