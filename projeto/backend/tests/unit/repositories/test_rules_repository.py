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
    # PRD 7.2 e 7.5: ISNA 0,55 (grão) / 0,50 (cobertura), ±15 dias, 30 dias, 35 °C x 3 dias
    regras = YamlRulesRepository(SHIPPED).get_rules()
    clima = regras.clima

    assert (clima.isna_grao, clima.isna_cobertura) == (0.55, 0.50)
    assert (clima.janela_grao_meia_dias, clima.janela_cobertura_dias) == (15, 30)
    assert (clima.calor_temp_c, clima.calor_min_dias) == (35.0, 3)
    assert (clima.perda_isna_sem_perda, clima.perda_isna_alta_abaixo) == (0.65, 0.55)
    assert (clima.perda_fator_media, clima.perda_fator_alta) == (0.30, 0.60)


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
    assert (rotulos.dinheiro_bom, rotulos.dinheiro_medio) == (70.0, 30.0)
    assert (solo.palhada_max, solo.nitrogenio_max, solo.pragas_max) == (40.0, 30.0, 30.0)
    assert solo.peso_pragas_nematoide == 1.5


def test_should_load_shipped_ndvi_and_rotation_rules() -> None:
    # PRD 7.7, 7.8 e 7.9
    regras = YamlRulesRepository(SHIPPED).get_rules()
    ndvi, rotacao = regras.ndvi, regras.rotacao

    assert (ndvi.plantou_acima, ndvi.parado_abaixo, ndvi.queda_colheita) == (0.60, 0.45, 0.50)
    assert ndvi.meses_entressafra == frozenset({4, 5, 6, 7})
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


def test_should_load_phrase_templates_in_portuguese_and_english() -> None:
    # Plano técnico §4.8: modelos de frase em regras.yaml, nas duas línguas
    regras = YamlRulesRepository(SHIPPED).get_rules()

    assert set(regras.frases) == {"pt", "en"}
    assert "{anos_aperto} dos últimos {total} anos" in regras.frases["pt"].seguranca
    assert "{anos_aperto} of the last {total} years" in regras.frases["en"].seguranca
    assert "{dias}" in regras.frases["pt"].fase_cobertura


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


def test_should_load_default_rules_from_file_shipped_with_the_app() -> None:
    assert load_default_rules() == YamlRulesRepository(SHIPPED).get_rules()
