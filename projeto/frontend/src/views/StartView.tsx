import type { ReactNode } from 'react'
import { Link } from 'react-router'
import fieldPhoto from '../assets/cerrado-field.jpg'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import type { StartSourcesState } from '../controllers/useStartController'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { Modal } from '../design-system/components/Modal'
import {
  ArrowRightIcon,
  CalculatorIcon,
  CalendarIcon,
  ClockIcon,
  HeatIcon,
  PinIcon,
  PlusIcon,
  RainIcon,
  SatelliteIcon,
  SoilIcon,
  SparkleIcon,
  SproutIcon,
} from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import styles from './StartView.module.css'

type Step = { icon: ReactNode; title: string; text: string; tone: 'green' | 'blue' }

export type StartViewProps = {
  t: Messages
  /** "Ouvir resumo" da tela (estado do `useListenSummary`). */
  listen: ListenSummaryState
  /** Modal "De onde vêm os dados", aberto pelo selo da foto. */
  sources: StartSourcesState
}

/**
 * Tela Início (remodelagem, tarefa 0052): só o essencial à vista, os detalhes em modais. A abertura ocupa
 * o resto da primeira tela (texto, foto gerada por IA com a marca d'água e o selo da NASA, e os 3 passos
 * presos ao fim dela); embaixo, a faixa do agrônomo. O rodapé e o modal de créditos são da moldura.
 */
export function StartView({ t, listen, sources }: StartViewProps) {
  const s = t.start
  const steps: Step[] = [
    { icon: <PinIcon size={20} />, title: s.stepMark, text: s.stepMarkText, tone: 'green' },
    { icon: <CalendarIcon size={20} />, title: s.stepHarvest, text: s.stepHarvestText, tone: 'blue' },
    { icon: <SproutIcon size={20} />, title: s.stepAnswer, text: s.stepAnswerText, tone: 'green' },
  ]
  const sourceRows = [
    { icon: <RainIcon size={20} />, title: s.sources.rain, text: s.sources.rainText },
    { icon: <HeatIcon size={20} />, title: s.sources.heat, text: s.sources.heatText },
    { icon: <SoilIcon size={20} />, title: s.sources.soil, text: s.sources.soilText },
    { icon: <ClockIcon size={20} />, title: s.sources.future, text: s.sources.futureText },
  ]

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="inicio-titulo">
        <div className={styles.photo}>
          <img src={fieldPhoto} alt={s.photoAlt} width={1536} height={1024} />
        </div>
        <button type="button" className={styles.seal} aria-haspopup="dialog" onClick={sources.onOpen}>
          <span className={styles.sealIcon}>
            <SatelliteIcon size={20} />
          </span>
          <span>
            {s.seal} <b>{s.sealRegion}</b>
          </span>
          <span className={styles.sealMore} aria-hidden="true">
            <PlusIcon size={14} />
          </span>
        </button>
        {/* Regra do NASA Space Apps: toda imagem gerada por IA leva marca d'água visível. */}
        <span className={styles.aiMark}>
          <SparkleIcon size={12} />
          <span>{s.aiImage}</span>
        </span>

        <div className={styles.inner}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{s.eyebrow}</p>
            <h1 id="inicio-titulo" className={styles.title}>
              {s.title}
            </h1>
            <p className={styles.slogan}>{t.header.slogan}</p>
            {s.nameMeaning && <p className={styles.nameMeaning}>{s.nameMeaning}</p>}
            <p className={styles.lead}>{s.lead}</p>
            <ListenSummary
              className={styles.listen}
              supported={listen.supported}
              speaking={listen.speaking}
              onToggle={listen.toggle}
              label={t.listen.summary}
              stopLabel={t.listen.stop}
            />
            <Link to="/onde" className={styles.start}>
              <span>{s.start}</span>
              <ArrowRightIcon size={18} />
            </Link>
          </div>

          <h2 className="visually-hidden">{s.stepsTitle}</h2>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepIcon} data-tone={step.tone}>
                  {step.icon}
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                </span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.agro} aria-labelledby="inicio-agro">
        <div className={styles.agroInner}>
          <p className={styles.agroText}>
            <span className={styles.agroIcon}>
              <CalculatorIcon size={20} />
            </span>
            <span>
              <b id="inicio-agro">{s.agroTitle}</b> {s.agroText}
            </span>
          </p>
          <Link to="/como-funciona" className={styles.agroButton}>
            <span>{s.agroButton}</span>
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>

      <Modal
        open={sources.open}
        onClose={sources.onClose}
        title={s.sources.title}
        subtitle={s.sources.subtitle}
        closeLabel={t.common.close}
      >
        <ul className={styles.sources}>
          {sourceRows.map((row) => (
            <li key={row.title}>
              <span className={styles.sourceIcon}>{row.icon}</span>
              <div>
                <b>{row.title}</b>
                <span>{row.text}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className={styles.sourcesNote}>{s.sources.note}</p>
        <button type="button" className={styles.allCredits} onClick={sources.onAllCredits}>
          <span>{s.sources.allCredits}</span>
          <ArrowRightIcon size={14} />
        </button>
      </Modal>
    </div>
  )
}
