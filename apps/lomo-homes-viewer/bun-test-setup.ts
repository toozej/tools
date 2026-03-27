import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

const { window } = dom;

// Propagate jsdom globals BEFORE any other imports
Object.assign(globalThis, {
  document: window.document,
  window: window as unknown as Window & typeof globalThis,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLImageElement: window.HTMLImageElement,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  constructor(public callback: IntersectionObserverCallback) {}
}
Object.assign(globalThis, {
  IntersectionObserver: MockIntersectionObserver as unknown as typeof IntersectionObserver,
});

// Now safe to import testing-library (it binds screen to document.body at import time)
const { cleanup } = await import('@testing-library/react');
await import('@testing-library/jest-dom');

// Cleanup DOM after each test
const { afterEach } = await import('bun:test');
afterEach(() => {
  cleanup();
});
