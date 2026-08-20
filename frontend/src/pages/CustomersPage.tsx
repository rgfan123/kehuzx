import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Col, Drawer, Form, Input, message, Modal, Row, Select, Space, Table, Tag } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Customer, Page } from '../types'
import { ErrorBlock, MetricStrip, PageTitle, StatusTag, TableTitle } from '../components/Common'

const blankPage: Page<Customer> = { items: [], page: 1, pageSize: 10, total: 0 }

export default function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { modal } = App.useApp()
  const [data, setData] = useState(blankPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | undefined>()
  const [form] = Form.useForm()
  const reqRef = useRef(0)

  const keyword = searchParams.get('keyword') ?? ''
  const statusFilter = searchParams.get('status') ?? undefined
  const page = Number(searchParams.get('page') ?? 1)

  const load = useCallback(async () => {
    const v = ++reqRef.current
    setLoading(true)
    setError('')
    try {
      const result = await api.customers({ keyword, status: statusFilter, page, pageSize: 10 })
      if (v === reqRef.current) setData(result)
    } catch (e) {
      if (v === reqRef.current) setError((e as Error).message)
    } finally {
      if (v === reqRef.current) setLoading(false)
    }
  }, [keyword, statusFilter, page])

  useEffect(() => { void load() }, [load])

  const openForm = (customer?: Customer) => {
    setEditing(customer)
    form.setFieldsValue(customer ?? { status: '潜在' })
    setDrawerOpen(true)
  }

  const closeForm = () => {
    setDrawerOpen(false)
    setEditing(undefined)
    form.resetFields()
  }

  const submit = async () => {
    if (saving) return
    setSaving(true)
    try {
      const values = await form.validateFields()
      await api.saveCustomer(values, editing?.id)
      message.success(editing ? '客户更新成功' : '客户添加成功')
      closeForm()
      await load()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (customer: Customer) => {
    if (deleting) return
    try {
      await modal.confirm({
        title: `确定删除客户"${customer.name}"？`,
        content: '删除后无法恢复，该客户名下的需求、模板、订单也会永久删除。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setDeleting(customer.id)
          try {
            await api.deleteCustomer(customer.id)
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
      // Modal cancelled
    }
  }

  const totals = data.items.reduce(
    (acc, item) => ({
      demand: acc.demand + item.demand_count,
      sample: acc.sample + item.sample_order_count,
      formal: acc.formal + item.formal_order_count,
    }),
    { demand: 0, sample: 0, formal: 0 }
  )

  const columns = [
    {
      title: '客户', width: 200,
      render: (_: unknown, c: Customer) => (
        <TableTitle
          primary={<Button type="link" className="inline-link" onClick={() => navigate(`/customers/${c.id}`)}>{c.name}</Button>}
          secondary={c.code}
        />
      ),
    },
    {
      title: '企业信息', width: 180,
      render: (_: unknown, c: Customer) => (
        <TableTitle primary={c.company_name || '无'} secondary={c.category || '未分类'} />
      ),
    },
    {
      title: '联系人', width: 150,
      render: (_: unknown, c: Customer) => (
        <TableTitle primary={c.contact_name || '无'} secondary={c.phone || '无联系电话'} />
      ),
    },
    { title: '微信号', dataIndex: 'wechat', width: 110, render: (v?: string) => v || '无' },
    { title: '状态', dataIndex: 'status', width: 80, render: (v?: string) => <StatusTag value={v} /> },
    {
      title: '业务关联', width: 200,
      render: (_: unknown, c: Customer) => (
        <Space wrap>
          <Tag>需求 {c.demand_count}</Tag>
          <Tag>样品单 {c.sample_order_count}</Tag>
          <Tag>正式单 {c.formal_order_count}</Tag>
        </Space>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', width: 110, render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    {
      title: '操作', fixed: 'right' as const, width: 140,
      render: (_: unknown, c: Customer) => (
        <Space size={4}>
          <Button size="small" onClick={() => navigate(`/customers/${c.id}`)}>查看</Button>
          <Button size="small" onClick={() => openForm(c)}>编辑</Button>
          <Button size="small" danger loading={deleting === c.id} onClick={() => handleDelete(c)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageTitle
        title="客户档案"
        description="维护客户资料，并快速进入需求、样品与订单上下文。"
        action={<Button type="primary" onClick={() => openForm()}>新增客户</Button>}
      />
      <MetricStrip
        items={[
          { label: '当前结果', value: data.total, hint: '位客户' },
          { label: '关联需求', value: totals.demand },
          { label: '样品订单', value: totals.sample },
          { label: '正式订单', value: totals.formal },
        ]}
      />
      <section className="workspace-panel">
        <div className="filter-bar">
          <Input.Search
            allowClear
            defaultValue={keyword}
            placeholder="客户名称、编号、公司、联系人或电话"
            onSearch={(value) => setSearchParams(value ? { keyword: value } : {})}
            style={{ width: 320 }}
          />
          <Select
            allowClear
            placeholder="客户状态"
            value={statusFilter}
            onChange={(v) => setSearchParams((prev) => { const p = new URLSearchParams(prev); v ? p.set('status', v) : p.delete('status'); p.set('page', '1'); return p })}
            options={[{ value: '潜在' }, { value: '合作中' }, { value: '暂停' }]}
            style={{ width: 140 }}
          />
          <Button onClick={() => setSearchParams({})}>重置</Button>
        </div>
        {error ? <ErrorBlock message={error} retry={load} /> : (
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={data.items}
            scroll={{ x: 1100 }}
            pagination={{
              current: data.page,
              pageSize: 10,
              total: data.total,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (next) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('page', String(next)); return p }),
            }}
          />
        )}
      </section>

      <Drawer
        title={editing ? '编辑客户' : '新增客户'}
        open={drawerOpen}
        onClose={closeForm}
        width={600}
        extra={
          <Space>
            <Button onClick={closeForm} disabled={saving}>取消</Button>
            <Button type="primary" loading={saving} onClick={submit}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="客户名称" name="name" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="客户状态" name="status">
                <Select options={[{ value: '潜在' }, { value: '合作中' }, { value: '暂停' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="客户分类" name="category"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="公司名称" name="company_name"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系人" name="contact_name"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系电话" name="phone"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="微信号" name="wechat"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="行业" name="industry"><Input /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="地址" name="address"><Input /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="客户备注" name="notes"><Input.TextArea rows={3} /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  )
}
