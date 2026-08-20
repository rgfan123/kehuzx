import { useCallback, useEffect, useState } from 'react'
import { Input, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { api } from '../api'
import type { OperationLog } from '../types'
import { ACTION_TEXT, ENTITY_TEXT } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle } from '../components/Common'

export default function LogsPage() {
  const [data, setData] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [entityType, setEntityType] = useState<string | undefined>(undefined)
  const [action, setAction] = useState<string | undefined>(undefined)
  const [operator, setOperator] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.logs({ page, pageSize, keyword, entity_type: entityType, action, operator })
      setData(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, entityType, action, operator])

  useEffect(() => { load() }, [load])

  const renderChangeDetail = (detail?: string) => {
    if (!detail) return '-'
    try {
      const parsed = JSON.parse(detail)
      const before = parsed.before || {}
      const after = parsed.after || {}
      const keys = new Set([...Object.keys(before), ...Object.keys(after)])
      const parts: string[] = []
      keys.forEach((key) => {
        const oldVal = before[key]
        const newVal = after[key]
        if (oldVal !== newVal && newVal != null) {
          parts.push(`${key}: ${oldVal ?? '-'} → ${newVal}`)
        }
      })
      return parts.length > 0 ? parts.join('; ') : '-'
    } catch {
      return detail
    }
  }

  const columns: ColumnsType<OperationLog> = [
    {
      title: '时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作人', dataIndex: 'operator', width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '类型', dataIndex: 'entity_type', width: 80,
      render: (v: string) => ENTITY_TEXT[v] || v,
    },
    {
      title: '名称', dataIndex: 'entity_name', width: 160, ellipsis: true,
    },
    {
      title: '编号', dataIndex: 'record_code', width: 140,
      render: (v?: string) => v || '-',
    },
    {
      title: '操作', dataIndex: 'action', width: 80,
      render: (v: string) => <Tag>{ACTION_TEXT[v] || v}</Tag>,
    },
    {
      title: '变更详情', dataIndex: 'change_detail', ellipsis: true,
      render: renderChangeDetail,
    },
  ]

  if (error) return <ErrorBlock message={error} retry={load} />
  if (loading && !data.length) return <LoadingBlock />

  return <>
    <PageTitle title="操作日志" description="系统所有操作记录，按时间倒序" />
    <div className="filter-bar">
      <Input.Search placeholder="搜索名称或编号" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
        onSearch={() => setPage(1)} style={{ width: 280 }} allowClear />
      <Select placeholder="类型" value={entityType} onChange={(v) => { setEntityType(v); setPage(1) }}
        allowClear style={{ width: 140 }} options={Object.entries(ENTITY_TEXT).map(([k, v]) => ({ label: v, value: k }))} />
      <Select placeholder="操作" value={action} onChange={(v) => { setAction(v); setPage(1) }}
        allowClear style={{ width: 140 }} options={Object.entries(ACTION_TEXT).map(([k, v]) => ({ label: v, value: k }))} />
      <Input placeholder="操作人" value={operator} onChange={(e) => { setOperator(e.target.value); setPage(1) }}
        onPressEnter={() => setPage(1)} style={{ width: 160 }} allowClear />
    </div>
    <div className="workspace-panel">
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        onChange={(p) => { setPage(p.current!); setPageSize(p.pageSize!) }} size="middle" />
    </div>
  </>
}
