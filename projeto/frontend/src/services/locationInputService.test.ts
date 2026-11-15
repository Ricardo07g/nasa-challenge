import { describe, expect, it } from 'vitest'
import { parseLocationInput } from './locationInputService'

/** Modal "Outras formas de marcar" (tarefa 0053): um teste por formato aceito e por entrada que não serve. */
describe('parseLocationInput: latitude e longitude coladas', () => {
  it.each([
    ['ponto decimal, vírgula e espaço', '-18.9543, -48.1993', -18.9543, -48.1993],
    ['ponto decimal, vírgula sem espaço', '-18.9543,-48.1993', -18.9543, -48.1993],
    ['ponto decimal, só espaço', '-18.9543 -48.1993', -18.9543, -48.1993],
    ['espaços sobrando nas pontas e no meio', '  -18.9543 ,  -48.1993  ', -18.9543, -48.1993],
    ['vírgula decimal, separadas por vírgula e espaço', '-18,9543, -48,1993', -18.9543, -48.1993],
    ['vírgula decimal, separadas por vírgula sem espaço', '-18,9543,-48,1993', -18.9543, -48.1993],
    ['vírgula decimal, separadas por ponto e vírgula', '-18,9543; -48,1993', -18.9543, -48.1993],
    ['vírgula decimal, separadas por espaço', '-18,9543 -48,1993', -18.9543, -48.1993],
    ['entre parênteses', '(-18.9543, -48.1993)', -18.9543, -48.1993],
    ['números inteiros', '-19, -48', -19, -48],
    ['com sinal de mais', '+10.5, 20.25', 10.5, 20.25],
  ])('%s: "%s"', (_name, text, lat, lon) => {
    expect(parseLocationInput(text)).toEqual({ lat, lon })
  })
})

describe('parseLocationInput: link do Google Maps colado', () => {
  it('@lat,lon (centro do mapa)', () => {
    expect(parseLocationInput('https://www.google.com/maps/@-18.9543,-48.1993,15z')).toEqual({ lat: -18.9543, lon: -48.1993 })
  })

  it('@lat,lon num link do google.com.br, com mais coisa depois', () => {
    expect(
      parseLocationInput('https://www.google.com.br/maps/@-18.9543166,-48.1992889,1234m/data=!3m1!1e3?entry=ttu'),
    ).toEqual({ lat: -18.9543166, lon: -48.1992889 })
  })

  it('@lat,lon sem o https://', () => {
    expect(parseLocationInput('www.google.com/maps/@-18.95,-48.19,15z')).toEqual({ lat: -18.95, lon: -48.19 })
  })

  it('?q=lat,lon', () => {
    expect(parseLocationInput('https://maps.google.com/?q=-18.9543,-48.1993')).toEqual({ lat: -18.9543, lon: -48.1993 })
  })

  it('?q= com a vírgula codificada (%2C)', () => {
    expect(parseLocationInput('https://maps.google.com/maps?q=-18.9543%2C-48.1993&z=15')).toEqual({
      lat: -18.9543,
      lon: -48.1993,
    })
  })

  it('?q=loc:lat,lon', () => {
    expect(parseLocationInput('https://maps.google.com/?q=loc:-18.9543,-48.1993')).toEqual({ lat: -18.9543, lon: -48.1993 })
  })

  it('ll=lat,lon', () => {
    expect(parseLocationInput('https://www.google.com/maps?ll=-18.9543,-48.1993&z=14')).toEqual({
      lat: -18.9543,
      lon: -48.1993,
    })
  })

  it('query=lat,lon', () => {
    expect(parseLocationInput('https://www.google.com/maps/search/?api=1&query=-18.9543,-48.1993')).toEqual({
      lat: -18.9543,
      lon: -48.1993,
    })
  })

  it('!3dlat!4dlon (o alfinete do lugar) vale mais que o centro do mapa (@…)', () => {
    const link =
      'https://www.google.com/maps/place/Uberl%C3%A2ndia,+MG/@-18.9127749,-48.3418376,12z/data=!3m1!4b1!4m6!3m5!1s0x94a4450cd5e46d5f:0x14ad7f6ad3cfc1a1!8m2!3d-18.9113317!4d-48.2622478!16zL20vMDJmdl8?entry=ttu'

    expect(parseLocationInput(link)).toEqual({ lat: -18.9113317, lon: -48.2622478 })
  })

  it('!3d…!4d… de um lugar marcado por coordenadas (nome em graus, minutos e segundos)', () => {
    const link =
      "https://www.google.com/maps/place/18%C2%B057'15.5%22S+48%C2%B011'57.5%22W/@-18.9543,-48.1993,17z/data=!3m1!4b1!4m4!3m3!8m2!3d-18.954306!4d-48.199306"

    expect(parseLocationInput(link)).toEqual({ lat: -18.954306, lon: -48.199306 })
  })

  it('busca por coordenadas no caminho (/maps/search/lat,+lon)', () => {
    expect(parseLocationInput('https://www.google.com/maps/search/-18.9543,+-48.1993?entry=ttu')).toEqual({
      lat: -18.9543,
      lon: -48.1993,
    })
  })
})

describe('parseLocationInput: o que não serve (a tela diz "Não entendi")', () => {
  it.each([
    ['campo vazio', '   '],
    ['nome de cidade (a busca por endereço saiu da tela)', 'Uberaba'],
    ['endereço', 'Rua 2, 120, Uberlândia'],
    ['CEP', '38400-000'],
    ['só a latitude', '-18.95'],
    ['três números', '-18.9543, -48.1993, 12'],
    ['latitude fora do mundo (acima de 90)', '91, -48'],
    ['longitude fora do mundo (abaixo de -180)', '-18.95, -181'],
    ['link curto (só abre com rede)', 'https://maps.app.goo.gl/AbCdEf123'],
    ['link curto antigo', 'https://goo.gl/maps/AbCdEf123'],
    ['link só com o nome do lugar', 'https://www.google.com/maps/place/Uberaba,+MG'],
    ['?q= com o nome do lugar', 'https://maps.google.com/?q=Uberaba'],
    ['link com coordenadas impossíveis', 'https://www.google.com/maps/@-98.1,-48.1,15z'],
    ['link de outro site sem coordenadas', 'https://example.com/fazenda'],
  ])('%s: "%s"', (_name, text) => {
    expect(parseLocationInput(text)).toBeNull()
  })
})
