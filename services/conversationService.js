import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';

class ConversationService {
    constructor() {
        this.router = express.Router();
        this.conversations = new Map();
        this.cache = new NodeCache({ stdTTL: 86400 }); // 24 hours
        this.setupRoutes();
        this.maxHistoryLength = parseInt(process.env.MAX_CONVERSATION_HISTORY) || 100;
    }

    setupRoutes() {
        // Get conversation history
        this.router.get('/:id', (req, res) => {
            try {
                const { id } = req.params;
                const history = this.getHistory(id);
                res.json({ success: true, history, conversationId: id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get all conversations
        this.router.get('/', (req, res) => {
            try {
                const conversations = this.getAllConversations();
                res.json({ success: true, conversations });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Create new conversation
        this.router.post('/', (req, res) => {
            try {
                const { title, metadata = {} } = req.body;
                const conversationId = this.createConversation(title, metadata);
                res.json({ success: true, conversationId });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Add message to conversation
        this.router.post('/:id/messages', async (req, res) => {
            try {
                const { id } = req.params;
                const { role, content, metadata = {} } = req.body;
                
                await this.addMessage(id, {
                    role,
                    content,
                    metadata,
                    timestamp: new Date()
                });
                
                res.json({ success: true, conversationId: id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Update conversation metadata
        this.router.put('/:id', (req, res) => {
            try {
                const { id } = req.params;
                const { title, metadata } = req.body;
                this.updateConversation(id, title, metadata);
                res.json({ success: true, conversationId: id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Delete conversation
        this.router.delete('/:id', (req, res) => {
            try {
                const { id } = req.params;
                this.deleteConversation(id);
                res.json({ success: true, message: 'Conversation deleted' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Search conversations
        this.router.post('/search', (req, res) => {
            try {
                const { query, options = {} } = req.body;
                const results = this.searchConversations(query, options);
                res.json({ success: true, results });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Export conversation
        this.router.get('/:id/export', (req, res) => {
            try {
                const { id } = req.params;
                const { format = 'json' } = req.query;
                const exported = this.exportConversation(id, format);
                
                res.setHeader('Content-Disposition', `attachment; filename="conversation-${id}.${format}"`);
                res.setHeader('Content-Type', this.getContentType(format));
                res.send(exported);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    createConversation(title = 'New Conversation', metadata = {}) {
        const id = uuidv4();
        const conversation = {
            id,
            title,
            metadata,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        this.conversations.set(id, conversation);
        this.cache.set(`conversation:${id}`, conversation);
        
        return id;
    }

    async addMessage(conversationId, message) {
        let conversation = this.conversations.get(conversationId);
        
        if (!conversation) {
            conversation = {
                id: conversationId,
                title: 'Auto-generated Conversation',
                metadata: {},
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.conversations.set(conversationId, conversation);
        }

        // Add unique ID to message
        message.id = uuidv4();
        message.timestamp = message.timestamp || new Date();

        conversation.messages.push(message);
        conversation.updatedAt = new Date();

        // Trim conversation if it gets too long
        if (conversation.messages.length > this.maxHistoryLength) {
            conversation.messages = conversation.messages.slice(-this.maxHistoryLength);
        }

        // Update cache
        this.cache.set(`conversation:${conversationId}`, conversation);
        
        return message.id;
    }

    getHistory(conversationId) {
        if (!conversationId) {
            return [];
        }

        const conversation = this.conversations.get(conversationId) || 
                           this.cache.get(`conversation:${conversationId}`);
        
        return conversation ? conversation.messages : [];
    }

    getAllConversations() {
        const conversations = [];
        
        for (const [id, conversation] of this.conversations) {
            conversations.push({
                id: conversation.id,
                title: conversation.title,
                metadata: conversation.metadata,
                messageCount: conversation.messages.length,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                lastMessage: conversation.messages.length > 0 ? 
                           conversation.messages[conversation.messages.length - 1] : null
            });
        }

        // Sort by most recent
        return conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    updateConversation(id, title, metadata) {
        const conversation = this.conversations.get(id);
        
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        if (title) conversation.title = title;
        if (metadata) conversation.metadata = { ...conversation.metadata, ...metadata };
        conversation.updatedAt = new Date();

        this.cache.set(`conversation:${id}`, conversation);
    }

    deleteConversation(id) {
        const deleted = this.conversations.delete(id);
        this.cache.del(`conversation:${id}`);
        
        if (!deleted) {
            throw new Error('Conversation not found');
        }
    }

    searchConversations(query, options = {}) {
        const results = [];
        const searchTerm = query.toLowerCase();
        
        for (const [id, conversation] of this.conversations) {
            let score = 0;
            let matches = [];

            // Search in title
            if (conversation.title.toLowerCase().includes(searchTerm)) {
                score += 10;
                matches.push({ type: 'title', content: conversation.title });
            }

            // Search in messages
            conversation.messages.forEach((message, index) => {
                if (message.content.toLowerCase().includes(searchTerm)) {
                    score += 5;
                    matches.push({
                        type: 'message',
                        content: message.content,
                        role: message.role,
                        timestamp: message.timestamp,
                        index
                    });
                }
            });

            if (score > 0) {
                results.push({
                    conversation: {
                        id: conversation.id,
                        title: conversation.title,
                        updatedAt: conversation.updatedAt
                    },
                    score,
                    matches: options.includeMatches ? matches : matches.length
                });
            }
        }

        // Sort by score (relevance)
        return results.sort((a, b) => b.score - a.score);
    }

    exportConversation(id, format = 'json') {
        const conversation = this.conversations.get(id);
        
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(conversation, null, 2);
            
            case 'txt':
                return this.exportAsText(conversation);
            
            case 'md':
            case 'markdown':
                return this.exportAsMarkdown(conversation);
            
            case 'csv':
                return this.exportAsCsv(conversation);
            
            default:
                throw new Error('Unsupported export format');
        }
    }

    exportAsText(conversation) {
        let text = `Conversation: ${conversation.title}\n`;
        text += `Created: ${conversation.createdAt}\n`;
        text += `Updated: ${conversation.updatedAt}\n`;
        text += `Messages: ${conversation.messages.length}\n\n`;
        text += '=' * 50 + '\n\n';

        conversation.messages.forEach((message, index) => {
            text += `[${index + 1}] ${message.role.toUpperCase()}\n`;
            text += `Time: ${message.timestamp}\n`;
            text += `Content: ${message.content}\n\n`;
            text += '-' * 30 + '\n\n';
        });

        return text;
    }

    exportAsMarkdown(conversation) {
        let md = `# ${conversation.title}\n\n`;
        md += `**Created:** ${conversation.createdAt}  \n`;
        md += `**Updated:** ${conversation.updatedAt}  \n`;
        md += `**Messages:** ${conversation.messages.length}\n\n`;
        md += '---\n\n';

        conversation.messages.forEach((message, index) => {
            md += `## Message ${index + 1} - ${message.role}\n\n`;
            md += `**Time:** ${message.timestamp}\n\n`;
            md += `${message.content}\n\n`;
            md += '---\n\n';
        });

        return md;
    }

    exportAsCsv(conversation) {
        let csv = 'Index,Role,Timestamp,Content\n';
        
        conversation.messages.forEach((message, index) => {
            const content = message.content.replace(/"/g, '""'); // Escape quotes
            csv += `${index + 1},"${message.role}","${message.timestamp}","${content}"\n`;
        });

        return csv;
    }

    getContentType(format) {
        const types = {
            'json': 'application/json',
            'txt': 'text/plain',
            'md': 'text/markdown',
            'markdown': 'text/markdown',
            'csv': 'text/csv'
        };
        
        return types[format.toLowerCase()] || 'text/plain';
    }

    // Analytics and statistics
    getStats() {
        const totalConversations = this.conversations.size;
        let totalMessages = 0;
        let oldestConversation = null;
        let newestConversation = null;

        for (const conversation of this.conversations.values()) {
            totalMessages += conversation.messages.length;
            
            if (!oldestConversation || conversation.createdAt < oldestConversation.createdAt) {
                oldestConversation = conversation;
            }
            
            if (!newestConversation || conversation.createdAt > newestConversation.createdAt) {
                newestConversation = conversation;
            }
        }

        return {
            totalConversations,
            totalMessages,
            averageMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
            oldestConversation: oldestConversation ? {
                id: oldestConversation.id,
                title: oldestConversation.title,
                createdAt: oldestConversation.createdAt
            } : null,
            newestConversation: newestConversation ? {
                id: newestConversation.id,
                title: newestConversation.title,
                createdAt: newestConversation.createdAt
            } : null,
            cacheStats: this.cache.getStats()
        };
    }

    // Cleanup old conversations
    cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const cutoff = new Date(Date.now() - maxAge);
        let cleaned = 0;

        for (const [id, conversation] of this.conversations) {
            if (conversation.updatedAt < cutoff) {
                this.conversations.delete(id);
                this.cache.del(`conversation:${id}`);
                cleaned++;
            }
        }

        return cleaned;
    }
}

const conversationService = new ConversationService();
export { conversationService };