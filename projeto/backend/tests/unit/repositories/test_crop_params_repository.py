"""Unit tests for YamlCropParamsRepository."""

from pathlib import Path

import yaml

from app.config import Settings
from app.repositories.crop_params_repository import YamlCropParamsRepository

# O culturas.yaml que vai junto com a API (caminho padrão, sem ler variável de ambiente).
SHIPPED_CULTURAS = Settings.model_fields["culturas_path"].default

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


def test_should_ignore_old_money_keys_and_keep_no_price_or_cost(tmp_path: Path) -> None:
    # Tarefa 0040: a renda não usa preço, custo nem produtividade. Um YAML antigo com essas chaves
    # ainda carrega (são ignoradas), e o parâmetro da cultura não as guarda.
    sorgo = _repo(tmp_path).get_by_id("sorgo")

    assert sorgo is not None
    for campo in ("produtividade_padrao_sc_ha", "preco_padrao_saca", "custo_padrao_ha"):
        assert not hasattr(sorgo, campo)


def test_should_ship_culturas_yaml_without_price_cost_or_yield() -> None:
    raw = yaml.safe_load(SHIPPED_CULTURAS.read_text(encoding="utf-8"))

    for crop_id, data in raw["culturas"].items():
        for campo in ("produtividade_padrao_sc_ha", "preco_padrao_saca", "custo_padrao_ha"):
            assert campo not in data, f"{crop_id}.{campo}"


def test_should_ship_zarc_deadlines_of_uberlandia_and_uberaba() -> None:
    """Prazos do ZARC de MG vigentes (tarefa 0066): último decêndio com risco de até 20%, Grupo I,
    no solo que mais guarda água, o mais cedo entre Uberlândia e Uberaba. Crotalária sem ZARC."""
    repo = YamlCropParamsRepository(SHIPPED_CULTURAS)

    limites = {c.id: c.semeadura_limite_mes_dia for c in repo.list_all()}
    zarc = {c.id: c.prazo_zarc for c in repo.list_all()}

    assert limites["milho_safrinha"] == "02-10"
    assert limites["milho_braquiaria"] == "02-10"
    assert limites["sorgo"] == "03-20"
    assert limites["milheto"] == "04-20"
    assert limites["crotalaria"] == "02-28"
    assert zarc == {
        "pousio": False,
        "milho_safrinha": True,
        "milho_braquiaria": True,
        "sorgo": True,
        "milheto": True,
        "crotalaria": False,
    }


def test_should_ship_a_source_for_every_number_of_each_crop() -> None:
    """Cada número de cada cultura diz de onde veio (tarefa 0066): citação ou "hipótese do time"."""
    raw = yaml.safe_load(SHIPPED_CULTURAS.read_text(encoding="utf-8"))
    campos = (
        "semeadura_limite_mes_dia",
        "dias_florescer",
        "ciclo_dias",
        "kc_pico",
        "nota_solo",
        "n_deixado_kg",
    )

    for crop_id, data in raw["culturas"].items():
        if crop_id == "pousio":
            continue
        fontes = data.get("fontes") or {}
        for campo in campos:
            assert str(fontes.get(campo) or "").strip(), f"{crop_id}.fontes.{campo}"


def test_should_ship_soil_points_backed_by_the_nematode_field_trial() -> None:
    """Debiasi et al. (2016): só as crotalárias reduziram o nematoide das lesões; milho, sorgo,
    braquiárias e milheto sozinho não diferiram da testemunha (tarefa 0066)."""
    repo = YamlCropParamsRepository(SHIPPED_CULTURAS)

    pragas = {c.id: c.solo_pragas for c in repo.list_all()}
    floracao = {c.id: c.dias_florescer for c in repo.list_all()}

    assert pragas == {
        "pousio": 0,
        "milho_safrinha": 0,
        "sorgo": 0,
        "milho_braquiaria": 0,
        "milheto": 0,
        "crotalaria": 30,
    }
    assert floracao["crotalaria"] == 70


def test_should_return_crop_params_when_queried_by_canonical_or_alias_id(tmp_path: Path) -> None:
    repo = _repo(tmp_path)

    sorgo = repo.get_by_id("sorgo")

    assert sorgo is not None
    assert sorgo.semeadura_limite_mes_dia == "03-20"
    assert sorgo.nome_en == "Grain sorghum"
    assert sorgo.como_fazer == ("Semeie logo depois da soja.",)
    assert repo.get_by_id("sorgo_granifero") == sorgo
    assert repo.get_by_id("trigo_inverno") is None


def test_should_read_how_to_steps_in_portuguese_and_english(tmp_path: Path) -> None:
    path = tmp_path / "culturas.yaml"
    path.write_text(
        YAML
        + """
  milheto:
    nome: "Milheto"
    nome_en: "Pearl millet"
    tipo: "cobertura"
    funcao: "Cobertura"
    semeadura_limite_mes_dia: "03-15"
    dias_florescer: 50
    ciclo_dias: 90
    kc_pico: 1.0
    nota_solo: {palhada: 35, nitrogenio: 0, pragas: 20}
    n_deixado_kg: 0
    como_fazer: ["Semeie o milheto.", "Deixe formar palha."]
    como_fazer_en: ["Sow the pearl millet.", "Let it form straw."]
""",
        encoding="utf-8",
    )
    repo = YamlCropParamsRepository(path)

    milheto = repo.get_by_id("milheto")
    sorgo = repo.get_by_id("sorgo")

    assert milheto is not None and sorgo is not None
    assert milheto.como_fazer == ("Semeie o milheto.", "Deixe formar palha.")
    assert milheto.como_fazer_en == ("Sow the pearl millet.", "Let it form straw.")
    # Sem tradução no YAML: vazio (o service usa o português).
    assert sorgo.como_fazer_en == ()


def test_should_load_shipped_culturas_yaml_with_prd_soil_points() -> None:
    # O culturas.yaml que vai junto com a API precisa carregar (PRD 7.4: totais da nota de solo;
    # tarefa 0066: pragas só na crotalária, a única que reduziu o nematoide no campo).
    repo = YamlCropParamsRepository(Settings(_env_file=None).culturas_path)

    totals = {c.id: c.solo_palhada + c.solo_nitrogenio + c.solo_pragas for c in repo.list_all()}

    assert totals == {
        "pousio": 0,
        "milho_safrinha": 20,
        "sorgo": 20,
        "milho_braquiaria": 40,
        "milheto": 35,
        "crotalaria": 85,
    }


def test_should_ship_culturas_yaml_keyed_by_canonical_crop_ids() -> None:
    # ADR-0001: o YAML já usa o id canônico; os aliases longos só servem para entrada antiga.
    raw = yaml.safe_load(SHIPPED_CULTURAS.read_text(encoding="utf-8"))

    assert list(raw["culturas"]) == [
        "pousio",
        "milho_safrinha",
        "sorgo",
        "milho_braquiaria",
        "milheto",
        "crotalaria",
    ]


def test_should_ship_interface_names_and_how_to_steps_in_both_languages() -> None:
    # Nomes iguais aos da interface (front: src/i18n/messages.pt.ts e messages.en.ts).
    crops = YamlCropParamsRepository(SHIPPED_CULTURAS).list_all()

    assert {c.id: (c.nome, c.nome_en) for c in crops} == {
        "pousio": ("Deixar parado", "Leave it fallow"),
        "milho_safrinha": ("Milho sozinho", "Corn alone"),
        "sorgo": ("Sorgo", "Sorghum"),
        "milho_braquiaria": ("Milho com braquiária", "Corn with brachiaria"),
        "milheto": ("Milheto", "Pearl millet"),
        "crotalaria": ("Crotalária", "Crotalaria"),
    }
    for crop in crops:
        assert 3 <= len(crop.como_fazer) <= 5, crop.id
        assert len(crop.como_fazer_en) == len(crop.como_fazer), crop.id
