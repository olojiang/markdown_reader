import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
      }
    },
    plugins: [vue()]
  }
})
