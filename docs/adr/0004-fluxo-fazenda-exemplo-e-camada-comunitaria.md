# ADR 0004: Fluxo da Fazenda Exemplo, Dados Comunitários e Escopo Pós-MVP

- **Status:** Aceito
- **Data:** 2026-11-14
- **Decisores:** Time Raiz Orbital (Frontend, Backend, Design de Produto)
- **Contexto:** `projeto/frontend/src/routes.tsx`, `projeto/frontend/src/models/community.ts`, `arquivos contexto/Raiz Orbital – Protótipo das telas.html`, `projeto/backend/docs/historias-de-usuario.md`

---

## 1. Contexto e Problema

O produto Raiz Orbital foi concebido com uma premissa forte de usabilidade rápida: **"2 perguntas, 1 resposta em menos de 10 segundos"**, com opção de teste imediato via **"Testar com fazenda exemplo"** (para produtores sem coordenadas à mão e para os juízes do Hackathon avaliarem a ferramenta em 1 clique).

Durante a auditoria cruzada entre frontend, backend docs e protótipo, identificaram-se três pontos de divergência arquitetural:

1. **Roteamento e Obtenção da Fazenda Exemplo:**
   - No frontend (`src/routes.tsx` e `src/repositories/exemploRepository.ts`), a rota `/exemplo` foi implementada como um redirecionamento imediato para `/resposta?exemplo=true`, lendo dados das fixtures locais (`src/repositories/mocks/fixtures.ts`).
   - Nos documentos do backend (`diagrama-de-sequencias.md` e plano técnico), previu-se um endpoint `GET /api/exemplo` que devolveria os dados cadastrais da Fazenda Santa Luzia pré-configurada.

2. **Tela 8 ("Perto de Você" / Dados Comunitários):**
   - O Protótipo HTML (v3) e o arquivo `src/models/community.ts` no frontend exibem estatísticas do tipo: *"68% dos produtores na sua região escolheram Milho + Braquiária na última safra"* e *"Tendência de consórcio cresceu 22%"*.
   - No entanto, a modelagem de banco do backend não possui tabelas de telemetria social ou rede de produtores, pois o MVP preza por não exigir login, cadastro prévio ou rastreamento de dados de outros produtores.

3. **Parâmetro de Pecuária Integrada (`gado=sim`):**
   - O protótipo v3 contempla a pergunta *"Tem gado na fazenda? (sim/não)"* para ponderar consórcio milho-braquiária com produção de palhada e forragem para pastejo de inverno.
   - O modelo de parâmetros do frontend precisa estar estritamente mapeado com a regra de negócio do motor no backend.

---

## 2. Decisão

1. **Unificação do Fluxo da Fazenda Exemplo:**
   - O backend disponibilizará o endpoint canônico:
     ```http
     GET /api/exemplo -> { "talhao": TalhaoResponse, "recomendacao": RecomendacaoResponse }
     ```
   - No frontend:
     - A rota `/exemplo` faz o fetch de `GET /api/exemplo` quando a API estiver conectada, e utiliza o fallback offline de `fixtures.ts` caso o backend esteja indisponível.
     - Redireciona o usuário para `/resposta?exemplo=true`, preenchendo todos os cards com a Fazenda Santa Luzia (Uberlândia/MG - Triângulo Mineiro).
     - Isso garante demonstração perfeita tanto em ambiente integrado quanto em modo offline/apresentação (pitch dos juízes).

2. **Isolamento da Camada Comunitária ("Perto de Você") como Mock no Frontend no MVP:**
   - Fica acordado que a Tela 8 ("Perto de você" - estatísticas comunitárias regionais) é **puramente informativa e computada via mocks/heurísticas no frontend** para o MVP.
   - O backend **não** implementará banco de dados de usuários compartilhados nem agregador social no MVP, evitando escopo inflado e preocupações de LGPD durante a apresentação do hackathon.
   - No futuro (v2), as escolhas anônimas salvas com feedback do produtor alimentarão a tabela de consolidação regional.

3. **Pecuária / Pastejo (`gado`) Tratado como Parâmetro Opcional:**
   - O parâmetro `gado` (`boolean` ou `'sim' | 'nao'`) é aceito opcionalmente no endpoint `/recomendacao`.
   - Quando `gado=true`, o motor de regras (`ScoreEngine`) aplica bônus de aptidão na cultura `milho_braquiaria` (+15 pontos de sinergia com pecuária) e penaliza pousio. Quando omitido ou `false`, o cálculo segue estritamente água, solo, janela e nematoides.

---

## 3. Consequências

### Positivas
- **Garantia de Demonstração em Pitch:** Os juízes conseguem rodar a fazenda exemplo em 1 clique sem depender da disponibilidade de internet ou do banco estar populado na hora, graças ao desacoplamento no frontend com fallback.
- **Foco no Motor Central da NASA:** A equipe de backend e dados concentra 100% de esforço no cálculo real do ISNA, balanço hídrico diário e solo SoilGrids, sem gastar tempo com CRUDs de usuários ou rede comunitária.
- **Transparência de Escopo:** O time de frontend sabe exatamente quais dados vêm da API real e quais são simulações visuais para enriquecer o protótipo.

### Negativas / Mitigações
- A seção comunitária não reflete dados de banco em tempo real.
  - *Mitigação:* Uma tag discreta de *"Dados agregados da microrregião (IBGE PAM / IMEA)"* contextualiza perfeitamente o número na tela para os juízes.
