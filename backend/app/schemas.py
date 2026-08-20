from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel):
    items: list[Any]
    page: int
    page_size: int = Field(alias="pageSize")
    total: int

    model_config = ConfigDict(populate_by_name=True)


# ── Auth ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(ORMModel):
    id: str
    username: str
    display_name: str
    role: str


# ── Customer ──────────────────────────────────────────────────────────

class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    wechat: str | None = None
    company_name: str | None = None
    industry: str | None = None
    address: str | None = None
    status: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase, ORMModel):
    id: str
    code: str
    created_at: datetime
    updated_at: datetime
    demand_count: int = 0
    sample_order_count: int = 0
    formal_order_count: int = 0


# ── Product Fields ────────────────────────────────────────────────────

class ProductFields(BaseModel):
    product_name: str | None = None
    raw_material_part: str | None = None
    product_category: str | None = None
    meat_grade: str | None = None
    variety: str | None = None
    goods_status: str | None = None
    manufacturer: str | None = None
    import_domestic: str | None = None
    origin: str | None = None
    execution_standard: str | None = None
    processing_method: str | None = None
    product_form: str | None = None
    fat_lean_ratio: str | None = None
    cut_length: Decimal | None = Field(default=None, ge=0)
    length_unit: str = "cm"
    cut_width: Decimal | None = Field(default=None, ge=0)
    width_unit: str = "cm"
    cut_thickness: Decimal | None = Field(default=None, ge=0)
    thickness_unit: str = "mm"
    trimming_grade: str | None = None
    processing_details: str | None = None
    packaging_plan: str | None = None
    unit_price: Decimal | None = Field(default=None, ge=0)
    price_currency: str = "元"
    pricing_unit: str | None = None
    tax_included: bool | None = None
    tax_rate: Decimal | None = Field(default=None, ge=0)
    delivery_fee: Decimal | None = Field(default=None, ge=0)


# ── Demand ────────────────────────────────────────────────────────────

class DemandBase(ProductFields):
    name: str = Field(min_length=1, max_length=200)
    expected_delivery_date: date | None = None
    notes: str | None = None


class DemandOut(DemandBase, ORMModel):
    id: str
    code: str
    customer_id: str
    created_at: datetime
    updated_at: datetime


# ── Template ──────────────────────────────────────────────────────────

class TemplateBase(ProductFields):
    name: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    status: str = "UNSUPPLIED"


class TemplateCreate(TemplateBase):
    customer_id: str
    source_demand_id: str | None = None


class TemplateOut(TemplateBase, ORMModel):
    id: str
    code: str
    customer_id: str
    source_demand_id: str | None = None
    customer_name: str | None = None
    created_at: datetime
    updated_at: datetime


class TemplateStatusBody(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in {"UNSUPPLIED", "SUPPLIED"}:
            raise ValueError("无效的模板状态，只允许 UNSUPPLIED 或 SUPPLIED")
        return value


# ── Supplier ──────────────────────────────────────────────────────────

class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    contact_name: str | None = None
    phone: str | None = None
    address: str | None = None
    status: str | None = None
    notes: str | None = None


class SupplierOut(SupplierBase, ORMModel):
    id: str
    code: str
    created_at: datetime
    updated_at: datetime


# ── Order ─────────────────────────────────────────────────────────────

class OrderItemCreate(ProductFields):
    source_template_id: str | None = None
    source_template_name: str | None = None
    supplier_id: str | None = None
    quantity_per_unit: Decimal | None = Field(default=None, ge=0)
    quantity_unit: str | None = None
    unit_count: int | None = Field(default=None, ge=0)
    total_quantity: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class OrderBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    customer_id: str | None = None
    delivery_date: date | None = None
    delivery_address: str | None = None
    delivery_lead_time: str | None = None
    delivery_cycle: str | None = None
    settlement_period: str | None = None
    settlement_method: str | None = None
    settlement_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None
    items: list[OrderItemCreate] = Field(default_factory=list)


class OrderOut(ORMModel):
    id: str
    code: str
    name: str
    customer_id: str | None
    customer_name: str | None = None
    is_submitted: bool
    workflow_status: str | None
    delivery_date: date | None
    delivery_address: str | None
    delivery_lead_time: str | None
    delivery_cycle: str | None
    settlement_period: str | None
    settlement_method: str | None
    settlement_amount: Decimal | None
    notes: str | None
    is_suspended: bool
    suspended_reason: str | None
    created_at: datetime
    updated_at: datetime
    items: list[dict[str, Any]] = Field(default_factory=list)


class SuspendBody(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


# ── Operation Log ─────────────────────────────────────────────────────

class OperationLogOut(ORMModel):
    id: str
    entity_type: str
    entity_id: str
    entity_name: str | None = None
    record_code: str | None = None
    action: str
    operator: str
    change_detail: str | None = None
    created_at: datetime
