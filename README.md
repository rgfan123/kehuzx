# 客户订单中心

面向内部运营人员的客户、样品及正式订单管理系统。业务依据见 `docs/01-业务需求文档.md`，技术与交互约束见其余 `docs` 文档。

## 已实现范围

- 客户档案、软删除、组合搜索、服务端分页和关联业务统计
- 客户详情，以及客户需求、样品模板、样品订单、正式订单标签页
- 单产品样品模板、模板状态、复制为新模板
- 供应商档案与订单产品级供应商关联；空值表示本公司供应
- 样品订单和正式订单主表、产品明细、交付与结账信息
- 模板加入订单时复制产品、规格、供价快照
- 草稿保存与提交校验
- 样品及正式订单顺序流程、中止、恢复和流程日志
- 客户、模板、订单等业务对象软删除
- 桌面、窄桌面和移动端响应式界面

## 技术栈

- 前端：React 19、TypeScript、Vite、Ant Design 5、React Router
- 后端：FastAPI、SQLAlchemy 2、Pydantic 2、Alembic
- 正式数据库：PostgreSQL 16
- 测试：Pytest、FastAPI TestClient、Playwright

## 本地运行

### 1. 数据库

```powershell
docker compose up -d db
```

### 2. 后端

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Set-Location backend
..\.venv\Scripts\alembic.exe upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API 文档：http://127.0.0.1:8000/docs

### 3. 前端

```powershell
Set-Location frontend
npm install
npm run dev
```

页面：http://127.0.0.1:5173

## 演示模式

无需 PostgreSQL 时，可使用进程内 SQLite 和演示数据：

```powershell
Set-Location backend
$env:DATABASE_URL='sqlite:///:memory:'
$env:SEED_DEMO='true'
..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

演示数据只在当前后端进程内存在，重启后会重新生成。

## 验证命令

```powershell
Set-Location backend
$env:DATABASE_URL='sqlite:///:memory:'
..\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
..\.venv\Scripts\alembic.exe upgrade head

Set-Location ..\frontend
npm run lint
npm run build
npx playwright test
```

Playwright 默认验证运行在 `http://127.0.0.1:5174` 的联调服务，可在 `frontend/playwright.config.ts` 调整。

## 已确认业务规则

- 总体数量始终由单份数量乘以份数计算，不允许人工覆盖。
- 结账金额当前由使用者填写，允许为 0。
- 样品订单完成后由使用者确认是否把模板更新为“已被供应”，不静默自动修改。
- 正式订单可由模板创建，并预留来源样品订单字段。
- 第一阶段使用固定操作人“本地管理员”，数据库和日志结构保留后续认证扩展空间。
