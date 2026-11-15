"""Unit tests for YamlRulesRepository (regras.yaml: limiares, pesos e frases do motor)."""

from pathlib import Path
from typing import Any

import pytest
import yaml

from app.config import Settings
from app.repositories.rules_repository import YamlRulesRepository, load_default_rules

SHIPPED = Settings.model_fields["regras_path"].default


def _shipped_raw() -> dict[str, Any]:
    return yaml.safe_load(SHIPPED.read_text(encoding="utf-8"))


def _write(tmp_path: Path, raw: dict[str, Any]) -> Path:
    path = tmp_path / "regras.yaml"
    path.write_text(yaml.safe_dump(raw, allow_unicode=True), encoding="utf-8")
    return path


def test_should_load_shipped_regras_yaml_with_prd_thresholds() -> None:
    # PRD 7.2: ISNA 0,55 (grão) / 0,50 (cobertura), ±15 dias, 30 dias, 35 °C x 3 dias
    regras = YamlRulesRepository(SHIPPED).get_rules()
    clima = regras.clima

    assert (clima.isna_grao, clima.isna_cobertura) == (0.55, 0.50)
    assert (clima.janela_grao_meia_dias, clima.janela_cobertura_dias) == (15, 30)
    assert (clima.calor_temp_c, clima.calor_min_dias) == (35.0, 3)
    # Tarefa 0040: a perda de produtividade pelo ISNA só servia à margem em reais, que saiu.
    assert not hasattr(clima, "perda_fator_alta")


def test_should_load_the_income_rule_without_price_or_cost() -> None:
    # Tarefa 0040 (seção 1 da remodelagem): renda sem preço nem custo. Grão (grão e consórcio)
    # vale a segurança climática; cobertura e pousio não dão grão e ficam com a nota fixa.
    renda = YamlRulesRepository(SHIPPED).get_rules().renda

    assert renda.tipos_com_grao == frozenset({"grao", "consorcio"})
    assert renda.nota_sem_grao == 0.0


def test_should_refuse_an_income_rule_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["renda"]["nota_sem_grao"]["fonte"]

    with pytest.raises(ValueError, match="renda.nota_sem_grao"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_shipped_weights_labels_and_soil_points() -> None:
    # PRD 7.4 e 7.6: pesos 30/25/30/15, rótulos 17/12 anos, 50/20 e 70/30, solo 40/30/30
    regras = YamlRulesRepository(SHIPPED).get_rules()
    nota, rotulos, solo = regras.nota_final, regras.rotulos, regras.solo

    assert (nota.peso_seguranca, nota.peso_solo, nota.peso_renda, nota.peso_futuro) == (
        0.30,
        0.25,
        0.30,
        0.15,
    )
    assert nota.peso_seguranca + nota.peso_solo + nota.peso_renda + nota.peso_futuro == (
        pytest.approx(1.0)
    )
    assert nota.bonus_gado_milho_braquiaria == 15.0
    assert (rotulos.chuva_bom_pct, rotulos.chuva_medio_pct) == (85.0, 60.0)
    assert (rotulos.terra_bom, rotulos.terra_medio) == (50.0, 20.0)
    assert (rotulos.renda_bom, rotulos.renda_medio) == (70.0, 30.0)
    assert (solo.palhada_max, solo.nitrogenio_max, solo.pragas_max) == (40.0, 30.0, 30.0)
    assert solo.peso_pragas_nematoide == 1.5


def test_should_load_shipped_ndvi_and_rotation_rules() -> None:
    # PRD 7.7 e 7.9
    regras = YamlRulesRepository(SHIPPED).get_rules()
    ndvi, rotacao = regras.ndvi, regras.rotacao

    assert ndvi.queda_colheita == 0.50
    assert rotacao.anos_secos == 4
    assert rotacao.meses_seco == frozenset({2, 3, 4})
    assert rotacao.max_pousios == 2
    assert (rotacao.bonus_diversidade_2, rotacao.bonus_diversidade_3) == (5.0, 10.0)
    # R4.3: a penalidade de monocultura de milho (12, sem fonte no PRD) saiu do regras.yaml.
    assert not hasattr(rotacao, "penalidade_monocultura_milho")
    assert rotacao.culturas_supressoras_nematoide == frozenset({"crotalaria", "milheto"})


def test_should_load_crop_functions_for_rotation_diversity() -> None:
    # PRD 5 (coluna Função) e 7.7: grão, cobertura gramínea e cobertura leguminosa
    funcoes = YamlRulesRepository(SHIPPED).get_rules().rotacao.funcoes

    assert funcoes == {
        "pousio": frozenset(),
        "milho_safrinha": frozenset({"grao"}),
        "sorgo": frozenset({"grao"}),
        "milho_braquiaria": frozenset({"grao", "cobertura_graminea"}),
        "milheto": frozenset({"cobertura_graminea"}),
        "crotalaria": frozenset({"cobertura_leguminosa"}),
    }


def test_should_load_autumn_signal_thresholds() -> None:
    # PRD 7.10: seco com chance >= 50% ou terra seca (SMAP < percentil 20 e chuva < 60% da média);
    # normal com chance < 33% e terra sem falta de água
    sinal = YamlRulesRepository(SHIPPED).get_rules().sinal_outono

    assert (sinal.chance_seco_min, sinal.chance_normal_max) == (0.50, 0.33)
    assert sinal.smap_percentil_seco == 20.0
    assert sinal.chuva_fracao_seco == 0.60


def test_should_load_shipped_field_history_rules_from_the_ndvi_guide() -> None:
    # PRD 7.8 e guia do histórico NDVI ("Regra do talhão"); anos 2017 a 2026 (decisão de 15/11/2026:
    # a entressafra de 2026, de abril a julho, já aconteceu; continuam 10 anos)
    historico = YamlRulesRepository(SHIPPED).get_rules().historico_ndvi

    assert (historico.janela_inicio, historico.janela_fim) == ("04-01", "07-31")
    assert (historico.limite_plantou, historico.limite_parado) == (0.60, 0.45)
    assert historico.min_observacoes == 3
    assert (historico.ano_inicio, historico.ano_fim) == (2017, 2026)
    # O produtor confirma as 3 últimas entressafras (2024, 2025 e 2026; decisão de 15/11/2026)
    assert historico.anos_confirmaveis == 3


def test_should_load_shipped_region_soy_rules() -> None:
    # Região pelo satélite (tarefa 0036; hipótese do time, a revisar pela agrônoma): pico da soja
    # de 1/jan a 15/mar >= 0,70; colheita (NDVI <= 0,40) depois do pico até 15/mai; entressafra
    # da colheita até 31/jul
    regiao = YamlRulesRepository(SHIPPED).get_rules().regiao_ndvi

    assert (regiao.pico_inicio, regiao.pico_fim, regiao.pico_min_ndvi) == ("01-01", "03-15", 0.70)
    assert (regiao.colheita_fim, regiao.colheita_max_ndvi) == ("05-15", 0.40)
    assert regiao.entressafra_fim == "07-31"


def test_should_refuse_a_region_soy_rule_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["regiao_ndvi"]["pico_min_ndvi"]["fonte"]

    with pytest.raises(ValueError, match="regiao_ndvi.pico_min_ndvi"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_phrase_templates_in_portuguese_and_english() -> None:
    # Plano técnico §4.8: modelos de frase em regras.yaml, nas duas línguas
    regras = YamlRulesRepository(SHIPPED).get_rules()

    assert set(regras.frases) == {"pt", "en"}
    assert "{anos_aperto} dos últimos {total} anos" in regras.frases["pt"].seguranca
    assert "{anos_aperto} of the last {total} years" in regras.frases["en"].seguranca
    assert "{dias}" in regras.frases["pt"].fase_cobertura
    # PRD 7.6: frase do histórico do talhão, com o número de entressafras paradas
    assert "{parado}" in regras.frases["pt"].historico
    assert "{parado}" in regras.frases["en"].historico
    # Com safras confirmadas pelo produtor (tarefa 0039), a frase diz quantas ele confirmou
    assert "{confirmadas}" in regras.frases["pt"].historico_confirmado
    assert "{confirmadas}" in regras.frases["en"].historico_confirmado
    # Renda só com fatos (tarefa 0040): dá grão ou não e o risco de perder a lavoura
    assert regras.frases["pt"].renda_com_grao == "Dá grão para vender"
    assert regras.frases["pt"].renda_sem_grao == "Não dá grão: é investimento na terra"
    assert regras.frases["en"].renda_com_grao == "Gives grain to sell"
    assert "{anos_aperto} de {total} anos" in regras.frases["pt"].renda_risco
    assert "{anos_aperto} of {total} years" in regras.frases["en"].renda_risco


def test_should_load_shipped_alert_rules_for_the_season_replay() -> None:
    # Plano de evolução 4.4 (P4 e P6): 10 dias secos na fase crítica, 2 dias seguidos de calor,
    # no máximo 2 avisos por semana. Dia seco = menos de 1 mm (hipótese do time, índice CDD)
    avisos = YamlRulesRepository(SHIPPED).get_rules().avisos

    assert avisos.dia_seco_abaixo_mm == 1.0
    assert avisos.veranico_min_dias == 10
    assert avisos.calor_dias_seguidos == 2
    assert (avisos.max_avisos, avisos.janela_limite_dias) == (2, 7)


def test_should_load_season_event_texts_in_portuguese_and_english() -> None:
    frases = YamlRulesRepository(SHIPPED).get_rules().frases_safra

    assert set(frases) == {"pt", "en"}
    assert "{dias} dias sem chuva" in frases["pt"].aviso_veranico
    assert "{dias} days without rain" in frases["en"].aviso_veranico
    assert "{temp_c}" in frases["pt"].aviso_calor
    assert "{opcao}" in frases["en"].semeadura


def test_should_load_enso_rules_used_to_mark_each_off_season() -> None:
    # P1 (plano de evolução 4.1): El Niño com ONI de +0,5 ou mais e La Niña com −0,5 ou menos
    # (NOAA CPC), pela média das estações DJF, JFM e FMA do ano da safrinha (hipótese do time)
    enso = YamlRulesRepository(SHIPPED).get_rules().enso

    assert (enso.el_nino_oni_min, enso.la_nina_oni_max) == (0.5, -0.5)
    assert enso.estacoes == ("DJF", "JFM", "FMA")


def test_should_refuse_an_enso_number_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["enso"]["el_nino_oni_min"]["fonte"]

    with pytest.raises(ValueError, match="enso.el_nino_oni_min"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_the_recent_soybean_rule_checked_at_the_start_of_the_flow() -> None:
    # RF-24 (tarefa 0037): soja vista no pixel com o maior NDVI de 1/jan a 15/mar de 0,70 ou mais,
    # com pelo menos 2 observações boas (hipótese do time, a revisar pela agrônoma)
    soja = YamlRulesRepository(SHIPPED).get_rules().soja_recente

    assert (soja.janela_inicio, soja.janela_fim) == ("01-01", "03-15")
    assert soja.ndvi_minimo == 0.70
    assert soja.min_observacoes == 2


def test_should_keep_the_recent_soybean_rule_equal_to_the_region_soybean_peak() -> None:
    # Integração (tarefas 0036 e 0037): a soja do ponto e a soja do ano da região usam o mesmo
    # limite e a mesma janela do pico, até os dois grupos do regras.yaml virarem um só.
    regras = YamlRulesRepository(SHIPPED).get_rules()
    soja, regiao = regras.soja_recente, regras.regiao_ndvi

    assert soja.ndvi_minimo == regiao.pico_min_ndvi
    assert (soja.janela_inicio, soja.janela_fim) == (regiao.pico_inicio, regiao.pico_fim)


def test_should_refuse_a_recent_soybean_number_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["soja_recente"]["ndvi_minimo"]["fonte"]

    with pytest.raises(ValueError, match="soja_recente.ndvi_minimo"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_the_enso_forecast_signal_rules() -> None:
    # Tarefa 0038 (hipótese do time, a revisar): previsão de FMA; fase dominante com 50% ou mais;
    # 5 anos da fase no mínimo; seco quando o 1º ano do Plano A deu errado em metade ou mais deles;
    # regra da data com a chuva dos 30 dias antes da data limite; faixas do SMAP de agora
    sinal = YamlRulesRepository(SHIPPED).get_rules().sinal_enso

    assert sinal.estacao_previsao == "FMA"
    assert sinal.fase_chance_min_pct == 50
    assert sinal.anos_fase_min == 5
    assert sinal.fracao_anos_ruins_seco == 0.5
    assert sinal.dias_regra_data == 30
    assert sinal.smap_faixas_pct == (20.0, 45.0, 55.0, 80.0)


def test_should_refuse_an_enso_signal_number_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["sinal_enso"]["anos_fase_min"]["fonte"]

    with pytest.raises(ValueError, match="sinal_enso.anos_fase_min"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_year_detail_texts_in_portuguese_and_english() -> None:
    # P1: a frase de cada ano sai de um modelo do regras.yaml, sem IA generativa (RF-06)
    frases = YamlRulesRepository(SHIPPED).get_rules().frases_ano

    assert set(frases) == {"pt", "en"}
    for lang in ("pt", "en"):
        for campo in ("{ano}", "{semeadura}", "{data_fase}", "{seca}"):
            assert campo in frases[lang].fase_grao
        assert "{janela}" in frases[lang].fase_cobertura
        assert "{dias}" in frases[lang].varios_dias_sem_chuva
        assert "{temp_c}" in frases[lang].calor
    assert frases["pt"].varios_dias_sem_chuva == "ficou {dias} dias sem chuva"
    assert frases["pt"].el_nino == "Ano de El Niño."
    assert frases["en"].la_nina == "La Niña year."


def test_should_refuse_an_alert_number_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["avisos"]["veranico_min_dias"]["fonte"]

    with pytest.raises(ValueError, match="avisos.veranico_min_dias"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_read_values_from_the_file_given_by_path(tmp_path: Path) -> None:
    raw = _shipped_raw()
    raw["clima"]["isna_grao"]["valor"] = 0.7
    raw["rotacao"]["meses_seco"]["valor"] = [3]
    raw["frases"]["pt"]["solo"] = "Solo {textura}."

    regras = YamlRulesRepository(_write(tmp_path, raw)).get_rules()

    assert regras.clima.isna_grao == 0.7
    assert regras.rotacao.meses_seco == frozenset({3})
    assert regras.frases["pt"].solo == "Solo {textura}."


def test_should_refuse_a_number_without_source(tmp_path: Path) -> None:
    # Cada número do regras.yaml precisa dizer de onde veio (PRD 7 / plano técnico §5)
    raw = _shipped_raw()
    del raw["nota_final"]["peso_renda"]["fonte"]

    with pytest.raises(ValueError, match="nota_final.peso_renda"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_refuse_a_field_history_rule_without_source(tmp_path: Path) -> None:
    raw = _shipped_raw()
    del raw["historico_ndvi"]["min_observacoes"]["fonte"]

    with pytest.raises(ValueError, match="historico_ndvi.min_observacoes"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_default_rules_from_file_shipped_with_the_app() -> None:
    assert load_default_rules() == YamlRulesRepository(SHIPPED).get_rules()


# --- tela 3 "Quando você colhe a soja?" (tarefa 0042) -------------------------------------------


def test_should_load_the_harvest_band_rule_of_screen_three() -> None:
    # A regra que a tela 3 já usava (até 10/fev cedo, 11 a 20/fev meio, depois tarde) e a época
    # da colheita da soja (15/jan a 31/mar), as mesmas do front (harvestService).
    colheita = YamlRulesRepository(SHIPPED).get_rules().colheita

    assert (colheita.cedo_ate, colheita.meio_ate) == ("02-10", "02-20")
    assert (colheita.janela_inicio, colheita.janela_fim) == ("01-15", "03-31")


def test_should_load_the_rain_left_after_harvest_rule() -> None:
    # Pedido da remodelagem, seção 3: da data escolhida até 30/jun, mediana e percentil 20.
    regra = YamlRulesRepository(SHIPPED).get_rules().chuva_que_sobra

    assert (regra.fim, regra.percentil_seco) == ("06-30", 20)


def test_should_load_the_end_of_rains_rule() -> None:
    # Pedido da remodelagem, seção 3: a partir de 1º/mar, 20 dias seguidos com menos de 10 mm.
    regra = YamlRulesRepository(SHIPPED).get_rules().fim_das_chuvas

    assert (regra.inicio, regra.dias, regra.chuva_max_mm) == ("03-01", 20, 10.0)


def test_should_load_the_water_and_crop_thirst_rules_of_the_suggestion() -> None:
    # Tarefa 0044 (5.3): sede da cultura pelo consumo no ciclo (hipótese do time) e o ano seco
    # da falta de água com o mesmo sentido da tela 3 (só 20% dos anos piores).
    agua = YamlRulesRepository(SHIPPED).get_rules().agua

    assert (agua.sede_pouca_ate_mm, agua.sede_muita_desde_mm) == (280.0, 325.0)
    assert agua.percentil_seco == 20


def test_should_load_the_enso_hit_rate_and_cell_climate_rules_of_the_suggestion() -> None:
    # Tarefa 0044 (5.4): quando a diferença entre os anos de El Niño / La Niña e os outros é
    # "clara"; e os cálculos pequenos do clima 2041-2060 e da geada (a unificar com a S4 na S9).
    regras = YamlRulesRepository(SHIPPED).get_rules()

    assert (regras.enso_acerto.diferenca_min_pct, regras.enso_acerto.anos_fase_min) == (25.0, 5)
    assert regras.clima_futuro_sugestao.meses == (3, 4, 5)
    assert regras.geada_sugestao.tmin_max_c == 3.0
    assert regras.geada_sugestao.meses == (5, 6, 7)


def test_should_load_the_plan_b_rain_limit_and_the_used_rain_rules() -> None:
    # Tarefa 0045 (5.6): o limite do Plano B é a chuva dos 15 dias antes da semeadura, e só vira
    # número se separar bem os anos bons dos ruins (hipótese do time); a chuva aproveitada vai da
    # semeadura ao fim de julho.
    regras = YamlRulesRepository(SHIPPED).get_rules()

    plano_b = regras.plano_b
    assert plano_b.dias_antes_semeadura == 15
    assert plano_b.anos_falha_min == 3
    assert (plano_b.sensibilidade_min_pct, plano_b.precisao_min_pct) == (50.0, 60.0)
    assert plano_b.chance_max_pct == 10.0
    assert regras.chuva_aproveitada.fim == "07-31"


@pytest.mark.parametrize(
    "path",
    [
        ("plano_b", "precisao_min_pct"),
        ("chuva_aproveitada", "fim"),
        ("colheita", "meio_ate"),
        ("chuva_que_sobra", "percentil_seco"),
        ("fim_das_chuvas", "chuva_max_mm"),
        ("agua", "sede_muita_desde_mm"),
        ("enso_acerto", "diferenca_min_pct"),
        ("clima_futuro_sugestao", "meses"),
        ("geada_sugestao", "tmin_max_c"),
    ],
)
def test_should_refuse_a_screen_three_number_without_source(
    tmp_path: Path, path: tuple[str, str]
) -> None:
    raw = _shipped_raw()
    del raw[path[0]][path[1]]["fonte"]

    with pytest.raises(ValueError, match=".".join(path)):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_the_x_ray_rule() -> None:
    # Remodelagem S4 (tarefa 0043), seção 4 do pedido: chuva de janeiro a julho, veranico, calor e
    # a região em março a maio, solo da célula vizinha até 15 km e colunas de 16 dias do NDVI.
    regra = YamlRulesRepository(SHIPPED).get_rules().raio_x

    assert (regra.chuva_inicio, regra.chuva_fim) == ("01-01", "07-31")
    assert (regra.veranico_inicio, regra.veranico_fim) == ("03-01", "05-31")
    assert (regra.calor_inicio, regra.calor_fim) == ("03-01", "05-31")
    assert (regra.regiao_inicio, regra.regiao_fim, regra.regiao_min_celulas) == (
        "03-01",
        "05-31",
        10,
    )
    assert regra.solo_vizinho_max_km == 15.0
    assert (regra.ndvi_inicio, regra.ndvi_fim, regra.ndvi_coluna_dias) == ("01-01", "07-31", 16)
    assert (regra.futuro_mes_inicio, regra.futuro_mes_fim) == (3, 5)


def test_should_load_the_area_alerts_rule() -> None:
    # Seção 4 do pedido: geada (mínima de 3 °C ou menos de maio a julho), chuva forte (50 mm ou mais
    # em fevereiro e março) e fogo (MODIS MCD64A1 a até 5 km). Sem granizo: não existe dado.
    regra = YamlRulesRepository(SHIPPED).get_rules().alertas_area

    assert (regra.geada_temp_c, regra.geada_inicio, regra.geada_fim) == (3.0, "05-01", "07-31")
    assert regra.geada_anos_min == 1
    assert (regra.chuva_forte_mm, regra.chuva_forte_inicio, regra.chuva_forte_fim) == (
        50.0,
        "02-01",
        "03-31",
    )
    assert regra.chuva_forte_media_min_dias == 0.1
    assert (regra.fogo_raio_km, regra.fogo_anos_min) == (5.0, 1)
    assert (regra.fogo_ano_inicio, regra.fogo_ano_fim) == (2016, 2025)
    assert not hasattr(regra, "granizo_mm")


@pytest.mark.parametrize(
    "path",
    [
        ("raio_x", "veranico_inicio"),
        ("raio_x", "solo_vizinho_max_km"),
        ("alertas_area", "geada_temp_c"),
        ("alertas_area", "fogo_raio_km"),
    ],
)
def test_should_refuse_an_x_ray_number_without_source(
    tmp_path: Path, path: tuple[str, str]
) -> None:
    raw = _shipped_raw()
    del raw[path[0]][path[1]]["fonte"]

    with pytest.raises(ValueError, match=".".join(path)):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()


def test_should_load_the_alerts_screen_rule() -> None:
    # Remodelagem S6 (tarefa 0046), seção 6 do pedido: terra seca com o percentil do SMAP de 20 ou
    # menos (leitura antiga com mais de 15 dias), 30 dias do NASA POWER, 10 dias seguidos sem chuva,
    # 3 dias de calor nos últimos 10, relatos dos últimos 7 dias e 2020–2024 contra 2005–2019.
    regra = YamlRulesRepository(SHIPPED).get_rules().avisos_tela

    assert (regra.terra_seca_percentil_max, regra.smap_antiga_dias) == (20.0, 15)
    assert (regra.power_dias, regra.dias_sem_chuva_min) == (30, 10)
    assert (regra.calor_dias_min, regra.calor_janela_dias) == (3, 10)
    assert regra.vizinhos_dias == 7
    assert regra.ano_recente_inicio == 2020
    assert (regra.outono_inicio, regra.outono_fim) == ("03-01", "05-31")
    assert regra.mudou_veranico_dias_min > 0
    assert regra.mudou_fim_chuvas_dias_min > 0
    assert regra.mudou_calor_dias_min > 0
    assert regra.mudou_falta_agua_mm_min > 0
    assert regra.mudou_deu_certo_pct_min > 0


def test_should_keep_the_crop_alerts_group_as_it_was() -> None:
    # O grupo `avisos` (replay P4 e acompanhamento P6) continua igual: a tela /avisos tem o dela.
    regra = YamlRulesRepository(SHIPPED).get_rules().avisos

    assert (regra.dia_seco_abaixo_mm, regra.veranico_min_dias) == (1.0, 10)
    assert not hasattr(regra, "terra_seca_percentil_max")


@pytest.mark.parametrize(
    "field", ["terra_seca_percentil_max", "dias_sem_chuva_min", "mudou_falta_agua_mm_min"]
)
def test_should_refuse_an_alerts_screen_number_without_source(tmp_path: Path, field: str) -> None:
    raw = _shipped_raw()
    del raw["avisos_tela"][field]["fonte"]

    with pytest.raises(ValueError, match=f"avisos_tela.{field}"):
        YamlRulesRepository(_write(tmp_path, raw)).get_rules()
