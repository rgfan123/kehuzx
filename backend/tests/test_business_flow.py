def create_customer(client):
    response = client.post("/api/customers", json={
        "name": "海港餐饮", "company_name": "海港餐饮有限公司", "contact_name": "陈经理",
        "phone": "13800000000", "status": "合作中",
    })
    assert response.status_code == 201, response.text
    return response.json()


def test_customer_demand_template_and_pagination(client):
    customer = create_customer(client)
    demand = client.post(f"/api/customers/{customer['id']}/demands", json={
        "name": "澳洲牛肉切片", "product_name": "M5牛肩切片", "product_category": "牛肉",
        "expected_delivery_date": "2026-09-01",
    })
    assert demand.status_code == 201, demand.text
    copied = client.post(f"/api/demands/{demand.json()['id']}/template")
    assert copied.status_code == 201, copied.text
    assert copied.json()["product_name"] == "M5牛肩切片"
    template = client.post("/api/templates", json={
        "name": "M5牛肩切片标准样", "customer_id": customer["id"],
        "source_demand_id": demand.json()["id"], "product_name": "M5牛肩切片",
        "unit_price": "48.50", "pricing_unit": "kg",
    })
    assert template.status_code == 201, template.text
    assert template.json()["status"] == "DRAFT"
    duplicate = client.post(f"/api/templates/{template.json()['id']}/duplicate")
    assert duplicate.status_code == 201
    page = client.get("/api/templates?page=1&pageSize=5").json()
    assert page["total"] == 3
    assert page["pageSize"] == 5


def test_order_snapshot_submit_suspend_resume_and_advance(client):
    customer = create_customer(client)
    supplier = client.post("/api/suppliers", json={"name": "北方冷链", "status": "合作中"}).json()
    supplier_page = client.get("/api/suppliers?page=1&pageSize=100")
    assert supplier_page.status_code == 200, supplier_page.text
    assert supplier_page.json()["items"][0]["name"] == "北方冷链"
    template = client.post("/api/templates", json={
        "name": "肥牛样品", "customer_id": customer["id"], "product_name": "肥牛卷",
        "unit_price": "39.90", "pricing_unit": "kg", "processing_method": "切片",
    }).json()
    order = client.post("/api/sample-orders", json={
        "name": "海港九月打样", "customer_id": customer["id"], "delivery_date": "2026-09-02",
        "delivery_address": "香港九龙", "settlement_amount": "0",
        "items": [{
            "source_template_id": template["id"], "supplier_id": supplier["id"],
            "quantity_per_unit": "2.5", "quantity_unit": "kg", "unit_count": 4,
        }],
    })
    assert order.status_code == 201, order.text
    assert order.json()["items"][0]["product_name"] == "肥牛卷"
    assert order.json()["items"][0]["total_quantity"] == "10.000"
    submitted = client.post(f"/api/sample-orders/{order.json()['id']}/submit")
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["workflow_status"] == "SAMPLE_COMMUNICATION"
    workflow_page = client.get("/api/sample-orders?submittedOnly=true&page=1&pageSize=5").json()
    assert workflow_page["total"] == 1
    advanced = client.post(f"/api/sample-orders/{order.json()['id']}/advance")
    assert advanced.json()["workflow_status"] == "FACTORY_COMMUNICATION"
    suspended = client.post(f"/api/sample-orders/{order.json()['id']}/suspend", json={"reason": "客户暂停试样"})
    assert suspended.json()["is_suspended"] is True
    blocked = client.post(f"/api/sample-orders/{order.json()['id']}/advance")
    assert blocked.status_code == 409
    resumed = client.post(f"/api/sample-orders/{order.json()['id']}/resume")
    assert resumed.json()["workflow_status"] == "FACTORY_COMMUNICATION"
    assert resumed.json()["is_suspended"] is False


def test_submit_validation_and_final_state(client):
    draft = client.post("/api/formal-orders", json={"name": "资料不全订单"}).json()
    invalid = client.post(f"/api/formal-orders/{draft['id']}/submit")
    assert invalid.status_code == 422


def test_formal_order_is_independent_from_sample_order(client):
    customer = create_customer(client)
    sample = client.post("/api/sample-orders", json={"name": "来源样品单"}).json()
    formal = client.post("/api/formal-orders", json={
        "name": "转换正式订单", "customer_id": customer["id"],
        "items": [{"product_name": "牛肩切片", "source_sample_order_id": sample["id"]}],
    })
    assert formal.status_code == 201, formal.text
    assert formal.json()["items"][0]["product_name"] == "牛肩切片"
    assert formal.json()["items"][0]["source_sample_order_id"] is None
    assert client.delete(f"/api/sample-orders/{sample['id']}").status_code == 204
    assert client.get(f"/api/formal-orders/{formal.json()['id']}").json()["items"][0]["product_name"] == "牛肩切片"


def test_business_codes_are_unique_for_batch_creates(client):
    codes = {
        client.post("/api/customers", json={"name": f"批量客户{i}"}).json()["code"]
        for i in range(20)
    }
    assert len(codes) == 20


def test_demand_template_and_both_order_types_have_full_crud(client):
    customer = create_customer(client)
    demand = client.post(f"/api/customers/{customer['id']}/demands", json={
        "name": "CRUD需求", "product_name": "原产品",
    }).json()
    assert client.get(f"/api/demands/{demand['id']}").status_code == 200
    updated_demand = client.put(f"/api/demands/{demand['id']}", json={
        "name": "已修改需求", "product_name": "新产品",
    })
    assert updated_demand.status_code == 200
    assert updated_demand.json()["product_name"] == "新产品"

    template = client.post("/api/templates", json={
        "name": "CRUD模板", "customer_id": customer["id"], "product_name": "模板产品",
    }).json()
    assert client.get(f"/api/templates/{template['id']}").status_code == 200
    updated_template = client.put(f"/api/templates/{template['id']}", json={
        "name": "已修改模板", "customer_id": customer["id"], "status": "AVAILABLE_FOR_SAMPLE",
        "product_name": "修改后模板产品",
    })
    assert updated_template.status_code == 200
    assert updated_template.json()["status"] == "AVAILABLE_FOR_SAMPLE"

    for prefix in ("sample", "formal"):
        path = "sample-orders" if prefix == "sample" else "formal-orders"
        created = client.post(f"/api/{path}", json={"name": f"{prefix} CRUD草稿"}).json()
        assert client.get(f"/api/{path}/{created['id']}").status_code == 200
        updated = client.put(f"/api/{path}/{created['id']}", json={
            "name": f"{prefix} 已修改草稿", "customer_id": customer["id"],
            "items": [{"product_name": "CRUD产品", "quantity_per_unit": "1", "unit_count": 2}],
        })
        assert updated.status_code == 200, updated.text
        assert updated.json()["name"].endswith("已修改草稿")
        assert client.delete(f"/api/{path}/{created['id']}").status_code == 204

    assert client.delete(f"/api/templates/{template['id']}").status_code == 204
    assert client.delete(f"/api/demands/{demand['id']}").status_code == 204
    assert client.get(f"/api/templates/{template['id']}").status_code == 404
    assert client.get(f"/api/demands/{demand['id']}").status_code == 404


def test_order_template_import_is_limited_to_order_customer(client):
    first_customer = create_customer(client)
    second_customer = create_customer(client)
    template = client.post("/api/templates", json={
        "name": "客户专属模板", "customer_id": first_customer["id"], "product_name": "牛肩切片",
    }).json()
    allowed = client.post("/api/sample-orders", json={
        "name": "同客户样品单", "customer_id": first_customer["id"],
        "items": [{"source_template_id": template["id"]}],
    })
    assert allowed.status_code == 201, allowed.text
    rejected = client.post("/api/sample-orders", json={
        "name": "跨客户样品单", "customer_id": second_customer["id"],
        "items": [{"source_template_id": template["id"]}],
    })
    assert rejected.status_code == 400
    assert "当前订单所属客户" in rejected.json()["detail"]


def test_hard_delete_removes_records_but_keeps_copied_order_snapshot(client):
    customer = create_customer(client)
    demand = client.post(f"/api/customers/{customer['id']}/demands", json={
        "name": "待永久删除需求", "product_name": "牛肩原需求",
    }).json()
    template = client.post("/api/templates", json={
        "name": "待永久删除模板", "customer_id": customer["id"],
        "source_demand_id": demand["id"], "product_name": "模板牛肩切片",
    }).json()
    order = client.post("/api/sample-orders", json={
        "name": "保留快照订单", "customer_id": customer["id"],
        "items": [{"source_template_id": template["id"]}],
    }).json()
    assert client.delete(f"/api/templates/{template['id']}").status_code == 204
    assert client.get(f"/api/templates/{template['id']}").status_code == 404
    snapshot = client.get(f"/api/sample-orders/{order['id']}").json()["items"][0]
    assert snapshot["product_name"] == "模板牛肩切片"
    assert snapshot["source_template_id"] is None
    assert client.delete(f"/api/demands/{demand['id']}").status_code == 204
    assert client.get(f"/api/demands/{demand['id']}").status_code == 404
