/**
 * Os artigos do Guia (`src/content/guia/pt/<slug>.md` e `.../en/<slug>.md`), para o `GuideLink` só aceitar
 * um artigo que existe: um slug errado nem compila. `slugs.test.ts` confere que a lista é igual aos arquivos
 * nos dois idiomas; artigo novo entra aqui no mesmo PR.
 */
export const GUIDE_SLUGS = [
  'adubo-verde',
  'alertas-defesa-civil',
  'calor-35-graus',
  'clima-2041-2060',
  'como-evitar-erosao',
  'como-ler-os-avisos',
  'conta-de-agua',
  'crotalaria',
  'deu-certo',
  'el-nino-la-nina',
  'fogo-na-palha',
  'geada-na-safrinha',
  'milheto',
  'milho-braquiaria',
  'milho-safrinha',
  'nematoide',
  'palhada',
  'plantar-logo-depois-da-colheita',
  'plantio-direto',
  'prazo-de-plantio-zarc',
  'quando-a-chuva-acaba',
  'raio-x',
  'rotacao-de-culturas',
  'sementes',
  'sorgo',
  'terra-parada',
  'veranico',
] as const

export type GuideSlug = (typeof GUIDE_SLUGS)[number]
