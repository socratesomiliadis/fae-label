import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',use:{browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1050}},reporter:'list'});
