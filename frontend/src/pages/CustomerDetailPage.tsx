import { useCallback, useEffect, useRef, useState } from 'react'
import {
  App, Button, Collapse, DatePicker, Descriptions, Divider, Drawer, Form, Input, message,
  Modal, Space, Table, Tabs, Tag, Timeline,
} from 'antd'
import dayjs from 'dayjs'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Customer, Demand, OperationLog, Order, Template } from '../types'
import { ACTION_TEXT, ENTITY_TEXT } from '../types'
import { OrderProductDetails, ProductDetails, ProductFieldsForm } from '../components/BusinessFields'
import { ErrorBlock, LoadingBlock, PageTitle, StatusTag, TableTitle } from '../components/Common'

const text = (value?: string | number | boolean | null) =>
  value === undefined || value === null || value === '' ? '无' : typeof value === 'boolean' ? (value ? '是' : '否') : String(value)

function formatLogDetail(raw?: string) {
  if (!raw) return null
  try {
    const detail = JSON.parse(raw) as Record<string, unknown>
    // Handle {changes: [{field, before, after}]} format
    const changes = detail.changes as Array<{ field: string; before: unknown; after: unknown }> | undefined
    if (changes?.length) {
      return changes.map((c, i) => (
        <div key={i} style={{ fontSize: 12 }}>
          <span style={{ color: '#666' }}>{c.field}:</span>{' '}
          <span style={{ color: '#f5222d', textDecoration: 'line-through' }}>{text(c.before)}</span>
          {' → '}
          <span style={{ color: '#52c41a' }}>{text(c.after)}</span>
        </div>
      ))
    }
    // Handle {before: {}, after: {}} format
    const before = detail.before as Record<string, unknown> | undefined
    const after = detail.after as Record<string, unknown> | undefined
    if (before && after) {
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
      const changedKeys = [...allKeys].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      if (changedKeys.length) {
        return changedKeys.slice(0, 10).map((key) => (
          <div key={key} style={{ fontSize: 12 }}>
            <span style={{ color: '#666' }}>{key}:</span>{' '}
            {before[key] !== undefined && <span style={{ color: '#f5222d', textDecoration: 'line-through' }}>{text(before[key])}</span>}
            {before[key] !== undefined && after[key] !== undefined && ' → '}
            {after[key] !== undefined && <span style={{ color: '#52c41a' }}>{text(after[key])}</span>}
          </div>
        ))
      }
    }
    return <div style={{ fontSize: 12, color: '#888' }}>{JSON.stringify(detail)}</div>
  } catch {
    return <div style={{ fontSize: 12, color: '#888' }}>{raw}</div>
  }
}

function RecordLogs({ entityType, entityId, entityName }: { entityType: string; entityId: string; entityName?: string }) {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.entityLogs(entityType, entityId)
      setLogs(result)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => { void load() }, [load])

  if (loading) return <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>加载日志中...</div>
  if (!logs.length) return <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>暂无操作记录</div>

  return (
    <div style={{ padding: '8px 0' }}>
      <Timeline
        items={logs.map((log) => ({
          children: (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Tag>{ACTION_TEXT[log.action] ?? log.action}</Tag>
                  <span style={{ color: '#666' }}>{log.operator}</span>
                </Space>
                <span style={{ fontSize: 12, color: '#999' }}>
                  {new Date(log.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              {formatLogDetail(log.change_detail)}
            </div>
          ),
        }))}
      />
    </div>
  )
}

function OrderDetail({ order }: { order: Order }) {
  return <>
    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
      { key: 'code', label: '订单编号', children: order.code },
      { key: 'customer', label: '所属客户', children: text(order.customer_name) },
      { key: 'status', label: '流程状态', children: <StatusTag value={order.workflow_status} suspended={order.is_suspended} /> },
      { key: 'deliveryDate', label: '交付时间', children: text(order.delivery_date) },
      { key: 'address', label: '交货地址', children: text(order.delivery_address) },
      { key: 'lead', label: '配送时效', children: text(order.delivery_lead_time) },
      { key: 'cycle', label: '配送周期', children: text(order.delivery_cycle) },
      { key: 'period', label: '结账账期', children: text(order.settlement_period) },
      { key: 'method', label: '结账方式', children: text(order.settlement_method) },
      { key: 'amount', label: '结账金额', children: text(order.settlement_amount) },
      ...(order.is_suspended && order.suspended_reason ? [
        { key: 'suspendedReason', label: '中止原因', span: 2, children: <div style={{ color: '#9B3A3A', padding: '4px 8px', background: '#FFF2F0', borderRadius: 4 }}>{order.suspended_reason}</div> }
      ] : []),
      { key: 'notes', label: '订单备注', span: 2, children: text(order.notes) },
    ]} />
    <OrderProductDetails items={order.items} />
  </>
}

export default function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { modal } = App.useApp()
  const [customer, setCustomer] = useState<Customer>()
  const [demands, setDemands] = useState<Demand[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [sampleOrders, setSampleOrders] = useState<Order[]>([])
  const [formalOrders, setFormalOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingDemand, setSavingDemand] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const requestVersion = useRef(0)

  // Drawer states
  const [demandOpen, setDemandOpen] = useState(false)
  const [editingDemand, setEditingDemand] = useState<Demand>()
  const [viewDemand, setViewDemand] = useState<Demand>()
  const [viewTemplate, setViewTemplate] = useState<Template>()
  const [viewOrder, setViewOrder] = useState<Order>()
  const [viewOrderType, setViewOrderType] = useState<'sample' | 'formal'>('sample')
  const [logsOpen, setLogsOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const [c, d, t, s, f] = await Promise.all([
        api.customer(id),
        api.demands(id),
        api.templates({ customer_id: id, page: 1, pageSize: 100 }),
        api.orders('sample', { customer_id: id, page: 1, pageSize: 5 }),
        api.orders('formal', { customer_id: id, page: 1, pageSize: 5 }),
      ])
      if (version !== requestVersion.current) return
      setCustomer(c)
      setDemands(d.items)
      setTemplates(t.items)
      setSampleOrders(s.items)
      setFormalOrders(f.items)
    } catch (e) {
      if (version === requestVersion.current) setError((e as Error).message)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingBlock />
  if (error || !customer) return <ErrorBlock message={error || '客户不存在'} retry={load} />

  // ── Demand editing ──
  const openDemand = (demand?: Demand) => {
    setEditingDemand(demand)
    form.setFieldsValue(demand
      ? { ...demand, expected_delivery_date: demand.expected_delivery_date ? dayjs(demand.expected_delivery_date) : undefined }
      : {}
    )
    setDemandOpen(true)
  }

  const closeDemand = () => {
    setDemandOpen(false)
    setEditingDemand(undefined)
    form.resetFields()
  }

  const saveDemand = async () => {
    if (savingDemand) return
    setSavingDemand(true)
    try {
      const values = await form.validateFields()
      const payload = { ...values, expected_delivery_date: values.expected_delivery_date?.format('YYYY-MM-DD') }
      if (editingDemand) await api.updateDemand(editingDemand.id, payload)
      else await api.createDemand(id, payload)
      message.success(editingDemand ? '需求更新成功' : '需求添加成功')
      closeDemand()
      await load()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setSavingDemand(false)
    }
  }

  const handleDeleteDemand = async (demand: Demand) => {
    if (busyId) return
    try {
      await modal.confirm({
        title: `确定删除需求"${demand.name}"？`,
        content: '删除后无法恢复；由该需求复制出的模板不会受到影响。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setBusyId(demand.id)
          setDemands((items) => items.filter((item) => item.id !== demand.id))
          try {
            await api.deleteDemand(demand.id)
            message.success('需求删除成功')
            await load()
          } catch (e) {
            message.error((e as Error).message)
            await load()
          } finally {
            setBusyId(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  const handleDeleteTemplate = async (template: Template) => {
    if (busyId) return
    try {
      await modal.confirm({
        title: `确定删除模板"${template.name}"？`,
        content: '删除后无法恢复；已经粘贴到订单中的产品快照不会受到影响。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setBusyId(template.id)
          setTemplates((items) => items.filter((item) => item.id !== template.id))
          try {
            await api.deleteTemplate(template.id)
            message.success('模板删除成功')
            await load()
          } catch (e) {
            message.error((e as Error).message)
            await load()
          } finally {
            setBusyId(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  const handleDeleteOrder = async (type: 'sample' | 'formal', order: Order) => {
    if (busyId) return
    try {
      await modal.confirm({
        title: `确定删除订单"${order.name}"？`,
        content: '删除后无法恢复，订单及其产品明细将从数据库中永久移除。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setBusyId(order.id)
          const setter = type === 'sample' ? setSampleOrders : setFormalOrders
          setter((items) => items.filter((item) => item.id !== order.id))
          try {
            await api.deleteOrder(type, order.id)
            message.success('订单删除成功')
            await load()
          } catch (e) {
            message.error((e as Error).message)
            await load()
          } finally {
            setBusyId(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  const createTemplate = async (demand: Demand) => {
    if (busyId) return
    setBusyId(demand.id)
    try {
      await api.createTemplateFromDemand(demand.id)
      message.success('模板创建成功')
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const submitOrder = (type: 'sample' | 'formal', order: Order) => {
    if (busyId) return
    try {
      modal.confirm({
        title: `提交订单"${order.name}"？`,
        content: '提交后订单将进入第一个流程状态。',
        okText: '确认提交',
        cancelText: '取消',
        onOk: async () => {
          setBusyId(order.id)
          try {
            await api.orderAction(type, order.id, 'submit')
            message.success('订单已提交')
            await load()
          } catch (e) {
            message.error((e as Error).message)
          } finally {
            setBusyId(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  const orderCols = (type: 'sample' | 'formal') => [
    {
      title: '订单',
      render: (_: unknown, o: Order) => <TableTitle primary={o.name} secondary={o.code} />,
    },
    {
      title: '产品', width: 140,
      render: (_: unknown, o: Order) => {
        const count = o.items.length
        return count > 0 ? <Tag>{count}个产品</Tag> : <span style={{ color: '#999' }}>无</span>
      },
    },
    { title: '交付时间', dataIndex: 'delivery_date', render: (v?: string) => v || '无' },
    { title: '状态', render: (_: unknown, o: Order) => <StatusTag value={o.workflow_status} suspended={o.is_suspended} /> },
    {
      title: '操作', fixed: 'right' as const, width: 200,
      render: (_: unknown, o: Order) => (
        <Space size={4}>
          <Button size="small" onClick={() => { setViewOrder(o); setViewOrderType(type) }}>查看</Button>
          {!o.is_submitted && <Button size="small" loading={busyId === o.id} onClick={() => submitOrder(type, o)}>提交</Button>}
          <Button size="small" onClick={() => navigate(`/${type === 'sample' ? 'samples/orders' : 'orders'}?edit=${o.id}`)}>编辑</Button>
          <Button size="small" danger loading={busyId === o.id} onClick={() => handleDeleteOrder(type, o)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageTitle
        title={customer.name}
        description={`${customer.code} · ${customer.company_name || '未填写公司'}`}
        action={
          <Space>
            <Button onClick={() => setLogsOpen(true)}>操作日志</Button>
            <Button onClick={() => navigate('/customers')}>返回列表</Button>
          </Space>
        }
      />

      <section className="summary-panel">
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small" items={[
          { key: 'category', label: '客户分类', children: text(customer.category) },
          { key: 'status', label: '状态', children: <StatusTag value={customer.status} /> },
          { key: 'contact', label: '联系人', children: text(customer.contact_name) },
          { key: 'phone', label: '联系电话', children: text(customer.phone) },
          { key: 'wechat', label: '微信号', children: text(customer.wechat) },
          { key: 'industry', label: '行业', children: text(customer.industry) },
          { key: 'address', label: '地址', span: 2, children: text(customer.address) },
          { key: 'notes', label: '备注', span: 2, children: text(customer.notes) },
        ]} />
      </section>

      <section className="workspace-panel detail-tabs">
        <Tabs activeKey={params.get('tab') ?? 'demands'} onChange={(tab) => setParams({ tab })} items={[
          {
            key: 'demands', label: `客户需求 (${customer.demand_count})`,
            children: (
              <>
                <div className="tab-actions">
                  <Button type="primary" onClick={() => openDemand()}>新增需求</Button>
                </div>
                <Table rowKey="id" dataSource={demands} pagination={false} scroll={{ x: 1100 }} columns={[
                  { title: '需求', render: (_: unknown, d: Demand) => <TableTitle primary={d.name} secondary={d.code} /> },
                  { title: '产品方向', dataIndex: 'product_name', render: (v?: string) => v || '无' },
                  { title: '品类', dataIndex: 'product_category', render: (v?: string) => v || '无' },
                  { title: '期望交付', dataIndex: 'expected_delivery_date', render: (v?: string) => v || '无' },
                  {
                    title: '操作', fixed: 'right' as const, width: 260,
                    render: (_: unknown, d: Demand) => (
                      <Space size={4}>
                        <Button size="small" onClick={() => setViewDemand(d)}>查看</Button>
                        <Button size="small" onClick={() => openDemand(d)}>编辑</Button>
                        <Button size="small" loading={busyId === d.id} onClick={() => void createTemplate(d)}>创建模板</Button>
                        <Button size="small" danger loading={busyId === d.id} onClick={() => handleDeleteDemand(d)}>删除</Button>
                      </Space>
                    ),
                  },
                ]} />
              </>
            ),
          },
          {
            key: 'templates', label: `样品模板 (${templates.length})`,
            children: (
              <>
                <div className="tab-actions">
                  <Button type="primary" onClick={() => navigate(`/samples/templates?create=1&customerId=${id}`)}>新增模板</Button>
                </div>
                <Table rowKey="id" dataSource={templates} pagination={false} scroll={{ x: 850 }} columns={[
                  { title: '模板', render: (_: unknown, t: Template) => <TableTitle primary={t.name} secondary={t.code} /> },
                  { title: '产品', dataIndex: 'product_name', render: (v?: string) => v || '无' },
                  { title: '状态', render: (_: unknown, t: Template) => <StatusTag value={t.status} /> },
                  {
                    title: '操作', fixed: 'right' as const, width: 180,
                    render: (_: unknown, t: Template) => (
                      <Space size={4}>
                        <Button size="small" onClick={() => setViewTemplate(t)}>查看</Button>
                        <Button size="small" onClick={() => navigate(`/samples/templates?edit=${t.id}`)}>编辑</Button>
                        <Button size="small" danger loading={busyId === t.id} onClick={() => handleDeleteTemplate(t)}>删除</Button>
                      </Space>
                    ),
                  },
                ]} />
              </>
            ),
          },
          {
            key: 'samples', label: `样品订单 (${customer.sample_order_count})`,
            children: (
              <>
                <div className="tab-actions">
                  <Button type="primary" onClick={() => navigate(`/samples/orders?create=1&customerId=${id}`)}>新增样品订单</Button>
                </div>
                <Table rowKey="id" dataSource={sampleOrders} pagination={false} scroll={{ x: 950 }} columns={orderCols('sample')} />
              </>
            ),
          },
          {
            key: 'formal', label: `正式订单 (${customer.formal_order_count})`,
            children: (
              <>
                <div className="tab-actions">
                  <Button type="primary" onClick={() => navigate(`/orders?create=1&customerId=${id}`)}>新增正式订单</Button>
                </div>
                <Table rowKey="id" dataSource={formalOrders} pagination={false} scroll={{ x: 950 }} columns={orderCols('formal')} />
              </>
            ),
          },
        ]} />
      </section>

      {/* Demand editor */}
      <Drawer
        title={editingDemand ? '编辑需求' : '新增需求'}
        open={demandOpen}
        onClose={closeDemand}
        width={760}
        extra={
          <Space>
            <Button onClick={closeDemand} disabled={savingDemand}>取消</Button>
            <Button type="primary" loading={savingDemand} onClick={saveDemand}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <div className="field-grid">
            <Form.Item label="需求名称" name="name" rules={[{ required: true, message: '请输入需求名称' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="交付时间" name="expected_delivery_date">
              <DatePicker className="full-width" />
            </Form.Item>
          </div>
          <ProductFieldsForm sections={['basic']} />
          <Form.Item label="需求备注" name="notes"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Drawer>

      {/* View demand */}
      <Drawer title={viewDemand?.name} open={Boolean(viewDemand)} onClose={() => setViewDemand(undefined)} width={820}>
        {viewDemand && (
          <>
            <Descriptions size="small" items={[
              { key: 'code', label: '需求编号', children: viewDemand.code },
              { key: 'delivery', label: '期望交付', children: text(viewDemand.expected_delivery_date) },
              { key: 'notes', label: '需求备注', children: text(viewDemand.notes) },
            ]} />
            <ProductDetails value={viewDemand} sections={['basic']} />
          </>
        )}
      </Drawer>

      {/* View template */}
      <Drawer title={viewTemplate?.name} open={Boolean(viewTemplate)} onClose={() => setViewTemplate(undefined)} width={820}>
        {viewTemplate && (
          <>
            <Descriptions size="small" items={[
              { key: 'code', label: '模板编号', children: viewTemplate.code },
              { key: 'customer', label: '所属客户', children: text(viewTemplate.customer_name) },
              { key: 'status', label: '模板状态', children: <StatusTag value={viewTemplate.status} /> },
              { key: 'notes', label: '模板备注', children: text(viewTemplate.notes) },
            ]} />
            <Divider />
            <ProductDetails value={viewTemplate} />
          </>
        )}
      </Drawer>

      {/* View order */}
      <Drawer
        title={viewOrder?.name}
        open={Boolean(viewOrder)}
        onClose={() => setViewOrder(undefined)}
        width={900}
        extra={viewOrder ? (
          <Space>
            {!viewOrder.is_submitted && (
              <Button loading={busyId === viewOrder.id} onClick={() => submitOrder(viewOrderType, viewOrder)}>提交</Button>
            )}
            <Button onClick={() => {
              const orderId = viewOrder.id
              setViewOrder(undefined)
              navigate(`/${viewOrderType === 'sample' ? 'samples/orders' : 'orders'}?edit=${orderId}`)
            }}>编辑</Button>
          </Space>
        ) : undefined}
      >
        {viewOrder && <OrderDetail order={viewOrder} />}
      </Drawer>

      {/* Record-level operation logs */}
      <Drawer title={`"${customer.name}" 操作日志`} open={logsOpen} onClose={() => setLogsOpen(false)} width={600}>
        <RecordLogs entityType="customer" entityId={customer.id} entityName={customer.name} />
      </Drawer>
    </>
  )
}
