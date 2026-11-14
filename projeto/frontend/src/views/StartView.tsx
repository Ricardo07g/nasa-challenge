import type { ReactNode } from 'react'
import fieldPhoto from '../assets/cerrado-field.jpg'
import { Button } from '../design-system/components/Button'
import { ArrowUpRightIcon, CalendarIcon, PinIcon, SatelliteIcon, SproutIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import styles from './StartView.module.css'

/** Satélite em órbita sobre as fileiras da lavoura (enfeite do canto da foto). */
function OrbitIllustration() {
  return (
    <svg viewBox="0 0 300 190" className={styles.orbit} aria-hidden="true" focusable="false">
      <ellipse
        cx="154"
        cy="76"
        rx="119"
        ry="57"
        transform="rotate(-13 154 76)"
        fill="none"
        stroke="var(--color-secondary)"
        strokeDasharray="4 7"
        strokeWidth="1.5"
      />
      <g transform="translate(202 30) rotate(-25)" fill="none" stroke="var(--color-secondary)" strokeWidth="2">
        <rect x="-13" y="-12" width="26" height="24" rx="3" />
        <path d="M-38-10h20v20h-20zM18-10h20v20H18zM0 12v11m-8 0h16M-5-12l-4-12m0 0 17-2" />
      </g>
      <g stroke="currentColor" fill="none" strokeWidth="2">
        <path d="M30 155Q150 110 270 155M45 173Q150 130 255 173" />
        <path d="M100 143v-17m0 6q-15 0-16-10q13-2 16 10m0-6q1-12 13-12q0 12-13 12M165 136v-20m0 9q-13 0-15-10q13-3 15 10m0-9q1-12 12-13q1 12-12 13" />
      </g>
    </svg>
  )
}

type Step = { icon: ReactNode; title: string; text: string; tone: 'green' | 'blue' }

/** Tela 1 "Início". Só apresentação: não tem controller. */
export function StartView({ t }: { t: Messages }) {
  const s = t.start
  const steps: Step[] = [
    { icon: <PinIcon />, title: s.stepMark, text: s.stepMarkText, tone: 'green' },
    { icon: <CalendarIcon />, title: s.stepHarvest, text: s.stepHarvestText, tone: 'blue' },
    { icon: <SproutIcon />, title: s.stepAnswer, text: s.stepAnswerText, tone: 'green' },
  ]

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <img className={styles.photo} src={fieldPhoto} alt={s.photoAlt} width={1536} height={1024} />
        <div className={styles.heroContent}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>
              <span className={styles.dot} aria-hidden="true" />
              {s.eyebrow}
            </span>
            <h1 className={styles.title}>{s.title}</h1>
            <p className={styles.slogan}>{t.header.slogan}</p>
            <p className={styles.lead}>{s.lead}</p>
            <div className={styles.actions}>
              <Button to="/onde" arrow>
                {s.start}
              </Button>
              <span className={styles.meta}>{s.meta}</span>
              <Button to="/exemplo" variant="outline" iconEnd={<ArrowUpRightIcon size={20} />}>
                {s.example}
              </Button>
            </div>
          </div>
          <OrbitIllustration />
        </div>
        <p className={styles.photoLabel}>
          <SatelliteIcon size={23} />
          <span>
            {s.nasaData}
            <br />
            <strong>{s.region}</strong>
          </span>
        </p>
      </section>

      <section className={styles.steps} aria-labelledby="inicio-passos">
        <div className={styles.stepsHeading}>
          <h2 id="inicio-passos" className={styles.stepsTitle}>
            {s.stepsTitle}
          </h2>
          <span className={`${styles.eyebrow} ${styles.stepsEyebrow}`}>
            <SproutIcon size={18} />
            {s.stepsEyebrow}
          </span>
        </div>
        <ul className={styles.stepsGrid}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepIcon} data-tone={step.tone}>
                {step.icon}
              </span>
              <div>
                <span className={styles.stepNumber} aria-hidden="true">
                  0{index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
