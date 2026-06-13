import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// self-hosted fonts — export rendering never depends on the network
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/500-italic.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/eb-garamond/600-italic.css'
import '@fontsource/eb-garamond/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
