import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, ConfigProvider, message } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter } from 'react-router-dom'
import AppShell from './App'
import './styles.css'

message.config({ maxCount: 1, duration: 2.5 })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{
      token: {
        colorPrimary: '#4676A9', colorBgLayout: '#F3F6FA', colorBgContainer: '#FFFFFF',
        colorBorder: '#DCE3EA', colorBorderSecondary: '#E8EDF2', colorText: '#1F2937',
        colorTextSecondary: '#667085', colorSuccess: '#3F7D5A', colorWarning: '#9A6B24',
        colorError: '#9B3A3A', borderRadius: 8, controlHeight: 34, fontSize: 14,
      },
      components: { Table: { headerBg: '#F6F8FA', headerColor: '#475467' }, Menu: { itemBorderRadius: 6 } },
    }}>
      <App>
        <BrowserRouter><AppShell /></BrowserRouter>
      </App>
    </ConfigProvider>
  </React.StrictMode>,
)
