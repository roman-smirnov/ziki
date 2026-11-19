import { defineConfig } from '@playwright/test';

const port=Number(process.env.ZIKI_PREVIEW_PORT ?? 4317);
const url=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./e2e',
  workers:1,
  timeout:45_000,
  use:{ baseURL:url, browserName:'chromium', channel:'chrome', viewport:{width:1280,height:720} },
  webServer:process.env.ZIKI_REUSE_PREVIEW==='1' ? undefined : {
    command:`npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url,
    reuseExistingServer:false,
  },
});
