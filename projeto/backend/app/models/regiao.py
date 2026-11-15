"""Região pelo satélite (P3): a lavoura em volta de um ponto na entressafra, ano a ano, pelo MODIS.

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
    """A entressafra de um ano na região (guia NDVI, "Região pelo satélite").

    `n_pixels` = pixels de lavoura (máscara de uso do solo) dentro do raio. `pct_parado`,
    `pct_plantou` e `pct_incerto` contam só os pixels classificados (o "sem dado" fica fora da
    conta) e somam 100; os três ficam `None` quando nenhum pixel foi classificado.
    `pct_sem_dado` é a parte de `n_pixels` sem observações boas suficientes; `None` sem pixel.
    """

    ano: int
    n_pixels: int
    pct_parado: float | None
    pct_plantou: float | None
    pct_incerto: float | None
    pct_sem_dado: float | None

    def __post_init__(self) -> None:
        if self.n_pixels < 0:
            raise ValueError(f"n_pixels não pode ser negativo, veio {self.n_pixels!r}")
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
                raise ValueError("ano sem pixel de lavoura não tem percentual")
            return
        if self.pct_sem_dado is None:
            raise ValueError("pct_sem_dado é obrigatório quando há pixel de lavoura")
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
