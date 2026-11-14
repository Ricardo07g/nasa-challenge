/**
 * Único lugar do front que fala HTTP. Sempre caminhos relativos (/api/...):
 * o proxy do Vite encaminha para o backend.
 */
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`GET ${path} falhou com status ${response.status}`)
  }
  return (await response.json()) as T
}
