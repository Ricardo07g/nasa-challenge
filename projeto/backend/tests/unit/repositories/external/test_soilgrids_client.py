"""Unit tests for SoilGridsClient (Sub-task 1.1 of Task 0001)."""

from typing import Any

from app.repositories.external.soilgrids_client import SoilGridsClient


class FakeHttpGetter:
    """Fake HTTP getter to test SoilGridsClient without real network requests."""

    def __init__(self, responses: list[dict[str, Any] | Exception]) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[str, dict[str, Any], float]] = []

    def __call__(self, url: str, params: dict[str, Any], timeout: float) -> dict[str, Any]:
        self.calls.append((url, params, timeout))
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _sample_soilgrids_payload(clay_g_kg: int = 420, sand_g_kg: int = 350) -> dict[str, Any]:
    return {
        "properties": {
            "layers": [
                {
                    "name": "clay",
                    "depths": [
                        {"label": "0-5cm", "values": {"mean": clay_g_kg}},
                        {"label": "5-15cm", "values": {"mean": clay_g_kg + 20}},
                        {"label": "15-30cm", "values": {"mean": clay_g_kg + 40}},
                    ],
                },
                {
                    "name": "sand",
                    "depths": [
                        {"label": "0-5cm", "values": {"mean": sand_g_kg}},
                        {"label": "5-15cm", "values": {"mean": sand_g_kg - 10}},
                        {"label": "15-30cm", "values": {"mean": sand_g_kg - 20}},
                    ],
                },
            ]
        }
    }


def test_should_extract_0_30cm_depths_and_compute_clayey_cad_when_isric_responds() -> None:
    getter = FakeHttpGetter([_sample_soilgrids_payload(clay_g_kg=420, sand_g_kg=350)])
    client = SoilGridsClient(http_get=getter)

    soil = client.fetch_soil(lat=-17.78, lon=-50.92)

    assert len(getter.calls) == 1
    assert soil.argila_percentual == 44.0
    assert soil.areia_percentual == 34.0
    assert soil.textura_solo == "argiloso"
    assert soil.cad_capacidade_agua_mm == 60.0
    assert soil.fonte == "soilgrids"


def test_should_return_safe_medium_soil_fallback_when_isric_api_fails() -> None:
    getter = FakeHttpGetter(
        [
            TimeoutError("ISRIC timeout 1"),
            TimeoutError("ISRIC timeout 2"),
            TimeoutError("ISRIC timeout 3"),
        ]
    )
    client = SoilGridsClient(http_get=getter)

    soil = client.fetch_soil(lat=-17.78, lon=-50.92)

    assert soil.textura_solo == "medio"
    assert soil.cad_capacidade_agua_mm == 50.0
    assert soil.fonte == "padrao"


def _payload_without_values(*missing: str) -> dict[str, Any]:
    """Resposta real do SoilGrids onde o mapa não tem dado (ex.: área urbana): `mean` nulo."""
    payload = _sample_soilgrids_payload()
    for layer in payload["properties"]["layers"]:
        if layer["name"] in missing:
            for depth in layer["depths"]:
                depth["values"]["mean"] = None
    return payload


def test_should_label_default_soil_as_padrao_when_soilgrids_has_no_values() -> None:
    # Em (-17,78; -50,92) o SoilGrids responde 200 com argila e areia nulas. Antes o cliente
    # trocava por 28%/45% e marcava "soilgrids": dado inventado com nome de fonte real, gravado no
    # banco pela busca sob demanda.
    client = SoilGridsClient(http_get=FakeHttpGetter([_payload_without_values("clay", "sand")]))

    soil = client.fetch_soil(lat=-17.78, lon=-50.92)

    assert soil.fonte == "padrao"
    assert soil.textura_solo == "medio"
    assert soil.cad_capacidade_agua_mm == 50.0


def test_should_not_invent_the_missing_property_when_only_one_layer_comes_without_values() -> None:
    client = SoilGridsClient(http_get=FakeHttpGetter([_payload_without_values("sand")]))

    soil = client.fetch_soil(lat=-17.78, lon=-50.92)

    assert soil.fonte == "padrao"
