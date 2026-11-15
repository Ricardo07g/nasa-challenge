"""As regras da tela "Como a conta é feita" saem do regras.yaml (S9 da remodelagem, tarefa 0049).

A tela não pode repetir número fixo: cada limite que ela cita vem daqui, lido das regras injetadas.
"""

from dataclasses import replace

from app.repositories.rules_repository import load_default_rules
from app.services.method_service import MethodService


def test_should_take_every_number_of_the_method_screen_from_the_rules() -> None:
    regras = load_default_rules()

    metodo = MethodService(regras).rules()

    clima = regras.clima
    assert metodo.deu_certo.isna_grao_pct == round(clima.isna_grao * 100)
    assert metodo.deu_certo.isna_cobertura_pct == round(clima.isna_cobertura * 100)
    assert metodo.deu_certo.janela_grao_meia_dias == clima.janela_grao_meia_dias
    assert metodo.deu_certo.janela_cobertura_dias == clima.janela_cobertura_dias
    assert (metodo.deu_certo.calor_temp_c, metodo.deu_certo.calor_min_dias) == (
        clima.calor_temp_c,
        clima.calor_min_dias,
    )
    pesos = regras.nota_final
    assert (metodo.pesos.seguranca_pct, metodo.pesos.renda_pct) == (
        round(pesos.peso_seguranca * 100),
        round(pesos.peso_renda * 100),
    )
    assert metodo.renda.tipos_com_grao == tuple(sorted(regras.renda.tipos_com_grao))
    assert metodo.renda.nota_sem_grao == regras.renda.nota_sem_grao
    assert (metodo.agua.sede_pouca_ate_mm, metodo.agua.sede_muita_desde_mm) == (
        regras.agua.sede_pouca_ate_mm,
        regras.agua.sede_muita_desde_mm,
    )
    assert metodo.rotacao.culturas_supressoras_nematoide == tuple(
        sorted(regras.rotacao.culturas_supressoras_nematoide)
    )
    assert metodo.plano_b.dias_antes_semeadura == regras.plano_b.dias_antes_semeadura
    assert metodo.alertas.geada_temp_c == regras.alertas_area.geada_temp_c
    assert metodo.alertas.fogo_raio_km == regras.alertas_area.fogo_raio_km
    assert metodo.avisos.terra_seca_percentil_max == regras.avisos_tela.terra_seca_percentil_max
    assert metodo.avisos.raio_km == regras.comunidade.raio_km
    assert metodo.sinal.fase_chance_min_pct == regras.sinal_enso.fase_chance_min_pct


def test_should_follow_the_injected_rules_not_fixed_numbers() -> None:
    base = load_default_rules()
    rules = replace(
        base,
        clima=replace(base.clima, isna_grao=0.6, calor_min_dias=2),
        agua=replace(base.agua, sede_pouca_ate_mm=250.0),
    )

    metodo = MethodService(rules).rules()

    assert (metodo.deu_certo.isna_grao_pct, metodo.deu_certo.calor_min_dias) == (60, 2)
    assert metodo.agua.sede_pouca_ate_mm == 250.0
