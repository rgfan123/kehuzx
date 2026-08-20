import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5174', screenshot: 'only-on-failure' },
  reporter: 'line',
})

