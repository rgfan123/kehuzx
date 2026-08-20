"""Add sample order source to formal order items.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("formal_order_items")}
    if "source_sample_order_id" in columns:
        return
    op.add_column("formal_order_items", sa.Column("source_sample_order_id", sa.String(36), nullable=True))
    op.create_index(
        "ix_formal_order_items_source_sample_order_id",
        "formal_order_items",
        ["source_sample_order_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_formal_order_items_source_sample_order_id",
        "formal_order_items",
        "sample_orders",
        ["source_sample_order_id"],
        ["id"],
    )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("formal_order_items")}
    if "source_sample_order_id" not in columns:
        return
    op.drop_constraint("fk_formal_order_items_source_sample_order_id", "formal_order_items", type_="foreignkey")
    op.drop_index("ix_formal_order_items_source_sample_order_id", table_name="formal_order_items")
    op.drop_column("formal_order_items", "source_sample_order_id")
