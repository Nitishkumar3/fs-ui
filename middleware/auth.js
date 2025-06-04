const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authenticate = async (request, reply) => {
  try {
    const token = request.cookies.auth_token;

    if (!token) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const result = await db.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'User not found' });
    }

    request.user = result.rows[0];
    request.userId = result.rows[0].id;
  } catch (error) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
};

// Use the same logic for both functions to avoid duplication
const requireAuth = authenticate;

module.exports = {
  authenticate,
  requireAuth
};
