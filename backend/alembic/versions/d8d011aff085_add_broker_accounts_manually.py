"""add broker accounts manually

Revision ID: d8d011aff085
Revises: 
Create Date: 2026-07-29 21:43:26.386660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8d011aff085'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('broker_accounts',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
    sa.Column('broker_name', sa.Text(), nullable=False),
    sa.Column('account_label', sa.Text(), nullable=False),
    sa.Column('account_purpose', sa.Text(), nullable=True),
    sa.Column('credentials_encrypted', sa.Text(), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
    sa.Column('last_synced_at', sa.DateTime(), nullable=True),
    sa.Column('sync_status', sa.Text(), server_default='never', nullable=True),
    sa.Column('sync_error', sa.Text(), nullable=True),
    sa.Column('holdings_count', sa.Integer(), server_default='0', nullable=True),
    sa.Column('total_invested', sa.Float(), server_default='0', nullable=True),
    sa.Column('total_current_value', sa.Float(), server_default='0', nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_foreign_key('fk_broker_user', 'broker_accounts', 'users', ['user_id'], ['id'], referent_schema='auth', ondelete='CASCADE')

    op.add_column('holdings', sa.Column('broker_account_id', sa.Integer(), nullable=True))
    op.add_column('holdings', sa.Column('source', sa.Text(), nullable=True))
    op.add_column('holdings', sa.Column('broker_trading_symbol', sa.Text(), nullable=True))
    op.add_column('holdings', sa.Column('isin', sa.Text(), nullable=True))
    op.create_foreign_key('fk_holdings_broker', 'holdings', 'broker_accounts', ['broker_account_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    pass
