/** Tela 8 "Perto de você": simulada no hackathon (PRD, RF-13 a RF-15). Sem backend. */
export type Community = {
  lugar: string
  raio_km: number
  participantes: number
  ano: number
  vizinhos: { opcao: string; total: number; gostaram: number }[]
  leituras: { lugar: string; pluviometro_mm: number; satelite_mm: number }[]
}
