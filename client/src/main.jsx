import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { UIProvider } from './contexts/UIContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { SummaryProvider } from './contexts/SummaryContext.jsx'
import QueryProvider from './providers/QueryProvider.jsx'

window.addEventListener('error', (event) => {
  if (event.filename && event.filename.includes('h1-check')) {
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      event.reason.message.includes('Cannot convert undefined or null to object')) {
    event.preventDefault();
    return false;
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <UIProvider>
              <SummaryProvider>
                <App />
              </SummaryProvider>
            </UIProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
)
