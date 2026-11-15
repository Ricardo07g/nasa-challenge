import { Navigate, type RouteObject } from 'react-router'
import {
  AvisosPage,
  ChoosePlanPage,
  CommunityPage,
  DesignSystemPage,
  ExamplePage,
  GuideArticlePage,
  GuidePage,
  LegacyAnswerRedirect,
  MissionPage,
  PlanningPage,
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
      // Tela 5 do pacote 2: "1. Escolher" e "2. Plano de 3 anos" na mesma tela; /plano abre a aba do plano.
      { path: '/resposta', element: <ChoosePlanPage /> },
      { path: '/opcoes', element: <ChoosePlanPage /> },
      { path: '/plano', element: <ChoosePlanPage /> },
      // Tarefa 0058: a tela final; por enquanto, os blocos que saíram do raio-X.
      { path: '/planejamento', element: <PlanningPage /> },
      // Tarefa 0044: o relatório saiu e a safra passada virou o detalhe do ano na Sugestão; os
      // endereços antigos levam para a Sugestão com o mesmo caminho (e o ano, na safra passada).
      { path: '/relatorio', element: <LegacyAnswerRedirect /> },
      { path: '/safra-passada', element: <LegacyAnswerRedirect keepYear /> },
      { path: '/comunidade', element: <CommunityPage /> },
      { path: '/avisos', element: <AvisosPage /> },
      { path: '/guia', element: <GuidePage /> },
      { path: '/guia/:artigo', element: <GuideArticlePage /> },
      { path: '/como-funciona', element: <MethodPage /> },
      { path: '/exemplo', element: <ExamplePage /> },
      ...(import.meta.env.DEV ? [{ path: '/design-system', element: <DesignSystemPage /> }] : []),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
