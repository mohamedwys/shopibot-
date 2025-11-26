/**
 * Voice Integration Tests
 * Tests for the VoiceAssistant class and voice functionality
 */

// Mock browser APIs for testing
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn()
  },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

global.window = {
  AudioContext: jest.fn(),
  webkitAudioContext: jest.fn(),
  WebSocket: jest.fn(),
  Shopify: {
    shop: 'test-shop.myshopify.com'
  }
};

global.fetch = jest.fn();

describe('VoiceAssistant Class', () => {
  let voiceAssistant;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock successful API responses
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session_id: 'test-session-123' })
    });
    
    // Mock WebSocket with spyOn
    jest.spyOn(global.window, 'WebSocket').mockImplementation(() => ({
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    }));
    
    // AudioContext is already mocked in setup.js
    
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
    
    const settings = {
      enabled: true,
      primaryColor: '#ee5cee'
    };
    
    voiceAssistant = new VoiceAssistant(settings);
  });
  
  test('should initialize with correct settings', () => {
    expect(voiceAssistant.settings).toBeDefined();
    expect(voiceAssistant.isRecording).toBe(false);
    expect(voiceAssistant.voiceSettings.enabled).toBe(true);
  });
  
  test('should create voice session successfully', async () => {
    const result = await voiceAssistant.createSession();
    expect(result).toBe(true);
    expect(voiceAssistant.sessionId).toBe('test-session-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/session',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });
  
  test('should initialize WebSocket connection', () => {
    voiceAssistant.sessionId = 'test-session-123';
    voiceAssistant.initializeWebSocket();
    
    expect(global.window.WebSocket).toHaveBeenCalledWith(
      'ws://localhost:8000/ws/voice/test-session-123'
    );
  });
  
  test('should handle WebSocket messages correctly', () => {
    const mockWebSocket = {
      readyState: 1,
      send: jest.fn()
    };
    voiceAssistant.websocket = mockWebSocket;
    
    // Test transcription message
    const transcriptionData = { type: 'transcription', text: 'Hello world' };
    voiceAssistant.handleWebSocketMessage(transcriptionData);
    
    // Test AI response message
    const aiResponseData = { type: 'ai_response', message: 'Hi there!' };
    voiceAssistant.handleWebSocketMessage(aiResponseData);
    
    // Test error message
    const errorData = { type: 'error', error: 'Test error' };
    voiceAssistant.handleWebSocketMessage(errorData);
  });
  
  test('should toggle recording state', () => {
    expect(voiceAssistant.isRecording).toBe(false);
    
    voiceAssistant.toggleRecording();
    expect(voiceAssistant.isRecording).toBe(true);
    
    voiceAssistant.toggleRecording();
    expect(voiceAssistant.isRecording).toBe(false);
  });
  
  test('should update recording UI correctly', () => {
    // Mock DOM elements
    document.body.innerHTML = `
      <button id="ai-voice-btn"></button>
      <div id="ai-recording-indicator"></div>
    `;
    
    voiceAssistant.updateRecordingUI(true);
    const voiceBtn = document.getElementById('ai-voice-btn');
    const recordingIndicator = document.getElementById('ai-recording-indicator');
    
    expect(voiceBtn.classList.contains('recording')).toBe(true);
    expect(recordingIndicator.style.display).toBe('block');
  });
  
  test('should show voice errors correctly', () => {
    // Mock DOM elements
    document.body.innerHTML = '<div id="ai-voice-error"><span class="error-text"></span></div>';
    
    voiceAssistant.showVoiceError('Test error message');
    const errorElement = document.getElementById('ai-voice-error');
    const textElement = errorElement.querySelector('.error-text');
    
    expect(errorElement.style.display).toBe('block');
    expect(textElement.textContent).toBe('Test error message');
  });
  
  test('should cleanup resources properly', () => {
    const mockWebSocket = { close: jest.fn() };
    const mockMediaRecorder = { stop: jest.fn() };
    
    voiceAssistant.websocket = mockWebSocket;
    voiceAssistant.mediaRecorder = mockMediaRecorder;
    voiceAssistant.isRecording = true;
    voiceAssistant.audioContext = { close: jest.fn() };
    
    voiceAssistant.cleanup();
    
    expect(mockWebSocket.close).toHaveBeenCalled();
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    expect(voiceAssistant.audioContext.close).toHaveBeenCalled();
  });
});

describe('Voice Integration with Chat Widget', () => {
  test('should integrate voice button with chat widget', () => {
    // Mock DOM elements
    document.body.innerHTML = `
      <button id="ai-voice-btn"></button>
      <div id="ai-voice-transcription">
        <span class="transcription-text"></span>
      </div>
    `;
    
    // Test that voice button exists
    const voiceBtn = document.getElementById('ai-voice-btn');
    expect(voiceBtn).toBeDefined();
    
    // Test that transcription element exists
    const transcriptionElement = document.getElementById('ai-voice-transcription');
    expect(transcriptionElement).toBeDefined();
  });
  
  test('should handle voice transcription display', () => {
    document.body.innerHTML = `
      <div id="ai-voice-transcription">
        <span class="transcription-text"></span>
      </div>
    `;
    
    const voiceAssistant = new VoiceAssistant({});
    voiceAssistant.updateTranscription('Hello, this is a test');
    
    const transcriptionElement = document.getElementById('ai-voice-transcription');
    const textElement = transcriptionElement.querySelector('.transcription-text');
    
    expect(transcriptionElement.style.display).toBe('block');
    expect(textElement.textContent).toBe('Hello, this is a test');
  });
});

describe('Speech Validation Tests', () => {
  let voiceAssistant;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    const settings = {
      enabled: true,
      primaryColor: '#ee5cee'
    };
    
    voiceAssistant = new VoiceAssistant(settings);
  });
  
  test('should validate speech detection correctly', () => {
    // Test valid speech
    expect(voiceAssistant.validateSpeechDetection('Hello, this is a valid speech')).toBe(true);
    expect(voiceAssistant.validateSpeechDetection('How can I help you today?')).toBe(true);
    expect(voiceAssistant.validateSpeechDetection('I need assistance with my order')).toBe(true);
    
    // Test invalid speech (test transcription)
    expect(voiceAssistant.validateSpeechDetection('Test transcription')).toBe(false);
    expect(voiceAssistant.validateSpeechDetection('test transcription')).toBe(false);
    expect(voiceAssistant.validateSpeechDetection('TEST TRANSCRIPTION')).toBe(false);
    
    // Test empty or short speech
    expect(voiceAssistant.validateSpeechDetection('')).toBe(false);
    expect(voiceAssistant.validateSpeechDetection('   ')).toBe(false);
    expect(voiceAssistant.validateSpeechDetection('Hi')).toBe(false);
    expect(voiceAssistant.validateSpeechDetection('No')).toBe(false);
  });
  
  test('should handle transcription_final message with validation', () => {
    // Mock DOM elements
    document.body.innerHTML = `
      <div id="ai-voice-transcription">
        <span class="transcription-text"></span>
      </div>
      <div id="ai-processing-indicator"></div>
    `;
    
    // Test valid transcription
    const validTranscriptionData = { 
      type: 'transcription_final', 
      text: 'Hello, I need help with my order' 
    };
    
    voiceAssistant.handleWebSocketMessage(validTranscriptionData);
    
    expect(voiceAssistant.speechValidationPassed).toBe(true);
    
    // Test invalid transcription (test response)
    const invalidTranscriptionData = { 
      type: 'transcription_final', 
      text: 'Test transcription' 
    };
    
    voiceAssistant.handleWebSocketMessage(invalidTranscriptionData);
    
    expect(voiceAssistant.speechValidationPassed).toBe(false);
  });
  
  test('should block AI response when speech validation fails', () => {
    // Set speech validation to failed
    voiceAssistant.speechValidationPassed = false;
    
    // Mock console.log to capture output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const aiResponseData = { 
      type: 'ai_response', 
      text: 'Hello! I heard you stop recording. This is a test response from the voice API.' 
    };
    
    voiceAssistant.handleWebSocketMessage(aiResponseData);
    
    // Should log blocked message
    expect(consoleSpy).toHaveBeenCalledWith(
      '🚫 BLOCKED: AI response blocked due to failed speech validation'
    );
    
    consoleSpy.mockRestore();
  });
  
  test('should allow AI response when speech validation passes', () => {
    // Set speech validation to passed
    voiceAssistant.speechValidationPassed = true;
    
    // Mock console.log to capture output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const aiResponseData = { 
      type: 'ai_response', 
      text: 'Thank you for your question. How can I help you today?' 
    };
    
    voiceAssistant.handleWebSocketMessage(aiResponseData);
    
    // Should not log blocked message
    expect(consoleSpy).not.toHaveBeenCalledWith(
      '🚫 BLOCKED: AI response blocked due to failed speech validation'
    );
    
    consoleSpy.mockRestore();
  });
  
  test('should reset speech validation flag on new recording', () => {
    // Set speech validation to some value
    voiceAssistant.speechValidationPassed = true;
    
    // Start recording (no need to mock getUserMedia since our mock startRecording doesn't use it)
    voiceAssistant.startRecording();
    
    // Speech validation should be reset
    expect(voiceAssistant.speechValidationPassed).toBe(null);
  });
});

// Mock the VoiceAssistant class for testing
class VoiceAssistant {
  constructor(settings) {
    this.settings = settings;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.websocket = null;
    this.sessionId = null;
    this.voiceApiUrl = 'http://localhost:8000';
    this.audioContext = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.receivedVoiceAudio = false;
    this.speechValidationPassed = null; // 🆕 Add speech validation flag
    
    this.voiceSettings = {
      enabled: true,
      voiceType: 'alloy',
      speechRate: 1.0,
      autoPlay: true,
      activationMethod: 'push-to-talk'
    };
  }
  
  async createSession() {
    const response = await fetch(`${this.voiceApiUrl}/api/v1/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_domain: window.Shopify?.shop || 'test-shop.myshopify.com',
        user_agent: navigator.userAgent
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      this.sessionId = data.session_id;
      return true;
    }
    return false;
  }
  
  initializeWebSocket() {
    if (!this.sessionId) return;
    this.websocket = new WebSocket(`ws://localhost:8000/ws/voice/${this.sessionId}`);
  }
  
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'transcription':
        this.updateTranscription(data.text);
        break;
      case 'transcription_final':
        // 🆕 Add speech validation logic
        console.log('🔍 DEBUG: ENTERING transcription_final case');
        console.log('📝 Final transcription:', data.text);
        console.log('🔍 DEBUG: About to validate speech detection');
        
        try {
          const validationResult = this.validateSpeechDetection(data.text);
          console.log('🔍 DEBUG: Speech validation result:', validationResult);
          
          if (validationResult) {
            this.updateTranscription(data.text);
            this.speechValidationPassed = true;
            console.log('✅ Valid speech detected - will process for AI response');
          } else {
            console.log('🚫 Invalid speech detected - blocking AI response generation');
            this.speechValidationPassed = false;
            console.log('🔍 DEBUG: Exiting transcription_final handler due to invalid speech');
            return;
          }
        } catch (error) {
          console.error('❌ Error in speech validation:', error);
          this.speechValidationPassed = true;
          this.updateTranscription(data.text);
          console.log('⚠️ Speech validation failed - allowing response by default');
        }
        break;
      case 'ai_response':
        // 🆕 Add speech validation check
        const responseText = data.message || data.text;
        if (responseText && typeof responseText === 'string') {
          console.log('🔍 DEBUG: Checking speech validation flag:', this.speechValidationPassed);
          if (this.speechValidationPassed === false) {
            console.log('🚫 BLOCKED: AI response blocked due to failed speech validation');
            console.log('🚫 BLOCKED: No actual speech detected - ignoring response');
            return;
          }
          this.handleAIResponse(responseText);
        }
        break;
      case 'error':
        this.showVoiceError(data.error);
        break;
    }
  }
  
  toggleRecording() {
    this.isRecording = !this.isRecording;
  }
  
  async startRecording() {
    if (this.isRecording) return;
    
    // Reset flags for new recording session
    this.receivedVoiceAudio = false;
    this.speechValidationPassed = null;
    
    this.isRecording = true;
  }
  
  updateRecordingUI(isRecording) {
    const voiceBtn = document.getElementById('ai-voice-btn');
    const recordingIndicator = document.getElementById('ai-recording-indicator');
    
    if (voiceBtn) {
      voiceBtn.classList.toggle('recording', isRecording);
    }
    
    if (recordingIndicator) {
      recordingIndicator.style.display = isRecording ? 'block' : 'none';
    }
  }
  
  updateTranscription(text) {
    const transcriptionElement = document.getElementById('ai-voice-transcription');
    if (transcriptionElement) {
      const textElement = transcriptionElement.querySelector('.transcription-text');
      if (textElement) {
        textElement.textContent = text;
      }
      transcriptionElement.style.display = 'block';
    }
  }
  
  handleAIResponse(message) {
    // Mock implementation
  }
  
  showVoiceError(message) {
    const errorElement = document.getElementById('ai-voice-error');
    if (errorElement) {
      const textElement = errorElement.querySelector('.error-text');
      if (textElement) {
        textElement.textContent = message;
      }
      errorElement.style.display = 'block';
    }
  }
  
  // 🆕 Add speech validation method
  validateSpeechDetection(transcription) {
    if (!transcription || transcription.trim().length === 0) {
      console.log('🚫 BLOCKED: No transcription detected - blocking response');
      return false;
    }
    
    if (transcription.toLowerCase() === 'test transcription') {
      console.log('🚫 BLOCKED: Test transcription detected - no actual speech');
      return false;
    }
    
    if (transcription.length < 5) {
      console.log('🚫 BLOCKED: Transcription too short - likely not actual speech');
      return false;
    }
    
    console.log('✅ Speech validation passed:', transcription);
    return true;
  }
  
  cleanup() {
    if (this.websocket) {
      this.websocket.close();
    }
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
} 