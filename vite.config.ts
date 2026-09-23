import { defineConfig } from 'vitest/config'; import react from '@vitejs/plugin-react';
declare const process:{env:Record<string,string|undefined>};
const repo=process.env.GITHUB_ACTIONS?process.env.GITHUB_REPOSITORY?.split('/')[1]:undefined;
export default defineConfig({plugins:[react()],base:repo?`/${repo}/`:'/',test:{environment:'node',exclude:['e2e/**','node_modules/**','dist/**']}});
