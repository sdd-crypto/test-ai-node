import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';

class FileService {
    constructor() {
        this.router = express.Router();
        this.setupRoutes();
        this.setupMulter();
        
        this.maxFileSize = this.parseSize(process.env.MAX_FILE_SIZE || '50MB');
        this.supportedTypes = (process.env.SUPPORTED_FILE_TYPES || 'pdf,docx,txt,md,js,py,java,cpp,html,css,json,xml').split(',');
        this.uploadDir = '/workspace/uploads';
        
        this.ensureUploadDir();
    }

    parseSize(size) {
        const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
        const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
        if (!match) return 50 * 1024 * 1024; // Default 50MB
        return parseFloat(match[1]) * units[match[2].toUpperCase()];
    }

    async ensureUploadDir() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create upload directory:', error);
        }
    }

    setupMulter() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, this.uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueName = `${uuidv4()}-${file.originalname}`;
                cb(null, uniqueName);
            }
        });

        this.upload = multer({
            storage: storage,
            limits: {
                fileSize: this.maxFileSize,
                files: 10 // Max 10 files at once
            },
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).slice(1).toLowerCase();
                if (this.supportedTypes.includes(ext) || this.supportedTypes.includes('*')) {
                    cb(null, true);
                } else {
                    cb(new Error(`File type .${ext} not supported. Supported types: ${this.supportedTypes.join(', ')}`));
                }
            }
        });
    }

    setupRoutes() {
        // Upload single file
        this.router.post('/upload', this.upload.single('file'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: 'No file uploaded' });
                }

                const analysis = await this.analyzeFile(req.file);
                res.json({
                    success: true,
                    file: {
                        id: path.parse(req.file.filename).name,
                        originalName: req.file.originalname,
                        filename: req.file.filename,
                        size: req.file.size,
                        mimetype: req.file.mimetype,
                        path: req.file.path,
                        analysis
                    }
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Upload multiple files
        this.router.post('/upload/multiple', this.upload.array('files', 10), async (req, res) => {
            try {
                if (!req.files || req.files.length === 0) {
                    return res.status(400).json({ error: 'No files uploaded' });
                }

                const results = [];
                for (const file of req.files) {
                    const analysis = await this.analyzeFile(file);
                    results.push({
                        id: path.parse(file.filename).name,
                        originalName: file.originalname,
                        filename: file.filename,
                        size: file.size,
                        mimetype: file.mimetype,
                        path: file.path,
                        analysis
                    });
                }

                res.json({ success: true, files: results });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Analyze uploaded file
        this.router.post('/analyze/:fileId', async (req, res) => {
            try {
                const { fileId } = req.params;
                const { options = {} } = req.body;
                
                const analysis = await this.analyzeUploadedFile(fileId, options);
                res.json({ success: true, analysis });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get file content
        this.router.get('/content/:fileId', async (req, res) => {
            try {
                const { fileId } = req.params;
                const content = await this.getFileContent(fileId);
                res.json({ success: true, content });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Delete file
        this.router.delete('/:fileId', async (req, res) => {
            try {
                const { fileId } = req.params;
                await this.deleteFile(fileId);
                res.json({ success: true, message: 'File deleted' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // List uploaded files
        this.router.get('/', async (req, res) => {
            try {
                const files = await this.listFiles();
                res.json({ success: true, files });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Process URL content
        this.router.post('/url', async (req, res) => {
            try {
                const { url, options = {} } = req.body;
                const content = await this.processUrl(url, options);
                res.json({ success: true, content });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async analyzeFile(file) {
        const ext = path.extname(file.originalname).slice(1).toLowerCase();
        const analysis = {
            type: ext,
            size: file.size,
            encoding: 'utf-8',
            metadata: {},
            content: null,
            summary: null
        };

        try {
            switch (ext) {
                case 'pdf':
                    analysis.content = await this.extractPdfContent(file.path);
                    break;
                
                case 'docx':
                    analysis.content = await this.extractDocxContent(file.path);
                    break;
                
                case 'txt':
                case 'md':
                case 'js':
                case 'py':
                case 'java':
                case 'cpp':
                case 'html':
                case 'css':
                case 'json':
                case 'xml':
                    analysis.content = await this.extractTextContent(file.path);
                    break;
                
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                case 'webp':
                    analysis.metadata = await this.extractImageMetadata(file.path);
                    analysis.content = `[Image file: ${file.originalname}]`;
                    break;
                
                default:
                    analysis.content = '[Binary or unsupported file type]';
            }

            // Generate summary for text content
            if (analysis.content && analysis.content.length > 100) {
                analysis.summary = analysis.content.substring(0, 500) + '...';
                analysis.wordCount = analysis.content.split(/\s+/).length;
                analysis.charCount = analysis.content.length;
            }

        } catch (error) {
            console.error('File analysis error:', error);
            analysis.error = error.message;
        }

        return analysis;
    }

    async extractPdfContent(filePath) {
        const buffer = await fs.readFile(filePath);
        const data = await pdfParse(buffer);
        return data.text;
    }

    async extractDocxContent(filePath) {
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }

    async extractTextContent(filePath) {
        return await fs.readFile(filePath, 'utf-8');
    }

    async extractImageMetadata(filePath) {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            colorspace: metadata.space,
            channels: metadata.channels,
            density: metadata.density
        };
    }

    async processFiles(files) {
        if (!files || files.length === 0) {
            return '';
        }

        let context = 'File Analysis:\n\n';
        
        for (const file of files) {
            try {
                const content = await this.getFileContent(file.id || file.filename);
                context += `File: ${file.originalName || file.filename}\n`;
                context += `Type: ${file.type || 'unknown'}\n`;
                context += `Size: ${this.formatFileSize(file.size)}\n`;
                context += `Content:\n${content.substring(0, 2000)}${content.length > 2000 ? '...[truncated]' : ''}\n\n`;
                context += '---\n\n';
            } catch (error) {
                context += `File: ${file.originalName || file.filename}\n`;
                context += `Error: ${error.message}\n\n`;
                context += '---\n\n';
            }
        }

        return context;
    }

    async getFileContent(fileId) {
        const files = await fs.readdir(this.uploadDir);
        const targetFile = files.find(file => file.startsWith(fileId));
        
        if (!targetFile) {
            throw new Error('File not found');
        }

        const filePath = path.join(this.uploadDir, targetFile);
        const ext = path.extname(targetFile).slice(1).toLowerCase();

        switch (ext) {
            case 'pdf':
                return await this.extractPdfContent(filePath);
            
            case 'docx':
                return await this.extractDocxContent(filePath);
            
            case 'txt':
            case 'md':
            case 'js':
            case 'py':
            case 'java':
            case 'cpp':
            case 'html':
            case 'css':
            case 'json':
            case 'xml':
                return await this.extractTextContent(filePath);
            
            default:
                return '[Binary or unsupported file type]';
        }
    }

    async analyzeUploadedFile(fileId, options = {}) {
        const content = await this.getFileContent(fileId);
        
        // Basic analysis
        const analysis = {
            wordCount: content.split(/\s+/).length,
            charCount: content.length,
            lineCount: content.split('\n').length,
            summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
            keywords: this.extractKeywords(content),
            language: this.detectLanguage(content)
        };

        // Advanced analysis if requested
        if (options.deep) {
            analysis.sentiment = this.analyzeSentiment(content);
            analysis.complexity = this.analyzeComplexity(content);
            analysis.structure = this.analyzeStructure(content);
        }

        return analysis;
    }

    extractKeywords(content) {
        // Simple keyword extraction
        const words = content.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        const frequency = {};
        
        words.forEach(word => {
            if (!this.isStopWord(word)) {
                frequency[word] = (frequency[word] || 0) + 1;
            }
        });

        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));
    }

    isStopWord(word) {
        const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those'];
        return stopWords.includes(word);
    }

    detectLanguage(content) {
        // Simple language detection based on common patterns
        const patterns = {
            javascript: /function|const|let|var|=>|console\.log/i,
            python: /def |import |from |class |if __name__|print\(/i,
            java: /public class|private|protected|import java/i,
            cpp: /#include|using namespace|std::|int main/i,
            html: /<html|<body|<div|<script/i,
            css: /\{[^}]*:[^}]*\}|@media|\.class/i,
            json: /^\s*[\{\[]/,
            xml: /<\?xml|<[a-zA-Z]/
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(content)) {
                return lang;
            }
        }

        return 'text';
    }

    analyzeSentiment(content) {
        // Basic sentiment analysis
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect', 'love', 'best', 'awesome'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'disgusting', 'disappointing', 'poor', 'fail'];
        
        const words = content.toLowerCase().split(/\s+/);
        let positiveCount = 0;
        let negativeCount = 0;

        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });

        const total = positiveCount + negativeCount;
        if (total === 0) return 'neutral';
        
        const ratio = positiveCount / total;
        if (ratio > 0.6) return 'positive';
        if (ratio < 0.4) return 'negative';
        return 'neutral';
    }

    analyzeComplexity(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.split(/\s+/);
        const avgWordsPerSentence = words.length / sentences.length;
        const avgCharsPerWord = content.length / words.length;

        let complexity = 'simple';
        if (avgWordsPerSentence > 20 && avgCharsPerWord > 6) complexity = 'complex';
        else if (avgWordsPerSentence > 15 || avgCharsPerWord > 5) complexity = 'moderate';

        return {
            level: complexity,
            avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
            avgCharsPerWord: Math.round(avgCharsPerWord * 10) / 10
        };
    }

    analyzeStructure(content) {
        const lines = content.split('\n');
        const structure = {
            totalLines: lines.length,
            emptyLines: lines.filter(line => line.trim() === '').length,
            codeBlocks: (content.match(/```[\s\S]*?```/g) || []).length,
            headings: (content.match(/^#+\s/gm) || []).length,
            lists: (content.match(/^\s*[-*+]\s/gm) || []).length,
            links: (content.match(/\[.*?\]\(.*?\)/g) || []).length
        };

        return structure;
    }

    async processUrl(url, options = {}) {
        try {
            const fetch = await import('node-fetch');
            const response = await fetch.default(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            
            if (contentType.includes('text/html')) {
                const html = await response.text();
                const cheerio = await import('cheerio');
                const $ = cheerio.load(html);
                
                // Extract text content
                $('script, style, nav, header, footer').remove();
                const textContent = $('body').text().replace(/\s+/g, ' ').trim();
                
                return {
                    url,
                    title: $('title').text() || '',
                    content: textContent,
                    type: 'html',
                    extracted: new Date()
                };
            } else if (contentType.includes('application/json')) {
                const json = await response.json();
                return {
                    url,
                    content: JSON.stringify(json, null, 2),
                    type: 'json',
                    extracted: new Date()
                };
            } else {
                const text = await response.text();
                return {
                    url,
                    content: text,
                    type: 'text',
                    extracted: new Date()
                };
            }
        } catch (error) {
            throw new Error(`Failed to process URL: ${error.message}`);
        }
    }

    async deleteFile(fileId) {
        const files = await fs.readdir(this.uploadDir);
        const targetFile = files.find(file => file.startsWith(fileId));
        
        if (!targetFile) {
            throw new Error('File not found');
        }

        await fs.unlink(path.join(this.uploadDir, targetFile));
    }

    async listFiles() {
        const files = await fs.readdir(this.uploadDir);
        const fileList = [];

        for (const filename of files) {
            try {
                const filePath = path.join(this.uploadDir, filename);
                const stats = await fs.stat(filePath);
                const id = filename.split('-')[0];
                
                fileList.push({
                    id,
                    filename,
                    originalName: filename.substring(37), // Remove UUID prefix
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    type: path.extname(filename).slice(1).toLowerCase()
                });
            } catch (error) {
                console.error(`Error reading file ${filename}:`, error);
            }
        }

        return fileList.sort((a, b) => new Date(b.created) - new Date(a.created));
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
    }

    // Cleanup old files
    async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const files = await fs.readdir(this.uploadDir);
        const cutoff = new Date(Date.now() - maxAge);
        let cleaned = 0;

        for (const filename of files) {
            try {
                const filePath = path.join(this.uploadDir, filename);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoff) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            } catch (error) {
                console.error(`Error cleaning file ${filename}:`, error);
            }
        }

        return cleaned;
    }
}

const fileService = new FileService();
export { fileService };