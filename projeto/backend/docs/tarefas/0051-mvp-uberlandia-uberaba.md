# Tarefa 0051: Área do MVP informada (região de Uberlândia e Uberaba)

- **Identificador:** `0051`
- **Título:** O app diz com clareza que esta primeira versão (MVP) funciona na região de Uberlândia e Uberaba (MG) e que vamos ampliar para todo o Triângulo Mineiro
- **Status:** Concluída
- **Prioridade:** Alta (decisão do time em 15/11/2026)
- **PRD:** RF-35 "Área do MVP informada" e a frase de escopo do MVP (seção 1)
- **Módulos Afetados:** só front: `src/i18n/messages.{pt,en}.ts`, `views/StartView.tsx` (e o `.module.css`), `views/WhereView.tsx`, `views/MethodView.tsx`, `views/GuideView.tsx`
- **Referências:** `projeto/frontend/AGENTS.md` ("Área piloto"), tarefa 0041 (`GET /api/area-piloto`)

---

## 1. Decisão

A área do app **não muda**. O MVP fica na área piloto de hoje, a região de Uberlândia e Uberaba:
latitude de −19,9 a −18,4 e longitude de −49,0 a −47,5 (`PILOT_*` do `app/constants.py`, servidos por
`GET /api/area-piloto`). Para um hackathon, uma área pequena e bem preparada vale mais que uma área
grande pela metade.

O que muda é o texto: o app passa a dizer qual é a área desta primeira versão e que vamos ampliar.
Ampliar para todo o Triângulo Mineiro fica no roadmap (PRD, seção 1, "Área do MVP").

Antes desta decisão, o time pensou em aumentar a área para o retângulo do Triângulo (lat −20,5 a
−17,9, lon −51,1 a −47,0), primeiro de uma vez e depois por etapas com uma variável de ambiente. As
duas ideias foram descartadas no mesmo dia: nada delas entrou no código.

## 2. Textos trocados (antes e depois)

### Tela inicial

| Onde | Antes (pt) | Depois (pt) | Depois (en) |
| --- | --- | --- | --- |
| Selo da foto (`start.region`) | Triângulo Mineiro · MG | MVP · região de Uberlândia e Uberaba | MVP · Uberlândia and Uberaba region |
| Frase nova no texto, logo depois do resumo (`start.mvpNote`) | (não existia) | Nesta primeira versão (MVP), o app funciona na região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro. | This first version (MVP) works in the Uberlândia and Uberaba region (Minas Gerais, Brazil). We will expand to the whole Triângulo Mineiro. |

O público continua: "Para quem planta soja no Triângulo Mineiro" (en: "For soybean growers in the
Triângulo Mineiro, Brazil"). O selo da foto some no celular; por isso a frase do MVP fica também no
texto da tela, que aparece em qualquer tamanho.

Antes (en) do selo: "Triângulo Mineiro · MG".

### Onde fica a lavoura (`/onde`)

| Onde | Antes (pt) | Depois (pt) | Depois (en) |
| --- | --- | --- | --- |
| Frase nova logo abaixo do mapa e da legenda da linha tracejada, sempre visível (`where.mvpNote`) | (não existia) | Nesta primeira versão, o app funciona na região de Uberlândia e Uberaba (linha tracejada). Vamos ampliar para todo o Triângulo Mineiro. | This first version (MVP) works in the Uberlândia and Uberaba region (dashed line). We will expand to the whole Triângulo Mineiro. |
| Aviso do ponto fora da área (`where.outsideNotice`) | Por enquanto só temos dados da região de Uberlândia e Uberaba. | Por enquanto só temos dados da região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro. | For now we only have data for the Uberlândia and Uberaba region. We will expand to the whole Triângulo Mineiro. |
| Cartão "Ainda não chegamos aí" das telas seguintes (`where.outsideText`) | Por enquanto, os dados estão prontos só para a região de Uberlândia e Uberaba. Veja como funciona na fazenda de exemplo. | Por enquanto, os dados estão prontos só para a região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro. Veja como funciona na fazenda de exemplo. | For now, the data is ready only for the Uberlândia and Uberaba region. We will expand to the whole Triângulo Mineiro. See how it works on the example farm. |

Antes (en): "For now we only have data for the Uberlândia and Uberaba region." e "For now, the data is
ready only for the Uberlândia and Uberaba region. See how it works on the example farm."

O título "Ainda não chegamos aí" (en: "We're not there yet") ficou: o "ainda" já diz que vamos chegar,
e o texto logo abaixo diz que vamos ampliar.

### Como a conta é feita

| Onde | Antes | Depois (pt) | Depois (en) |
| --- | --- | --- | --- |
| Logo abaixo do título "De onde vem cada dado", mesmo antes de as fontes chegarem (`method.sourcesArea`) | (não existia) | Nesta primeira versão (MVP), os dados estão prontos para a região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro. | This first version (MVP) has data ready for the Uberlândia and Uberaba region (Minas Gerais, Brazil). We will expand to the whole Triângulo Mineiro. |

### Guia

| Onde | Antes | Depois (pt) | Depois (en) |
| --- | --- | --- | --- |
| Página inicial do Guia, logo abaixo do título (`guide.mvpArea`) | (não existia) | Nesta primeira versão (MVP), o app funciona na região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro. | This first version (MVP) works in the Uberlândia and Uberaba region (Minas Gerais, Brazil). We will expand to the whole Triângulo Mineiro. |

Os artigos não mudaram. O artigo "Como ler o raio-X da sua terra" (o que diz de onde vem cada dado)
já está perto do limite de 300 palavras do Guia: com a frase, passaria do limite. Por isso a frase
fica na página inicial do Guia.

## 3. O que não mudou

- A área (`PILOT_*`), o `GET /api/area-piloto` e o bloqueio do "Confirmar local" fora dela.
- Backend: as mensagens 404 `OUTSIDE_AREA` ("Ainda não temos dados preparados para esse ponto. Veja a
  lavoura de demonstração.") e o `GET /api/metodo` não descrevem a área. A mensagem 422 dos relatos da
  comunidade fora da área ("O ponto fica fora da área piloto (região de Uberlândia e Uberaba).") já
  diz a área certa e o front não a mostra (usa o próprio texto pelo `code`).
- A fazenda de exemplo (lavoura de demonstração, perto de Uberlândia) e os textos que falam do Triângulo como região do problema.

## 4. Testes (TDD)

Cada teste foi escrito antes e falhou pelo motivo certo:

- `views/StartView.test.tsx`: o selo "MVP · região de Uberlândia e Uberaba", o público mantido e a
  frase do MVP; em inglês, o selo e a frase.
- `views/WhereView.test.tsx`: a frase do MVP sempre visível junto do mapa, com o ponto dentro da área
  (sem o cartão de fora); o aviso de fora da área diz que vamos ampliar; em inglês, as duas frases.
- `views/SatelliteView.test.tsx`: o cartão "Ainda não chegamos aí" diz que vamos ampliar.
- `views/MethodView.test.tsx`: "De onde vem cada dado" diz a área do MVP enquanto as fontes carregam;
  em inglês também.
- `views/GuideView.test.tsx`: a página inicial do Guia diz a área do MVP, em pt e en.

Checagens: `npm test` (115 arquivos, 1050 testes), `npm run lint` (sem erro; 1 aviso antigo em
`useMissionController.ts`), `npm run build` e `pre-commit run --all-files`.
