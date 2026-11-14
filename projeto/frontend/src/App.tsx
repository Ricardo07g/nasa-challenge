import { createBrowserRouter, RouterProvider } from 'react-router'
import { I18nProvider } from './i18n/I18nProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

function App() {
  return (
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  )
}

export default App
