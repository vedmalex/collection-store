// bun.test.config.ts
export default {
  testDir: './tests',
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx'
  ],
  coverage: {
    enabled: true,
    threshold: 95,
    include: ['src/browser-sdk/**/*.ts'],
    exclude: [
      'src/browser-sdk/**/*.d.ts',
      'src/browser-sdk/**/types.ts'
    ]
  },
  timeout: 10000,
  setupFiles: ['./tests/bun-setup.ts']
};