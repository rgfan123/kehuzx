import { useCallback, useEffect, useState } from 'react'
import { Card, Tag, Timeline, Typography } from 'antd'
import { ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { DashboardData } from '../types'
import { SAMPLE_FLOW_TEXT, FORMAL_FLOW_TEXT, ACTION_TEXT, ENTITY_TEXT } from '../types'
import { ErrorBlock, MetricStrip, PageTitle } from '../components/Common'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.dashboard())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <>
        <PageTitle title="工作台" description="" />
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>正在加载数据…</div>
      </>
    )
  }
  if (error) return <ErrorBlock message={error} retry={load} />
  if (!data) return null

  const { metrics, workflow_summary, suspended_orders, draft_orders, recent_logs } = data

  return (
    <>
      <PageTitle title="工作台" description="" />

      {/* ── Metrics ─ */}
      <MetricStrip
        items={[
          { label: '客户总数', value: metrics.customers, hint: '位' },
          { label: '进行中订单', value: metrics.in_progress, hint: '张' },
          { label: '已中止', value: metrics.suspended, hint: '张' },
          { label: '草稿', value: metrics.drafts, hint: '张' },
          { label: '本月交付', value: `¥${Number(metrics.monthly_amount).toFixed(2)}` },
        ]}
      />

      {/* ── Todo Sections ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>

        {/* Workflow progress */}
        <Card title="流程进度" size="small" styles={{ body: { padding: '8px 0' } }}>
          {workflow_summary.map((w) => {
            const total = w.sample_count + w.formal_count
            if (total === 0) return null
            const clickSample = () => navigate(`/samples/workflow?status=${w.key}`)
            const clickFormal = () => navigate(`/orders/workflow?status=${w.key}`)
            return (
              <div
                key={w.key}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 16px', cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <span>{w.label}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  {w.sample_count > 0 && (
                    <Tag color="blue" style={{ cursor: 'pointer', margin: 0 }} onClick={clickSample}>
                      样品 {w.sample_count}
                    </Tag>
                  )}
                  {w.formal_count > 0 && (
                    <Tag color="green" style={{ cursor: 'pointer', margin: 0 }} onClick={clickFormal}>
                      正式 {w.formal_count}
                    </Tag>
                  )}
                </span>
              </div>
            )
          })}
          {workflow_summary.every((w) => w.sample_count + w.formal_count === 0) && (
            <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>暂无进行中的订单</div>
          )}
        </Card>

        {/* Suspended orders */}
        <Card
          title={<><ExclamationCircleOutlined style={{ color: '#cf1322', marginRight: 6 }} />已中止订单</>}
          size="small"
          styles={{ body: { padding: '8px 0' } }}
        >
          {suspended_orders.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>无已中止订单</div>
          ) : (
            suspended_orders.map((o) => (
              <div
                key={o.id}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  background: '#FFF2F0',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(o.type === 'sample' ? `/samples/orders?edit=${o.id}` : `/orders?edit=${o.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Typography.Text strong>{o.name}</Typography.Text>
                  <Tag color="red">{o.type === 'sample' ? '样品' : '正式'}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#9B3A3A' }}>
                  {o.reason || '未填写中止原因'}
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Draft orders */}
        <Card
          title={<><FileTextOutlined style={{ marginRight: 6 }} />草稿订单</>}
          size="small"
          styles={{ body: { padding: '8px 0' } }}
        >
          {draft_orders.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>无草稿订单</div>
          ) : (
            draft_orders.map((o) => (
              <div
                key={o.id}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(o.type === 'sample' ? `/samples/orders?edit=${o.id}` : `/orders?edit=${o.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Typography.Text strong>{o.name}</Typography.Text>
                  <Tag>{o.type === 'sample' ? '样品' : '正式'}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{o.code}</div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* ── Recent Activity ── */}
      <Card title="最近动态" size="small" style={{ marginTop: 16 }} styles={{ body: { padding: '16px 24px' } }}>
        {recent_logs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无操作记录</div>
        ) : (
          <Timeline
            items={recent_logs.map((log) => ({
              color: 'blue',
              children: (
                <div>
                  <Typography.Text strong>{log.operator}</Typography.Text>
                  {' '}
                  <span>{ACTION_TEXT[log.action] || log.action}</span>
                  {' '}
                  <span>{ENTITY_TEXT[log.entity_type] || log.entity_type}</span>
                  {log.entity_name && <Typography.Text strong>「{log.entity_name}」</Typography.Text>}
                  {log.record_code && <span style={{ color: '#999', marginLeft: 8 }}>({log.record_code})</span>}
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </>
  )
}
