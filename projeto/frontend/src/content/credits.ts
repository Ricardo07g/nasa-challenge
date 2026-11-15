/**
 * Créditos e uso de IA (regra do NASA Space Apps: listar toda fonte, código, texto e imagem usados).
 * O mesmo conteúdo em todas as telas: o rodapé abre o modal global (`views/CreditsModal.tsx`).
 *
 * Fonte nova? Acrescente UMA linha no grupo certo, em pt e em en (o teste confere que os dois idiomas
 * têm os mesmos grupos e o mesmo número de linhas). Negrito com **…** (lido por `parseInline`).
 */
import type { Lang } from '../i18n/language'

export type CreditGroup = {
  /** Igual nos dois idiomas. */
  id: 'nasa' | 'other' | 'code' | 'images'
  title: string
  lines: readonly string[]
}

export type CreditsContent = {
  title: string
  subtitle: string
  groups: readonly CreditGroup[]
  /** Quadro azul-claro "Uso de IA". */
  ai: { title: string; text: string }
}

export const CREDITS: Record<Lang, CreditsContent> = {
  pt: {
    title: 'Créditos e uso de IA',
    subtitle: 'Tudo o que usamos para fazer o Raiz Orbital.',
    groups: [
      {
        id: 'nasa',
        title: 'Dados da NASA',
        lines: [
          '**GPM IMERG Final** · chuva de cada dia, 2005–2024',
          '**NASA POWER** · temperatura, umidade, vento e sol',
          '**NEX-GDDP-CMIP6** · clima de 2041–2060 (SSP2-4.5)',
          '**SMAP L4** · umidade da terra',
          '**MODIS** (NDVI pela ORNL DAAC, MCD64A1, MCD12Q1) · verde da lavoura, fogo e uso do solo',
        ],
      },
      {
        id: 'other',
        title: 'Outros dados',
        lines: [
          '**SoilGrids** (ISRIC, CC BY 4.0) · solo',
          '**NOAA CPC** · índice ONI e previsão de El Niño / La Niña',
          '**ZARC (MAPA) e Embrapa** · prazos e parâmetros das culturas',
          '**OpenStreetMap** (© colaboradores do OpenStreetMap, ODbL) · mapa e endereços',
          '**Photon** (komoot) · endereço aproximado do ponto marcado, com dados do OpenStreetMap',
        ],
      },
      {
        id: 'code',
        title: 'Código, fontes e ícones',
        lines: [
          'React, Vite, FastAPI, PostgreSQL e PostGIS (código aberto; lista completa no repositório)',
          '**Leaflet** (BSD-2-Clause) · mapa',
          'Fontes Inter e Space Grotesk (SIL Open Font License) · ícones Lucide (ISC)',
        ],
      },
      {
        id: 'images',
        title: 'Imagens',
        lines: [
          'Foto da lavoura na tela inicial: imagem gerada por IA no **Lovable**, não é uma foto real. Está marcada na própria tela.',
        ],
      },
    ],
    ai: {
      title: 'Uso de IA',
      text: 'Usamos **Claude** (Anthropic), **Gemini** (Google) e **Lovable** para ajudar a escrever código, textos, documentos e telas. Tudo foi revisado pelo time. Nenhum número das telas vem de IA: a conta é feita por regras fixas, com dados de satélite.',
    },
  },
  en: {
    title: 'Credits and use of AI',
    subtitle: 'Everything we used to build Raiz Orbital.',
    groups: [
      {
        id: 'nasa',
        title: 'NASA data',
        lines: [
          '**GPM IMERG Final** · daily rainfall, 2005–2024',
          '**NASA POWER** · temperature, humidity, wind and sun',
          '**NEX-GDDP-CMIP6** · 2041–2060 climate (SSP2-4.5)',
          '**SMAP L4** · soil moisture',
          '**MODIS** (NDVI via ORNL DAAC, MCD64A1, MCD12Q1) · crop greenness, fire and land use',
        ],
      },
      {
        id: 'other',
        title: 'Other data',
        lines: [
          '**SoilGrids** (ISRIC, CC BY 4.0) · soil',
          '**NOAA CPC** · ONI index and El Niño / La Niña outlook',
          '**ZARC (MAPA) and Embrapa** · crop calendars and parameters',
          '**OpenStreetMap** (© OpenStreetMap contributors, ODbL) · map and addresses',
          '**Photon** (komoot) · approximate address of the marked spot, with OpenStreetMap data',
        ],
      },
      {
        id: 'code',
        title: 'Code, fonts and icons',
        lines: [
          'React, Vite, FastAPI, PostgreSQL and PostGIS (open source; full list in the repository)',
          '**Leaflet** (BSD-2-Clause) · map',
          'Inter and Space Grotesk fonts (SIL Open Font License) · Lucide icons (ISC)',
        ],
      },
      {
        id: 'images',
        title: 'Images',
        lines: [
          'Field photo on the home screen: AI-generated with **Lovable**, not a real photo. It is labeled on the screen.',
        ],
      },
    ],
    ai: {
      title: 'Use of AI',
      text: 'We used **Claude** (Anthropic), **Gemini** (Google) and **Lovable** to help write code, text, documents and screens. Everything was reviewed by the team. No number on screen comes from AI: the math is done by fixed rules on satellite data.',
    },
  },
}
