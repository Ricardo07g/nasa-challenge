"""Domain error hierarchy for the business layer."""


class DomainError(Exception):
    """Base exception for business rule errors."""

    def __init__(self, message: str, code: str = "DOMAIN_ERROR") -> None:
        super().__init__(message)
        self.code = code


class NotFoundError(DomainError):
    """Raised when a requested domain resource does not exist (maps to HTTP 404)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="NOT_FOUND")


class ValidationDomainError(DomainError):
    """Raised when a business parameter violates domain constraints (maps to HTTP 422)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="VALIDATION_ERROR")


class OutsideAreaError(NotFoundError):
    """O ponto fica fora da área com dados preparados (vira HTTP 404 com code OUTSIDE_AREA)."""

    def __init__(self, message: str) -> None:
        DomainError.__init__(self, message, code="OUTSIDE_AREA")
