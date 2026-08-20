import { ReactNode } from 'react'
import { Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

export function PageTitle({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><Typography.Title level={2}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text></div>{action}</div>
}

export function LoadingBlock() { return <div className="state-block"><Spin /><span>正在加载业务数据</span></div> }
export function EmptyBlock({ title = '暂无数据', action }: { title?: string; action?: ReactNode }) { return <Empty description={title}>{action}</Empty> }
export function ErrorBlock({ message, retry }: { message: string; retry: () => void }) { return <Result status="error" title="数据加载失败" subTitle={message} extra={<Button icon={<ReloadOutlined />} onClick={retry}>重新加载</Button>} /> }

const statusMap: Record<string, [string, string]> = {
  UNSUPPLIED: ['未供应', 'orange'],
  SUPPLIED: ['已供应', 'green'],
  SAMPLE_COMMUNICATION: ['样品沟通', 'blue'],
  FACTORY_COMMUNICATION: ['工厂沟通', 'geekblue'],
  SAMPLE_PRODUCING: ['样品制作中', 'gold'],
  SAMPLE_COMPLETED: ['样品制作完成', 'cyan'],
  SAMPLE_DELIVERY: ['顾客送样', 'purple'],
  PRODUCT_CONFIRMED: ['成品确定', 'green'],
  ORDER_COMMUNICATION: ['订单沟通', 'blue'],
  ORDER_PRODUCING: ['订单制作中', 'gold'],
  ORDER_COMPLETED: ['订单制作完成', 'cyan'],
  DELIVERED_TO_CUSTOMER: ['送达顾客', 'green'],
  合作中: ['合作中', 'green'], 潜在: ['潜在', 'blue'], 暂停: ['暂停', 'orange'],
}

export const statusLabel = (value?: string) => value ? statusMap[value]?.[0] ?? value : '未供应'

export function StatusTag({ value, suspended }: { value?: string; suspended?: boolean }) {
  if (suspended) return <Tag color="red">已中止</Tag>
  const config = statusMap[value ?? 'UNSUPPLIED'] ?? [value ?? '未供应', 'default']
  return <Tag color={config[1]}>{config[0]}</Tag>
}

export function MetricStrip({ items }: { items: { label: string; value: ReactNode; hint?: string }[] }) {
  return <div className="metric-strip">{items.map((item) => <div className="metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.hint && <small>{item.hint}</small>}</div>)}</div>
}

export function TableTitle({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return <Space direction="vertical" size={1}><Typography.Text strong>{primary}</Typography.Text>{secondary && <Typography.Text type="secondary" className="code-text">{secondary}</Typography.Text>}</Space>
}
