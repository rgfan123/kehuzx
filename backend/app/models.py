import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import TemplateStatus


def uuid_str() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)


class ProductFieldsMixin:
    product_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    raw_material_part: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    meat_grade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    variety: Mapped[str | None] = mapped_column(String(100), nullable=True)
    goods_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manufacturer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    import_domestic: Mapped[str | None] = mapped_column(String(50), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(100), nullable=True)
    execution_standard: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processing_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_form: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fat_lean_ratio: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cut_length: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    length_unit: Mapped[str] = mapped_column(String(20), default="cm")
    cut_width: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    width_unit: Mapped[str] = mapped_column(String(20), default="cm")
    cut_thickness: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    thickness_unit: Mapped[str] = mapped_column(String(20), default="mm")
    trimming_grade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processing_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    packaging_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    price_currency: Mapped[str] = mapped_column(String(20), default="元")
    pricing_unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tax_included: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tax_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    delivery_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)


# ── Users ──────────────────────────────────────────────────────────────

class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="user")


# ── Customers ──────────────────────────────────────────────────────────

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    wechat: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    demands: Mapped[list["CustomerDemand"]] = relationship(back_populates="customer")


# ── Customer Demands ──────────────────────────────────────────────────

class CustomerDemand(Base, TimestampMixin, ProductFieldsMixin):
    __tablename__ = "customer_demands"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    customer: Mapped[Customer] = relationship(back_populates="demands")


# ── Sample Templates ──────────────────────────────────────────────────

class SampleTemplate(Base, TimestampMixin, ProductFieldsMixin):
    __tablename__ = "sample_templates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    source_demand_id: Mapped[str | None] = mapped_column(
        ForeignKey("customer_demands.id"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(40), default=TemplateStatus.UNSUPPLIED.value, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    customer: Mapped[Customer] = relationship()
    source_demand: Mapped[CustomerDemand | None] = relationship()


# ── Suppliers ──────────────────────────────────────────────────────────

class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# ── Order Fields (shared by sample & formal orders) ───────────────────

class OrderFieldsMixin:
    name: Mapped[str] = mapped_column(String(200), index=True)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    is_submitted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    delivery_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    delivery_lead_time: Mapped[str | None] = mapped_column(String(100), nullable=True)
    delivery_cycle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    settlement_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    settlement_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    settlement_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    suspended_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status_before_suspension: Mapped[str | None] = mapped_column(String(50), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


# ── Order Items (shared by sample & formal order items) ───────────────

class OrderItemFieldsMixin(ProductFieldsMixin):
    source_template_id: Mapped[str | None] = mapped_column(
        ForeignKey("sample_templates.id"), nullable=True, index=True
    )
    source_template_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_template_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    supplier_id: Mapped[str | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    quantity_per_unit: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    quantity_unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    unit_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# ── Sample Orders ─────────────────────────────────────────────────────

class SampleOrder(Base, TimestampMixin, OrderFieldsMixin):
    __tablename__ = "sample_orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    customer: Mapped[Customer | None] = relationship()
    items: Mapped[list["SampleOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class SampleOrderItem(Base, TimestampMixin, OrderItemFieldsMixin):
    __tablename__ = "sample_order_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    order_id: Mapped[str] = mapped_column(ForeignKey("sample_orders.id"), index=True)
    order: Mapped[SampleOrder] = relationship(back_populates="items")
    supplier: Mapped[Supplier | None] = relationship()
    source_template: Mapped[SampleTemplate | None] = relationship()


# ── Formal Orders ─────────────────────────────────────────────────────

class FormalOrder(Base, TimestampMixin, OrderFieldsMixin):
    __tablename__ = "formal_orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    source_sample_order_id: Mapped[str | None] = mapped_column(
        ForeignKey("sample_orders.id"), nullable=True
    )
    customer: Mapped[Customer | None] = relationship()
    source_sample_order: Mapped[SampleOrder | None] = relationship()
    items: Mapped[list["FormalOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class FormalOrderItem(Base, TimestampMixin, OrderItemFieldsMixin):
    __tablename__ = "formal_order_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    order_id: Mapped[str] = mapped_column(ForeignKey("formal_orders.id"), index=True)
    source_sample_order_id: Mapped[str | None] = mapped_column(
        ForeignKey("sample_orders.id"), nullable=True, index=True
    )
    order: Mapped[FormalOrder] = relationship(back_populates="items")
    source_sample_order: Mapped[SampleOrder | None] = relationship()
    supplier: Mapped[Supplier | None] = relationship()
    source_template: Mapped[SampleTemplate | None] = relationship()


# ── Workflow Logs ──────────────────────────────────────────────────────

class OrderWorkflowLog(Base):
    __tablename__ = "order_workflow_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    order_type: Mapped[str] = mapped_column(String(20), index=True)
    order_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(30))
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    operator: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


# ── Operation Logs (audit trail) ──────────────────────────────────────

class OperationLog(Base):
    __tablename__ = "operation_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    entity_type: Mapped[str] = mapped_column(String(30), index=True)
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    entity_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    record_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(30), index=True)
    operator: Mapped[str] = mapped_column(String(100))
    change_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
