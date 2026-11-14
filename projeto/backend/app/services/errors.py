class DomainError(Exception):
    """Erro de regra de negócio. Os services lançam; o main.py traduz para HTTP."""


class NotFoundError(DomainError):
    """O recurso pedido não existe (vira HTTP 404)."""
