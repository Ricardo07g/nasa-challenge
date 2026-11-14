import type { HomeState } from '../controllers/useHomeController'

/** View: só desenha o que recebe. Sem fetch e sem regra de negócio. */
export function HomeView({ apiStatus, cropOptions, error }: HomeState) {
  return (
    <main>
      <h1>Raiz Orbital</h1>
      <p>O que plantar depois da soja?</p>
      <p>
        API: <strong data-status={apiStatus}>{apiStatus}</strong>
      </p>

      <h2>Opções de entressafra</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <ul>
          {cropOptions.map((option) => (
            <li key={option.id}>
              <strong>{option.name}</strong> <span>({option.role})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
