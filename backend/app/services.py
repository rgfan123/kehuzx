import json
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from app import models
from app.enums import FORMAL_FLOW, SAMPLE_FLOW


# ── Business Code ─────────────────────────────────────────────────────

def business_code(prefix: str, db: Session | None = None) -> str:
    """Generate business code like KH-260820-001."""
    today = datetime.utcnow().strftime("%y%m%d")
    date_part = f"{prefix}-{today}"

    max_seq = 0
    if db is not None:
        # Check committed records in database
        all_models = [
            models.Customer, models.CustomerDemand, models.SampleTemplate,
            models.Supplier, models.SampleOrder, models.FormalOrder,
        ]
        for model in all_models:
            codes = db.scalars(
                select(model.code).where(model.code.like(f"{date_part}-%"))
            ).all()
            for code in codes:
                try:
                    seq = int(code.split("-")[-1])
                    max_seq = max(max_seq, seq)
                except (ValueError, IndexError):
                    pass

        # Also check pending (uncommitted) objects in the current session
        for obj in db.new:
            if hasattr(obj, "code") and isinstance(getattr(obj, "code", None), str):
                code = obj.code
                if code.startswith(f"{date_part}-"):
                    try:
                        seq = int(code.split("-")[-1])
                        max_seq = max(max_seq, seq)
                    except (ValueError, IndexError):
                        pass

    seq = max_seq + 1
    return f"{date_part}-{seq:03d}"


# ── Page Query ────────────────────────────────────────────────────────

def page_query(db: Session, query: Select, page: int, page_size: int):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return items, page, page_size, total


# ── Product Fields ────────────────────────────────────────────────────

PRODUCT_FIELD_NAMES = [
    "product_name", "raw_material_part", "product_category", "meat_grade", "variety",
    "goods_status", "manufacturer", "import_domestic", "origin", "execution_standard",
    "processing_method", "product_form", "fat_lean_ratio", "cut_length", "length_unit",
    "cut_width", "width_unit", "cut_thickness", "thickness_unit", "trimming_grade",
    "processing_details", "packaging_plan", "unit_price", "price_currency", "pricing_unit",
    "tax_included", "tax_rate", "delivery_fee",
]


def apply_product_fields(target: Any, source: Any) -> None:
    for field in PRODUCT_FIELD_NAMES:
        setattr(target, field, getattr(source, field, None))


# ── Logging Helpers ───────────────────────────────────────────────────

def _serialize_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (int, float, bool, str)):
        return v
    return str(v)


def compute_changes(old_dict: dict, new_dict: dict, skip_keys: set[str] | None = None) -> dict | None:
    skip = skip_keys or set()
    skip.update({"id", "created_at", "updated_at", "deleted_at", "password_hash"})
    changes = {}
    all_keys = set(old_dict.keys()) | set(new_dict.keys())
    for key in all_keys:
        if key in skip:
            continue
        old_val = _serialize_value(old_dict.get(key))
        new_val = _serialize_value(new_dict.get(key))
        if old_val != new_val and new_val is not None:
            changes[key] = {"old": old_val, "new": new_val}
    if not changes:
        return None
    return {"changes": changes}


def save_log(
    db: Session,
    entity_type: str,
    entity_id: str,
    entity_name: str | None,
    action: str,
    operator: str,
    record_code: str | None = None,
    old_data: dict | None = None,
    new_data: dict | None = None,
) -> None:
    change_detail = None
    if old_data is not None or new_data is not None:
        change_detail = json.dumps(
            {"before": old_data or {}, "after": new_data or {}},
            ensure_ascii=False, default=str,
        )
    log = models.OperationLog(
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        record_code=record_code,
        action=action,
        operator=operator,
        change_detail=change_detail,
    )
    db.add(log)


def model_to_dict(obj: Any, fields: list[str] | None = None) -> dict:
    if fields:
        return {f: getattr(obj, f, None) for f in fields}
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Order Item ────────────────────────────────────────────────────────

def copy_item_from_payload(
    item: models.SampleOrderItem | models.FormalOrderItem,
    payload: Any,
    template: models.SampleTemplate | None = None,
) -> None:
    apply_product_fields(item, payload)
    item.source_template_id = None
    if isinstance(item, models.FormalOrderItem):
        item.source_sample_order_id = None
    item.source_template_code = template.code if template else None
    item.source_template_name = template.name if template else getattr(payload, "source_template_name", None)
    item.supplier_id = payload.supplier_id
    item.quantity_per_unit = payload.quantity_per_unit
    item.quantity_unit = payload.quantity_unit
    item.unit_count = payload.unit_count
    if payload.total_quantity is not None:
        item.total_quantity = payload.total_quantity
    elif payload.quantity_per_unit is not None and payload.unit_count is not None:
        item.total_quantity = payload.quantity_per_unit * payload.unit_count
    else:
        item.total_quantity = None
    item.notes = payload.notes


def validate_submit(order: Any) -> None:
    if not order.customer_id:
        raise HTTPException(status_code=422, detail="提交订单前必须选择所属客户")
    if not order.items:
        raise HTTPException(status_code=422, detail="订单至少需要一条产品明细")
    if not order.delivery_date:
        raise HTTPException(status_code=422, detail="提交订单前必须填写交付时间")
    for item in order.items:
        if not item.product_name:
            raise HTTPException(status_code=422, detail="每条产品明细必须填写产品名")
        if item.quantity_per_unit is None or item.unit_count is None:
            raise HTTPException(status_code=422, detail="每条产品明细必须填写有效数量")


# ── Workflow ──────────────────────────────────────────────────────────

def workflow_config(order_type: str):
    return SAMPLE_FLOW if order_type == "sample" else FORMAL_FLOW


def advance_order(db: Session, order: Any, order_type: str, operator: str = "系统") -> Any:
    if not order.is_submitted:
        raise HTTPException(status_code=409, detail="草稿订单不能推进流程，请先提交")
    if order.is_suspended:
        raise HTTPException(status_code=409, detail="已中止订单不能推进流程")
    flow = workflow_config(order_type)
    try:
        index = flow.index(order.workflow_status)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail="订单流程状态无效") from exc
    if index >= len(flow) - 1:
        raise HTTPException(status_code=409, detail="订单已处于最终流程状态")
    old_status = order.workflow_status
    order.workflow_status = flow[index + 1].value
    order.version += 1
    db.add(models.OrderWorkflowLog(
        order_type=order_type, order_id=order.id, action="ADVANCE",
        from_status=old_status, to_status=order.workflow_status, operator=operator,
    ))
    save_log(db, "order", order.id, order.name, "advance", operator,
             order.code, {"workflow_status": old_status}, {"workflow_status": order.workflow_status})
    return order


def suspend_order(db: Session, order: Any, order_type: str, reason: str, operator: str = "系统") -> Any:
    if not order.is_submitted:
        raise HTTPException(status_code=409, detail="草稿订单不能中止")
    if order.is_suspended:
        raise HTTPException(status_code=409, detail="订单已处于中止状态")
    order.is_suspended = True
    order.suspended_reason = reason
    order.suspended_at = datetime.utcnow()
    order.status_before_suspension = order.workflow_status
    order.version += 1
    db.add(models.OrderWorkflowLog(
        order_type=order_type, order_id=order.id, action="SUSPEND",
        from_status=order.workflow_status, to_status=order.workflow_status,
        operator=operator, notes=reason,
    ))
    save_log(db, "order", order.id, order.name, "suspend", operator,
             order.code, None, {"suspended_reason": reason, "workflow_status": order.workflow_status})
    return order


def resume_order(db: Session, order: Any, order_type: str, operator: str = "系统") -> Any:
    if not order.is_suspended:
        raise HTTPException(status_code=409, detail="订单当前未中止")
    status_before = order.status_before_suspension
    order.is_suspended = False
    order.suspended_reason = None
    order.suspended_at = None
    order.workflow_status = status_before
    order.status_before_suspension = None
    order.version += 1
    db.add(models.OrderWorkflowLog(
        order_type=order_type, order_id=order.id, action="RESUME",
        from_status=status_before, to_status=status_before, operator=operator,
    ))
    save_log(db, "order", order.id, order.name, "resume", operator, order.code)
    return order


def load_template(db: Session, template_id: str | None, customer_id: str | None = None):
    if not template_id:
        return None
    template = db.scalar(select(models.SampleTemplate).where(
        models.SampleTemplate.id == template_id, models.SampleTemplate.deleted_at.is_(None)
    ))
    if not template:
        raise HTTPException(status_code=404, detail="来源样品模板不存在")
    if customer_id and template.customer_id != customer_id:
        raise HTTPException(status_code=400, detail="只能导入当前订单所属客户的样品模板")
    return template


def make_order_item(db: Session, payload: Any, item_type: str, customer_id: str | None = None):
    template = load_template(db, payload.source_template_id, customer_id)
    if template:
        merged = payload.model_copy()
        for field in type(payload).model_fields:
            if field in {"source_template_id", "source_template_name", "supplier_id",
                         "quantity_per_unit", "quantity_unit", "unit_count",
                         "total_quantity", "notes"}:
                continue
            if getattr(merged, field, None) is None:
                setattr(merged, field, getattr(template, field, None))
        payload = merged
    item = models.SampleOrderItem() if item_type == "sample" else models.FormalOrderItem()
    copy_item_from_payload(item, payload, template)
    return item


def update_order_from_payload(db: Session, order: Any, payload: Any, order_type: str) -> Any:
    for field in [
        "name", "customer_id", "delivery_date", "delivery_address", "delivery_lead_time",
        "delivery_cycle", "settlement_period", "settlement_method", "settlement_amount", "notes",
    ]:
        setattr(order, field, getattr(payload, field))
    if payload.items is not None:
        order.items.clear()
        order.items.extend(make_order_item(db, item, order_type, payload.customer_id) for item in payload.items)
    return order


def order_to_dict(order: Any) -> dict[str, Any]:
    customer_name = order.customer.name if order.customer else None
    items = []
    for item in order.items:
        product_fields = {
            field: getattr(item, field) for field in PRODUCT_FIELD_NAMES
        }
        items.append({
            "id": item.id,
            "product_name": item.product_name,
            "source_template_id": item.source_template_id,
            "source_template_code": item.source_template_code,
            "source_template_name": item.source_template_name,
            "supplier_id": item.supplier_id,
            "source_sample_order_id": getattr(item, "source_sample_order_id", None),
            "supplier_name": item.supplier.name if item.supplier else "本公司供应",
            "quantity_per_unit": item.quantity_per_unit,
            "quantity_unit": item.quantity_unit,
            "unit_count": item.unit_count,
            "total_quantity": item.total_quantity,
            "unit_price": item.unit_price,
            "pricing_unit": item.pricing_unit,
            "notes": item.notes,
            **product_fields,
        })
    return {
        "id": order.id, "code": order.code, "name": order.name,
        "customer_id": order.customer_id, "customer_name": customer_name,
        "is_submitted": order.is_submitted, "workflow_status": order.workflow_status,
        "delivery_date": order.delivery_date, "delivery_address": order.delivery_address,
        "delivery_lead_time": order.delivery_lead_time, "delivery_cycle": order.delivery_cycle,
        "settlement_period": order.settlement_period, "settlement_method": order.settlement_method,
        "settlement_amount": order.settlement_amount, "notes": order.notes,
        "is_suspended": order.is_suspended, "suspended_reason": order.suspended_reason,
        "created_at": order.created_at, "updated_at": order.updated_at, "items": items,
    }


# ── Settlement Amount Calculator ──────────────────────────────────────

def calc_settlement_amount(items: list, delivery_fee: Any = None) -> Decimal:
    """Auto-calculate settlement amount: sum of (unit_price * total_quantity) + delivery_fee."""
    total = Decimal("0")
    for item in items:
        price = getattr(item, "unit_price", None) or Decimal("0")
        qty = getattr(item, "total_quantity", None) or Decimal("0")
        total += price * qty
    if delivery_fee is not None:
        total += Decimal(str(delivery_fee))
    return total
