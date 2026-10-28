import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['firebase/production.test.ts'],testTimeout:45000,hookTimeout:45000}});
