const db = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

async function authRoutes(fastify, options) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { username, email, password } = request.body;

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'Username, email, and password are required' });
    }

    try {
      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return reply.code(409).send({ error: 'Username or email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const result = await db.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, passwordHash]
      );      const user = result.rows[0];

      // Create JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Set cookie
      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return { user: { id: user.id, username: user.username, email: user.email } };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to create user' });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    try {
      // Find user
      const result = await db.query(
        'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }      // Create JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Set cookie
      reply.setCookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return { user: { id: user.id, username: user.username, email: user.email } };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Login failed' });
    }
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('auth_token');
    return { success: true };
  });  // Get current user
  fastify.get('/me', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    return { user: request.user };
  });  // Check auth status (no auth required - for preventing redirect loops)
  fastify.get('/check', async (request, reply) => {
    try {
      const token = request.cookies.auth_token;
      
      if (!token) {
        return reply.code(401).send({ authenticated: false });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      
      const result = await db.query(
        'SELECT id, username, email FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ authenticated: false });
      }

      return { authenticated: true, user: result.rows[0] };
    } catch (error) {
      return reply.code(401).send({ authenticated: false });
    }
  });
}

module.exports = authRoutes;
