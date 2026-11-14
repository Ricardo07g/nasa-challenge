from dataclasses import dataclass


@dataclass(frozen=True)
class CropOption:
    """Opção de entressafra (PRD, seção 5): o que plantar depois da soja."""

    id: str
    name: str
    role: str  # função da opção: "Grão", "Cobertura", etc.
