from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app import models
from app.auth import create_access_token, get_current_user, get_operator_name, verify_password
from app.config import settings
from app.database import Base, engine, get_db
from app.enums import FormalStatus, SampleStatus
from app.schemas import (
    CustomerCreate, CustomerOut, DemandBase, DemandOut, LoginRequest, LoginResponse,
    OperationLogOut, OrderBase, OrderOut, Page, SupplierBase, SupplierOut,
    SuspendBody, TemplateCreate, TemplateOut, TemplateStatusBody, UserOut,
)
from app.services import (
    advance_order, business_code, calc_settlement_amount, compute_changes,
    model_to_dict, order_to_dict, page_query, resume_order, save_log,
    suspend_order, update_order_from_payload, validate_submit,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo:
        from app.seed import seed
        seed()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def active(model):
    return model.deleted_at.is_(None)


# ── Auth Routes ───────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).where(models.User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(user.username)
    save_log(db, "user", user.id, user.display_name, "login", user.display_name)
    db.commit()
    return LoginResponse(token=token, user=UserOut.model_validate(user))


@app.get("/api/auth/me", response_model=UserOut)
def get_me(user: models.User = Depends(get_current_user)):
    return user


# ── Helpers ───────────────────────────────────────────────────────────

def hard_delete_demand(db: Session, demand: models.CustomerDemand) -> None:
    db.execute(update(models.SampleTemplate).where(
        models.SampleTemplate.source_demand_id == demand.id
    ).values(source_demand_id=None))
    db.delete(demand)


def hard_delete_template(db: Session, template: models.SampleTemplate) -> None:
    for item_model in (models.SampleOrderItem, models.FormalOrderItem):
        db.execute(update(item_model).where(
            item_model.source_template_id == template.id
        ).values(source_template_id=None))
    db.delete(template)


def hard_delete_order(db: Session, order_type: str, order) -> None:
    if order_type == "sample":
        db.execute(update(models.FormalOrder).where(
            models.FormalOrder.source_sample_order_id == order.id
        ).values(source_sample_order_id=None))
        db.execute(update(models.FormalOrderItem).where(
            models.FormalOrderItem.source_sample_order_id == order.id
        ).values(source_sample_order_id=None))
    db.execute(delete(models.OrderWorkflowLog).where(
        models.OrderWorkflowLog.order_type == order_type,
        models.OrderWorkflowLog.order_id == order.id,
    ))
    db.delete(order)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


# ── Operation Logs ────────────────────────────────────────────────────

@app.get("/api/logs", response_model=Page)
def list_logs(
    entity_type: str | None = None,
    action: str | None = None,
    operator: str | None = None,
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(5, alias="pageSize", ge=1, le=100),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    query = select(models.OperationLog).order_by(models.OperationLog.created_at.desc())
    if entity_type:
        query = query.where(models.OperationLog.entity_type == entity_type)
    if action:
        query = query.where(models.OperationLog.action == action)
    if operator:
        query = query.where(models.OperationLog.operator.ilike(f"%{operator}%"))
    if keyword:
        pattern = f"%{keyword}%"
        query = query.where(or_(
            models.OperationLog.entity_name.ilike(pattern),
            models.OperationLog.record_code.ilike(pattern),
        ))
    items, page, page_size, total = page_query(db, query, page, page_size)
    data = [OperationLogOut.model_validate(item).model_dump() for item in items]
    return {"items": data, "page": page, "pageSize": page_size, "total": total}


@app.get("/api/logs/{entity_type}/{entity_id}")
def list_entity_logs(
    entity_type: str,
    entity_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    logs = db.scalars(
        select(models.OperationLog)
        .where(models.OperationLog.entity_type == entity_type,
               models.OperationLog.entity_id == entity_id)
        .order_by(models.OperationLog.created_at.desc())
    ).all()
    return [OperationLogOut.model_validate(log).model_dump() for log in logs]


# ── Customers ─────────────────────────────────────────────────────────

@app.get("/api/customers", response_model=Page)
def list_customers(
    keyword: str | None = None,
    category: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, alias="pageSize", ge=1, le=100),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    query = select(models.Customer).where(active(models.Customer)).order_by(models.Customer.created_at.desc())
    if keyword:
        pattern = f"%{keyword}%"
        query = query.where(or_(
            models.Customer.name.ilike(pattern), models.Customer.code.ilike(pattern),
            models.Customer.company_name.ilike(pattern), models.Customer.contact_name.ilike(pattern),
            models.Customer.phone.ilike(pattern)))
    if category:
        query = query.where(models.Customer.category == category)
    if status_filter:
        query = query.where(models.Customer.status == status_filter)
    items, page, page_size, total = page_query(db, query, page, page_size)
    result = []
    for customer in items:
        result.append({
            **CustomerOut.model_validate(customer).model_dump(),
            "demand_count": db.scalar(select(func.count()).where(
                models.CustomerDemand.customer_id == customer.id, active(models.CustomerDemand))) or 0,
            "sample_order_count": db.scalar(select(func.count()).where(
                models.SampleOrder.customer_id == customer.id, active(models.SampleOrder))) or 0,
            "formal_order_count": db.scalar(select(func.count()).where(
                models.FormalOrder.customer_id == customer.id, active(models.FormalOrder))) or 0,
        })
    return {"items": result, "page": page, "pageSize": page_size, "total": total}


@app.post("/api/customers", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    customer = models.Customer(code=business_code("KH", db), **payload.model_dump())
    db.add(customer)
    db.flush()
    save_log(db, "customer", customer.id, customer.name, "create",
             get_operator_name(user), customer.code, None, model_to_dict(customer))
    db.commit()
    db.refresh(customer)
    return customer


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    customer = db.scalar(select(models.Customer).where(
        models.Customer.id == customer_id, active(models.Customer)))
    if not customer:
        raise HTTPException(404, "客户不存在")
    return {
        **CustomerOut.model_validate(customer).model_dump(),
        "demand_count": db.scalar(select(func.count()).where(
            models.CustomerDemand.customer_id == customer.id, active(models.CustomerDemand))) or 0,
        "sample_order_count": db.scalar(select(func.count()).where(
            models.SampleOrder.customer_id == customer.id, active(models.SampleOrder))) or 0,
        "formal_order_count": db.scalar(select(func.count()).where(
            models.FormalOrder.customer_id == customer.id, active(models.FormalOrder))) or 0,
    }


@app.put("/api/customers/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: str,
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    customer = db.scalar(select(models.Customer).where(
        models.Customer.id == customer_id, active(models.Customer)))
    if not customer:
        raise HTTPException(404, "客户不存在")
    old_data = model_to_dict(customer)
    for key, value in payload.model_dump().items():
        setattr(customer, key, value)
    db.flush()
    changes = compute_changes(old_data, model_to_dict(customer))
    if changes:
        save_log(db, "customer", customer.id, customer.name, "update",
                 get_operator_name(user), customer.code, old_data, model_to_dict(customer))
    db.commit()
    db.refresh(customer)
    return customer


@app.delete("/api/customers/{customer_id}", status_code=204)
def delete_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    customer = db.scalar(select(models.Customer).where(
        models.Customer.id == customer_id, active(models.Customer)))
    if not customer:
        raise HTTPException(404, "客户不存在")
    save_log(db, "customer", customer.id, customer.name, "delete",
             get_operator_name(user), customer.code, model_to_dict(customer))
    for order in db.scalars(select(models.FormalOrder).where(
            models.FormalOrder.customer_id == customer.id)).all():
        hard_delete_order(db, "formal", order)
    for order in db.scalars(select(models.SampleOrder).where(
            models.SampleOrder.customer_id == customer.id)).all():
        hard_delete_order(db, "sample", order)
    for template in db.scalars(select(models.SampleTemplate).where(
            models.SampleTemplate.customer_id == customer.id)).all():
        hard_delete_template(db, template)
    for demand in db.scalars(select(models.CustomerDemand).where(
            models.CustomerDemand.customer_id == customer.id)).all():
        hard_delete_demand(db, demand)
    db.delete(customer)
    db.commit()


# ── Customer Demands ──────────────────────────────────────────────────

@app.get("/api/customers/{customer_id}/demands", response_model=Page)
def list_demands(
    customer_id: str,
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(5, alias="pageSize", ge=1, le=100),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    query = select(models.CustomerDemand).where(
        models.CustomerDemand.customer_id == customer_id,
        active(models.CustomerDemand)
    ).order_by(models.CustomerDemand.created_at.desc())
    if keyword:
        pattern = f"%{keyword}%"
        query = query.where(or_(
            models.CustomerDemand.name.ilike(pattern),
            models.CustomerDemand.product_name.ilike(pattern),
        ))
    items, page, page_size, total = page_query(db, query, page, page_size)
    data = [DemandOut.model_validate(item).model_dump() for item in items]
    return {"items": data, "page": page, "pageSize": page_size, "total": total}


@app.post("/api/customers/{customer_id}/demands", response_model=DemandOut, status_code=201)
def create_demand(
    customer_id: str,
    payload: DemandBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not db.scalar(select(models.Customer).where(
            models.Customer.id == customer_id, active(models.Customer))):
        raise HTTPException(404, "客户不存在")
    demand = models.CustomerDemand(
        code=business_code("DEM", db), customer_id=customer_id, **payload.model_dump())
    db.add(demand)
    db.flush()
    save_log(db, "demand", demand.id, demand.name, "create",
             get_operator_name(user), demand.code, None, model_to_dict(demand))
    db.commit()
    db.refresh(demand)
    return demand


@app.get("/api/demands/{demand_id}", response_model=DemandOut)
def get_demand(
    demand_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    demand = db.scalar(select(models.CustomerDemand).where(
        models.CustomerDemand.id == demand_id, active(models.CustomerDemand)))
    if not demand:
        raise HTTPException(404, "客户需求不存在")
    return demand


@app.put("/api/demands/{demand_id}", response_model=DemandOut)
def update_demand(
    demand_id: str,
    payload: DemandBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    demand = db.scalar(select(models.CustomerDemand).where(
        models.CustomerDemand.id == demand_id, active(models.CustomerDemand)))
    if not demand:
        raise HTTPException(404, "客户需求不存在")
    old_data = model_to_dict(demand)
    for key, value in payload.model_dump().items():
        setattr(demand, key, value)
    db.flush()
    changes = compute_changes(old_data, model_to_dict(demand))
    if changes:
        save_log(db, "demand", demand.id, demand.name, "update",
                 get_operator_name(user), demand.code, old_data, model_to_dict(demand))
    db.commit()
    db.refresh(demand)
    return demand


@app.delete("/api/demands/{demand_id}", status_code=204)
def delete_demand(
    demand_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    demand = db.scalar(select(models.CustomerDemand).where(
        models.CustomerDemand.id == demand_id, active(models.CustomerDemand)))
    if not demand:
        raise HTTPException(404, "客户需求不存在")
    save_log(db, "demand", demand.id, demand.name, "delete",
             get_operator_name(user), demand.code, model_to_dict(demand))
    hard_delete_demand(db, demand)
    db.commit()


@app.post("/api/demands/{demand_id}/template", response_model=TemplateOut, status_code=201)
def create_template_from_demand(
    demand_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from app.services import apply_product_fields
    demand = db.scalar(select(models.CustomerDemand).where(
        models.CustomerDemand.id == demand_id, active(models.CustomerDemand)))
    if not demand:
        raise HTTPException(404, "客户需求不存在")
    template = models.SampleTemplate(
        code=business_code("MB", db), name=f"{demand.name}样品模板",
        customer_id=demand.customer_id, source_demand_id=demand.id,
        status="UNSUPPLIED", notes=demand.notes,
    )
    apply_product_fields(template, demand)
    db.add(template)
    db.flush()
    save_log(db, "template", template.id, template.name, "create_from_demand",
             get_operator_name(user), template.code, None, model_to_dict(template))
    db.commit()
    db.refresh(template)
    return {**TemplateOut.model_validate(template).model_dump(),
            "customer_name": demand.customer.name if demand.customer else None}


# ── Sample Templates ──────────────────────────────────────────────────

@app.get("/api/templates", response_model=Page)
def list_templates(
    keyword: str | None = None,
    customer_id: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, alias="pageSize", ge=1, le=100),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    query = select(models.SampleTemplate).options(
        joinedload(models.SampleTemplate.customer)
    ).where(active(models.SampleTemplate)).order_by(models.SampleTemplate.created_at.desc())
    if keyword:
        pattern = f"%{keyword}%"
        query = query.where(or_(
            models.SampleTemplate.name.ilike(pattern),
            models.SampleTemplate.code.ilike(pattern),
            models.SampleTemplate.product_name.ilike(pattern)))
    if customer_id:
        query = query.where(models.SampleTemplate.customer_id == customer_id)
    if status_filter:
        query = query.where(models.SampleTemplate.status == status_filter)
    items, page, page_size, total = page_query(db, query, page, page_size)
    data = [{**TemplateOut.model_validate(item).model_dump(),
             "customer_name": item.customer.name if item.customer else None} for item in items]
    return {"items": data, "page": page, "pageSize": page_size, "total": total}


@app.post("/api/templates", response_model=TemplateOut, status_code=201)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    customer = db.scalar(select(models.Customer).where(
        models.Customer.id == payload.customer_id, active(models.Customer)))
    if not customer:
        raise HTTPException(404, "客户不存在")
    template = models.SampleTemplate(code=business_code("MB", db), **payload.model_dump())
    db.add(template)
    db.flush()
    save_log(db, "template", template.id, template.name, "create",
             get_operator_name(user), template.code, None, model_to_dict(template))
    db.commit()
    db.refresh(template)
    return {**TemplateOut.model_validate(template).model_dump(), "customer_name": customer.name}


@app.get("/api/templates/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    template = db.scalar(select(models.SampleTemplate).where(
        models.SampleTemplate.id == template_id, active(models.SampleTemplate)))
    if not template:
        raise HTTPException(404, "模板不存在")
    return {**TemplateOut.model_validate(template).model_dump(),
            "customer_name": template.customer.name if template.customer else None}


@app.post("/api/templates/{template_id}/duplicate", response_model=TemplateOut, status_code=201)
def duplicate_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    source = db.scalar(select(models.SampleTemplate).where(
        models.SampleTemplate.id == template_id, active(models.SampleTemplate)))
    if not source:
        raise HTTPException(404, "模板不存在")
    data = {column.name: getattr(source, column.name)
            for column in models.SampleTemplate.__table__.columns
            if column.name not in {"id", "code", "created_at", "updated_at", "deleted_at"}}
    # 生成不重复的副本名称：原名 + 递增数字
    base_name = source.name
    new_name = f"{base_name}1"
    counter = 2
    while db.scalar(select(models.SampleTemplate).where(
            models.SampleTemplate.name == new_name,
            models.SampleTemplate.deleted_at.is_(None))):
        new_name = f"{base_name}{counter}"
        counter += 1
    data["name"] = new_name
    copy = models.SampleTemplate(code=business_code("MB", db), **data)
    db.add(copy)
    db.flush()
    save_log(db, "template", copy.id, copy.name, "duplicate",
             get_operator_name(user), copy.code, None, model_to_dict(copy))
    db.commit()
    db.refresh(copy)
    return {**TemplateOut.model_validate(copy).model_dump(),
            "customer_name": source.customer.name if source.customer else None}


@app.put("/api/templates/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: str,
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.scalar(select(models.SampleTemplate).where(
        models.SampleTemplate.id == template_id, active(models.SampleTemplate)))
    if not template:
        raise HTTPException(404, "模板不存在")
    old_data = model_to_dict(template)
    for key, value in payload.model_dump().items():
        setattr(template, key, value)
    db.flush()
    changes = compute_changes(old_data, model_to_dict(template))
    if changes:
        save_log(db, "template", template.id, template.name, "update",
                 get_operator_name(user), template.code, old_data, model_to_dict(template))
    db.commit()
    db.refresh(template)
    return {**TemplateOut.model_validate(template).model_dump(),
            "customer_name": template.customer.name if template.customer else None}


@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.scalar(select(models.SampleTemplate).where(
        models.SampleTemplate.id == template_id, active(models.SampleTemplate)))
    if not template:
        raise HTTPException(404, "模板不存在")
    save_log(db, "template", template.id, template.name, "delete",
             get_operator_name(user), template.code, model_to_dict(template))
    hard_delete_template(db, template)
    db.commit()


@app.patch("/api/templates/{template_id}/status", response_model=TemplateOut)
def update_template_status(
    template_id: str,
    payload: TemplateStatusBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    template = db.scalar(select(models.SampleTemplate).where(
        models.SampleTemplate.id == template_id, active(models.SampleTemplate)))
    if not template:
        raise HTTPException(404, "模板不存在")
    old_status = template.status
    template.status = payload.status
    save_log(db, "template", template.id, template.name, "status_change",
             get_operator_name(user), template.code,
             {"status": old_status}, {"status": payload.status})
    db.commit()
    db.refresh(template)
    return {**TemplateOut.model_validate(template).model_dump(),
            "customer_name": template.customer.name if template.customer else None}


# ── Suppliers ─────────────────────────────────────────────────────────

@app.get("/api/suppliers", response_model=Page)
def list_suppliers(
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(5, alias="pageSize", ge=1, le=100),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    query = select(models.Supplier).where(active(models.Supplier)).order_by(models.Supplier.created_at.desc())
    if keyword:
        pattern = f"%{keyword}%"
        query = query.where(or_(
            models.Supplier.name.ilike(pattern), models.Supplier.code.ilike(pattern),
            models.Supplier.contact_name.ilike(pattern), models.Supplier.phone.ilike(pattern)))
    items, page, page_size, total = page_query(db, query, page, page_size)
    data = [SupplierOut.model_validate(item).model_dump() for item in items]
    return {"items": data, "page": page, "pageSize": page_size, "total": total}


@app.post("/api/suppliers", response_model=SupplierOut, status_code=201)
def create_supplier(
    payload: SupplierBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    supplier = models.Supplier(code=business_code("SUP", db), **payload.model_dump())
    db.add(supplier)
    db.flush()
    save_log(db, "supplier", supplier.id, supplier.name, "create",
             get_operator_name(user), supplier.code, None, model_to_dict(supplier))
    db.commit()
    db.refresh(supplier)
    return supplier


@app.put("/api/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: str,
    payload: SupplierBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    supplier = db.scalar(select(models.Supplier).where(
        models.Supplier.id == supplier_id, active(models.Supplier)))
    if not supplier:
        raise HTTPException(404, "供应商不存在")
    old_data = model_to_dict(supplier)
    for key, value in payload.model_dump().items():
        setattr(supplier, key, value)
    db.flush()
    changes = compute_changes(old_data, model_to_dict(supplier))
    if changes:
        save_log(db, "supplier", supplier.id, supplier.name, "update",
                 get_operator_name(user), supplier.code, old_data, model_to_dict(supplier))
    db.commit()
    db.refresh(supplier)
    return supplier


@app.delete("/api/suppliers/{supplier_id}", status_code=204)
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    supplier = db.scalar(select(models.Supplier).where(
        models.Supplier.id == supplier_id, active(models.Supplier)))
    if not supplier:
        raise HTTPException(404, "供应商不存在")
    save_log(db, "supplier", supplier.id, supplier.name, "delete",
             get_operator_name(user), supplier.code, model_to_dict(supplier))
    for item_model in (models.SampleOrderItem, models.FormalOrderItem):
        db.execute(update(item_model).where(
            item_model.supplier_id == supplier.id
        ).values(supplier_id=None))
    db.delete(supplier)
    db.commit()


# ── Workflow Logs ─────────────────────────────────────────────────────

@app.get("/api/workflow-logs")
def list_workflow_logs(
    order_type: str,
    order_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    return db.scalars(select(models.OrderWorkflowLog).where(
        models.OrderWorkflowLog.order_type == order_type,
        models.OrderWorkflowLog.order_id == order_id,
    ).order_by(models.OrderWorkflowLog.created_at.desc())).all()


# ── Orders (shared logic) ────────────────────────────────────────────

def _order_model(order_type: str):
    return models.SampleOrder if order_type == "sample" else models.FormalOrder


def _order_prefix(order_type: str):
    return "SO" if order_type == "sample" else "FO"


def _order_status(order_type: str):
    return SampleStatus.SAMPLE_COMMUNICATION.value if order_type == "sample" else FormalStatus.ORDER_COMMUNICATION.value


def _list_orders(order_type, keyword, status_filter, customer_id, submitted_only, page, page_size, db):
    model = _order_model(order_type)
    query = select(model).options(joinedload(model.customer)).where(
        active(model)).order_by(model.created_at.desc())
    if keyword:
        pattern = f"%{keyword}%"
        item_model = models.SampleOrderItem if order_type == "sample" else models.FormalOrderItem
        query = query.where(or_(
            model.name.ilike(pattern), model.code.ilike(pattern),
            model.items.any(item_model.product_name.ilike(pattern))))
    if status_filter == "SUSPENDED":
        query = query.where(model.is_suspended.is_(True))
    elif status_filter:
        query = query.where(model.workflow_status == status_filter, model.is_suspended.is_(False))
    if customer_id:
        query = query.where(model.customer_id == customer_id)
    if submitted_only:
        query = query.where(model.is_submitted.is_(True))
    items, page, page_size, total = page_query(db, query, page, page_size)
    data = [order_to_dict(item) for item in items]
    return {"items": data, "page": page, "pageSize": page_size, "total": total}


def _create_order(order_type, payload, db, operator):
    model = _order_model(order_type)
    order = model(code=business_code(_order_prefix(order_type), db))
    update_order_from_payload(db, order, payload, order_type)
    db.add(order)
    db.flush()
    save_log(db, "order", order.id, order.name, "create",
             operator, order.code, None, {"name": order.name, "customer_id": order.customer_id})
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


def _get_order(order_type, order_id, db):
    model = _order_model(order_type)
    order = db.scalar(select(model).options(joinedload(model.customer)).where(
        model.id == order_id, active(model)))
    if not order:
        raise HTTPException(404, "订单不存在")
    return order


def _register_order_routes(order_type: str):
    prefix = "/api/sample-orders" if order_type == "sample" else "/api/formal-orders"
    label = "sample" if order_type == "sample" else "formal"

    @app.get(prefix, response_model=Page, name=f"list_{label}_orders")
    def list_orders(
        keyword: str | None = None,
        status_filter: str | None = Query(None, alias="status"),
        customer_id: str | None = None,
        submitted_only: bool = Query(False, alias="submittedOnly"),
        page: int = Query(1, ge=1),
        page_size: int = Query(5, alias="pageSize", ge=1, le=100),
        db: Session = Depends(get_db),
        _user: models.User = Depends(get_current_user),
    ):
        return _list_orders(order_type, keyword, status_filter, customer_id,
                            submitted_only, page, page_size, db)

    @app.post(prefix, response_model=OrderOut, status_code=201, name=f"create_{label}_order")
    def create_order(
        payload: OrderBase,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        return _create_order(order_type, payload, db, get_operator_name(user))

    @app.get(f"{prefix}/{{order_id}}", response_model=OrderOut, name=f"get_{label}_order")
    def get_order(
        order_id: str,
        db: Session = Depends(get_db),
        _user: models.User = Depends(get_current_user),
    ):
        return order_to_dict(_get_order(order_type, order_id, db))

    @app.put(f"{prefix}/{{order_id}}", response_model=OrderOut, name=f"update_{label}_order")
    def update_order(
        order_id: str,
        payload: OrderBase,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        order = _get_order(order_type, order_id, db)
        if order.is_submitted:
            raise HTTPException(409, "已提交订单不能按草稿编辑")
        old_data = {"name": order.name, "customer_id": order.customer_id,
                    "delivery_date": str(order.delivery_date) if order.delivery_date else None,
                    "settlement_amount": str(order.settlement_amount) if order.settlement_amount else None}
        update_order_from_payload(db, order, payload, order_type)
        db.flush()
        new_data = {"name": order.name, "customer_id": order.customer_id,
                    "delivery_date": str(order.delivery_date) if order.delivery_date else None,
                    "settlement_amount": str(order.settlement_amount) if order.settlement_amount else None}
        save_log(db, "order", order.id, order.name, "update",
                 get_operator_name(user), order.code, old_data, new_data)
        db.commit()
        db.refresh(order)
        return order_to_dict(order)

    @app.delete(f"{prefix}/{{order_id}}", status_code=204, name=f"delete_{label}_order")
    def delete_order(
        order_id: str,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        order = _get_order(order_type, order_id, db)
        save_log(db, "order", order.id, order.name, "delete",
                 get_operator_name(user), order.code,
                 {"name": order.name, "code": order.code})
        hard_delete_order(db, order_type, order)
        db.commit()

    @app.post(f"{prefix}/{{order_id}}/submit", response_model=OrderOut, name=f"submit_{label}_order")
    def submit_order(
        order_id: str,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        order = _get_order(order_type, order_id, db)
        if order.is_submitted:
            raise HTTPException(409, "订单已提交")
        validate_submit(order)
        # Auto-calculate settlement amount if not manually set
        if not order.settlement_amount or order.settlement_amount == 0:
            order.settlement_amount = calc_settlement_amount(order.items)
        order.is_submitted = True
        order.workflow_status = _order_status(order_type)
        order.version += 1
        op = get_operator_name(user)
        db.add(models.OrderWorkflowLog(
            order_type=order_type, order_id=order.id, action="SUBMIT",
            to_status=order.workflow_status, operator=op))
        save_log(db, "order", order.id, order.name, "submit",
                 op, order.code, {"is_submitted": False},
                 {"is_submitted": True, "workflow_status": order.workflow_status})
        db.commit()
        db.refresh(order)
        return order_to_dict(order)

    @app.post(f"{prefix}/{{order_id}}/advance", response_model=OrderOut, name=f"advance_{label}_order")
    def advance(
        order_id: str,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        order = _get_order(order_type, order_id, db)
        advance_order(db, order, order_type, get_operator_name(user))
        db.commit()
        db.refresh(order)
        return order_to_dict(order)

    @app.post(f"{prefix}/{{order_id}}/suspend", response_model=OrderOut, name=f"suspend_{label}_order")
    def suspend(
        order_id: str,
        payload: SuspendBody,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        order = _get_order(order_type, order_id, db)
        suspend_order(db, order, order_type, payload.reason, get_operator_name(user))
        db.commit()
        db.refresh(order)
        return order_to_dict(order)

    @app.post(f"{prefix}/{{order_id}}/resume", response_model=OrderOut, name=f"resume_{label}_order")
    def resume(
        order_id: str,
        db: Session = Depends(get_db),
        user: models.User = Depends(get_current_user),
    ):
        order = _get_order(order_type, order_id, db)
        resume_order(db, order, order_type, get_operator_name(user))
        db.commit()
        db.refresh(order)
        return order_to_dict(order)


_register_order_routes("sample")
_register_order_routes("formal")
