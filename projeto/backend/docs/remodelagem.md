# Remodelagem do produto (iniciada em 15/11/2026)

Pedido do usuário: `arquivos contexto/prompt-raiz-orbital.md` (9 seções). Este arquivo é o roteiro, o
estado de cada entrega, o registro das decisões e a revisão. Quem trabalhar numa seção lê o pedido
inteiro (as "Regras gerais" valem para todas), os `AGENTS.md` e esta página.

## Como trabalhamos

- **Ordem do pedido, uma entrega (PR) por seção.** No máximo duas seções em paralelo, só quando não mexem
  nos mesmos arquivos (coluna "Junto com").
- **TDD e camadas** como em todo o repositório. Cada seção tem a tarefa em `docs/tarefas/` (número abaixo)
  e o requisito no PRD no mesmo PR.
- **Só dados que já temos** (banco e `data/baixados/`). Sem dado para o ponto, o elemento não aparece.
- **Revisão de cada seção** depois do merge: testes, telas no Chrome sem interface (pt e en, celular e
  computador) e a lista de itens do pedido marcada aqui (✅ feito, ⚠️ feito com ressalva, ❌ não feito e
  por quê).

## Roteiro

| # | Seção do pedido | Tarefa | O que entra | Junto com | Estado |
| --- | --- | --- | --- | --- | --- |
| S1 | 1. Valores em reais (e a regra geral de esconder "Ainda não conectado") | 0040 | nota de renda sem preço nem custo no motor (`regras.yaml`), "Renda" com fatos, nenhum R$ na API nem no front, selos "Ainda não conectado" escondidos, "Como a conta é feita" | S8 | a fazer |
| S8 | 8. Guia | 0048 | `/guia` e `/guia/<artigo>`, artigos em Markdown pt/en (primeiro os da lista prioritária), busca por título, imagens das plantas (SVG próprio) | S1 | a fazer |
| S2 | 2. Onde fica a lavoura | 0041 | busca com autocompletar (Photon/OSM), coordenadas e link do Google Maps colados, "Confirmar local" com pin, endereço aproximado, limite da área piloto e bloqueio fora dela | S3 | a fazer |
| S3 | 3. Quando você colhe | 0042 | data exata + "Não sei o dia exato", sugestão = seleção, chuva que sobra (mediana e ano seco), chuva × ETo por mês, custo do atraso, fim das chuvas | S2 | a fazer |
| S4 | 4. O que o satélite viu (raio-X) | 0043 | painel escuro com 8 blocos, histórico em faixa de calor do NDVI, alertas (geada, chuva forte, fogo: MCD64A1 na ORNL ou índice substituto), cartões menores | — | a fazer |
| S5a | 5. Abas: objetivo, Sugestão e Água | 0044 | abas Sugestão / Comparar / Plano, seletor "O que você quer mais?", linha Água e sede da cultura, explorador ano a ano (substitui `/safra-passada`), "Como fazer" em 4 partes, aviso único da colheita tarde, sem relatório | — | a fazer |
| S5b | 5. Comparar e Plano de 3 anos | 0045 | Comparar (até 3 culturas, colunas, "Usar no meu plano"), Plano editável com notas na hora, saúde da terra da rotação, chuva aproveitada, "Como é hoje" com o NDVI e a confirmação, Plano A/B com número derivado da série, sem "Comece por um pedaço" | — | a fazer |
| S6 | 6. Avisos | 0046 | `/avisos` com contador, grupos Agora / O que mudou / Fora do comum / Perto de você, POWER recente com cache de 24 h, rodapé "Alertas oficiais" | S7 | a fazer |
| S7 | 7. Comunidade | 0047 | relatos (plantio, chuva, evento) sem cadastro, tabela `community_report`, endpoints, mapa de 30 km, resumo "Perto de você" | S6 | a fazer |
| S9 | 9. Consistência e revisão final | 0049 | missão com as fontes certas, "Como a conta é feita" com as regras novas, nenhum link para telas removidas, lista final do pedido | — | a fazer |

Ordem de merge: S1 → S8 → S2 → S3 → S4 → S5a → S5b → S6 → S7 → S9. Se a janela de uso acabar, a
retomada automática continua da primeira seção não terminada (arquivo de retomada do orquestrador).

## Decisões (registro)

Cada decisão tomada sem o usuário entra aqui, com o porquê. Decisões de produto ficam "a revisar".

| # | Data | Decisão | Por quê |
| --- | --- | --- | --- |
| D1 | 15/11 | A S8 (Guia) roda junto da S1 e sai antes das outras telas. | É conteúdo em arquivos próprios, sem conflito, e as outras seções linkam para os artigos. |
| D2 | 15/11 | "Esconda todos os selos 'Ainda não conectado'" (regra geral do pedido) substitui a regra do `projeto/frontend/AGENTS.md` que mandava mostrar o selo. Feito na S1, com o AGENTS do front atualizado no mesmo PR. | O pedido é a decisão mais recente do usuário. |
| D3 | 15/11 | Busca de endereço pelo **Photon** (komoot, OpenStreetMap, sem chave), com espera de ~400 ms entre teclas e uma busca por vez; endereço aproximado do pin pelo *reverse* do Photon; atribuição "© OpenStreetMap". | Feito para autocompletar e sem cadastro; uma fonte só para buscar e para o endereço. |
| D4 | 15/11 | Imagens das plantas: ilustrações próprias em SVG, simples, feitas no repositório. | O pedido proíbe IA sem marca d'água; SVG próprio não tem licença a conferir. |
| D5 | 15/11 | O histórico usa **2017–2026** (10 anos até a entressafra mais recente, decisão de 15/11, tarefa 0039), não 2016–2025 como está escrito na seção 4. | Decisão mais recente do usuário. |
| D6 | 15/11 | O Guia (S8) é escrito com o modelo Sonnet; as seções de código, com o modelo padrão. | Poupa a janela de uso no trabalho de texto, sem perder a revisão (o orquestrador revisa). |
| D7 | 15/11 | O orquestrador não consegue ler o percentual da janela de 5 horas. Mitigação: no máximo 2 subagentes ao mesmo tempo, entregas pequenas e commitadas, e a retomada automática a cada 30 min continua depois que a janela libera. | Não há ferramenta que mostre o uso; o que dá para garantir é não perder trabalho. |

## Revisão por seção

(preenchida depois de cada merge)

## Números estranhos encontrados

(preenchido ao longo do trabalho)

## O que não foi possível e por quê

(preenchido ao longo do trabalho)
