# Tarefa 0032: previsão sazonal do GEOS-S2S para o sinal do outono (A2.1), investigação

- **Identificador:** `0032`
- **Título:** O que o GMAO publica do GEOS-S2S-3, em que formato, e o que falta para ler a chance de
  chuva abaixo do normal em março a maio
- **Status:** Bloqueada (sem caminho sem biblioteca nova; **nenhum código de download**, como pedia a
  tarefa). Espera o R0.3 e uma decisão de produto (seção 4)
- **Prioridade:** Alta (é a parte "previsão" do sinal para o outono, RF-20)
- **Roteiro:** A2.1 (Fase 6, ajuste A2). Depende de R0.3 (dependências dos scripts de dados)
- **Módulos Afetados:** nenhum código. Docs: este arquivo, o roteiro (seção 3 e A2.1) e o `AGENTS.md`
  do backend ("Sinal para o outono")
- **Referências:** [PRD](../../../../arquivos%20contexto/PRD%20%E2%80%93%20Raiz%20Orbital%20o%20que%20plantar%20depois%20da%20soja.md)
  (7.10, RF-20, T-18), [plano de evolução](../../../../arquivos%20contexto/Raiz%20Orbital%20%E2%80%93%20plano%20de%20evolu%C3%A7%C3%A3o%20do%20produto.md)
  (ajuste A2), [tarefa 0015](0015-servico-sinal-outono.md) (regra e `SeasonalForecast`)

---

## 1. Pergunta

O `SinalOutonoService` espera, por célula, a **chance (0 a 1) de chuva abaixo do normal de março a
maio** e a data da rodada (`SeasonalForecast`). A pasta pública do GMAO responde (roteiro, seção 3),
mas o formato nunca tinha sido conferido. Regra da tarefa: sem dependência nova; se o GEOS-S2S só
vier em NetCDF/HDF binário, procurar OPeNDAP, ASCII ou um produto derivado em texto e, sem nenhum,
parar e relatar.

## 2. O que existe (conferido em 14/11/2026, sem credencial)

Pasta `https://portal.nccs.nasa.gov/datashare/gmao/geos-s2s-3/` (nginx estático, aceita `Range`):

| Caminho | O que é | Formato e tamanho | Serve? |
| --- | --- | --- | --- |
| `NRT/NMME/monthly/<mmm><aaaa>/` (ex.: `nov2026/`) | Médias **mensais** da previsão, por membro, lead e variável: `<rodada AAAAMMDD>.<var>.ens<N>.lead<L>.nc4` | NetCDF-4 (assinatura HDF5 `\x89HDF`), ~1,0 MiB por arquivo (campo global; bate com 0,5° em float32, a conferir). `nov2026`: 3.150 arquivos, 21 variáveis, 150 de `precip` | **É o produto certo**, mas só com biblioteca |
| `NRT/APCN/<aaaamm>/<aaaamm>_precip.tar.xz` | O mesmo dado entregue ao APEC Climate Center: um arquivo por membro com os 9 meses | 118,3 MiB; dentro, NetCDF-4 de ~9 MiB por membro (`202611.precip.20261003ens1.9mo.nc4`) | Só com biblioteca |
| `NRT/ORNL/<aaaamm>/<aaaamm>_PRECTOTCORR.tar.xz` | Idem, para o ORNL | 118,3 MiB; NetCDF-4 por membro (`...9leads.nc4`) | Só com biblioteca |
| `NRT/IRI/IRI_<aaaamm>.txt` | **Único texto:** média do conjunto para o Niño 3.4 em 7 trimestres (NDJ a MJJ) | 159 B | Não: é índice do Pacífico, não chuva no Triângulo (e o PRD 7.10 não usa El Niño como ano seco) |
| `NRT/SubC/<aaaammdd>/` | Subsazonal (45 dias) | — | Não alcança março a maio |
| `Hindcast/Vaisala/199102/` | Previsões retrospectivas horárias (60 dias) | 3,0 GiB por arquivo | Não: nada mensal, nem climatologia ou tercis |
| `GEOS-S2S-3-primer.pdf` | Ficha do sistema | PDF | Rodada a cada 5 dias, 9 meses; 40 membros nos 3 primeiros meses e 10 nos 6 seguintes; retrospectivas 1991–2024 só nos discos da NAS |

Detalhe da pasta `NRT/NMME/monthly/nov2026/` (previsão de novembro de 2026):

- Rodadas 03, 08, 13, 18, 23 e 28/out (conjunto defasado, a cada 5 dias). Só **10 membros** chegam ao
  lead 9: 20261003 ens1/3/4, 20261013 ens1/4, 20261023 ens1/2, 20261028 ens7/8/12.
- Se o lead 1 é o mês da pasta (novembro), **março a maio de 2027 são os leads 5 a 7**: 30 arquivos,
  ~31 MiB. Isso precisa ser confirmado lendo o eixo `time` de um arquivo (com biblioteca).
- Tempo medido: listagem da pasta em 1,7 s; um arquivo de 1 MiB em 1,6 s; os 3 primeiros MiB de um
  `.tar.xz` em 1,8 s. A caixa inteira sairia em ~1 min (o arquivo é global; não há recorte).
- **Não há probabilidade nem tercis:** só o valor mensal de cada membro. Para "abaixo do normal" é
  preciso o limite do tercil inferior da climatologia das retrospectivas (mesmo lead, março a maio),
  que **não está publicado** na pasta.

Serviços com recorte ou texto:

- **THREDDS da NCCS** (`ds.nccs.nasa.gov/thredds`, o do CMIP6): só GEOS-CF e GEOS-FP.
- **GrADS Data Server** (`opendap.nccs.nasa.gov/dods`): só GEOS-5 (fp, MERRAero, WGNE) e geos-cf.
- **CMR da Earthdata:** nenhuma coleção GEOS-S2S (o GES DISC só tem a reanálise GiOCEAN).
- **IRI Data Library** (`iridl.ldeo.columbia.edu`, modelo `NASA-GEOSS2S` do NMME, com saída em texto
  e probabilidades): agora **exige login** (testado: devolve a página de entrada).
- **NOAA CPC NMME** (`ftp.cpc.ncep.noaa.gov/NMME/`), aberto:
  - `realtime_anom/NASA_GEOS5v2/<aaaamm>0800/NASA_GEOS5v2.prate.<aaaamm>.anom.nc`: anomalia por
    membro e lead, NetCDF clássico (`CDF\x01`). A pasta de nov/2026 ainda estava vazia em 14/11;
  - `clim/NASA_GEOS5v2.prate.<MM>.mon.clim.nc`: só a média da climatologia (sem tercis);
  - `prob/netcdf/prate.<aaaamm>.prob.adj.seas.nc`: **probabilidade dos tercis por trimestre**
    (inclui MAM), mas do conjunto de vários modelos do NMME (não só o GEOS-S2S), da NOAA.

## 3. Conclusão

**Não há caminho sem biblioteca nova.** O GEOS-S2S só sai em NetCDF-4/HDF5 (ou NetCDF clássico, nos
derivados da NOAA), sem OPeNDAP, ASCII ou texto com chuva. Nenhum código de download foi escrito. O
`get_seasonal_forecast_repository` continua com o `NoAutumnSignalDataRepository`; o sinal segue só
com a terra (SMAP + chuva recente) quando elas chegarem, e a frase diz "ainda sem a previsão da NASA".

## 4. O que precisaria (recomendação)

1. **R0.3:** o grupo de dependências `pipeline` do roteiro (`h5netcdf` ou `h5py`, mais `numpy`;
   `xarray` é opcional), num PR só dele. Só os scripts de dados usam; a API continua sem.
2. **Decisão de produto: o que é "abaixo do normal"** (bloqueia o script):
   - **(a) Tercil do próprio GEOS-S2S** (fiel ao PRD): fração dos membros com a chuva de mar–mai
     abaixo do tercil inferior das retrospectivas 1991–2024 (mesmo lead). Falta a climatologia:
     pedir ao GMAO (contato no primer) as retrospectivas mensais de `precip` ou os limites dos tercis.
     Também destrava o A2.5 (validação).
   - **(b) Abaixo da média** com a climatologia do CPC (`NASA_GEOS5v2.prate.*.clim.nc`): sai sem
     ajuda do GMAO, mas mede "chance de chover menos que a média", não o tercil. Os limiares 50% e
     33% do PRD 7.10 passam a significar outra coisa (recalibrar no A2.5).
   - **(c) Probabilidade pronta do NMME** (`prate.<aaaamm>.prob.adj.seas.nc`, MAM): já é "chance de
     abaixo do normal", mas de vários modelos e da NOAA. A `fonte` do sinal deixaria de ser
     `GEOS-S2S` (avisar o front, que mostra o nome).
3. **Com a decisão:** `pipeline/fetch_geos_s2s.py` (rodada mais recente da pasta do mês; MAM nos
   leads certos: 5 a 7 em novembro, 2 a 4 em fevereiro), arquivo de contrato `previsao_sazonal` por
   célula do POWER (`chance_abaixo_normal` de 0 a 1 e `data` da rodada), model no
   `app/models/`, um `FileSeasonalForecastRepository` e a troca em `get_seasonal_forecast_repository`.
   Uma rodada leva ~1 min (30 arquivos de 1 MiB).

## 5. Como conferir de novo

```bash
curl -s -o /dev/null -w "pasta %{http_code}\n" https://portal.nccs.nasa.gov/datashare/gmao/geos-s2s-3/NRT/NMME/monthly/
# assinatura do arquivo: 89 48 44 46 = HDF5 (NetCDF-4)
curl -s -r 0-7 https://portal.nccs.nasa.gov/datashare/gmao/geos-s2s-3/NRT/NMME/monthly/nov2026/20261028.precip.ens7.lead5.nc4 | xxd
```
