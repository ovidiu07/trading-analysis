import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { I18nProvider } from './i18n'
import { DemoDataProvider } from './features/demo/DemoDataContext'
import { initializeAnalytics } from './utils/analytics/ga4'
import { ThemeModeProvider } from './themeMode'

const client = new QueryClient()
initializeAnalytics()

const router = createBrowserRouter([
  {
    path: '*',
    element: (
        <AuthProvider>
          <I18nProvider>
            <DemoDataProvider>
              <ThemeModeProvider>
                <App />
              </ThemeModeProvider>
            </DemoDataProvider>
          </I18nProvider>
        </AuthProvider>
    ),
  },
])

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
