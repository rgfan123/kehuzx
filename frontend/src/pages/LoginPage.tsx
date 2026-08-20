import { useState } from 'react'
import { Button, Card, Form, Input, Layout, message, Typography } from 'antd'
import { UserOutlined, LockOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api'

const { Content } = Layout

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await api.login(values.username, values.password)
      setToken(result.token, result.user)
      message.success(`欢迎回来，${result.user.display_name}`)
      navigate('/customers', { replace: true })
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#F3F6FA' }}>
      <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <ApartmentOutlined style={{ fontSize: 40, color: '#4676A9', marginBottom: 12 }} />
            <Typography.Title level={3} style={{ margin: 0 }}>客户订单中心</Typography.Title>
            <Typography.Text type="secondary">请登录以继续</Typography.Text>
          </div>
          <Form onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>登 录</Button>
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              默认账号：admin / admin123
            </Typography.Text>
          </div>
        </Card>
      </Content>
    </Layout>
  )
}
