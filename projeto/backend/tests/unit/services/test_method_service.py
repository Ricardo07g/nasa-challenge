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


def test_should_send_the_zarc_isna_of_each_crop_in_percent() -> None:
    # Tarefa 0066: o ZARC de MG tem um ISNA por cultura; a tela diz qual
    metodo = MethodService(load_default_rules()).rules()

    assert metodo.deu_certo.isna_por_cultura_pct == {
        "milho_braquiaria": 50,
        "milheto": 60,
        "sorgo": 45,
    }


def test_should_send_the_source_of_each_rule_and_whether_it_is_a_team_hypothesis() -> None:
    # Tarefa 0066: cada regra mostra a fonte quando há; "ainda não validado em campo" fica só no
    # que continua hipótese do time (toda a regra ou parte dela).
    fontes = MethodService(load_default_rules()).rules().fontes

    assert set(fontes) == {
        "deu_certo",
        "pesos",
        "renda",
        "agua",
        "sede",
        "rotacao",
        "plano_b",
        "geada",
        "chuva_forte",
        "fogo",
        "avisos",
        "sinal",
    }
    assert {chave: f.hipotese for chave, f in fontes.items()} == {
        "deu_certo": "parte",
        "pesos": "sim",
        "renda": "sim",
        "agua": "nao",
        "sede": "sim",
        "rotacao": "parte",
        "plano_b": "sim",
        "geada": "nao",
        "chuva_forte": "nao",
        "fogo": "sim",
        "avisos": "parte",
        "sinal": "parte",
    }
    for chave, fonte in fontes.items():
        if fonte.hipotese != "sim":
            assert fonte.citacoes, chave
        assert all(c.citacao.strip() for c in fonte.citacoes)
    assert any("Portaria SPA/MAPA" in c.citacao for c in fontes["deu_certo"].citacoes)
    assert any("Debiasi" in c.citacao for c in fontes["rotacao"].citacoes)


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
