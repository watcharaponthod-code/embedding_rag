import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getAuthClient } from '../../utils/db';

const JWT_SECRET = process.env.JWT_SECRET || 'sycapt-super-secret-key-2026';

export class AuthService {
    /**
     * Register a new user
     */
    async signUp(userData: {
        name: string;
        email: string;
        password: string;
        department?: string;
        role?: string;
    }) {
        const client = await getAuthClient();
        try {
            // Check if user exists
            const existing = await client.query('SELECT id FROM "user" WHERE email = $1', [userData.email]);
            if (existing.rows.length > 0) {
                throw new Error('Email already registered');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Derive a default username from email just in case it's needed in the future
            const username = userData.email.split('@')[0];

            // Insert user into sycapt_chatai database
            const result = await client.query(
                `INSERT INTO "user" (name, email, username, password, department, role, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
                 RETURNING id, name, email`,
                [userData.name, userData.email, username, hashedPassword, userData.department || 'General', userData.role || 'user']
            );

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    /**
     * Authenticate user and return token
     */
    async login(identifier: string, password: string) {
        const client = await getAuthClient();
        try {
            // Support login by email OR name (as requested)
            const result = await client.query(
                'SELECT * FROM "user" WHERE email = $1 OR name = $1 OR username = $1',
                [identifier]
            );
            const user = result.rows[0];

            if (!user) {
                throw new Error('User not found');
            }

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                throw new Error('Invalid password');
            }

            // Generate JWT
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    avatar_url: user.avatar_url
                }
            };
        } finally {
            client.release();
        }
    }

    /**
     * Middleware to verify token
     */
    verifyToken(token: string) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Unauthorized');
        }
    }
}

export const authService = new AuthService();
