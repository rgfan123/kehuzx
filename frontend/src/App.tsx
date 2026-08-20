import { useEffect, useMemo, useState } from 'react'
import { Avatar, Breadcrumb, Button, Drawer, Grid, Layout, Menu, Space, Tooltip, Typography } from 'antd'
import {
  ApartmentOutlined, FileDoneOutlined, FileSearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ProfileOutlined, ShopOutlined, TeamOutlined, UserOutlined, LogoutOutlined,
} from '@ant-design/icons'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { clearAuth, getUser, isLoggedIn } from './api'
import type { User } from './types'
import LoginPage from './pages/LoginPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import TemplatesPage from './pages/TemplatesPage'
import SuppliersPage from './pages/SuppliersPage'
import OrdersPage from './pages/OrdersPage'
import LogsPage from './pages/LogsPage'

const { Header, Sider, Content } = Layout

const routeTitles: Record<string, string> = {
  '/customers': '客户档案', '/samples/templates': '样品模板', '/samples/orders': '样品订单',
  '/samples/workflow': '样品订单流程', '/orders': '正式订单', '/orders/workflow': '正式订单流程',
  '/suppliers': '供应商档案', '/logs': '操作日志',
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const mobile = !screens.md
  const [user, setUser] = useState<User | null>(getUser)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav-collapsed') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { localStorage.setItem('nav-collapsed', collapsed ? '1' : '0') }, [collapsed])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleLogout = () => {
    clearAuth()
    setUser(null)
    navigate('/login', { replace: true })
  }

  const selectedKey = useMemo(() => {
    const keys = Object.keys(routeTitles).sort((a, b) => b.length - a.length)
    return keys.find((key) => location.pathname.startsWith(key)) ?? '/customers'
  }, [location.pathname])
  const title = location.pathname.startsWith('/customers/') ? '客户详情' : routeTitles[selectedKey]

  const items = [
    { key: '/customers', icon: <TeamOutlined />, label: '客户' },
    { key: 'samples', icon: <ProfileOutlined />, label: '样品', children: [
      { key: '/samples/templates', label: '样品模板' }, { key: '/samples/orders', label: '样品订单' },
      { key: '/samples/workflow', label: '样品订单流程' },
    ] },
    { key: 'orders-group', icon: <FileDoneOutlined />, label: '正式订单', children: [
      { key: '/orders', label: '正式订单列表' }, { key: '/orders/workflow', label: '正式订单流程' },
    ] },
    { key: '/suppliers', icon: <ShopOutlined />, label: '供应商' },
    { key: '/logs', icon: <FileSearchOutlined />, label: '操作日志' },
  ]

  const nav = <>
    <div className="brand"><ApartmentOutlined /><span>客户订单中心</span></div>
    <Menu mode="inline" items={items} selectedKeys={[selectedKey]} defaultOpenKeys={['samples', 'orders-group']}
      onClick={({ key }) => key.startsWith('/') && navigate(key)} />
  </>

  return <Layout className="app-shell">
    {mobile ? <Drawer placement="left" width={232} open={mobileOpen} onClose={() => setMobileOpen(false)} closable={false} styles={{ body: { padding: 0 } }}>{nav}</Drawer>
      : <Sider width={232} collapsedWidth={72} collapsed={collapsed} theme="light" className="app-sider">{nav}</Sider>}
    <Layout>
      <Header className="topbar">
        <Space size={12}>
          <Tooltip title={mobile ? '打开导航' : collapsed ? '展开导航' : '收起导航'}>
            <Button aria-label="切换导航" type="text" icon={mobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => mobile ? setMobileOpen(true) : setCollapsed(!collapsed)} />
          </Tooltip>
          <div>
            <Breadcrumb items={[{ title: '业务中心' }, { title }]} />
            <Typography.Title level={4}>{title}</Typography.Title>
          </div>
        </Space>
        <Space>
          <Avatar icon={<UserOutlined />} />
          <span className="operator-name">{user?.display_name ?? '未登录'}</span>
          <Tooltip title="退出登录">
            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} size="small" />
          </Tooltip>
        </Space>
      </Header>
      <Content className="content-area">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/customers" element={<AuthGuard><CustomersPage /></AuthGuard>} />
          <Route path="/customers/:id" element={<AuthGuard><CustomerDetailPage /></AuthGuard>} />
          <Route path="/samples/templates" element={<AuthGuard><TemplatesPage /></AuthGuard>} />
          <Route path="/samples/orders" element={<AuthGuard><OrdersPage type="sample" workflow={false} /></AuthGuard>} />
          <Route path="/samples/workflow" element={<AuthGuard><OrdersPage type="sample" workflow /></AuthGuard>} />
          <Route path="/orders" element={<AuthGuard><OrdersPage type="formal" workflow={false} /></AuthGuard>} />
          <Route path="/orders/workflow" element={<AuthGuard><OrdersPage type="formal" workflow /></AuthGuard>} />
          <Route path="/suppliers" element={<AuthGuard><SuppliersPage /></AuthGuard>} />
          <Route path="/logs" element={<AuthGuard><LogsPage /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/customers" replace />} />
        </Routes>
      </Content>
    </Layout>
  </Layout>
}

export default function App() { return <Shell /> }
