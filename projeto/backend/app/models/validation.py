"""Checagens simples usadas pelos models para recusar dado fora do contrato das fontes."""

import math


def require_non_blank(name: str, value: str) -> None:
    if not value.strip():
        raise ValueError(f"{name} não pode ficar vazio")


def require_finite(name: str, value: float) -> None:
    if not math.isfinite(value):
        raise ValueError(f"{name} precisa ser um número finito, veio {value!r}")


def require_between(name: str, value: float, low: float, high: float) -> None:
    """Valor finito dentro de [low, high] (os dois limites valem)."""
    require_finite(name, value)
    if not low <= value <= high:
        raise ValueError(f"{name} precisa estar entre {low} e {high}, veio {value!r}")
