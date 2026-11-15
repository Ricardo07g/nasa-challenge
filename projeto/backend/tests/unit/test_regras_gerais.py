"""Regras gerais da remodelagem conferidas na API inteira (S9, tarefa 0049).

Nenhum valor em reais (seção 1) e nenhum "Ainda não conectado" (a regra é: sem dado, o campo vem
nulo e o front não desenha). Lê só os arquivos do repositório: nada de rede nem banco.
"""

from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "app"
SOURCES = sorted([*APP.rglob("*.py"), *APP.rglob("*.yaml")])


def test_should_have_no_money_value_in_the_api_code_or_rules() -> None:
    offenders = [str(path.relative_to(APP)) for path in SOURCES if "R$" in path.read_text()]

    assert len(SOURCES) > 50
    assert offenders == []


def test_should_never_mention_the_not_connected_badge() -> None:
    offenders = [
        str(path.relative_to(APP))
        for path in SOURCES
        if "Ainda não conectado" in path.read_text() or "Not connected yet" in path.read_text()
    ]

    assert offenders == []
