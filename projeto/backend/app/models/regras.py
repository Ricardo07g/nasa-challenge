"""Regras de negócio do motor de pontuação (PRD 7), lidas do `regras.yaml`.

Os nomes seguem as chaves do arquivo, que a agrônoma edita (por isso em português).
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RegrasClima:
    """Aperto de água e calor por ano (PRD 7.2)."""

    isna_grao: float
    isna_cobertura: float
    janela_grao_meia_dias: int
    janela_cobertura_dias: int
    calor_temp_c: float
    calor_min_dias: int
    # ISNA mínimo próprio de uma cultura, do ZARC dela (tarefa 0066); as outras ficam com o do tipo.
    isna_por_cultura: dict[str, float] = field(default_factory=dict)

    def isna_min(self, crop_id: str, *, cobertura: bool) -> float:
        """O ISNA abaixo do qual faltou água: o da cultura, ou o do grão ou o da cobertura."""
        padrao = self.isna_cobertura if cobertura else self.isna_grao
        return self.isna_por_cultura.get(crop_id, padrao)


@dataclass(frozen=True)
class RegrasNotaFinal:
    """Pesos da nota final (PRD 7.6) e bônus da pecuária (ADR-0004)."""

    peso_seguranca: float
    peso_solo: float
    peso_renda: float
    peso_futuro: float
    bonus_gado_milho_braquiaria: float


@dataclass(frozen=True)
class RegrasRotulos:
    """Limiares dos rótulos Bom / Médio / Fraco que o produtor vê (PRD 7.6)."""

    chuva_bom_pct: float
    chuva_medio_pct: float
    terra_bom: float
    terra_medio: float
    renda_bom: float
    renda_medio: float


@dataclass(frozen=True)
class RegrasRenda:
    """Nota de renda sem preço nem custo (PRD 7.5, tarefa 0040).

    A cultura cujo `tipo` (culturas.yaml) está em `tipos_com_grao` dá grão para vender: a nota de
    renda é a segurança climática dela (anos bons / total x 100). As outras (cobertura, pousio) não
    dão grão e ficam com `nota_sem_grao`.
    """

    tipos_com_grao: frozenset[str]
    nota_sem_grao: float


@dataclass(frozen=True)
class RegrasSolo:
    """Máximos da nota de solo e peso das pragas com nematoide (PRD 7.4)."""

    palhada_max: float
    nitrogenio_max: float
    pragas_max: float
    peso_pragas_nematoide: float


@dataclass(frozen=True)
class RegrasNdvi:
    """Queda da soja para a colheita sugerida (PRD 7.9). O histórico fica em RegrasHistoricoNdvi."""

    queda_colheita: float


@dataclass(frozen=True)
class RegrasColheita:
    """Faixas de colheita da tela 3 e a época da colheita da soja (tarefa 0042).

    Datas "MM-DD", inclusivas: até `cedo_ate` (e janeiro) é cedo; até `meio_ate`, meio; depois,
    tarde. A data exata do produtor e a faixa sugerida pelo NDVI usam a mesma regra. A época vai de
    `janela_inicio` a `janela_fim` (a do campo de data da tela 3).
    """

    cedo_ate: str
    meio_ate: str
    janela_inicio: str
    janela_fim: str


@dataclass(frozen=True)
class RegrasChuvaQueSobra:
    """Chuva que sobra depois da colheita (tela 3, tarefa 0042).

    Do dia da colheita até `fim` ("MM-DD", inclusive): a mediana dos anos e o ano seco
    (`percentil_seco`, de 0 a 100).
    """

    fim: str
    percentil_seco: int


@dataclass(frozen=True)
class RegrasFimDasChuvas:
    """Fim das chuvas na célula (tela 3, tarefa 0042).

    Primeiro dia, a partir de `inicio` ("MM-DD"), que começa `dias` dias seguidos com menos de
    `chuva_max_mm` mm somados.
    """

    inicio: str
    dias: int
    chuva_max_mm: float


@dataclass(frozen=True)
class RegrasRaioX:
    """Raio-X da sua terra (tela 4, remodelagem S4, tarefa 0043). Datas "MM-DD", inclusivas.

    O dia seco é o dos avisos (`avisos.dia_seco_abaixo_mm`), o calor é o do motor
    (`clima.calor_temp_c`) e a janela em volta da floração é a do aperto
    (`clima.janela_grao_meia_dias`): não se repetem aqui.
    """

    chuva_inicio: str
    chuva_fim: str
    veranico_inicio: str
    veranico_fim: str
    calor_inicio: str
    calor_fim: str
    regiao_inicio: str
    regiao_fim: str
    regiao_min_celulas: int
    solo_vizinho_max_km: float
    ndvi_inicio: str
    ndvi_fim: str
    ndvi_coluna_dias: int
    futuro_mes_inicio: int
    futuro_mes_fim: int


@dataclass(frozen=True)
class RegrasAlertasArea:
    """Alertas da sua área (tela 4, tarefa 0043): cada um só aparece se o dado indicar risco.

    Sem granizo: nenhuma fonte que o app usa mede granizo.
    """

    geada_temp_c: float
    geada_inicio: str
    geada_fim: str
    geada_anos_min: int
    chuva_forte_mm: float
    chuva_forte_inicio: str
    chuva_forte_fim: str
    chuva_forte_media_min_dias: float
    fogo_raio_km: float
    fogo_anos_min: int
    fogo_ano_inicio: int
    fogo_ano_fim: int


@dataclass(frozen=True)
class RegrasHistoricoNdvi:
    """Histórico do talhão pelo NDVI do MODIS (PRD 7.8 e guia do histórico NDVI).

    `janela_inicio` e `janela_fim` são "MM-DD" (a entressafra de cada ano); os anos vão de
    `ano_inicio` a `ano_fim`, inclusive. O produtor pode confirmar as `anos_confirmaveis` últimas
    entressafras (tarefa 0039): a resposta dele vale no lugar do satélite naquele ano.
    """

    janela_inicio: str
    janela_fim: str
    limite_plantou: float
    limite_parado: float
    min_observacoes: int
    ano_inicio: int
    ano_fim: int
    anos_confirmaveis: int


@dataclass(frozen=True)
class RegrasRegiaoNdvi:
    """Soja do ano em cada pixel da região pelo satélite (P3, tarefa 0036).

    Um pixel da máscara de lavoura só conta se mostrar a soja e a colheita: o maior NDVI de
    `pico_inicio` a `pico_fim` chega a `pico_min_ndvi`, e depois do pico, até `colheita_fim`,
    alguma observação fica em `colheita_max_ndvi` ou menos (a primeira é a data da colheita).
    A entressafra usa as observações depois da colheita até `entressafra_fim`. Datas "MM-DD".
    """

    pico_inicio: str
    pico_fim: str
    pico_min_ndvi: float
    colheita_fim: str
    colheita_max_ndvi: float
    entressafra_fim: str


@dataclass(frozen=True)
class RegrasSojaRecente:
    """Soja vista no ponto na safra mais recente (RF-24, tarefa 0037).

    No pixel de 250 m do MODIS, a soja foi vista quando o maior NDVI das observações boas
    (qualidade 0 ou 1, Terra e Aqua) de `janela_inicio` a `janela_fim` ("MM-DD") é `ndvi_minimo`
    ou mais. Com menos de `min_observacoes` observações boas na janela, o pixel fica sem dado.
    """

    janela_inicio: str
    janela_fim: str
    ndvi_minimo: float
    min_observacoes: int


@dataclass(frozen=True)
class RegrasRotacao:
    """Plano de 3 anos (PRD 7.7)."""

    anos_secos: int
    meses_seco: frozenset[int]
    max_pousios: int
    bonus_diversidade_2: float
    bonus_diversidade_3: float
    culturas_supressoras_nematoide: frozenset[str]
    # Funções de cada cultura para o bônus de diversidade: grao, cobertura_graminea,
    # cobertura_leguminosa (PRD 5 e 7.7). Cultura sem função (pousio) fica com o conjunto vazio.
    funcoes: dict[str, frozenset[str]]


@dataclass(frozen=True)
class RegrasSinalOutono:
    """Sinal para o outono (PRD 7.10, RF-20): limiares da previsão sazonal e da terra seca."""

    chance_seco_min: float  # chance (0 a 1) de chuva abaixo do normal que já é sinal de seco
    chance_normal_max: float  # abaixo disso (e com a terra sem falta de água) é sinal de normal
    smap_percentil_seco: float  # terra seca: percentil do SMAP abaixo disso...
    chuva_fracao_seco: float  # ...e chuva recente abaixo desta fração da média (sem uso)


@dataclass(frozen=True)
class RegrasSinalEnso:
    """Sinal para o outono pela previsão do ENSO e o histórico da opção (tarefa 0038)."""

    estacao_previsao: str  # estação da previsão que vale para o outono da safrinha (ex.: FMA)
    fase_chance_min_pct: int  # chance mínima (%) da fase mais provável para haver sinal
    anos_fase_min: int  # mínimo de anos daquela fase na série para contar o histórico
    fracao_anos_ruins_seco: float  # anos ruins do Plano A na fase a partir dos quais é seco
    smap_faixas_pct: tuple[float, ...]  # percentis do SMAP que separam as faixas da frase
    # Tarefa 0066: o seco também pede a fase pior que os outros anos, com o teste exato de Fisher
    # unilateral (hipergeométrico) com p de até este valor
    p_max_seco: float = 0.10


@dataclass(frozen=True)
class RegrasAvisos:
    """Avisos de veranico e calor da safra (plano de evolução 4.4: replay P4 e acompanhamento P6).

    A janela crítica e a temperatura do calor são as mesmas da conta do aperto (`RegrasClima`).
    """

    dia_seco_abaixo_mm: float
    veranico_min_dias: int
    calor_dias_seguidos: int
    max_avisos: int
    janela_limite_dias: int


@dataclass(frozen=True)
class RegrasAvisosTela:
    """Tela "Avisos" (/avisos, remodelagem S6, tarefa 0046). À parte do `RegrasAvisos` (P4 e P6).

    Agora: terra seca com o percentil do SMAP até `terra_seca_percentil_max` (leitura antiga com
    mais de `smap_antiga_dias`); nos últimos `power_dias` do NASA POWER, `dias_sem_chuva_min` dias
    seguidos sem chuva até a última leitura ou `calor_dias_min` dias de calor nos últimos
    `calor_janela_dias`. Perto: relatos dos últimos `vizinhos_dias`. O que mudou: os anos desde
    `ano_recente_inicio` contra os de antes, só com a diferença mínima de cada `mudou_*`.
    """

    terra_seca_percentil_max: float
    smap_antiga_dias: int
    power_dias: int
    dias_sem_chuva_min: int
    calor_dias_min: int
    calor_janela_dias: int
    vizinhos_dias: int
    ano_recente_inicio: int
    outono_inicio: str
    outono_fim: str
    mudou_veranico_dias_min: float
    mudou_fim_chuvas_dias_min: int
    mudou_calor_dias_min: float
    mudou_falta_agua_mm_min: float
    mudou_deu_certo_pct_min: float


@dataclass(frozen=True)
class FrasesSafra:
    """Textos dos eventos da linha do tempo da safra em uma língua (P4 e P6)."""

    semeadura: str
    sem_chuva: str
    aviso_veranico: str
    fase_critica_grao: str
    fase_critica_cobertura: str
    voltou_chuva: str
    aviso_calor: str
    colheita_grao: str
    colheita_consorcio: str
    colheita_cobertura: str


@dataclass(frozen=True)
class RegrasEnso:
    """Marca de El Niño / La Niña de cada safrinha pelo ONI da NOAA (P1, plano de evolução 4.1).

    Só informa: não entra na conta. O `pipeline/fetch_oni.py` usa estes números ao gravar a fase
    de cada ano no arquivo do ONI; a API lê a fase pronta.
    """

    el_nino_oni_min: float  # média do ONI nas estações a partir da qual o ano é de El Niño
    la_nina_oni_max: float  # média do ONI nas estações até a qual o ano é de La Niña
    estacoes: tuple[str, ...]  # estações do ONI (ex.: DJF) do ano da safrinha que entram na média


@dataclass(frozen=True)
class FrasesAno:
    """Textos do detalhe de cada ano da faixa de chuva em uma língua (P1)."""

    fase_grao: str
    fase_cobertura: str
    nenhum_dia_sem_chuva: str
    um_dia_sem_chuva: str
    varios_dias_sem_chuva: str
    deu_certo: str
    faltou_agua: str
    calor: str
    el_nino: str
    la_nina: str


@dataclass(frozen=True)
class FrasesPorque:
    """Modelos de frase do "Por quê?" em uma língua (PRD 7.6, plano técnico §4.8)."""

    seguranca: str
    fase_grao: str
    fase_cobertura: str
    futuro: str
    solo: str
    historico: str
    balde_smap: str
    # Cultura fora da janela de plantio para a faixa de colheita: {cultura}, {limite}, {faixa}
    fora_da_janela: str
    # O mesmo, para a cultura sem ZARC (crotalária, tarefa 0066): a data é sugestão do app
    fora_da_janela_sugerida: str
    # A faixa de colheita por extenso, para as frases (a chave interna nunca aparece na tela)
    colheita_cedo: str
    colheita_meio: str
    colheita_tarde: str
    # Histórico com safras confirmadas pelo produtor (tarefa 0039): {confirmadas} {vistas}
    historico_confirmado: str
    # Renda só com fatos (tarefa 0040): dá grão ou não, e o risco de perder a lavoura
    # ({anos_aperto} {total})
    renda_com_grao: str
    renda_sem_grao: str
    renda_risco: str


@dataclass(frozen=True)
class RegrasComunidade:
    """Relatos da comunidade sem cadastro (seção 7 da remodelagem, tarefa 0047).

    `raio_km` é o raio padrão da redondeza e `raio_max_km` o maior que a listagem aceita; a chuva
    vai de 0 a `chuva_max_mm` por dia; datas de chuva e evento de no máximo `dias_atras_max` dias
    atrás; no máximo `max_relatos_por_dia` relatos por aparelho nas últimas 24 horas.
    """

    raio_km: float
    raio_max_km: float
    chuva_max_mm: float
    dias_atras_max: int
    max_relatos_por_dia: int


@dataclass(frozen=True)
class RegrasAgua:
    """Linha "Água" e selo "Sede da cultura" da aba Sugestão (seção 5.3, tarefa 0044).

    Consumo da cultura no ciclo (mediana do ETc dos anos) abaixo de `sede_pouca_ate_mm` = pouca
    água; de `sede_muita_desde_mm` para cima = muita; entre os dois, média. O ano seco da falta de
    água é aquele em que só `percentil_seco`% dos anos tiveram falta maior.
    """

    sede_pouca_ate_mm: float
    sede_muita_desde_mm: float
    percentil_seco: int


@dataclass(frozen=True)
class RegrasEnsoAcerto:
    """Quando a taxa de acerto nos anos de El Niño / La Niña difere "claramente" dos outros anos.

    Clara = pelo menos `anos_fase_min` anos da fase e diferença de `diferenca_min_pct` pontos
    percentuais ou mais entre a fase e os outros anos (tarefa 0044).
    """

    diferenca_min_pct: float
    anos_fase_min: int


@dataclass(frozen=True)
class RegrasPlanoB:
    """Quando o limite de chuva do Plano B "separa bem" os anos bons dos ruins (tarefa 0045).

    "Secou" = chuva dos `dias_antes_semeadura` dias antes da semeadura abaixo do limite. O número só
    aparece com `anos_falha_min` anos de falha ou mais, pegando `sensibilidade_min_pct`% das falhas,
    com `precisao_min_pct`% dos anos marcados sendo de falha e chance ao acaso de até
    `chance_max_pct`%.
    """

    dias_antes_semeadura: int
    anos_falha_min: int
    sensibilidade_min_pct: float
    precisao_min_pct: float
    chance_max_pct: float


@dataclass(frozen=True)
class RegrasChuvaAproveitada:
    """Fim ("MM-DD") da janela da chuva aproveitada, que começa na semeadura (tarefa 0045)."""

    fim: str


@dataclass(frozen=True)
class RegrasPlanoCadeia:
    """Sugestão em cadeia do plano de 3 anos (tarefa 0056): o que pesa o ano anterior.

    Pontos somados à nota do plano (como o bônus de diversidade do PRD 7.7), por ano sugerido:
    depois de deixar parado, uma cobertura que cobre rápido; depois do milho, uma supressora do
    nematoide (`rotacao.culturas_supressoras_nematoide`); e uma função diferente da do ano
    anterior (`rotacao.funcoes`). Hipótese do time, a revisar pela agrônoma.
    """

    bonus_cobrir_depois_do_parado: float
    bonus_quebrar_nematoide_depois_do_milho: float
    bonus_variar_funcao: float
    culturas_cobertura_rapida: frozenset[str]
    culturas_que_multiplicam_nematoide: frozenset[str]


@dataclass(frozen=True)
class FrasesPlano:
    """O "Por quê:" de cada ano sugerido do plano de 3 anos em uma língua (tarefa 0056).

    Sem o nome da cultura: a tela mostra o nome logo antes ("Para 2028/29 agora sugerimos
    Milheto: a terra ficou descoberta; cobre rápido e pede pouca água.").
    `prazo` e `prazo_sugerido` (cultura sem ZARC, tarefa 0066): {cultura_fora} {limite_fora}
    {limite}; `aguenta_seca`: {motivo}.
    """

    cobrir_depois_do_parado: str
    quebrar_nematoide_depois_do_milho: str
    grao_depois_da_cobertura: str
    cobertura_depois_do_grao: str
    variar_funcao: str
    prazo: str
    prazo_sugerido: str
    melhor_nota: str
    aguenta_seca: str


@dataclass(frozen=True)
class Regras:
    """Todas as regras do motor, versão 0 (PRD 7)."""

    clima: RegrasClima
    nota_final: RegrasNotaFinal
    rotulos: RegrasRotulos
    renda: RegrasRenda
    solo: RegrasSolo
    ndvi: RegrasNdvi
    historico_ndvi: RegrasHistoricoNdvi
    regiao_ndvi: RegrasRegiaoNdvi
    rotacao: RegrasRotacao
    sinal_outono: RegrasSinalOutono
    frases: dict[str, FrasesPorque]  # "pt" e "en"
    avisos: RegrasAvisos
    avisos_tela: RegrasAvisosTela
    frases_safra: dict[str, FrasesSafra]  # "pt" e "en"
    enso: RegrasEnso
    frases_ano: dict[str, FrasesAno]  # "pt" e "en"
    soja_recente: RegrasSojaRecente
    sinal_enso: RegrasSinalEnso
    colheita: RegrasColheita
    chuva_que_sobra: RegrasChuvaQueSobra
    fim_das_chuvas: RegrasFimDasChuvas
    comunidade: RegrasComunidade
    raio_x: RegrasRaioX
    alertas_area: RegrasAlertasArea
    agua: RegrasAgua
    enso_acerto: RegrasEnsoAcerto
    plano_b: RegrasPlanoB
    chuva_aproveitada: RegrasChuvaAproveitada
    plano_cadeia: RegrasPlanoCadeia
    frases_plano: dict[str, FrasesPlano]  # "pt" e "en"
    # Fonte de cada regra da tela "Como a conta é feita" (grupo `fontes_metodo`, tarefa 0066)
    fontes_metodo: dict[str, "FonteMetodo"] = field(default_factory=dict)


HIPOTESE_NIVEIS = frozenset({"nao", "parte", "sim"})


@dataclass(frozen=True)
class FonteCitacao:
    """Uma fonte conferida, em forma curta (autores, ano, revista ou portaria) e o link aberto."""

    citacao: str
    url: str | None = None


@dataclass(frozen=True)
class FonteMetodo:
    """De onde vêm os números de uma regra da tela "Como a conta é feita" (tarefa 0066).

    `hipotese`: "nao" (todos os números têm fonte), "parte" (algum continua hipótese do time) ou
    "sim" (nenhum tem fonte: a regra toda é hipótese do time, ainda não validada em campo).
    """

    citacoes: tuple[FonteCitacao, ...]
    hipotese: str

    def __post_init__(self) -> None:
        if self.hipotese not in HIPOTESE_NIVEIS:
            raise ValueError(f"hipotese deve ser nao, parte ou sim: {self.hipotese!r}")
        if self.hipotese != "sim" and not self.citacoes:
            raise ValueError("regra com fonte precisa de pelo menos uma citação")
