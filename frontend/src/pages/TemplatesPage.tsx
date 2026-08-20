import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Descriptions, Divider, Drawer, Form, Input, InputNumber, message, Modal, Select, Space, Table } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Customer, Page, Template } from '../types'
import { ErrorBlock, MetricStrip, PageTitle, StatusTag, TableTitle } from '../components/Common'
import { ProductDetails, ProductFieldsForm } from '../components/BusinessFields'

const blankPage: Page<Template> = { items: [], page: 1, pageSize: 10, total: 0 }

export default function TemplatesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { modal } = App.useApp()
  const [data, setData] = useState(blankPage)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>()
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Template | undefined>()
  const [viewing, setViewing] = useState<Template | undefined>()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form] = Form.useForm()
  const reqRef = useRef(0)

  const load = useCallback(async () => {
    const v = ++reqRef.current
    setLoading(true)
    setError('')
    try {
      const [templates, clients] = await Promise.all([
        api.templates({ keyword, status, page, pageSize: 10 }),
        api.customers({ page: 1, pageSize: 100 }),
      ])
      if (v !== reqRef.current) return
      setData(templates)
      setCustomers(clients.items)
    } catch (e) {
      if (v === reqRef.current) setError((e as Error).message)
    } finally {
      if (v === reqRef.current) setLoading(false)
    }
  }, [keyword, status, page])

  useEffect(() => { void load() }, [load])

  const closeEditor = () => {
    setDrawerOpen(false)
    setEditing(undefined)
    form.resetFields()
    if (searchParams.has('create') || searchParams.has('edit')) setSearchParams({})
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const values = await form.validateFields()
      if (editing) await api.updateTemplate(editing.id, values)
      else await api.createTemplate(values)
      message.success(editing ? '模板更新成功' : '模板添加成功')
      closeEditor()
      await load()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const open = useCallback((template?: Template, customerId?: string) => {
    setEditing(template)
    form.setFieldsValue(template ?? {
      customer_id: customerId,
      status: 'UNSUPPLIED',
      length_unit: 'cm',
      width_unit: 'cm',
      thickness_unit: 'mm',
      price_currency: '元',
    })
    setDrawerOpen(true)
  }, [form])

  useEffect(() => {
    if (drawerOpen || loading) return
    const editId = searchParams.get('edit')
    const customerId = searchParams.get('customerId') || undefined
    if (editId) {
      setSearchParams({})
      void api.template(editId).then((t) => open(t))
    } else if (searchParams.get('create') === '1') {
      setSearchParams({})
      open(undefined, customerId)
    }
  }, [drawerOpen, loading, searchParams, open, setSearchParams])

  const handleDelete = async (template: Template) => {
    if (deleting) return
    try {
      await modal.confirm({
        title: `确定删除模板"${template.name}"？`,
        content: '删除后无法恢复；已经粘贴到订单中的产品快照不会受到影响。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setDeleting(template.id)
          try {
            await api.deleteTemplate(template.id)
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
    } catch {
      // cancelled
    }
  }

  const handleStatusChange = async (template: Template, newStatus: string) => {
    try {
      await api.updateTemplateStatus(template.id, newStatus)
      message.success(`状态已更新为${newStatus === 'SUPPLIED' ? '已供应' : '未供应'}`)
      await load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const copyTemplate = (template: Template) => {
    sessionStorage.setItem('copied-sample-template', JSON.stringify(template))
    message.success(`模板"${template.name}"已复制到剪贴板`)
  }

  const columns = [
    {
      title: '模板', width: 220,
      render: (_: unknown, t: Template) => <TableTitle primary={t.name} secondary={t.code} />,
    },
    { title: '所属客户', dataIndex: 'customer_name', width: 140 },
    {
      title: '产品', width: 180,
      render: (_: unknown, t: Template) => (
        <TableTitle
          primary={t.product_name || '无'}
          secondary={[t.product_category, t.processing_method].filter(Boolean).join(' · ') || '未填写规格'}
        />
      ),
    },
    {
      title: '单价', width: 110,
      render: (_: unknown, t: Template) => t.unit_price ? `¥${t.unit_price}/${t.pricing_unit || '份'}` : '无',
    },
    { title: '状态', width: 100, render: (_: unknown, t: Template) => <StatusTag value={t.status} /> },
    { title: '创建时间', dataIndex: 'created_at', width: 110, render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    {
      title: '操作', fixed: 'right' as const, width: 260,
      render: (_: unknown, t: Template) => (
        <Space size={4}>
          <Button size="small" onClick={() => setViewing(t)}>查看</Button>
          <Button size="small" onClick={() => copyTemplate(t)}>复制</Button>
          <Select
            size="small"
            value={t.status}
            style={{ width: 100 }}
            onChange={(v) => handleStatusChange(t, v)}
            options={[{ value: 'UNSUPPLIED', label: '未供应' }, { value: 'SUPPLIED', label: '已供应' }]}
          />
          <Button size="small" onClick={() => open(t)}>编辑</Button>
          <Button size="small" danger loading={deleting === t.id} onClick={() => handleDelete(t)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageTitle
        title="样品模板"
        description="一个模板对应一个产品；加入订单后保存独立快照。"
        action={<Button type="primary" onClick={() => open()}>新建模板</Button>}
      />
      <MetricStrip
        items={[
          { label: '模板总数', value: data.total },
          { label: '未供应', value: data.items.filter((x) => x.status === 'UNSUPPLIED').length },
          { label: '已供应', value: data.items.filter((x) => x.status === 'SUPPLIED').length },
        ]}
      />
      <section className="workspace-panel">
        <div className="filter-bar">
          <Input.Search
            placeholder="模板编号、名称或产品"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => setPage(1)}
            style={{ width: 320 }}
          />
          <Select
            allowClear
            placeholder="模板状态"
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={[{ value: 'UNSUPPLIED', label: '未供应' }, { value: 'SUPPLIED', label: '已供应' }]}
            style={{ width: 140 }}
          />
          <Button onClick={() => { setKeyword(''); setStatus(undefined); setPage(1) }}>重置</Button>
        </div>
        {error ? <ErrorBlock message={error} retry={load} /> : (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data.items}
            columns={columns}
            scroll={{ x: 1050 }}
            pagination={{ current: page, pageSize: 10, total: data.total, onChange: setPage, showTotal: (v) => `共 ${v} 条` }}
          />
        )}
      </section>

      <Drawer
        title={editing ? '编辑样品模板' : '新建样品模板'}
        open={drawerOpen}
        onClose={closeEditor}
        width={800}
        extra={
          <Space>
            <Button onClick={closeEditor} disabled={saving}>取消</Button>
            <Button type="primary" loading={saving} onClick={save}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ status: 'UNSUPPLIED', length_unit: 'cm', width_unit: 'cm', thickness_unit: 'mm', price_currency: '元' }}>
          <div className="field-grid">
            <Form.Item label="模板名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label="所属客户" name="customer_id" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={customers.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
            <Form.Item label="模板状态" name="status" rules={[{ required: true }]}>
              <Select options={[{ value: 'UNSUPPLIED', label: '未供应' }, { value: 'SUPPLIED', label: '已供应' }]} />
            </Form.Item>
          </div>
          <ProductFieldsForm />
          <Form.Item label="模板备注" name="notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Drawer>

      <Drawer title={viewing?.name} open={Boolean(viewing)} onClose={() => setViewing(undefined)} width={820}>
        {viewing && (
          <>
            <Descriptions size="small" items={[
              { key: 'code', label: '模板编号', children: viewing.code },
              { key: 'customer', label: '所属客户', children: viewing.customer_name || '无' },
              { key: 'status', label: '模板状态', children: <StatusTag value={viewing.status} /> },
              { key: 'notes', label: '模板备注', children: viewing.notes || '无' },
            ]} />
            <Divider />
            <ProductDetails value={viewing} />
          </>
        )}
      </Drawer>
    </>
  )
}
