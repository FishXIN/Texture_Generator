import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',
  timeout:30000,
  fullyParallel:false,
  workers:1,
  reporter:'list',
  use:{
    baseURL:'http://127.0.0.1:5173',
    viewport:{width:1440,height:900},
    launchOptions:process.env.TEXTURE_TEST_BROWSER?{executablePath:process.env.TEXTURE_TEST_BROWSER}:{},
    screenshot:'only-on-failure',
  },
  webServer:{
    command:'npm run dev:web',
    url:'http://127.0.0.1:5173',
    reuseExistingServer:!process.env.CI,
    timeout:15000,
  },
});
