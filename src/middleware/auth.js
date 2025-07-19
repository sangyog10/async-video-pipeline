const jwt = require('jsonwebtoken');
const DB = require('../DB');

// JWT Secret - In production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Also check for token in cookies for backward compatibility
  const cookieToken = req.headers.cookie && 
    req.headers.cookie.split(';').find(c => c.trim().startsWith('token='));
  
  const finalToken = token || (cookieToken && cookieToken.split('=')[1]);

  if (!finalToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(finalToken);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Verify user still exists
  DB.update();
  const user = DB.users.find(u => u.id === decoded.userId);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  req.userId = decoded.userId;
  req.user = user;
  next();
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      DB.update();
      const user = DB.users.find(u => u.id === decoded.userId);
      if (user) {
        req.userId = decoded.userId;
        req.user = user;
      }
    }
  }
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  JWT_SECRET
};