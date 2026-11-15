"""relatos da comunidade (tarefa 0047)

Tabela `community_report` da seção 7 da remodelagem: relatos sem cadastro (plantio, chuva e
evento). O `report_type` é texto aberto para os tipos futuros (oferta, troca, empréstimo), que o
service ainda recusa. Privacidade, garantida também no banco:

- `cell_id` é a célula de 0,1° do `cell_id_for` (`<floor(lat*10)>_<floor(lon*10)>`), nunca a
  coordenada exata (CHECK no formato do id);
- `device_hash` é o HMAC-SHA-256 do identificador do aparelho (64 dígitos hexadecimais; CHECK),
  nunca o identificador.

O downgrade apaga a tabela e os relatos.

Revision ID: 3f7c2a9d4e81
Revises: 6e961f333ddc
Create Date: 2026-11-15 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f7c2a9d4e81"
down_revision: str | Sequence[str] | None = "6e961f333ddc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Cria a tabela dos relatos com os índices da listagem e do limite por aparelho."""
    op.execute(
        """
        CREATE TABLE community_report (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            report_type TEXT NOT NULL,
            subtype TEXT,
            details JSONB NOT NULL DEFAULT '{}'::jsonb,
            cell_id TEXT NOT NULL CHECK (cell_id ~ '^-?[0-9]+_-?[0-9]+$'),
            fact_date DATE,
            sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            device_hash TEXT NOT NULL CHECK (device_hash ~ '^[0-9a-f]{64}$')
        );
        CREATE INDEX idx_community_report_cell ON community_report (cell_id, fact_date);
        CREATE INDEX idx_community_report_device ON community_report (device_hash, sent_at);
        """
    )


def downgrade() -> None:
    """Apaga a tabela dos relatos (e o que estiver nela)."""
    op.execute("DROP TABLE IF EXISTS community_report;")
