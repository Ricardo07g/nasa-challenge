import type { GuideFile } from '../models/guide'

export type GuideRepository = { files: () => GuideFile[] }

const PATH = /\/guia\/(pt|en)\/([a-z0-9-]+)\.md$/

/** Os artigos são arquivos Markdown do repositório, carregados como texto no build. */
export function createGuideRepository(modules: Record<string, string>): GuideRepository {
  return {
    files: () =>
      Object.entries(modules).flatMap(([path, raw]) => {
        const match = PATH.exec(path)
        return match ? [{ lang: match[1] as GuideFile['lang'], slug: match[2], raw }] : []
      }),
  }
}

export const guideRepository = createGuideRepository(
  import.meta.glob<string>('../content/guia/*/*.md', { query: '?raw', import: 'default', eager: true }),
)
