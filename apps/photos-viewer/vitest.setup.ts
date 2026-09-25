import { expect, vi } from 'vitest';
import '@testing-library/jest-dom';

expect.extend({});

// Mock IntersectionObserver for jsdom
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: IntersectionObserverCallback) {}
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
