import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App, Button, DatePicker, Descriptions, Divider, Drawer, Form, Input, InputNumber, message,
  Modal, Select, Space, Steps, Table, Tag,
} from 'antd'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Customer, Order, Page, ProductFields, Supplier, Template } from '../types'
import { SAMPLE_FLOW_TEXT, FORMAL_FLOW_TEXT } from '../types'
import { OrderProductDetails } from '../components/BusinessFields'
import { ErrorBlock, MetricStrip, PageTitle, StatusTag, TableTitle } from '../components/Common'

const SAMPLE_FLOW = ['SAMPLE_COMMUNICATION', 'FACTORY_COMMUNICATION', 'SAMPLE_PRODUCING', 'SAMPLE_COMPLETED', 'SAMPLE_DELIVERY', 'PRODUCT_CONFIRMED']
const FORMAL_FLOW = ['ORDER_COMMUNICATION', 'FACTORY_COMMUNICATION', 'ORDER_PRODUCING', 'ORDER_COMPLETED', 'DELIVERED_TO_CUSTOMER']
const FLOW_TEXT: Record<string, string> = { ...SAMPLE_FLOW_TEXT, ...FORMAL_FLOW_TEXT }

const text = (value: unknown) => value === null || value === undefined || value === '' ? '无' : String(value)

// Product fields that can be copied from a template (ALL product fields)
const PRODUCT_KEYS: (keyof ProductFields)[] = [
  'product_name', 'raw_material_part', 'product_category', 'meat_grade', 'variety',
  'goods_status', 'manufacturer', 'import_domestic', 'origin', 'execution_standard',
  'processing_method', 'product_form', 'fat_lean_ratio', 'trimming_grade',
  'cut_length', 'length_unit', 'cut_width', 'width_unit', 'cut_thickness', 'thickness_unit',
  'processing_details', 'packaging_plan',
  'unit_price', 'price_currency', 'pricing_unit', 'tax_included', 'tax_rate', 'delivery_fee',
]

// ── Product Edit Modal ──────────────────────────────────────────────

function ProductEditModal({
  open, onClose, onConfirm, suppliers, templates, initialValues,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (item: Record<string, unknown>) => void
  suppliers: Supplier[]
  templates: Template[]
  initialValues?: Record<string, unknown> | null
}) {
  const [form] = Form.useForm()
  const [isEditing, setIsEditing] = useState(false)

  // Fill form when modal opens with initial values
  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue(initialValues)
      setIsEditing(true)
    } else if (open) {
      form.resetFields()
      setIsEditing(false)
    }
  }, [open, initialValues, form])

  // When template is selected, fill ALL product fields
  const handleTemplateChange = (templateId: string | null) => {
    const tmpl = templates.find((t) => t.id === templateId) || null
    if (tmpl) {
      const productData = Object.fromEntries(
        PRODUCT_KEYS.map((key) => [key, (tmpl as Record<string, unknown>)[key] ?? undefined])
      )
      form.setFieldsValue({ ...productData, source_template_id: tmpl.id, source_template_name: tmpl.name })
    }
  }

  // Auto-calc total quantity
  const handleQuantityChange = () => {
    const perUnit = parseFloat(form.getFieldValue('quantity_per_unit')) || 0
    const unitCount = parseInt(form.getFieldValue('unit_count')) || 0
    const total = perUnit * unitCount
    form.setFieldsValue({ total_quantity: total > 0 ? total : undefined })
  }

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields()
      onConfirm(values)
    } catch {
      // validation error
    }
  }

  const handleClose = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={isEditing ? '编辑产品' : '添加产品'}
      open={open}
      onCancel={handleClose}
      onOk={handleConfirm}
      width={900}
      okText="确认"
      cancelText="取消"
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Form form={form} layout="vertical" size="small">
        {/* Template import */}
        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>从模板导入</Divider>
        <Form.Item label="选择模板" style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="选择模板可自动填充产品信息"
            onChange={handleTemplateChange}
            options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
          />
        </Form.Item>

        {/* Basic info */}
        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>产品基础信息</Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
          <Form.Item label="产品名" name="product_name" rules={[{ required: true, message: '请输入产品名' }]} style={{ marginBottom: 8 }}>
            <Input />
          </Form.Item>
          <Form.Item label="品类" name="product_category" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="原料部位" name="raw_material_part" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="肉类等级" name="meat_grade" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="品种" name="variety" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="货品状态" name="goods_status" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="厂商/厂号" name="manufacturer" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="进口/国产" name="import_domestic" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="产地来源" name="origin" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="执行标准" name="execution_standard" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="供应商" name="supplier_id" style={{ marginBottom: 8, gridColumn: 'span 2' }}>
            <Select allowClear placeholder="本公司供应" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </div>

        {/* Specs */}
        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>产品规格</Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
          <Form.Item label="加工方式" name="processing_method" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="产品形态" name="product_form" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="肥瘦比例" name="fat_lean_ratio" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="精修等级" name="trimming_grade" style={{ marginBottom: 8 }}><Input /></Form.Item>
          <Form.Item label="切割长度" name="cut_length" style={{ marginBottom: 8 }}>
            <InputNumber min={0} className="full-width" />
          </Form.Item>
          <Form.Item label="长度单位" name="length_unit" style={{ marginBottom: 8 }}><Input placeholder="cm" /></Form.Item>
          <Form.Item label="切割宽度" name="cut_width" style={{ marginBottom: 8 }}>
            <InputNumber min={0} className="full-width" />
          </Form.Item>
          <Form.Item label="宽度单位" name="width_unit" style={{ marginBottom: 8 }}><Input placeholder="cm" /></Form.Item>
          <Form.Item label="切割厚度" name="cut_thickness" style={{ marginBottom: 8 }}>
            <InputNumber min={0} className="full-width" />
          </Form.Item>
          <Form.Item label="厚度单位" name="thickness_unit" style={{ marginBottom: 8 }}><Input placeholder="mm" /></Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <Form.Item label="加工规格详细" name="processing_details" style={{ marginBottom: 8 }}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="包装方案" name="packaging_plan" style={{ marginBottom: 8 }}><Input.TextArea rows={2} /></Form.Item>
        </div>

        {/* Quantity & Pricing */}
        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>数量与价格</Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
          <Form.Item label="单份数量" name="quantity_per_unit" rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 8 }}>
            <InputNumber min={0} className="full-width" onChange={handleQuantityChange} />
          </Form.Item>
          <Form.Item label="数量单位" name="quantity_unit" style={{ marginBottom: 8 }}><Input placeholder="kg、箱" /></Form.Item>
          <Form.Item label="份数" name="unit_count" rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 8 }}>
            <InputNumber min={0} precision={0} className="full-width" onChange={handleQuantityChange} />
          </Form.Item>
          <Form.Item label="总数量" name="total_quantity" style={{ marginBottom: 8 }}>
            <InputNumber min={0} className="full-width" />
          </Form.Item>
          <Form.Item label="单价" name="unit_price" style={{ marginBottom: 8 }}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item label="价格单位" name="price_currency" style={{ marginBottom: 8 }}><Input placeholder="元" /></Form.Item>
          <Form.Item label="计价单位" name="pricing_unit" style={{ marginBottom: 8 }}><Input placeholder="份、kg" /></Form.Item>
          <Form.Item label="是否含税" name="tax_included" style={{ marginBottom: 8 }}>
            <Select allowClear options={[{ value: true, label: '是' }, { value: false, label: '否' }]} />
          </Form.Item>
          <Form.Item label="税率(%)" name="tax_rate" style={{ marginBottom: 8 }}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item label="配送费" name="delivery_fee" style={{ marginBottom: 8 }}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
        </div>

        <Form.Item label="备注" name="notes" style={{ marginBottom: 0 }}><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  )
}

// ── Order List Page ─────────────────────────────────────────────────

export default function OrdersPage({ type, workflow }: { type: 'sample' | 'formal'; workflow: boolean }) {
  const flow = type === 'sample' ? SAMPLE_FLOW : FORMAL_FLOW
  const { modal } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<Page<Order>>({ items: [], page: 1, pageSize: 10, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>()
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Order | undefined>()
  const [detail, setDetail] = useState<Order | undefined>()
  const [saving, setSaving] = useState(false)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form] = Form.useForm()

  const [counts, setCounts] = useState<Record<string, number>>({})
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null)
  const [productItems, setProductItems] = useState<Record<string, unknown>[]>([])
  const [productInitialValues, setProductInitialValues] = useState<Record<string, unknown> | null>(null)

  const reqRef = useRef(0)

  const loadReferences = useCallback(async () => {
    try {
      const [clients, sups, tmpls] = await Promise.all([
        api.customers({ page: 1, pageSize: 100 }),
        api.suppliers({ page: 1, pageSize: 100 }),
        api.templates({ page: 1, pageSize: 100 }),
      ])
      setCustomers(clients.items)
      setSuppliers(sups.items)
      setTemplates(tmpls.items)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const load = useCallback(async () => {
    const v = ++reqRef.current
    setLoading(true)
    setError('')
    try {
      const countRequests = workflow
        ? [...flow.map((key) => api.orders(type, { status: key, page: 1, pageSize: 1 })),
           api.orders(type, { status: 'SUSPENDED', page: 1, pageSize: 1 })]
        : []
      const [orders, ...countPages] = await Promise.all([
        api.orders(type, { keyword, status, submittedOnly: workflow ? 'true' : undefined, page, pageSize: 10 }),
        ...countRequests,
      ])
      if (v !== reqRef.current) return
      setData(orders)
      if (workflow) {
        setCounts(Object.fromEntries([...flow, 'SUSPENDED'].map((key, i) => [key, countPages[i].total])))
      }
    } catch (e) {
      if (v === reqRef.current) setError((e as Error).message)
    } finally {
      if (v === reqRef.current) setLoading(false)
    }
  }, [type, keyword, status, page, workflow, flow])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadReferences() }, [loadReferences])

  // ─ Auto-calculate settlement amount ──
  const calcSettlement = useCallback((items: Record<string, unknown>[]) => {
    let total = 0
    for (const item of items) {
      const price = parseFloat(item.unit_price as string) || 0
      const qty = parseFloat(item.total_quantity as string) || 0
      total += price * qty
    }
    return total
  }, [])

  // Update settlement when items change
  useEffect(() => {
    if (drawerOpen) {
      const amount = calcSettlement(productItems)
      if (amount > 0) {
        form.setFieldsValue({ settlement_amount: amount.toFixed(2) })
      }
    }
  }, [productItems, drawerOpen, calcSettlement, form])

  // ── Order Editor ──
  const openEditor = useCallback((order?: Order, customerId?: string) => {
    setEditing(order)
    if (order) {
      const items = order.items.map((item) => ({
        ...item,
        quantity_per_unit: item.quantity_per_unit ? parseFloat(item.quantity_per_unit) : undefined,
        unit_count: item.unit_count,
        total_quantity: item.total_quantity ? parseFloat(item.total_quantity) : undefined,
        unit_price: item.unit_price ? parseFloat(item.unit_price) : undefined,
      }))
      form.setFieldsValue({
        ...order,
        delivery_date: order.delivery_date ? dayjs(order.delivery_date) : undefined,
      })
      setProductItems(items)
    } else {
      form.resetFields()
      form.setFieldsValue({ customer_id: customerId })
      setProductItems([{ product_name: '', quantity_per_unit: undefined, quantity_unit: 'kg', unit_count: undefined, total_quantity: undefined, unit_price: undefined, pricing_unit: 'kg' }])
    }
    setDrawerOpen(true)
  }, [form])

  const closeEditor = () => {
    setDrawerOpen(false)
    setEditing(undefined)
    form.resetFields()
    setProductItems([])
    if (searchParams.has('create') || searchParams.has('edit')) setSearchParams({})
  }

  // Handle URL params for create/edit
  useEffect(() => {
    if (drawerOpen || loading) return
    const editId = searchParams.get('edit')
    const shouldCreate = searchParams.get('create') === '1'
    if (editId) {
      const order = data.items.find((item) => item.id === editId)
      if (order) openEditor(order)
      else void api.order(type, editId).then((found) => openEditor(found))
    } else if (shouldCreate) {
      openEditor(undefined, searchParams.get('customerId') || undefined)
    }
  }, [data.items, drawerOpen, loading, searchParams, openEditor, type])

  // ── Product management ──
  const openProductModal = (index?: number) => {
    setEditingProductIndex(index ?? null)
    setProductInitialValues(index !== undefined && index !== null && productItems[index] ? productItems[index] : null)
    setProductModalOpen(true)
  }

  const confirmProduct = (item: Record<string, unknown>) => {
    const newItems = [...productItems]
    if (editingProductIndex !== null) {
      newItems[editingProductIndex] = item
    } else {
      newItems.push(item)
    }
    setProductItems(newItems)
    setProductModalOpen(false)
    setEditingProductIndex(null)
    setProductInitialValues(null)
  }

  const removeProduct = (index: number) => {
    const newItems = productItems.filter((_, i) => i !== index)
    setProductItems(newItems)
  }

  // ── Save order (always saves as draft) ──
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const values = await form.validateFields()
      const items = productItems.map((item) => ({
        ...item,
        quantity_per_unit: item.quantity_per_unit ? String(item.quantity_per_unit) : undefined,
        unit_count: item.unit_count ? Number(item.unit_count) : undefined,
        total_quantity: item.total_quantity ? String(item.total_quantity) : undefined,
        unit_price: item.unit_price ? String(item.unit_price) : undefined,
        source_template_id: undefined,
        source_sample_order_id: undefined,
      }))
      const payload = {
        ...values,
        delivery_date: values.delivery_date?.format?.('YYYY-MM-DD') ?? values.delivery_date,
        settlement_amount: values.settlement_amount ? String(values.settlement_amount) : undefined,
        items,
      }
      if (editing) await api.updateOrder(type, editing.id, payload)
      else await api.createOrder(type, payload)
      message.success('订单保存成功')
      closeEditor()
      await load()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Workflow actions ──
  const doAction = async (order: Order, action: 'advance' | 'resume' | 'suspend') => {
    if (busyOrderId) return
    if (action === 'suspend') {
      let reason = ''
      try {
        await modal.confirm({
          title: '中止此订单',
          content: <Input.TextArea placeholder="请输入中止原因" onChange={(e) => { reason = e.target.value }} />,
          okText: '确认中止',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: async () => {
            if (!reason.trim()) { message.error('请填写中止原因'); return Promise.reject() }
            setBusyOrderId(order.id)
            try {
              await api.orderAction(type, order.id, 'suspend', { reason })
              message.success('订单已中止')
              await load()
            } catch (e) {
              message.error((e as Error).message)
            } finally {
              setBusyOrderId(null)
            }
          },
        })
      } catch { /* cancelled */ }
      return
    }

    try {
      await modal.confirm({
        title: action === 'advance' ? '进入下一流程？' : '取消中止并恢复？',
        content: action === 'advance' ? '系统将按预设顺序推进到下一状态。' : '订单会恢复到中止前的流程状态。',
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          setBusyOrderId(order.id)
          try {
            await api.orderAction(type, order.id, action)
            message.success(action === 'advance' ? '流程推进成功' : '订单已恢复')
            await load()
          } catch (e) {
            message.error((e as Error).message)
          } finally {
            setBusyOrderId(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  const submitDraft = async (order: Order) => {
    if (busyOrderId) return
    try {
      await modal.confirm({
        title: `提交订单"${order.name}"？`,
        content: '提交后订单将进入第一个流程状态。',
        okText: '确认提交',
        cancelText: '取消',
        onOk: async () => {
          setBusyOrderId(order.id)
          try {
            await api.orderAction(type, order.id, 'submit')
            message.success('订单已提交')
            await load()
          } catch (e) {
            message.error((e as Error).message)
          } finally {
            setBusyOrderId(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  const handleDelete = async (order: Order) => {
    if (deleting) return
    try {
      await modal.confirm({
        title: `确定删除订单"${order.name}"？`,
        content: '删除后无法恢复，订单及其产品明细将从数据库中永久移除。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setDeleting(order.id)
          try {
            await api.deleteOrder(type, order.id)
            message.success('删除成功')
            await load()
          } catch (e) {
            message.error((e as Error).message)
            await load()
          } finally {
            setDeleting(null)
          }
        },
      })
    } catch { /* cancelled */ }
  }

  // ── Table columns ──
  const columns = [
    {
      title: '订单', width: 220,
      render: (_: unknown, o: Order) => <TableTitle primary={o.name} secondary={o.code} />,
    },
    { title: '所属客户', dataIndex: 'customer_name', width: 130 },
    {
      title: '产品', width: 140,
      render: (_: unknown, o: Order) => {
        const count = o.items.length
        return count > 0 ? <Tag>{count}个产品</Tag> : <span style={{ color: '#999' }}>无</span>
      },
    },
    { title: '交付时间', dataIndex: 'delivery_date', width: 110, render: (v?: string) => v || '无' },
    {
      title: '流程状态', width: 120,
      render: (_: unknown, o: Order) => <StatusTag value={o.workflow_status} suspended={o.is_suspended} />,
    },
    { title: '创建时间', dataIndex: 'created_at', width: 110, render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    {
      title: '操作', fixed: 'right' as const, width: 280,
      render: (_: unknown, o: Order) => (
        <Space size={4}>
          <Button size="small" onClick={() => setDetail(o)}>查看</Button>
          {!o.is_submitted && (
            <>
              <Button size="small" loading={busyOrderId === o.id} onClick={() => submitDraft(o)}>提交</Button>
              <Button size="small" danger loading={deleting === o.id} onClick={() => handleDelete(o)}>删除</Button>
            </>
          )}
          <Button size="small" onClick={() => openEditor(o)}>编辑</Button>
          {workflow && o.is_submitted && (
            <>
              {o.is_suspended ? (
                <Button size="small" loading={busyOrderId === o.id} onClick={() => doAction(o, 'resume')}>恢复</Button>
              ) : (
                flow.indexOf(o.workflow_status || '') < flow.length - 1 && (
                  <Button size="small" type="primary" loading={busyOrderId === o.id} onClick={() => doAction(o, 'advance')}>
                    {flow.indexOf(o.workflow_status || '') === flow.length - 2 ? '完成' : '下一流程'}
                  </Button>
                )
              )}
              {!o.is_suspended && (
                <Button size="small" danger loading={busyOrderId === o.id} onClick={() => doAction(o, 'suspend')}>中止</Button>
              )}
            </>
          )}
          {workflow && o.is_submitted && (
            <Button size="small" danger loading={deleting === o.id} onClick={() => handleDelete(o)}>删除</Button>
          )}
        </Space>
      ),
    },
  ]

  const title = type === 'sample' ? (workflow ? '样品订单流程' : '样品订单') : (workflow ? '正式订单流程' : '正式订单')
  const desc = workflow ? '按预设状态推进订单，异常订单独立中止并可恢复。' : '管理多产品订单草稿、提交和履约信息。'

  // Workflow tabs
  const workflowTabs = useMemo(() => {
    const items = [
      {
        key: '',
        label: `全部 ${Object.values(counts).reduce((s, v) => s + v, 0)}`,
      },
      ...flow.map((key) => ({
        key,
        label: `${FLOW_TEXT[key]} ${counts[key] ?? 0}`,
      })),
      {
        key: 'SUSPENDED',
        label: `已中止 ${counts.SUSPENDED ?? 0}`,
      },
    ]
    return items
  }, [flow, counts])

  return (
    <>
      <PageTitle
        title={title}
        description={desc}
        action={!workflow && <Button type="primary" onClick={() => openEditor()}>新建订单</Button>}
      />

      {/* Workflow tabs */}
      {workflow && (
        <div className="flow-tabs">
          {workflowTabs.map((tab) => (
            <Button
              key={tab.key}
              type={(status ?? '') === tab.key ? 'primary' : 'default'}
              onClick={() => { setStatus(tab.key || undefined); setPage(1) }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      )}

      <MetricStrip
        items={[
          { label: '当前结果', value: data.total, hint: '张订单' },
          { label: '草稿', value: data.items.filter((x) => !x.is_submitted).length },
          { label: '进行中', value: data.items.filter((x) => x.is_submitted && !x.is_suspended).length },
          { label: '已中止', value: data.items.filter((x) => x.is_suspended).length },
        ]}
      />

      <section className="workspace-panel">
        <div className="filter-bar">
          <Input.Search
            placeholder="订单编号、名称或产品"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => setPage(1)}
            style={{ width: 320 }}
          />
          <Button onClick={() => { setKeyword(''); setStatus(undefined); setPage(1) }}>重置</Button>
        </div>
        {error ? <ErrorBlock message={error} retry={load} /> : (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data.items}
            columns={columns}
            scroll={{ x: 1100 }}
            pagination={{ current: page, pageSize: 10, total: data.total, showTotal: (v) => `共 ${v} 条`, onChange: setPage }}
          />
        )}
      </section>

      {/* ── Order Editor Drawer ── */}
      <Drawer
        title={editing ? `编辑${type === 'sample' ? '样品' : '正式'}订单` : `新建${type === 'sample' ? '样品' : '正式'}订单`}
        open={drawerOpen}
        onClose={closeEditor}
        width={800}
        extra={
          <Space>
            <Button onClick={closeEditor} disabled={saving}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void save()}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" size="small">
          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>订单基本信息</Divider>
          <div className="field-grid">
            <Form.Item label="订单名称" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="所属客户" name="customer_id">
              <Select showSearch optionFilterProp="label" options={customers.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>交付信息</Divider>
          <div className="field-grid">
            <Form.Item label="交付时间" name="delivery_date">
              <DatePicker className="full-width" />
            </Form.Item>
            <Form.Item label="交货地址" name="delivery_address"><Input /></Form.Item>
            <Form.Item label="配送时效" name="delivery_lead_time"><Input /></Form.Item>
            <Form.Item label="配送周期" name="delivery_cycle"><Input /></Form.Item>
          </div>

          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>结账信息</Divider>
          <div className="field-grid">
            <Form.Item label="结账账期" name="settlement_period"><Input /></Form.Item>
            <Form.Item label="结账方式" name="settlement_method"><Input /></Form.Item>
            <Form.Item label="结账金额（自动计算）" name="settlement_amount">
              <InputNumber min={0} precision={2} className="full-width" />
            </Form.Item>
          </div>

          {/* ── Product List ─ */}
          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
            产品明细
            <Button type="link" size="small" onClick={() => openProductModal()} style={{ marginLeft: 8 }}>添加产品</Button>
          </Divider>

          {productItems.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#999', border: '1px dashed #dce3ea', borderRadius: 8 }}>
              暂无产品，点击"添加产品"开始
            </div>
          ) : (
            <div style={{ border: '1px solid #dce3ea', borderRadius: 8, overflow: 'hidden' }}>
              {productItems.map((item, index) => (
                <div key={index} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                  gap: 8,
                  padding: '10px 12px',
                  alignItems: 'center',
                  borderBottom: index < productItems.length - 1 ? '1px solid #e8edf2' : 'none',
                  background: index % 2 === 0 ? '#fff' : '#fafbfc',
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{(item.product_name as string) || '未命名'}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{item.product_category || ''} {item.processing_method || ''}</div>
                  </div>
                  <div style={{ fontSize: 13 }}>{item.supplier_id ? suppliers.find((s) => s.id === item.supplier_id)?.name || '供应商' : '本公司'}</div>
                  <div style={{ fontSize: 13 }}>{item.quantity_per_unit ? `${item.quantity_per_unit} ${item.quantity_unit || ''}` : '-'}</div>
                  <div style={{ fontSize: 13 }}>×{item.unit_count ?? 0}</div>
                  <div style={{ fontSize: 13 }}>{item.unit_price ? `¥${item.unit_price}` : '-'}</div>
                  <Space size={4}>
                    <Button size="small" onClick={() => openProductModal(index)}>编辑</Button>
                    <Button size="small" danger onClick={() => removeProduct(index)}>移除</Button>
                  </Space>
                </div>
              ))}
            </div>
          )}

          <Form.Item label="订单备注" name="notes" style={{ marginTop: 16 }}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Product Edit Modal ── */}
      <ProductEditModal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setEditingProductIndex(null); setProductInitialValues(null) }}
        onConfirm={confirmProduct}
        suppliers={suppliers}
        templates={templates.filter((t) => !editing || t.customer_id === form.getFieldValue('customer_id'))}
        initialValues={productInitialValues}
      />

      {/* ── Order Detail Drawer ── */}
      <Drawer
        title={detail?.name}
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        width={800}
        extra={
          detail ? (
            <Button onClick={() => { setDetail(undefined); openEditor(detail) }}>编辑</Button>
          ) : undefined
        }
      >
        {detail && (
          <>
            <div className="detail-header">
              <Space>
                <StatusTag value={detail.workflow_status} suspended={detail.is_suspended} />
                <span className="code-text">{detail.code}</span>
              </Space>
              <strong>{detail.customer_name || '未选择客户'}</strong>
            </div>
            {detail.is_submitted && (
              <Steps
                current={Math.max(0, flow.indexOf(detail.workflow_status || ''))}
                items={flow.map((key) => ({ title: FLOW_TEXT[key] }))}
                size="small"
                className="order-steps"
              />
            )}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
              { key: 'deliveryDate', label: '交付时间', children: text(detail.delivery_date) },
              { key: 'address', label: '交货地址', children: text(detail.delivery_address) },
              { key: 'lead', label: '配送时效', children: text(detail.delivery_lead_time) },
              { key: 'cycle', label: '配送周期', children: text(detail.delivery_cycle) },
              { key: 'period', label: '结账账期', children: text(detail.settlement_period) },
              { key: 'method', label: '结账方式', children: text(detail.settlement_method) },
              { key: 'amount', label: '结账金额', children: text(detail.settlement_amount) },
              ...(detail.is_suspended && detail.suspended_reason ? [
                { key: 'suspendedReason', label: '中止原因', span: 2, children: <div style={{ color: '#9B3A3A', padding: '4px 8px', background: '#FFF2F0', borderRadius: 4 }}>{detail.suspended_reason}</div> }
              ] : []),
              { key: 'notes', label: '订单备注', children: text(detail.notes) },
            ]} />
            <OrderProductDetails items={detail.items} />
          </>
        )}
      </Drawer>
    </>
  )
}
