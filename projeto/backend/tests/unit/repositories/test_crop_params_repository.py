"""Unit tests for YamlCropParamsRepository."""

from pathlib import Path

from app.config import Settings
from app.repositories.crop_params_repository import YamlCropParamsRepository

YAML = """
culturas:
  pousio:
    nome: "Pousio"
    tipo: "pousio"
    funcao: "Nenhuma"
    semeadura_limite_mes_dia: null
    dias_florescer: 0
    ciclo_dias: 0
    kc_pico: 0.0
    nota_solo: {palhada: 0, nitrogenio: 0, pragas: 0}
    n_deixado_kg: 0
  sorgo_granifero:
    nome: "Sorgo Granífero"
    nome_en: "Grain sorghum"
    tipo: "grao"
    funcao: "Grão"
    semeadura_limite_mes_dia: "03-20"
    dias_florescer: 65
    ciclo_dias: 115
    kc_pico: 1.05
    nota_solo: {palhada: 20, nitrogenio: 0, pragas: 15}
    n_deixado_kg: 0
    produtividade_padrao_sc_ha: 60.0
    preco_padrao_saca: 49.6
    custo_padrao_ha: 2200.0
    como_fazer: ["Semeie logo depois da soja."]
  crotalaria_spectabilis:
    nome: "Crotalária spectabilis"
    tipo: "cobertura"
    funcao: "Cobertura leguminosa"
    semeadura_limite_mes_dia: "02-28"
    dias_florescer: 60
    ciclo_dias: 100
    kc_pico: 1.0
    nota_solo: {palhada: 25, nitrogenio: 30, pragas: 30}
    n_deixado_kg: 80
    custo_padrao_ha: 800.0
"""


def _repo(tmp_path: Path) -> YamlCropParamsRepository:
    path = tmp_path / "culturas.yaml"
    path.write_text(YAML, encoding="utf-8")
    return YamlCropParamsRepository(path)


def test_should_load_crops_with_canonical_ids_in_file_order(tmp_path: Path) -> None:
    crops = _repo(tmp_path).list_all()

    assert [c.id for c in crops] == ["pousio", "sorgo", "crotalaria"]


def test_should_read_soil_points_from_prd_table(tmp_path: Path) -> None:
    crotalaria = _repo(tmp_path).get_by_id("crotalaria")

    assert crotalaria is not None
    assert (crotalaria.solo_palhada, crotalaria.solo_nitrogenio, crotalaria.solo_pragas) == (
        25,
        30,
        30,
    )
    assert crotalaria.n_deixado_kg == 80


def test_should_default_money_fields_to_zero_when_crop_has_no_grain(tmp_path: Path) -> None:
    # Coberturas e pousio não têm produtividade nem preço (era o KeyError que dava HTTP 500).
    repo = _repo(tmp_path)
    crotalaria = repo.get_by_id("crotalaria")
    pousio = repo.get_by_id("pousio")

    assert crotalaria is not None and pousio is not None
    assert crotalaria.produtividade_padrao_sc_ha == 0.0
    assert crotalaria.preco_padrao_saca == 0.0
    assert crotalaria.custo_padrao_ha == 800.0
    assert pousio.custo_padrao_ha == 0.0


def test_should_return_crop_params_when_queried_by_canonical_or_alias_id(tmp_path: Path) -> None:
    repo = _repo(tmp_path)

    sorgo = repo.get_by_id("sorgo")

    assert sorgo is not None
    assert sorgo.semeadura_limite_mes_dia == "03-20"
    assert sorgo.nome_en == "Grain sorghum"
    assert sorgo.como_fazer == ("Semeie logo depois da soja.",)
    assert repo.get_by_id("sorgo_granifero") == sorgo
    assert repo.get_by_id("trigo_inverno") is None


def test_should_load_shipped_culturas_yaml_with_prd_soil_points() -> None:
    # O culturas.yaml que vai junto com a API precisa carregar (PRD 7.4: totais da nota de solo).
    repo = YamlCropParamsRepository(Settings(_env_file=None).culturas_path)

    totals = {c.id: c.solo_palhada + c.solo_nitrogenio + c.solo_pragas for c in repo.list_all()}

    assert totals == {
        "pousio": 0,
        "milho_safrinha": 20,
        "sorgo": 35,
        "milho_braquiaria": 50,
        "milheto": 55,
        "crotalaria": 85,
    }
