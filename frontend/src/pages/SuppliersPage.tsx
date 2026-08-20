import { useCallback, useEffect, useState } from 'react'
import { App, Button, Drawer, Form, Input, message, Modal, Space, Table } from 'antd'
import { api } from '../api'
import type { Page, Supplier } from '../types'
import { ErrorBlock, PageTitle, StatusTag, TableTitle } from '../components/Common'

const blankPage: Page<Supplier> = { items: [], page: 1, pageSize: 10, total: 0 }

export default function SuppliersPage() {
  const { modal } = App.useApp()
  const [data, setData] = useState(blankPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | undefined>()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.suppliers({ keyword, page, pageSize: 10 }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [keyword, page])

  useEffect(() => { void load() }, [load])

  const open = (supplier?: Supplier) => {
    setEditing(supplier)
    form.setFieldsValue(supplier ?? { status: '合作中' })
    setDrawerOpen(true)
  }

  const closeForm = () => {
    setDrawerOpen(false)
    setEditing(undefined)
    form.resetFields()
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const values = await form.validateFields()
      if (editing) await api.updateSupplier(editing.id, values)
      else await api.createSupplier(values)
      message.success(editing ? '供应商更新成功' : '供应商添加成功')
      closeForm()
      await load()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (supplier: Supplier) => {
    if (deleting) return
    try {
      await modal.confirm({
        title: `确定删除供应商"${supplier.name}"？`,
        content: '删除后无法恢复；历史订单中的供应商字段将改为本公司供应。',
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          setDeleting(supplier.id)
          try {
            await api.deleteSupplier(supplier.id)
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

  const columns = [
    {
      title: '供应商', width: 220,
      render: (_: unknown, s: Supplier) => <TableTitle primary={s.name} secondary={s.code} />,
    },
    { title: '联系人', dataIndex: 'contact_name', render: (v?: string) => v || '无' },
    { title: '联系电话', dataIndex: 'phone', render: (v?: string) => v || '无' },
    { title: '地址', dataIndex: 'address', render: (v?: string) => v || '无' },
    { title: '状态', dataIndex: 'status', render: (v?: string) => <StatusTag value={v} /> },
    { title: '创建时间', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    {
      title: '操作', fixed: 'right' as const, width: 140,
      render: (_: unknown, s: Supplier) => (
        <Space size={4}>
          <Button size="small" onClick={() => open(s)}>编辑</Button>
          <Button size="small" danger loading={deleting === s.id} onClick={() => handleDelete(s)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <PageTitle
        title="供应商档案"
        description="维护外部供应商信息；订单产品未选择供应商时默认为本公司供应。"
        action={<Button type="primary" onClick={() => open()}>新增供应商</Button>}
      />
      <section className="workspace-panel">
        <div className="filter-bar">
          <Input.Search
            placeholder="供应商名称、编号、联系人或电话"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => setPage(1)}
            style={{ width: 320 }}
          />
          <Button onClick={() => { setKeyword(''); setPage(1) }}>重置</Button>
        </div>
        {error ? <ErrorBlock message={error} retry={load} /> : (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={data.items}
            columns={columns}
            scroll={{ x: 850 }}
            pagination={{ current: page, pageSize: 10, total: data.total, onChange: setPage, showTotal: (v) => `共 ${v} 条` }}
          />
        )}
      </section>

      <Drawer
        title={editing ? '编辑供应商' : '新增供应商'}
        open={drawerOpen}
        onClose={closeForm}
        width={520}
        extra={
          <Space>
            <Button onClick={closeForm} disabled={saving}>取消</Button>
            <Button type="primary" loading={saving} onClick={save}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item label="供应商名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="联系人" name="contact_name"><Input /></Form.Item>
          <Form.Item label="联系电话" name="phone"><Input /></Form.Item>
          <Form.Item label="地址" name="address"><Input /></Form.Item>
          <Form.Item label="供应商状态" name="status"><Input placeholder="合作中、暂停等" /></Form.Item>
          <Form.Item label="备注" name="notes"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
