import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';

class AuthService {
    constructor() {
        this.router = express.Router();
        this.users = new Map();
        this.sessions = new NodeCache({ stdTTL: 86400 }); // 24 hours
        this.setupRoutes();
        this.setupDefaultAdmin();
        
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    }

    setupDefaultAdmin() {
        // Create default admin user
        const defaultAdmin = {
            id: uuidv4(),
            username: 'admin',
            email: 'admin@localhost',
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj21i8P5oUlS', // admin123
            role: 'admin',
            permissions: ['*'],
            createdAt: new Date(),
            lastLogin: null,
            isActive: true
        };
        
        this.users.set('admin', defaultAdmin);
    }

    setupRoutes() {
        // Register new user
        this.router.post('/register', async (req, res) => {
            try {
                const { username, email, password, role = 'user' } = req.body;
                
                if (!username || !email || !password) {
                    return res.status(400).json({ error: 'Username, email, and password are required' });
                }

                if (this.users.has(username)) {
                    return res.status(409).json({ error: 'Username already exists' });
                }

                const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
                const user = {
                    id: uuidv4(),
                    username,
                    email,
                    password: hashedPassword,
                    role,
                    permissions: this.getDefaultPermissions(role),
                    createdAt: new Date(),
                    lastLogin: null,
                    isActive: true
                };

                this.users.set(username, user);
                
                const token = this.generateToken(user);
                const sessionId = uuidv4();
                this.sessions.set(sessionId, { userId: user.id, username, role });

                res.json({
                    success: true,
                    user: this.sanitizeUser(user),
                    token,
                    sessionId
                });

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Login user
        this.router.post('/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                
                if (!username || !password) {
                    return res.status(400).json({ error: 'Username and password are required' });
                }

                const user = this.users.get(username);
                if (!user || !user.isActive) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                const isValidPassword = await bcrypt.compare(password, user.password);
                if (!isValidPassword) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                user.lastLogin = new Date();
                const token = this.generateToken(user);
                const sessionId = uuidv4();
                this.sessions.set(sessionId, { userId: user.id, username, role: user.role });

                res.json({
                    success: true,
                    user: this.sanitizeUser(user),
                    token,
                    sessionId
                });

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Logout user
        this.router.post('/logout', this.requireAuth, (req, res) => {
            try {
                const sessionId = req.headers['x-session-id'];
                if (sessionId) {
                    this.sessions.del(sessionId);
                }

                res.json({ success: true, message: 'Logged out successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get current user
        this.router.get('/me', this.requireAuth, (req, res) => {
            try {
                const user = this.users.get(req.user.username);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.json({
                    success: true,
                    user: this.sanitizeUser(user)
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Update user profile
        this.router.put('/profile', this.requireAuth, async (req, res) => {
            try {
                const { email, currentPassword, newPassword } = req.body;
                const user = this.users.get(req.user.username);

                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                if (email) user.email = email;

                if (newPassword) {
                    if (!currentPassword) {
                        return res.status(400).json({ error: 'Current password is required' });
                    }

                    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
                    if (!isValidPassword) {
                        return res.status(401).json({ error: 'Current password is incorrect' });
                    }

                    user.password = await bcrypt.hash(newPassword, this.bcryptRounds);
                }

                res.json({
                    success: true,
                    user: this.sanitizeUser(user)
                });

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Admin routes
        this.router.get('/users', this.requireAuth, this.requireRole('admin'), (req, res) => {
            try {
                const users = Array.from(this.users.values()).map(this.sanitizeUser);
                res.json({ success: true, users });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.router.put('/users/:username', this.requireAuth, this.requireRole('admin'), async (req, res) => {
            try {
                const { username } = req.params;
                const { role, isActive, permissions } = req.body;
                
                const user = this.users.get(username);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                if (role) user.role = role;
                if (typeof isActive === 'boolean') user.isActive = isActive;
                if (permissions) user.permissions = permissions;

                res.json({
                    success: true,
                    user: this.sanitizeUser(user)
                });

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Delete user
        this.router.delete('/users/:username', this.requireAuth, this.requireRole('admin'), (req, res) => {
            try {
                const { username } = req.params;
                
                if (username === 'admin') {
                    return res.status(403).json({ error: 'Cannot delete admin user' });
                }

                const deleted = this.users.delete(username);
                if (!deleted) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.json({ success: true, message: 'User deleted successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Verify token
        this.router.post('/verify', (req, res) => {
            try {
                const { token } = req.body;
                
                if (!token) {
                    return res.status(400).json({ error: 'Token is required' });
                }

                const decoded = jwt.verify(token, this.jwtSecret);
                const user = this.users.get(decoded.username);

                if (!user || !user.isActive) {
                    return res.status(401).json({ error: 'Invalid token' });
                }

                res.json({
                    success: true,
                    user: this.sanitizeUser(user),
                    valid: true
                });

            } catch (error) {
                res.status(401).json({ error: 'Invalid token' });
            }
        });
    }

    generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            },
            this.jwtSecret,
            { expiresIn: '24h' }
        );
    }

    sanitizeUser(user) {
        const { password, ...sanitized } = user;
        return sanitized;
    }

    getDefaultPermissions(role) {
        const permissions = {
            'admin': ['*'],
            'user': ['chat', 'files', 'conversations'],
            'guest': ['chat']
        };
        return permissions[role] || permissions['guest'];
    }

    // Middleware functions
    requireAuth = (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

            if (!token) {
                return res.status(401).json({ error: 'Access token required' });
            }

            const decoded = jwt.verify(token, this.jwtSecret);
            const user = this.users.get(decoded.username);

            if (!user || !user.isActive) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            req.user = decoded;
            next();

        } catch (error) {
            res.status(401).json({ error: 'Invalid token' });
        }
    };

    requireRole = (requiredRole) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (req.user.role !== requiredRole && !req.user.permissions.includes('*')) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        };
    };

    requirePermission = (permission) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('*')) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        };
    };

    // Utility methods
    isAuthenticated(req) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) return false;

            const decoded = jwt.verify(token, this.jwtSecret);
            const user = this.users.get(decoded.username);
            
            return user && user.isActive;
        } catch (error) {
            return false;
        }
    }

    hasPermission(req, permission) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) return false;

            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded.permissions.includes(permission) || decoded.permissions.includes('*');
        } catch (error) {
            return false;
        }
    }

    // Get auth stats
    getStats() {
        const totalUsers = this.users.size;
        const activeUsers = Array.from(this.users.values()).filter(u => u.isActive).length;
        const adminUsers = Array.from(this.users.values()).filter(u => u.role === 'admin').length;
        const activeSessions = this.sessions.keys().length;

        return {
            totalUsers,
            activeUsers,
            adminUsers,
            activeSessions,
            sessionStats: this.sessions.getStats()
        };
    }
}

const authService = new AuthService();
export { authService };