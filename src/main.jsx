import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register the service worker — silently auto-updates in the background
const updateSW = registerSW({
  onNeedRefresh() {
    // App has updated; reload silently (or you can prompt the user)
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[Nexus PWA] Ready to work offline')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
