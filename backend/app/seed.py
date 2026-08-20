from datetime import date
from decimal import Decimal

from sqlalchemy import func, select

from app import models
from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.enums import TemplateStatus
from app.services import business_code


def seed() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(models.User)):
            return

        # ── Default Users ─────────────────────────────────────────────
        users = [
            models.User(username="admin", password_hash=hash_password("admin123"),
                        display_name="系统管理员", role="admin"),
            models.User(username="zhangsan", password_hash=hash_password("123456"),
                        display_name="张三", role="user"),
            models.User(username="lisi", password_hash=hash_password("123456"),
                        display_name="李四", role="user"),
            models.User(username="wangwu", password_hash=hash_password("123456"),
                        display_name="王五", role="user"),
        ]
        db.add_all(users)
        db.flush()

        # ── Customers (add one by one so codes don't collide) ─────────
        def add_customer(**kwargs):
            c = models.Customer(code=business_code("KH", db), **kwargs)
            db.add(c)
            db.flush()
            return c

        customers = [
            add_customer(name="海港餐饮集团", category="连锁餐饮",
                         company_name="海港餐饮管理有限公司",
                         contact_name="陈经理", phone="138 0000 1208",
                         wechat="harbor_food", industry="餐饮",
                         address="香港九龙观塘道 418 号", status="合作中",
                         notes="重点客户，门店每周统一配送。"),
            add_customer(name="臻味火锅", category="区域客户",
                         company_name="臻味供应链有限公司",
                         contact_name="林小姐", phone="136 8000 3377",
                         wechat="zhenwei2026", industry="餐饮",
                         address="深圳市福田区福华一路", status="合作中"),
            add_customer(name="七码商贸", category="经销商",
                         company_name="七码国际贸易有限公司",
                         contact_name="周先生", phone="139 2233 5566",
                         industry="商贸", status="潜在"),
            add_customer(name="悦膳食品", category="食品加工",
                         company_name="悦膳食品科技有限公司",
                         contact_name="梁主管", phone="135 1020 9008",
                         industry="食品加工", status="合作中"),
            add_customer(name="湾区鲜选", category="零售渠道",
                         company_name="湾区鲜选零售有限公司",
                         contact_name="何女士", phone="137 8800 4116",
                         industry="零售", status="暂停"),
            add_customer(name="东岸餐饮", category="连锁餐饮",
                         company_name="东岸餐饮有限公司",
                         contact_name="王经理", phone="133 6600 2201",
                         industry="餐饮", status="潜在"),
        ]

        # ── Demands ───────────────────────────────────────────────────
        def add_demand(**kwargs):
            d = models.CustomerDemand(code=business_code("DEM", db), **kwargs)
            db.add(d)
            db.flush()
            return d

        demand1 = add_demand(
            name="澳洲牛肩切片", customer_id=customers[0].id,
            product_name="M5 牛肩切片", product_category="牛肉",
            raw_material_part="牛肩", meat_grade="M5", goods_status="冷冻",
            expected_delivery_date=date(2026, 9, 8),
            notes="适合小火锅，厚度稳定。")
        demand2 = add_demand(
            name="肥牛卷门店装", customer_id=customers[0].id,
            product_name="谷饲肥牛卷", product_category="牛肉",
            product_form="卷", expected_delivery_date=date(2026, 9, 12))

        # ── Templates ─────────────────────────────────────────────────
        def add_template(**kwargs):
            t = models.SampleTemplate(code=business_code("MB", db), **kwargs)
            db.add(t)
            db.flush()
            return t

        templates = [
            add_template(
                name="M5 牛肩标准样", customer_id=customers[0].id,
                source_demand_id=demand1.id,
                status=TemplateStatus.UNSUPPLIED.value,
                product_name="M5 牛肩切片", product_category="牛肉",
                meat_grade="M5", processing_method="切片",
                cut_thickness=Decimal("2.5"), unit_price=Decimal("48.50"),
                pricing_unit="kg", packaging_plan="2.5kg/袋，4袋/箱"),
            add_template(
                name="谷饲肥牛卷标准样", customer_id=customers[0].id,
                source_demand_id=demand2.id,
                status=TemplateStatus.SUPPLIED.value,
                product_name="谷饲肥牛卷", product_category="牛肉",
                processing_method="刨卷", unit_price=Decimal("42.00"),
                pricing_unit="kg"),
            add_template(
                name="火锅牛舌薄切", customer_id=customers[1].id,
                status=TemplateStatus.UNSUPPLIED.value,
                product_name="牛舌薄切", product_category="牛肉",
                processing_method="切片", unit_price=Decimal("68.00"),
                pricing_unit="kg"),
        ]

        # ── Suppliers ─────────────────────────────────────────────────
        def add_supplier(**kwargs):
            s = models.Supplier(code=business_code("SUP", db), **kwargs)
            db.add(s)
            db.flush()
            return s

        suppliers = [
            add_supplier(name="北方冷链食品", contact_name="赵厂长",
                         phone="186 1100 4521", address="河北省廊坊市开发区",
                         status="合作中"),
            add_supplier(name="粤港鲜品供应链", contact_name="郭经理",
                         phone="188 2600 8012", address="广东省佛山市南海区",
                         status="合作中"),
        ]

        # ── Sample Orders ─────────────────────────────────────────────
        item1 = models.SampleOrderItem(
            product_name=templates[0].product_name,
            product_category=templates[0].product_category,
            processing_method=templates[0].processing_method,
            source_template_id=templates[0].id,
            source_template_code=templates[0].code,
            source_template_name=templates[0].name,
            supplier_id=suppliers[0].id,
            quantity_per_unit=Decimal("2.5"), quantity_unit="kg",
            unit_count=4, total_quantity=Decimal("10"),
            unit_price=templates[0].unit_price, pricing_unit="kg")
        item2 = models.SampleOrderItem(
            product_name=templates[1].product_name,
            product_category=templates[1].product_category,
            processing_method=templates[1].processing_method,
            source_template_id=templates[1].id,
            source_template_code=templates[1].code,
            source_template_name=templates[1].name,
            quantity_per_unit=Decimal("2"), quantity_unit="kg",
            unit_count=3, total_quantity=Decimal("6"),
            unit_price=templates[1].unit_price, pricing_unit="kg")

        order1 = models.SampleOrder(
            code=business_code("SO", db), name="海港餐饮九月打样",
            customer_id=customers[0].id, is_submitted=True,
            workflow_status="SAMPLE_PRODUCING",
            delivery_date=date(2026, 9, 8),
            delivery_address="香港九龙观塘道 418 号",
            settlement_period="月结30天", settlement_method="银行转账",
            settlement_amount=Decimal("0"), items=[item1, item2])
        db.add(order1)
        db.flush()

        order2 = models.SampleOrder(
            code=business_code("SO", db), name="臻味火锅牛舌试样",
            customer_id=customers[1].id,
            delivery_date=date(2026, 9, 16),
            items=[models.SampleOrderItem(
                product_name="牛舌薄切",
                source_template_id=templates[2].id,
                source_template_code=templates[2].code,
                source_template_name=templates[2].name,
                quantity_per_unit=Decimal("1"), quantity_unit="kg",
                unit_count=2, total_quantity=Decimal("2"))])
        db.add(order2)
        db.commit()


if __name__ == "__main__":
    seed()
