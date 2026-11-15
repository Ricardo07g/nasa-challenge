import { Navigate, type RouteObject } from 'react-router'
import {
  AnswerPage,
  CommunityPage,
  DesignSystemPage,
  ExamplePage,
  GuideArticlePage,
  GuidePage,
  MissionPage,
  OptionsPage,
  PastSeasonPage,
  PlanPage,
  ReportPage,
  MethodPage,
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
      { path: '/calculando', element: <MissionPage /> },
      { path: '/satelite', element: <SatellitePage /> },
      { path: '/resposta', element: <AnswerPage /> },
      { path: '/opcoes', element: <OptionsPage /> },
      { path: '/plano', element: <PlanPage /> },
      { path: '/relatorio', element: <ReportPage /> },
      { path: '/safra-passada', element: <PastSeasonPage /> },
      { path: '/comunidade', element: <CommunityPage /> },
      { path: '/guia', element: <GuidePage /> },
      { path: '/guia/:artigo', element: <GuideArticlePage /> },
      { path: '/como-funciona', element: <MethodPage /> },
      { path: '/exemplo', element: <ExamplePage /> },
      ...(import.meta.env.DEV ? [{ path: '/design-system', element: <DesignSystemPage /> }] : []),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
