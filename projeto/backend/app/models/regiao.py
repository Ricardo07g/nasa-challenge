"""Região pelo satélite (P3): a soja em volta de um ponto na entressafra, ano a ano, pelo MODIS.

Contrato do arquivo que o `pipeline/fetch_regiao_ndvi.py` grava e o `FileRegionRepository` lê
(`AGENTS.md` do backend, "Contrato dos dados das fontes" → "Região pelo satélite").
"""

from dataclasses import dataclass
from typing import Final

from app.models.validation import require_between, require_finite, require_non_blank

# Os três percentuais (parado, plantou, incerto) saem arredondados a 1 casa: a soma pode ficar
# até 0,15 longe de 100 (três arredondamentos de no máximo 0,05).
PCT_SUM_TOLERANCE: Final[float] = 0.2


@dataclass(frozen=True)
class RegiaoAno:
    """A entressafra de um ano na região (guia NDVI, "Região pelo satélite"; tarefa 0036).

    `n_pixels_lavoura` = pixels da máscara de lavoura (uso do solo) dentro do raio; `n_pixels` =
    os que mostraram a soja do ano (pico e colheita, grupo `regiao_ndvi` do `regras.yaml`).
    `pct_parado`, `pct_plantou` e `pct_incerto` contam só os pixels de soja classificados (o
    "sem dado" fica fora da conta) e somam 100; os três ficam `None` quando nenhum foi
    classificado. `pct_sem_dado` é a parte de `n_pixels` sem observações boas suficientes depois
    da colheita; `None` sem pixel. Arquivo de antes da tarefa 0036 (máscara de lavoura, sem a soja
    do ano): `n_pixels_lavoura` ausente (`None`) e `n_pixels` são os pixels da máscara.
    """

    ano: int
    n_pixels: int
    pct_parado: float | None
    pct_plantou: float | None
    pct_incerto: float | None
    pct_sem_dado: float | None
    n_pixels_lavoura: int | None = None

    def __post_init__(self) -> None:
        if self.n_pixels < 0:
            raise ValueError(f"n_pixels não pode ser negativo, veio {self.n_pixels!r}")
        if self.n_pixels_lavoura is not None and self.n_pixels_lavoura < self.n_pixels:
            raise ValueError(
                f"n_pixels_lavoura ({self.n_pixels_lavoura}) não pode ser menor que n_pixels "
                f"({self.n_pixels}): a soja do ano sai da máscara de lavoura"
            )
        classes = {
            "pct_parado": self.pct_parado,
            "pct_plantou": self.pct_plantou,
            "pct_incerto": self.pct_incerto,
        }
        for name, value in {**classes, "pct_sem_dado": self.pct_sem_dado}.items():
            if value is not None:
                require_between(name, value, 0.0, 100.0)

        empty = [name for name, value in classes.items() if value is None]
        if self.n_pixels == 0:
            if len(empty) < len(classes) or self.pct_sem_dado is not None:
                raise ValueError("ano sem pixel de soja não tem percentual")
            return
        if self.pct_sem_dado is None:
            raise ValueError("pct_sem_dado é obrigatório quando há pixel de soja")
        if empty and len(empty) < len(classes):
            raise ValueError("pct_parado, pct_plantou e pct_incerto vêm juntos (ou nenhum)")
        if empty:
            if self.pct_sem_dado != 100.0:
                raise ValueError("sem pixel classificado, pct_sem_dado precisa ser 100")
            return
        total = sum(value for value in classes.values() if value is not None)
        if abs(total - 100.0) > PCT_SUM_TOLERANCE:
            raise ValueError(f"parado, plantou e incerto precisam somar 100, somam {total:.1f}")


@dataclass(frozen=True)
class RegiaoSatelite:
    """A região em volta de um ponto (`lat`, `lon`, WGS 84) num raio de `raio_km`.

    `fonte` = produtos de NDVI ("MODIS MOD13Q1 + MYD13Q1"); `mascara` = de onde vem a lavoura.
    """

    lat: float
    lon: float
    raio_km: float
    fonte: str
    mascara: str
    anos: tuple[RegiaoAno, ...]

    def __post_init__(self) -> None:
        require_between("lat", self.lat, -90.0, 90.0)
        require_between("lon", self.lon, -180.0, 180.0)
        require_finite("raio_km", self.raio_km)
        if not self.raio_km > 0:
            raise ValueError(f"raio_km precisa ser maior que zero, veio {self.raio_km!r}")
        require_non_blank("fonte", self.fonte)
        require_non_blank("mascara", self.mascara)
        anos = [item.ano for item in self.anos]
        repetidos = sorted({ano for ano in anos if anos.count(ano) > 1})
        if repetidos:
            raise ValueError(f"ano repetido na região: {repetidos}")


@dataclass(frozen=True)
class RegiaoDoPonto:
    """A região que vale para um ponto e a distância do ponto até o centro dela (km, 1 casa).

    A região é um círculo em volta de um centro calculado pelo pipeline: um ponto a 25 km da
    fazenda vê o círculo centrado na fazenda. A tela diz isso ao produtor pela distância.
    """

    regiao: RegiaoSatelite
    distancia_km: float

    def __post_init__(self) -> None:
        require_finite("distancia_km", self.distancia_km)
        if self.distancia_km < 0:
            raise ValueError(f"distancia_km não pode ser negativa, veio {self.distancia_km!r}")
