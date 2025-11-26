// Test setup file for Jest

// Mock browser APIs
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn()
  },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

global.window = {
  AudioContext: jest.fn().mockImplementation(() => ({
    decodeAudioData: jest.fn().mockResolvedValue({}),
    createBufferSource: jest.fn(() => ({
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
      onended: null
    })),
    destination: {},
    close: jest.fn(),
    state: 'running'
  })),
  webkitAudioContext: jest.fn().mockImplementation(() => ({
    decodeAudioData: jest.fn().mockResolvedValue({}),
    createBufferSource: jest.fn(() => ({
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
      onended: null
    })),
    destination: {},
    close: jest.fn(),
    state: 'running'
  })),
  WebSocket: jest.fn().mockImplementation(() => ({
    readyState: 1, // OPEN
    send: jest.fn(),
    close: jest.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null
  })),
  Shopify: {
    shop: 'test-shop.myshopify.com'
  },
  location: {
    pathname: '/test-page'
  }
};

global.fetch = jest.fn();

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  stream: {
    getTracks: () => [{ stop: jest.fn() }]
  },
  ondataavailable: null,
  onstop: null
}));

// Mock document methods - but allow real DOM operations
document.body.innerHTML = '';

// Console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}; 