"""add strategy_type to strategies

Revision ID: 66e13be97381
Revises: d8d011aff085
Create Date: 2026-08-07 13:10:17.813120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '66e13be97381'
down_revision: Union[str, Sequence[str], None] = 'd8d011aff085'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('strategies', sa.Column('strategy_type', sa.Text(), server_default='rule_based', nullable=True))


def downgrade() -> None:
    op.drop_column('strategies', 'strategy_type')
