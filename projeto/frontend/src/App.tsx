import { useEffect, useState } from 'react'

type ApiStatus = 'carregando' | 'ok' | 'fora do ar'

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('carregando')

  useEffect(() => {
    // Sempre chamar a API por /api: o proxy do Vite encaminha para o backend.
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { status: string }) => setApiStatus(data.status === 'ok' ? 'ok' : 'fora do ar'))
      .catch(() => setApiStatus('fora do ar'))
  }, [])

  return (
    <main>
      <h1>Raiz Orbital</h1>
      <p>O que plantar depois da soja?</p>
      <p>
        API: <strong data-status={apiStatus}>{apiStatus}</strong>
      </p>
    </main>
  )
}

export default App
