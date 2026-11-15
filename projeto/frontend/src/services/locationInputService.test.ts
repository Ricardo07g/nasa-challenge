import { describe, expect, it } from 'vitest'
import { parseLocationInput } from './locationInputService'

const point = (lat: number, lon: number, source: 'coordinates' | 'link') => ({ kind: 'point', point: { lat, lon }, source })

describe('parseLocationInput: coordenadas coladas', () => {
  it.each([
    ['-18.9543, -48.1993', -18.9543, -48.1993],
    ['-18.9543,-48.1993', -18.9543, -48.1993],
    ['-18.9543 -48.1993', -18.9543, -48.1993],
    ['  -18.9543 ,  -48.1993  ', -18.9543, -48.1993],
    ['-18,9543; -48,1993', -18.9543, -48.1993],
    ['-18,9543;-48,1993', -18.9543, -48.1993],
    ['-18,9543, -48,1993', -18.9543, -48.1993],
    ['-18,9543 -48,1993', -18.9543, -48.1993],
    ['(-18.9543, -48.1993)', -18.9543, -48.1993],
    ['-19, -48', -19, -48],
    ['+10.5, 20.25', 10.5, 20.25],
  ])('"%s" vira o ponto', (text, lat, lon) => {
    expect(parseLocationInput(text)).toEqual(point(lat, lon, 'coordinates'))
  })

  it('latitude ou longitude fora do mundo: avisa que as coordenadas não existem', () => {
    expect(parseLocationInput('91, -48')).toEqual({ kind: 'invalid-coordinates' })
    expect(parseLocationInput('-18.95, -181')).toEqual({ kind: 'invalid-coordinates' })
  })

  it('só números, ainda incompletos: não busca nem avisa (a pessoa ainda está digitando)', () => {
    expect(parseLocationInput('-18.95')).toEqual({ kind: 'incomplete-coordinates' })
    expect(parseLocationInput('-18,9543;')).toEqual({ kind: 'incomplete-coordinates' })
    expect(parseLocationInput('-18.9543, -48.1993, 12')).toEqual({ kind: 'incomplete-coordinates' })
  })
})

describe('parseLocationInput: link do Google Maps colado', () => {
  it('pino do lugar (!3d…!4d…) vale mais que o centro do mapa (@…)', () => {
    const link =
      'https://www.google.com/maps/place/Uberl%C3%A2ndia,+MG/@-18.9127749,-48.3418376,12z/data=!3m1!4b1!4m6!3m5!1s0x94a4450cd5e46d5f:0x14ad7f6ad3cfc1a1!8m2!3d-18.9113317!4d-48.2622478!16zL20vMDJmdl8?entry=ttu'

    expect(parseLocationInput(link)).toEqual(point(-18.9113317, -48.2622478, 'link'))
  })

  it('lugar marcado por coordenadas (nome em graus, minutos e segundos)', () => {
    const link =
      "https://www.google.com/maps/place/18%C2%B057'15.5%22S+48%C2%B011'57.5%22W/@-18.9543,-48.1993,17z/data=!3m1!4b1!4m4!3m3!8m2!3d-18.954306!4d-48.199306"

    expect(parseLocationInput(link)).toEqual(point(-18.954306, -48.199306, 'link'))
  })

  it.each([
    ['https://www.google.com/maps/@-18.9543,-48.1993,15z', -18.9543, -48.1993],
    ['https://www.google.com.br/maps/@-18.9543166,-48.1992889,1234m/data=!3m1!1e3?entry=ttu', -18.9543166, -48.1992889],
    ['www.google.com/maps/@-18.95,-48.19,15z', -18.95, -48.19],
    ['https://maps.google.com/?q=-18.9543,-48.1993', -18.9543, -48.1993],
    ['https://maps.google.com/maps?q=-18.9543%2C-48.1993&z=15', -18.9543, -48.1993],
    ['https://maps.google.com/?q=loc:-18.9543,-48.1993', -18.9543, -48.1993],
    ['https://www.google.com/maps?ll=-18.9543,-48.1993&z=14', -18.9543, -48.1993],
    ['https://www.google.com/maps/search/?api=1&query=-18.9543,-48.1993', -18.9543, -48.1993],
    ['https://www.google.com/maps/search/-18.9543,+-48.1993?entry=ttu', -18.9543, -48.1993],
    ['https://www.google.com/maps/dir//-18.9543,-48.1993/@-18.95,-48.19,15z', -18.95, -48.19],
  ])('%s', (link, lat, lon) => {
    expect(parseLocationInput(link)).toEqual(point(lat, lon, 'link'))
  })

  it('link curto não abre sem rede: pede o link completo ou as coordenadas', () => {
    expect(parseLocationInput('https://maps.app.goo.gl/AbCdEf123')).toEqual({ kind: 'short-link' })
    expect(parseLocationInput('https://goo.gl/maps/AbCdEf123')).toEqual({ kind: 'short-link' })
    expect(parseLocationInput('maps.app.goo.gl/AbCdEf123')).toEqual({ kind: 'short-link' })
  })

  it('link sem coordenadas (só o nome do lugar): avisa', () => {
    expect(parseLocationInput('https://www.google.com/maps/place/Uberaba,+MG')).toEqual({ kind: 'link-without-point' })
    expect(parseLocationInput('https://maps.google.com/?q=Uberaba')).toEqual({ kind: 'link-without-point' })
  })

  it('coordenadas impossíveis no link: avisa que não existem', () => {
    expect(parseLocationInput('https://www.google.com/maps/@-98.1,-48.1,15z')).toEqual({ kind: 'invalid-coordinates' })
  })
})

describe('parseLocationInput: texto para buscar', () => {
  it('nome de cidade, estrada ou endereço vai para a busca, sem os espaços das pontas', () => {
    expect(parseLocationInput('  Uberaba ')).toEqual({ kind: 'search', query: 'Uberaba' })
    expect(parseLocationInput('BR-050 km 80')).toEqual({ kind: 'search', query: 'BR-050 km 80' })
    expect(parseLocationInput('Rua 2, 120, Uberlândia')).toEqual({ kind: 'search', query: 'Rua 2, 120, Uberlândia' })
  })

  it('CEP vai para a busca (não é coordenada incompleta)', () => {
    expect(parseLocationInput('38400-000')).toEqual({ kind: 'search', query: '38400-000' })
    expect(parseLocationInput('38400000')).toEqual({ kind: 'search', query: '38400000' })
  })

  it('campo vazio', () => {
    expect(parseLocationInput('   ')).toEqual({ kind: 'empty' })
  })
})
