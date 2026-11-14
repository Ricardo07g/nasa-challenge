# ADR 0005: Dados direto dos serviços da NASA, sem Google Earth Engine no MVP

- **Status:** Proposto
- **Data:** 2026-11-14
- **Decisores:** Time Raiz Orbital (Backend, Engenharia de Dados)
- **Contexto:** `arquivos contexto/PRD – Raiz Orbital o que plantar depois da soja.md` (§6),
  `arquivos contexto/Raiz Orbital – plano técnico do backend.md` (§6 e §7),
  `projeto/backend/docs/roteiro-de-implementacao.md` (seção 3)

---

## 1. Contexto e problema

O PRD (§6.3) e o plano técnico (§6 e §7) mandam buscar três fontes pelo **Google Earth Engine**:
- NDVI do MODIS (`MODIS/061/MOD13Q1`);
- NEX-GDDP-CMIP6 (`NASA/GDDP-CMIP6`);
- SMAP L4 (`NASA/SMAP/SPL4SMGP/008`).

Para isso, o time precisaria de:
- um projeto no Google Cloud com cadastro de uso não comercial;
- uma conta de serviço com a chave JSON no servidor (`EE_SERVICE_ACCOUNT_KEY`);
- revisar a licença quando o produto passar a cobrar.

Hoje ninguém tem essa credencial configurada. Por isso nenhum script do Earth Engine existe no
repositório, apesar de o `data/README.md` dizer o contrário.

Em 2026-11-14, testamos o acesso numa máquina sem credencial nenhuma (resultados na seção 3 do roteiro):

- **Abrem sem login:**
  - NASA POWER e SoilGrids;
  - MODIS MOD13Q1 pela ORNL DAAC, com as bandas NDVI e `pixel_reliability`;
  - NEX-GDDP-CMIP6 recortado por ponto pelo THREDDS da NCCS, e também pelo S3 público;
  - a pasta pública do GEOS-S2S-3 no GMAO.
- **Pedem só a conta Earthdata da NASA** (gratuita, o time já tem um token): GPM IMERG (GES DISC),
  SMAP (NSIDC) e AppEEARS.

## 2. Decisão

1. No MVP, os dados vêm **direto dos serviços da NASA**:

   | Dado | Serviço | Credencial |
   | --- | --- | --- |
   | NDVI | AppEEARS (ponto ou área); ORNL DAAC como reserva | token Earthdata (AppEEARS) / nenhuma (ORNL) |
   | CMIP6 | NCCS THREDDS, recorte por ponto | nenhuma |
   | SMAP L4 | AppEEARS ou NSIDC | token Earthdata |
   | IMERG | GES DISC | token Earthdata |
   | POWER e SoilGrids | sem mudança | nenhuma |

2. A **única credencial** do MVP é o token da Earthdata (`EARTHDATA_TOKEN`). Ela fica no `.env`, e só o
   **pipeline** a usa. A API em produção não precisa de credencial da NASA.
3. O Google Earth Engine fica **fora do MVP**. Ele continua como opção para o que só existe lá, como a
   máscara de soja do MapBiomas no P3 (plano de evolução §4.3), e entra só se esse item precisar.
4. Os nomes, produtos e regras do PRD não mudam: MOD13Q1 v061, NEX-GDDP-CMIP6 SSP2-4.5, SPL4SMGP, o
   fator 0,0001 do NDVI e o filtro de qualidade (`SummaryQA` ≤ 1, que equivale a `pixel_reliability` ≤ 1).
   Muda só o caminho de acesso.

## 3. Consequências

### Positivas
- Nada fica esperando conta no Google Cloud. As fontes abertas já funcionam, e o token cobre o resto.
- Menos segredo no servidor: sai a chave JSON da conta de serviço do Earth Engine.
- Cada dado vem do sistema da própria NASA, o que o hackathon valoriza.
- Não há questão de licença do Earth Engine quando o produto passar a cobrar.

### Negativas e mitigações
- **Sem cálculo no servidor do Earth Engine.** Trazer NDVI de uma área grande sai mais caro. Por isso o
  MVP guarda NDVI só de pontos (fazenda de exemplo e talhões de calibração). Área, que é o P3, fica para o
  AppEEARS, junto com o PostGIS.
- **O serviço da ORNL é lento e instável.** Ele devolve no máximo 10 datas por pedido, e no teste um
  pedido levou de poucos segundos a ~60 s. Por isso o NDVI vem do AppEEARS, preparado no pipeline e
  guardado em cache, e nunca é buscado na hora do pedido. A ORNL fica só de reserva.
- **Os arquivos inteiros do CMIP6 têm cerca de 220 MB** (global, 1 ano, 1 variável). Usamos o recorte
  por ponto do THREDDS. Os nomes têm sufixo de versão (`_v1.1`, `_v2.0`), que precisa ser conferido
  arquivo a arquivo.
- O PRD (§6) e o plano técnico (§6 e §7) passam a divergir desta ADR no caminho de acesso. Eles devem
  ser atualizados quando esta ADR for aceita.
- No `.env.example`, `EE_PROJECT` deixa de ser necessário e `EARTHDATA_TOKEN` passa a ser.
  Isso vira a tarefa R0.1 do roteiro.
