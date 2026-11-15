import { LayersIcon, PlantingIcon, RainIcon, ShieldIcon, SproutIcon } from '../design-system/icons'
import type { GuideTheme } from '../models/guide'

/** O ícone de cada tema do Guia (tela 8), nas pílulas, nos títulos das seções e no artigo. */
export function GuideThemeIcon({ theme, size = 18 }: { theme: GuideTheme; size?: number }) {
  switch (theme) {
    case 'cultures':
      return <SproutIcon size={size} />
    case 'planting':
      return <PlantingIcon size={size} />
    case 'soil':
      return <LayersIcon size={size} />
    case 'climate':
      return <RainIcon size={size} />
    case 'safety':
      return <ShieldIcon size={size} />
  }
}
