#!/bin/bash

# Advanced AI Chatbot Startup Script
# This script will install dependencies and start the server

echo "🔥 Advanced AI Chatbot - Starting Up..."
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env .env.backup 2>/dev/null || true
    echo "⚠️  Please configure your .env file with your Perplexity API key"
    echo "   Visit: https://www.perplexity.ai/ to get your API key"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "✅ Dependencies already installed"
fi

# Create uploads directory
mkdir -p uploads
echo "✅ Created uploads directory"

# Check if API key is configured
if grep -q "your-perplexity-api-key" .env 2>/dev/null; then
    echo "⚠️  WARNING: Please configure your Perplexity API key in .env file"
    echo "   The chatbot will not work without a valid API key"
fi

echo ""
echo "🚀 Starting Advanced AI Chatbot..."
echo "=================================="
echo ""
echo "🌐 Server will be available at: http://localhost:3000"
echo "👤 Default admin login: admin / admin123"
echo "🔥 Uncensored mode: ENABLED"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start