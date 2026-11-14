import type { Lang } from '../i18n/language'
import type { Community } from '../models/community'

export type CommunityRepository = {
  get(lang: Lang): Promise<Community>
}
