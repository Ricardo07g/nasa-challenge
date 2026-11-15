/**
 * Bandeirinhas do seletor de idioma (15/11/2026, pedido do usuário): EUA para o inglês e Brasil para o português.
 * Desenho simplificado (sem as 50 estrelas nem a faixa do lema), só com as cores do `tokens.css`. Sempre decorativas:
 * o nome do idioma vai escrito ao lado e no nome acessível do botão.
 */
type FlagProps = { width?: number }

export function FlagUS({ width = 20 }: FlagProps) {
  const height = (width * 2) / 3
  const stripe = 30 / 13
  return (
    <svg data-flag="us" aria-hidden="true" focusable="false" width={width} height={height} viewBox="0 0 45 30">
      <rect width="45" height="30" fill="var(--flag-white)" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * stripe} width="45" height={stripe} fill="var(--flag-us-red)" />
      ))}
      <rect width="19" height={7 * stripe} fill="var(--flag-us-blue)" />
      {[3, 7.5, 12, 16].flatMap((x) =>
        [3, 7.5, 12].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="var(--flag-white)" />),
      )}
      <rect width="45" height="30" fill="none" stroke="var(--flag-outline)" strokeWidth="1.5" />
    </svg>
  )
}

export function FlagBR({ width = 20 }: FlagProps) {
  const height = (width * 7) / 10
  return (
    <svg data-flag="br" aria-hidden="true" focusable="false" width={width} height={height} viewBox="0 0 20 14">
      <rect width="20" height="14" fill="var(--flag-br-green)" />
      <polygon points="10,1.7 18.3,7 10,12.3 1.7,7" fill="var(--flag-br-yellow)" />
      <circle cx="10" cy="7" r="3.5" fill="var(--flag-br-blue)" />
      <rect width="20" height="14" fill="none" stroke="var(--flag-outline)" strokeWidth="0.7" />
    </svg>
  )
}
