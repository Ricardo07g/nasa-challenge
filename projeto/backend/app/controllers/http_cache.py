"""Cache HTTP que revalida (tarefa 0025): ETag do corpo JSON e 304 quando nada mudou.

Infraestrutura HTTP, sem regra de negócio. O navegador pode guardar a resposta, mas pergunta à API
toda vez se ela mudou (`If-None-Match`). Assim o dado carregado depois no banco aparece no próximo
pedido, e o sinal fraco no campo só baixa o corpo quando ele mudou.
"""

from hashlib import sha256
from typing import Final

from fastapi import Response

# Pode guardar (navegador e CDN), mas sempre revalida antes de usar.
REVALIDATE_CACHE_CONTROL: Final[str] = "public, no-cache"
# 32 dígitos hexadecimais (128 bits) do SHA-256 bastam para distinguir as versões de uma URL.
ETAG_HEX_DIGITS: Final[int] = 32
# O GZipMiddleware do main.py soma este valor ao Vary do 200 (corpo com 500 bytes ou mais). O 304
# não tem corpo, então o Vary dele leva o valor aqui: tem de ser o mesmo do 200 (RFC 9110 §15.4.5).
COMPRESSION_VARY: Final[str] = "Accept-Encoding"


def strong_etag(body: bytes) -> str:
    """ETag forte do corpo: o hash do JSON exatamente como ele sai, entre aspas."""
    return f'"{sha256(body).hexdigest()[:ETAG_HEX_DIGITS]}"'


def etag_matches(if_none_match: str | None, etag: str) -> bool:
    """Comparação fraca do `If-None-Match` (RFC 9110 §13.1.2): lista, `*` e o prefixo `W/`.

    Um proxy que comprime a resposta pode trocar o ETag forte pelo fraco (`W/"..."`): ainda é a
    mesma versão.
    """
    if not if_none_match:
        return False
    if if_none_match.strip() == "*":
        return True
    return any(tag.strip().removeprefix("W/") == etag for tag in if_none_match.split(","))


def revalidated_json_response(body: bytes, *, if_none_match: str | None, vary: str) -> Response:
    """200 com o corpo, ou 304 sem corpo se o navegador já tem esta versão. Mesmos cabeçalhos."""
    etag = strong_etag(body)
    headers = {"Cache-Control": REVALIDATE_CACHE_CONTROL, "ETag": etag, "Vary": vary}
    if etag_matches(if_none_match, etag):
        return Response(status_code=304, headers={**headers, "Vary": f"{vary}, {COMPRESSION_VARY}"})
    return Response(content=body, media_type="application/json", headers=headers)
