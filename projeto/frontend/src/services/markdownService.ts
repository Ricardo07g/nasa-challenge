/**
 * Renderizador mínimo de Markdown para o Guia: devolve uma árvore de blocos (a view desenha com React,
 * então o texto nunca vira HTML). Só entende a estrutura fixa dos artigos: títulos (##, ###),
 * parágrafos, listas (- e 1.), negrito (**) e links [texto](endereço). O resto é texto puro.
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string; external: boolean }

export type Block =
  | { type: 'heading'; level: 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }

const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g

/** Uma linha só (negrito e links), sem blocos: usado também pelos créditos (`content/credits.ts`). */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  const pushText = (text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last?.type === 'text') last.text += text
    else out.push({ type: 'text', text })
  }
  let cursor = 0
  for (const match of source.matchAll(TOKEN)) {
    pushText(source.slice(cursor, match.index))
    cursor = match.index + match[0].length
    if (match[1] !== undefined) {
      out.push({ type: 'strong', text: match[1] })
    } else {
      const [, , text, href] = match
      if (/^https?:\/\//i.test(href)) out.push({ type: 'link', text, href, external: true })
      else if (href.startsWith('/') && !href.startsWith('//')) out.push({ type: 'link', text, href, external: false })
      else pushText(text)
    }
  }
  pushText(source.slice(cursor))
  return out
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: Inline[][] } | null = null

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) })
    if (list) blocks.push({ type: 'list', ...list })
    paragraph = []
    list = null
  }

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    const heading = /^(#{2,3})\s+(.+)$/.exec(line)
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (!line) flush()
    else if (heading) {
      flush()
      blocks.push({ type: 'heading', level: heading[1].length as 2 | 3, children: parseInline(heading[2]) })
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered)
      if (paragraph.length || (list && list.ordered !== ordered)) flush()
      list ??= { ordered, items: [] }
      list.items.push(parseInline((bullet ?? numbered)![1]))
    } else {
      if (list) flush()
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

function inlineText(inlines: readonly Inline[]): string {
  return inlines.map((inline) => inline.text).join('')
}

/** Texto puro dos blocos (para contar palavras e buscar). */
export function plainText(blocks: readonly Block[]): string {
  return blocks
    .map((block) =>
      block.type === 'list' ? block.items.map(inlineText).join(' ') : inlineText(block.children),
    )
    .join(' ')
}
