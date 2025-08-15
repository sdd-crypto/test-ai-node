# 🔥 Advanced AI Chatbot - Uncensored & Powerful

An advanced, uncensored AI chatbot built with Node.js, featuring Cursor-like capabilities and powered by Perplexity AI. This chatbot offers unrestricted conversations, file analysis, real-time streaming, and advanced features without content filtering.

## ⚡ Features

### 🧠 AI Capabilities
- **Uncensored Conversations**: No content restrictions or filtering
- **Perplexity AI Integration**: Powered by `sonar-pro` model
- **Real-time Streaming**: Live response streaming
- **Web Search**: Real-time information access
- **Advanced Reasoning**: Complex problem-solving abilities

### 📁 File Processing
- **PDF Analysis**: Extract and analyze PDF documents
- **DOCX Processing**: Microsoft Word document analysis
- **Code Analysis**: Support for multiple programming languages
- **Image Metadata**: Extract image information
- **Multi-file Upload**: Process multiple files simultaneously

### 💻 Development Features
- **Code Generation**: Generate code in any programming language
- **Code Explanation**: Detailed code analysis and explanation
- **Syntax Highlighting**: Beautiful code display with highlight.js
- **Markdown Support**: Rich text formatting

### 🚀 Advanced Interface
- **Modern UI**: Beautiful, responsive design
- **Real-time Chat**: WebSocket-based communication
- **Conversation Management**: Save and organize conversations
- **Settings Panel**: Customizable AI parameters
- **File Drop Zone**: Drag and drop file uploads
- **Export Features**: Export conversations in multiple formats

### 🔐 Security & Authentication
- **JWT Authentication**: Secure user sessions
- **Role-based Access**: Admin and user roles
- **Rate Limiting**: Protection against abuse
- **Security Headers**: Comprehensive security middleware

## 🛠 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd advanced-ai-chatbot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Start the server**
```bash
npm start
```

5. **Open your browser**
```
http://localhost:3000
```

## ⚙️ Configuration

### Environment Variables

```env
# AI Configuration
PERPLEXITY_API_URL=https://api.perplexity.ai/chat/completions
PERPLEXITY_API_KEY=your-perplexity-api-key
PERPLEXITY_MODEL=sonar-pro

# Server Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
BCRYPT_ROUNDS=12

# Features Configuration
MAX_FILE_SIZE=50MB
SUPPORTED_FILE_TYPES=pdf,docx,txt,md,js,py,java,cpp,html,css,json,xml
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=15

# Cache Configuration
CACHE_TTL=3600
MAX_CONVERSATION_HISTORY=100

# Advanced Features
ENABLE_WEB_SEARCH=true
ENABLE_CODE_EXECUTION=false
ENABLE_FILE_ANALYSIS=true
ENABLE_UNCENSORED_MODE=true
MAX_CONTEXT_LENGTH=32000
TEMPERATURE=0.7
MAX_TOKENS=4000
```

### Perplexity AI Setup

1. **Get API Key**
   - Visit [Perplexity AI](https://www.perplexity.ai/)
   - Sign up for an account
   - Generate an API key
   - Add it to your `.env` file

2. **Model Configuration**
   - Default model: `sonar-pro`
   - Supports real-time web search
   - High-quality responses

## 🚀 Usage

### Basic Chat
1. Open the application in your browser
2. Start typing in the input field
3. Press Enter or click Send
4. Enjoy uncensored AI conversations!

### File Upload
1. Click the paperclip icon or drag files
2. Supported formats: PDF, DOCX, code files, images
3. Files are automatically analyzed
4. Ask questions about uploaded content

### Advanced Features
- **Temperature Control**: Adjust response creativity (0-2)
- **Token Limit**: Control response length
- **Streaming**: Real-time response streaming
- **Conversation Export**: Download chat history

### Authentication
- **Default Admin**: username `admin`, password `admin123`
- **Registration**: Create new user accounts
- **JWT Tokens**: Secure session management

## 🎯 API Endpoints

### Chat Endpoints
```javascript
POST /api/chat              // Send message
POST /api/chat/stream       // Streaming chat
GET  /api/health           // Health check
```

### AI Services
```javascript
POST /api/ai/generate      // Generate response
POST /api/ai/analyze       // Analyze content
POST /api/ai/code          // Generate code
POST /api/ai/explain       // Explain code
POST /api/ai/search        // Web search
```

### File Management
```javascript
POST /api/files/upload     // Upload file
GET  /api/files/:id        // Get file
POST /api/files/analyze    // Analyze file
DELETE /api/files/:id      // Delete file
```

### Authentication
```javascript
POST /api/auth/login       // User login
POST /api/auth/register    // User registration
GET  /api/auth/me          // Get current user
POST /api/auth/logout      // Logout
```

### Conversations
```javascript
GET  /api/conversations    // List conversations
POST /api/conversations    // Create conversation
GET  /api/conversations/:id // Get conversation
PUT  /api/conversations/:id // Update conversation
DELETE /api/conversations/:id // Delete conversation
```

## 🔧 Development

### Project Structure
```
├── server.js                 # Main server file
├── services/                 # Business logic
│   ├── aiService.js          # AI integration
│   ├── authService.js        # Authentication
│   ├── fileService.js        # File processing
│   └── conversationService.js # Chat management
├── handlers/                 # Event handlers
│   └── socketHandler.js      # WebSocket logic
├── public/                   # Frontend files
│   ├── index.html            # Main HTML
│   └── app.js               # Frontend JavaScript
├── uploads/                  # File uploads
└── package.json             # Dependencies
```

### Running in Development
```bash
npm run dev    # Start with nodemon
npm test       # Run tests
npm run build  # Build for production
```

### Docker Support
```bash
# Build image
docker build -t advanced-ai-chatbot .

# Run container
docker run -p 3000:3000 -e PERPLEXITY_API_KEY=your-key advanced-ai-chatbot
```

## 🌟 Key Features Explained

### Uncensored Mode
- **No Content Filtering**: Discuss any topic freely
- **No Restrictions**: No built-in content limitations
- **Direct Responses**: Honest and comprehensive answers
- **Academic Freedom**: Perfect for research and education

### File Analysis
- **PDF Processing**: Extract text and analyze documents
- **Code Analysis**: Understand and explain source code
- **Multi-format Support**: Handle various file types
- **Intelligent Parsing**: Smart content extraction

### Real-time Features
- **WebSocket Communication**: Instant message delivery
- **Typing Indicators**: See when users are typing
- **Live Streaming**: Watch responses generate in real-time
- **User Presence**: Track active users

### Security Measures
- **Rate Limiting**: Prevent API abuse
- **JWT Authentication**: Secure user sessions
- **Input Validation**: Sanitize all inputs
- **CORS Protection**: Control cross-origin requests
- **Helmet Security**: Comprehensive security headers

## 📊 Performance

### Optimization Features
- **Caching**: Redis-like in-memory caching
- **Compression**: Gzip response compression
- **Connection Pooling**: Efficient database connections
- **File Streaming**: Large file handling
- **Background Processing**: Async operations

### Monitoring
- **Health Checks**: Server status monitoring
- **Error Logging**: Comprehensive error tracking
- **Usage Statistics**: Track API usage
- **Performance Metrics**: Response time monitoring

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests**
5. **Submit a pull request**

### Code Style
- **ESLint**: JavaScript linting
- **Prettier**: Code formatting
- **Modern ES6+**: Latest JavaScript features
- **Modular Design**: Clean, organized code

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimers

### Responsible Use
- This chatbot is designed for educational and research purposes
- Users are responsible for complying with local laws and regulations
- The "uncensored" nature means content filtering is disabled - use responsibly

### AI Limitations
- AI responses are generated based on training data and may not always be accurate
- Users should verify important information independently
- The AI does not have access to real-time events beyond its training cutoff

### Privacy & Data
- Conversations may be temporarily stored for functionality
- No conversation data is shared with third parties
- Users can delete their data at any time

## 🔗 Links

- **Perplexity AI**: [https://www.perplexity.ai/](https://www.perplexity.ai/)
- **Socket.IO**: [https://socket.io/](https://socket.io/)
- **Express.js**: [https://expressjs.com/](https://expressjs.com/)
- **Node.js**: [https://nodejs.org/](https://nodejs.org/)

## 💡 Tips & Tricks

### Maximizing Performance
1. **Use Streaming**: Enable streaming for faster perceived responses
2. **Optimize Temperature**: Lower values (0.3-0.7) for focused responses
3. **File Preprocessing**: Smaller files process faster
4. **Connection Management**: Keep WebSocket connections stable

### Advanced Usage
1. **Custom Prompts**: Craft specific prompts for better results
2. **Context Management**: Use conversation history effectively
3. **File Analysis**: Upload relevant documents for context
4. **Export Data**: Regularly backup your conversations

---

**Built with ❤️ and cutting-edge technology for the ultimate AI chat experience**

*This is an advanced, uncensored AI chatbot. Use responsibly and enjoy the power of unrestricted AI conversations!*
