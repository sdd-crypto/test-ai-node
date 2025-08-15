class AdvancedChatbot {
    constructor() {
        this.socket = null;
        this.currentConversationId = null;
        this.conversations = new Map();
        this.settings = {
            temperature: 0.7,
            maxTokens: 4000,
            streamEnabled: true,
            username: 'User',
            theme: 'dark'
        };
        this.isTyping = false;
        this.uploadedFiles = [];
        this.currentMessage = null;
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.initSocket();
        this.setupEventListeners();
        this.setupFileDropZone();
        this.createNewConversation();
        this.updateUI();
    }

    loadSettings() {
        const saved = localStorage.getItem('chatbot-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        this.applySettings();
    }

    saveSettings() {
        localStorage.setItem('chatbot-settings', JSON.stringify(this.settings));
    }

    applySettings() {
        const tempElement = document.getElementById('temperature');
        const tempValueElement = document.getElementById('temperatureValue');
        const maxTokensElement = document.getElementById('maxTokens');
        const streamEnabledElement = document.getElementById('streamEnabled');
        const usernameElement = document.getElementById('username');
        const themeElement = document.getElementById('theme');
        const streamToggleElement = document.getElementById('streamToggle');

        if (tempElement) tempElement.value = this.settings.temperature;
        if (tempValueElement) tempValueElement.textContent = this.settings.temperature;
        if (maxTokensElement) maxTokensElement.value = this.settings.maxTokens;
        if (streamEnabledElement) streamEnabledElement.checked = this.settings.streamEnabled;
        if (usernameElement) usernameElement.value = this.settings.username;
        if (themeElement) themeElement.value = this.settings.theme;
        if (streamToggleElement) streamToggleElement.classList.toggle('active', this.settings.streamEnabled);
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('🔌 Connected to server');
            this.updateConnectionStatus(true);
            this.joinCurrentConversation();
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('message_received', (data) => {
            console.log('📨 Message received:', data);
            this.displayMessage(data);
            this.hideTypingIndicator();
        });

        this.socket.on('message_start', (data) => {
            console.log('🚀 Streaming started:', data);
            this.currentMessage = this.createStreamingMessage(data);
        });

        this.socket.on('message_chunk', (data) => {
            if (this.currentMessage) {
                this.updateStreamingMessage(this.currentMessage, data.chunk);
            }
        });

        this.socket.on('message_complete', (data) => {
            console.log('✅ Streaming complete');
            if (this.currentMessage) {
                this.finalizeStreamingMessage(this.currentMessage, data.content);
                this.currentMessage = null;
            }
            this.hideTypingIndicator();
        });

        this.socket.on('ai_typing', (data) => {
            if (data.typing) {
                this.showTypingIndicator();
            } else {
                this.hideTypingIndicator();
            }
        });

        this.socket.on('user_typing', (data) => {
            this.updateUserTyping(data);
        });

        this.socket.on('conversation_history', (history) => {
            console.log('📜 Loading conversation history:', history);
            this.loadConversationHistory(history);
        });

        this.socket.on('active_users', (users) => {
            this.updateUserCount(users.length);
        });

        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            this.showError(error.message);
        });

        this.socket.on('file_uploaded', (data) => {
            this.handleFileUploaded(data);
        });

        this.socket.on('server_stats', (stats) => {
            this.updateServerStats(stats);
        });
    }

    setupEventListeners() {
        // Temperature slider
        const tempSlider = document.getElementById('temperature');
        if (tempSlider) {
            tempSlider.addEventListener('input', (e) => {
                this.settings.temperature = parseFloat(e.target.value);
                const tempValue = document.getElementById('temperatureValue');
                if (tempValue) tempValue.textContent = this.settings.temperature;
                this.saveSettings();
            });
        }

        // Max tokens
        const maxTokensInput = document.getElementById('maxTokens');
        if (maxTokensInput) {
            maxTokensInput.addEventListener('change', (e) => {
                this.settings.maxTokens = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        // Stream toggle
        const streamToggle = document.getElementById('streamEnabled');
        if (streamToggle) {
            streamToggle.addEventListener('change', (e) => {
                this.settings.streamEnabled = e.target.checked;
                const toggleBtn = document.getElementById('streamToggle');
                if (toggleBtn) toggleBtn.classList.toggle('active', this.settings.streamEnabled);
                this.saveSettings();
            });
        }

        // Username
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.addEventListener('change', (e) => {
                this.settings.username = e.target.value;
                this.saveSettings();
            });
        }

        // Theme
        const themeSelect = document.getElementById('theme');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.saveSettings();
                this.applyTheme();
            });
        }

        // Typing indicators
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            let typingTimer;
            
            messageInput.addEventListener('input', () => {
                if (!this.isTyping && this.socket) {
                    this.isTyping = true;
                    this.socket.emit('typing_start', { conversationId: this.currentConversationId });
                }
                
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    this.isTyping = false;
                    if (this.socket) {
                        this.socket.emit('typing_stop', { conversationId: this.currentConversationId });
                    }
                }, 1000);

                // Update send button
                this.updateSendButton();
            });
        }

        // Auto-save conversations
        setInterval(() => {
            this.saveConversationsToLocal();
        }, 30000); // Every 30 seconds
    }

    setupFileDropZone() {
        const dropZone = document.getElementById('fileDropZone');
        const body = document.body;

        if (dropZone) {
            body.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('active');
            });

            body.addEventListener('dragleave', (e) => {
                if (!body.contains(e.relatedTarget)) {
                    dropZone.classList.remove('active');
                }
            });

            body.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('active');
                this.handleFilesDrop(e.dataTransfer.files);
            });
        }
    }

    joinCurrentConversation() {
        if (this.currentConversationId && this.socket) {
            console.log('🔗 Joining conversation:', this.currentConversationId);
            this.socket.emit('join', {
                conversationId: this.currentConversationId,
                username: this.settings.username
            });
        }
    }

    createNewConversation() {
        this.currentConversationId = this.generateUUID();
        const conversation = {
            id: this.currentConversationId,
            title: 'New Conversation',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        this.conversations.set(this.currentConversationId, conversation);
        this.updateConversationsList();
        this.clearMessages();
        
        if (this.socket && this.socket.connected) {
            this.joinCurrentConversation();
        }
        
        const chatTitle = document.getElementById('chatTitle');
        if (chatTitle) chatTitle.textContent = conversation.title;
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input) return;
        
        const message = input.value.trim();
        console.log('📤 Sending message:', message);
        
        if (!message) return;

        const options = {
            temperature: this.settings.temperature,
            maxTokens: this.settings.maxTokens,
            stream: this.settings.streamEnabled
        };

        // Clear input
        input.value = '';
        this.autoResize(input);

        // Emit message to server
        if (this.socket) {
            this.socket.emit('chat_message', {
                message,
                conversationId: this.currentConversationId,
                options,
                files: this.uploadedFiles
            });
        }

        // Clear uploaded files after sending
        this.uploadedFiles = [];
        this.updateFileDisplay();

        // Update send button state
        this.updateSendButton();
    }

    // Add missing autoResize method
    autoResize(textarea) {
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
    }

    displayMessage(data) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.role}`;
        messageDiv.dataset.messageId = data.id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = data.role === 'user' ? this.settings.username.charAt(0).toUpperCase() : 'AI';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Process markdown and code highlighting
        const processedContent = this.processMessageContent(data.content);
        contentDiv.innerHTML = processedContent;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date(data.timestamp).toLocaleTimeString();

        messageDiv.appendChild(avatar);
        contentDiv.appendChild(timeDiv);
        messageDiv.appendChild(contentDiv);

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        // Update conversation
        if (this.conversations.has(this.currentConversationId)) {
            const conversation = this.conversations.get(this.currentConversationId);
            conversation.messages.push(data);
            conversation.updatedAt = new Date();
            
            // Update title if it's the first user message
            if (data.role === 'user' && conversation.messages.length <= 2) {
                conversation.title = data.content.substring(0, 50) + (data.content.length > 50 ? '...' : '');
                const chatTitle = document.getElementById('chatTitle');
                if (chatTitle) chatTitle.textContent = conversation.title;
                this.updateConversationsList();
            }
        }
    }

    createStreamingMessage(data) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return null;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.role}`;
        messageDiv.dataset.messageId = data.id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = 'AI';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = '<span class="streaming-cursor">|</span>';

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date(data.timestamp).toLocaleTimeString();

        messageDiv.appendChild(avatar);
        contentDiv.appendChild(timeDiv);
        messageDiv.appendChild(contentDiv);

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        return { element: messageDiv, content: '', contentDiv };
    }

    updateStreamingMessage(messageData, chunk) {
        if (!messageData) return;
        
        messageData.content += chunk;
        const processedContent = this.processMessageContent(messageData.content);
        messageData.contentDiv.innerHTML = processedContent + '<span class="streaming-cursor">|</span>';
        
        // Re-add time
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = messageData.contentDiv.querySelector('.message-time')?.textContent || new Date().toLocaleTimeString();
        messageData.contentDiv.appendChild(timeDiv);
        
        this.scrollToBottom();
    }

    finalizeStreamingMessage(messageData, finalContent) {
        if (!messageData) return;
        
        const processedContent = this.processMessageContent(finalContent);
        messageData.contentDiv.innerHTML = processedContent;
        
        // Re-add time
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString();
        messageData.contentDiv.appendChild(timeDiv);

        // Update conversation
        if (this.conversations.has(this.currentConversationId)) {
            const conversation = this.conversations.get(this.currentConversationId);
            conversation.messages.push({
                id: messageData.element.dataset.messageId,
                role: 'assistant',
                content: finalContent,
                timestamp: new Date()
            });
            conversation.updatedAt = new Date();
        }
    }

    processMessageContent(content) {
        try {
            // Convert markdown to HTML
            let processed = marked.parse(content);
            
            // Apply syntax highlighting to code blocks
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = processed;
            
            tempDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            
            return tempDiv.innerHTML;
        } catch (error) {
            console.error('Error processing message content:', error);
            return content; // Return original content if processing fails
        }
    }

    showTypingIndicator() {
        const existingIndicator = document.querySelector('.typing-indicator');
        if (existingIndicator) return;

        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar" style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white;">AI</div>
            <div class="typing-text">AI is thinking...</div>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    loadConversationHistory(history) {
        this.clearMessages();
        
        if (Array.isArray(history)) {
            history.forEach(message => {
                this.displayMessage(message);
            });

            if (this.conversations.has(this.currentConversationId)) {
                const conversation = this.conversations.get(this.currentConversationId);
                conversation.messages = history;
            }
        }
    }

    clearMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    }

    updateConversationsList() {
        const conversationsList = document.getElementById('conversationsList');
        if (!conversationsList) return;

        conversationsList.innerHTML = '';

        const sortedConversations = Array.from(this.conversations.values())
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        sortedConversations.forEach(conversation => {
            const conversationDiv = document.createElement('div');
            conversationDiv.className = 'conversation-item';
            if (conversation.id === this.currentConversationId) {
                conversationDiv.classList.add('active');
            }

            const lastMessage = conversation.messages.length > 0 ? 
                conversation.messages[conversation.messages.length - 1].content.substring(0, 100) : 
                'No messages yet';

            conversationDiv.innerHTML = `
                <div class="conversation-title">${conversation.title}</div>
                <div class="conversation-preview">${lastMessage}</div>
            `;

            conversationDiv.addEventListener('click', () => {
                this.switchConversation(conversation.id);
            });

            conversationsList.appendChild(conversationDiv);
        });
    }

    switchConversation(conversationId) {
        this.currentConversationId = conversationId;
        const conversation = this.conversations.get(conversationId);
        
        if (conversation) {
            const chatTitle = document.getElementById('chatTitle');
            if (chatTitle) chatTitle.textContent = conversation.title;
            this.loadConversationHistory(conversation.messages);
            this.updateConversationsList();
            
            if (this.socket && this.socket.connected) {
                this.socket.emit('join_conversation', { conversationId });
            }
        }
    }

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    handleFilesDrop(files) {
        this.processFiles(Array.from(files));
    }

    async processFiles(files) {
        for (const file of files) {
            try {
                const fileData = await this.readFileAsBase64(file);
                
                // Add to uploaded files
                this.uploadedFiles.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: fileData
                });

                // Emit file upload to server for analysis
                if (this.socket) {
                    this.socket.emit('file_upload', {
                        fileData,
                        filename: file.name,
                        conversationId: this.currentConversationId
                    });
                }

            } catch (error) {
                console.error('File processing error:', error);
                this.showError(`Failed to process file: ${file.name}`);
            }
        }

        this.updateFileDisplay();
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    updateFileDisplay() {
        // You can add UI to show uploaded files here
        console.log('Uploaded files:', this.uploadedFiles);
    }

    handleFileUploaded(data) {
        console.log('File uploaded and analyzed:', data);
        this.showSuccess(`File "${data.filename}" uploaded and analyzed successfully!`);
    }

    updateConnectionStatus(connected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = statusDot?.nextElementSibling;
        
        if (statusDot) {
            statusDot.style.background = connected ? '#4ade80' : '#ef4444';
        }
        if (statusText) {
            statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    updateUserCount(count) {
        const userCount = document.getElementById('userCount');
        if (userCount) {
            userCount.innerHTML = `<i class="fas fa-users"></i> <span>${count} user${count !== 1 ? 's' : ''}</span>`;
        }
    }

    updateSendButton() {
        const sendBtn = document.getElementById('sendBtn');
        const input = document.getElementById('messageInput');
        if (sendBtn && input) {
            sendBtn.disabled = !input.value.trim();
        }
    }

    updateUserTyping(data) {
        // Handle user typing display
        console.log('User typing:', data);
    }

    updateServerStats(stats) {
        // Handle server stats
        console.log('Server stats:', stats);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    saveConversationsToLocal() {
        const conversationsData = Array.from(this.conversations.entries());
        localStorage.setItem('chatbot-conversations', JSON.stringify(conversationsData));
    }

    loadConversationsFromLocal() {
        const saved = localStorage.getItem('chatbot-conversations');
        if (saved) {
            try {
                const conversationsData = JSON.parse(saved);
                this.conversations = new Map(conversationsData);
                this.updateConversationsList();
            } catch (error) {
                console.error('Error loading conversations from local storage:', error);
            }
        }
    }

    updateUI() {
        this.updateSendButton();
        this.loadConversationsFromLocal();
    }

    applyTheme() {
        // Theme switching logic can be added here
        console.log(`Applied theme: ${this.settings.theme}`);
    }
}

// Global functions for HTML event handlers
let chatbot;

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
    if (chatbot) chatbot.updateSendButton();
}

function autoResize(textarea) {
    if (chatbot) {
        chatbot.autoResize(textarea);
    } else {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
}

function sendMessage() {
    if (chatbot) {
        console.log('🚀 Send button clicked');
        chatbot.sendMessage();
    }
}

function createNewConversation() {
    if (chatbot) {
        chatbot.createNewConversation();
    }
}

function toggleSettings() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
        settingsPanel.classList.toggle('open');
    }
}

function toggleStream() {
    const streamToggle = document.getElementById('streamToggle');
    const streamEnabled = document.getElementById('streamEnabled');
    if (streamEnabled) {
        streamEnabled.checked = !streamEnabled.checked;
        streamEnabled.dispatchEvent(new Event('change'));
    }
}

function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleFileUpload(event) {
    if (chatbot) {
        chatbot.handleFileUpload(event);
    }
}

function toggleMicrophone() {
    // Voice input functionality can be added here
    console.log('Microphone toggle clicked');
}

function exportConversation() {
    if (chatbot && chatbot.currentConversationId && chatbot.conversations.has(chatbot.currentConversationId)) {
        const conversation = chatbot.conversations.get(chatbot.currentConversationId);
        const data = JSON.stringify(conversation, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Advanced Chatbot...');
    chatbot = new AdvancedChatbot();
    console.log('✅ Chatbot initialized successfully');
});

// Add CSS for streaming cursor animation
const style = document.createElement('style');
style.textContent = `
    .streaming-cursor {
        animation: blink 1s infinite;
        color: #ff6b35;
        font-weight: bold;
    }
    
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
    }
    
    .notification {
        animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);