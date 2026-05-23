import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './app/providers/ThemeProvider.jsx'

// Theme CSS — load order matters. themes.css defines --color-* tokens per
// data-theme block, tokens.css defines theme-agnostic primitives plus the
// legacy --bg-*/--text-* aliases that the existing CSS modules use, and
// globals.css applies base resets that rely on both.
import './theme/themes.css'
import './theme/tokens.css'
import './theme/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
