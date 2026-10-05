import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    cors: true,
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
});
