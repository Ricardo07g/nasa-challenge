"""Soja na safra mais recente no ponto marcado (RF-24, tarefa 0037).

No começo do fluxo, o app confere se o satélite viu soja no pixel de 250 m do ponto na safra mais
recente, para saber que o ponto é lavoura (e não cidade, cana ou pasto). Números do grupo
`soja_recente` do `regras.yaml`. Duas partes, com a mesma regra:

- `SojaRecenteRule`: o pico de cada pixel (mínimo de observações boas) e o limite da soja. Quem
  usa o pico é o `pipeline/fetch_soja_recente.py`, offline, ao gravar o arquivo;
- `SojaRecenteService`: o campo `soja_recente` do `/talhao`, com o pico lido do arquivo.
"""

from collections.abc import Sequence

from app.models.regras import Regras
from app.models.soja_recente import SojaRecente
from app.repositories.rules_repository import load_default_rules
from app.repositories.soja_recente_repository import SojaRecenteRepository


class SojaRecenteRule:
    """A regra da soja recente: pico do pixel na janela e o limite que conta como soja vista."""

    def __init__(self, rules: Regras | None = None) -> None:
        self._regra = (rules or load_default_rules()).soja_recente

    def pixel_peak[T: (int, float)](self, values: Sequence[T]) -> T | None:
        """O maior NDVI das observações boas da janela no pixel (já sem nuvem, neve nem valor de
        preenchimento). Com menos de `min_observacoes`, o pixel fica sem dado (`None`)."""
        if len(values) < self._regra.min_observacoes:
            return None
        return max(values)

    def seen(self, ndvi_pico: float) -> bool:
        """A soja foi vista: o pico (NDVI físico) chegou a `ndvi_minimo`."""
        return ndvi_pico >= self._regra.ndvi_minimo


class SojaRecenteService:
    """`soja_recente` do talhão: o pico do pixel do ponto comparado com o limite da soja."""

    def __init__(self, repository: SojaRecenteRepository, rules: Regras | None = None) -> None:
        self._repository = repository
        self._rule = SojaRecenteRule(rules)

    def check(self, lat: float, lon: float) -> SojaRecente | None:
        """`None` sem o arquivo ou com o ponto fora da área medida; pixel sem dado: `vista` e
        `ndvi_pico` nulos (o front não avisa)."""
        pico = self._repository.get_pico(lat, lon)
        if pico is None:
            return None
        vista = None if pico.ndvi_pico is None else self._rule.seen(pico.ndvi_pico)
        return SojaRecente(
            safra=pico.safra, vista=vista, ndvi_pico=pico.ndvi_pico, fonte=pico.fonte
        )
