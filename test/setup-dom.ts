import '@testing-library/jest-dom/vitest';

// The console's visitors are mostly Korean: tests browse with a Korean browser unless they say otherwise.
Object.defineProperty(window.navigator, 'languages', { configurable: true, get: () => ['ko-KR', 'ko'] });
