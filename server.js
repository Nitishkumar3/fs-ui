require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const path = require('path');

// Register plugins
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'static'),
  prefix: '/',
});

fastify.register(require('@fastify/cors'), {
  origin: true
});

fastify.register(require('@fastify/multipart'), {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  }
});

fastify.register(require('@fastify/cookie'), {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
});

// Register authentication middleware
const { authenticate, requireAuth } = require('./middleware/auth');
fastify.decorate('authenticate', authenticate);
fastify.decorate('requireAuth', requireAuth);

// Import routes
const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');
const foldersRoutes = require('./routes/folders');

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(filesRoutes, { prefix: '/api' });
fastify.register(foldersRoutes, { prefix: '/api' });

// Serve the main app (with auth check)
fastify.get('/', async (request, reply) => {  try {
    const token = request.cookies.auth_token;
    
    if (!token) {
      return reply.redirect('/login.html');
    }

    const jwt = require('jsonwebtoken');
    const db = require('./database/db');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user exists in database
    const result = await db.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return reply.redirect('/login.html');
    }

    return reply.sendFile('index.html');
  } catch (error) {
    return reply.redirect('/login.html');
  }
});

// Serve login page
fastify.get('/login.html', async (request, reply) => {
  return reply.sendFile('login.html');
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
