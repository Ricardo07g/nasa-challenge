# Tarefa 0061: Cabeçalho com o Guia e a comunidade "em breve"

- **Identificador:** `0061`
- **Título:** A pílula "Comunidade" do cabeçalho vira "Guia" (livro, `/guia`), a página atual fica marcada
  (`aria-current`), e a comunidade sai da interface: `/comunidade` mostra só o cartão "Em breve" com o "Abrir o Guia"
- **Status:** Concluída
- **Prioridade:** Alta (pacote 3 de telas, passo 1)
- **PRD:** RF-44 (nova); notas nas RF-28, RF-36 e RF-38
- **Módulos Afetados:** só o front (`projeto/frontend/src`): `design-system/components/Header.tsx` e
  `Header.module.css`, `design-system/icons` (`BookIcon`), `design-system/tokens.css` (só o comentário do
  `--color-tint-green-hover`), `controllers/useShellController.ts`, `controllers/useCommunitySoonController.ts`
  (novo), `views/CommunitySoonView.tsx` e `.module.css` (novos), `controllers/useSatelliteController.ts`,
  `services/communityService.ts` (`COMMUNITY_OPEN`), `views/DesignSystemView.tsx`, `i18n/messages.{pt,en}.ts`
  (`header.guide` e o bloco novo `comingSoon`), `pages.tsx`, `routes.tsx`
- **Referências:** `pacote-3-cabecalho-comunidade-prompt.md`, `pacote-3-LEIA-ME.md`, `pacote-2-regras-gerais-prompt.md`
  e o cabeçalho dos protótipos `tela-6-planejamento.html`, `tela-7-avisos.html` e `tela-8-guia.html` (fora do
  repositório); tarefas 0052 (cabeçalho global), 0047 (comunidade) e 0054 (regras gerais)

---

## 1. O que mudou

- **Cabeçalho (todas as telas).** À direita, só **Guia**, Avisos e PT | EN. O Guia é a mesma pílula verde-clara de
  antes, com o ícone de livro (`BookIcon`, o `BookText` do Lucide, igual ao desenho dos protótipos) e o nome escrito
  também no celular; leva a `/guia`. A página atual fica marcada com `aria-current="page"` (o `NavLink`):
  - em `/guia` e nos artigos (`/guia/:artigo`), a pílula fica **verde cheia** com o texto branco;
  - em `/avisos` (com ou sem o ponto na URL), o sino ganha o **fundo verde-claro**. No computador, o respiro em volta
    do sino (10 px) é compensado por margem negativa, para nada mudar de lugar de uma página para outra.
  - Abaixo de 380 px, a pílula segue com 12,5 px (regra geral 8). Em 360 px: marca de 20 a 139 px, Guia de 210 a 276,
    sino de 278 a 312 e o idioma de 314 a 340 (20 px de margem), sem rolagem lateral.
- **`/comunidade` "em breve".** A rota continua (links antigos, com ou sem o caminho da lavoura) e mostra só o cartão
  "Em breve · Comunidade da sua região": "Um espaço para acompanhar a sua região junto com os vizinhos.", o que vai ter
  (o que os vizinhos plantaram depois da soja e como foi; quanto choveu em cada lavoura; granizo, fogo ou enxurrada
  perto de você; só a lista, sem link) e, ao lado, "Enquanto isso, o Guia explica cada cultura, o plantio e o clima."
  com o botão "Abrir o Guia" (livro). Em cima, o "← Voltar" (para a resposta, se o link trouxer o caminho; senão, a
  Início) e, perto do título, o "Ouvir resumo" (2 frases). Visual: o cartão claro do protótipo dos Avisos com a
  coluna do Guia da tela final, só com tokens que já existiam. `CommunitySoonPage` → `useCommunitySoonController` →
  `CommunitySoonView`.
- **Tela 4 (raio-X).** Sai o "Compartilhar com a comunidade" das safras respondidas (e o link para os relatos).
- **Vitrine `/design-system`.** Saem o cartão dos vizinhos (`NeighborDots`, `RainReadingRow`, `RegionMap`) e o botão
  "Contar como foi a minha"; a variante compacta do botão continua, agora com "Abrir o Guia".
- **Tela inicial:** não tinha link nem chamada para a comunidade; nada mudou.
- **Textos:** `header.community` virou `header.guide` ("Guia" / "Guide"); o cartão tem o bloco próprio `comingSoon`,
  logo depois do `header`, em pt e en.

## 2. O que continua no repositório (desligado)

O backend da comunidade não mudou (API de relatos, hash do aparelho, célula de 0,1°). No front, ficam o
`communityRepository`, o `deviceRepository`, o `communityService`, os models, o `CommunityForms`, o `ShareSeasons`, a
`CommunityView` com o `useCommunityController` e a `CommunityPage`, e os componentes dos vizinhos no design system,
todos com os testes. Quem desliga é uma constante só, `COMMUNITY_OPEN = false` (`services/communityService.ts`):

- `routes.tsx` escolhe a tela de `/comunidade` (`CommunityPage` ou `CommunitySoonPage`);
- `useSatelliteController` só oferece compartilhar com ela ligada (`communityOpen` nas dependências, para os testes).

Para voltar: trocar para `true` e decidir onde a Comunidade entra no cabeçalho (o Guia fica). O lint não reclamou de
nada que ficou sem uso (o oxlint não olha export sem uso), então nada precisou de ajuste.

## 3. Decisões

- **Voltar e "Ouvir resumo" em `/comunidade`:** o prompt diz "só o cartão e o botão"; as regras gerais (que continuam
  valendo) pedem o "← Voltar" em toda tela interna e o "Ouvir resumo" em toda tela. Entraram os dois, fora do
  conteúdo do cartão (o Voltar em cima; o "Ouvir resumo" discreto, perto do título). Nenhum outro elemento.
- **O Guia do cabeçalho leva a `/guia` sem o caminho da lavoura** (a Comunidade levava): o Guia é o mesmo para
  todos, e o prompt pede "leva a `/guia`".
- **A pílula fica marcada também nos artigos** (`/guia/:artigo`), como no protótipo da tela 8, que marca a pílula
  em todas as vistas do Guia.
- **Sino marcado no computador:** o protótipo só pinta o fundo; sem respiro, o fundo colava no texto. Ganhou 10 px
  de respiro com margem negativa (o texto não sai do lugar).
- **Uma constante em vez de apagar:** `COMMUNITY_OPEN` deixa a volta num lugar só, sem perder os testes.
- **Textos do cartão:** os do protótipo dos Avisos (o texto não repete o "Em breve" da etiqueta) e os do Guia da
  tela final ("Enquanto isso…", "Abrir o Guia").

## 4. Testes (TDD)

| Teste | Red |
| --- | --- |
| `Header.test.tsx`: só Guia, Avisos e o idioma; o livro; `/guia`; `aria-current` em `/guia`, nos artigos e em `/avisos` | 10 falhas (o componente ainda lia `community`) |
| `useShellController.test.ts`: `header.guide` = `/guia`, sem `community`; `I18nProvider.test.tsx` com `header.guide` | 6 falhas |
| `routes.test.tsx`: o Guia do cabeçalho abre o Guia e fica marcado; o sino marcado em `/avisos`; o cabeçalho de `/`, `/onde`, `/guia`, `/avisos`, `/comunidade` e `/satelite` sem Comunidade | integração, escrita junto com o código do cabeçalho |
| `useCommunitySoonController.test.ts`: Guia, Voltar com e sem o caminho, "Ouvir resumo" em pt e en | módulo inexistente |
| `CommunitySoonView.test.tsx`: o cartão, a lista, "Abrir o Guia" com o livro, nenhum relato nem formulário, Voltar e "Ouvir resumo", en | módulo inexistente |
| `routes.test.tsx`: `/comunidade` só com o "Em breve" e o título da aba; o link antigo com o caminho | 2 falhas |
| `communityService.test.ts`: `COMMUNITY_OPEN` é `false` | 1 falha |
| `useSatelliteController.test.ts`: com a comunidade fechada (e por padrão), não oferece compartilhar | 1 falha |
| `pages.satellite.test.tsx`: a tela 4 inteira, com safra respondida, sem "Compartilhar" nem link para `/comunidade` | conferido ligando o `COMMUNITY_OPEN`: falha |
| `DesignSystemView.test.tsx`: a vitrine sem vizinhos, comunidade nem "Contar" | 1 falha |

`npm test` (1227 testes), `npm run lint` (só o aviso antigo do `useMissionController`), `npm run build` e
`pre-commit run --all-files` passando.

## 5. Conferência visual

API deste worktree na porta 8012 (cópia do banco), front na 5195, Chrome headless. O cabeçalho em `/`, `/guia`,
`/avisos`, `/comunidade` (também com o caminho da lavoura) e `/satelite` da lavoura de demonstração, em 1280, 390 e
360 px, em pt e en, com e sem o selo de avisos: `scrollWidth` igual à largura em todos os casos, a pílula verde cheia
só no Guia e o fundo verde-claro do sino só nos Avisos.

## 6. Riscos

- **Conflito com os agentes de `/avisos`, `/planejamento` e `/guia` (em paralelo):** os três devem mexer em
  `i18n/messages.{pt,en}.ts` (este passo só trocou `header.community` por `header.guide` e pôs o bloco `comingSoon`
  logo depois do `header`), no `design-system/icons` (se criarem outro ícone de livro, fica um só: `BookIcon`), no
  `routes.test.tsx`, no `pages.tsx` (a `GuidePage` ainda tem `backTo="/comunidade"`, que agora cai no "Em breve") e
  nas mesmas linhas do PRD (RF-43 em diante), do `README.md` das tarefas e do `AGENTS.md` do front.
- **Fora deste passo, ainda falam dos relatos:** o grupo "Perto de você" dos Avisos (o agente de `/avisos` tira), o
  artigo `como-ler-os-avisos` do Guia ("Perto de você"), o texto da regra dos avisos em "Como a conta é feita"
  ("relatos de vizinhos dos últimos N dias", tela ainda não revista) e o `alerts` do `AGENTS.md` do front. Nenhum
  leva aos relatos.
- O backend continua contando os relatos nos avisos (`vizinho_evento`) e no contador do sino; com o grupo fora da
  tela, o número do sino pode contar um aviso que não aparece até o agente de `/avisos` ajustar.
