import { Navigate, type RouteObject } from 'react-router'
import {
  AnswerPage,
  DesignSystemPage,
  ExamplePage,
  PendingPage,
  SatellitePage,
  ShellPage,
  StartPage,
  WhenPage,
  WherePage,
} from './pages'

/** Uma URL por tela do protótipo v3; a URL guarda lat, lon e colheita (RF-18). */
export const routes: RouteObject[] = [
  {
    element: <ShellPage />,
    children: [
      { path: '/', element: <StartPage /> },
      { path: '/onde', element: <WherePage /> },
      { path: '/quando', element: <WhenPage /> },
      { path: '/satelite', element: <SatellitePage /> },
      { path: '/resposta', element: <AnswerPage /> },
      { path: '/opcoes', element: <PendingPage screen="options" /> },
      { path: '/plano', element: <PendingPage screen="plan" /> },
      { path: '/comunidade', element: <PendingPage screen="community" /> },
      { path: '/como-funciona', element: <PendingPage screen="method" /> },
      { path: '/exemplo', element: <ExamplePage /> },
      ...(import.meta.env.DEV ? [{ path: '/design-system', element: <DesignSystemPage /> }] : []),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
