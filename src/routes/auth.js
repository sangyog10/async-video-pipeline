const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const DB = require('../DB');
const { generateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('name')
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters')
];

const validateLogin = [
  body('username')
    .notEmpty()
    .withMessage('Username is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Register new user
router.post('/register', validateRegistration, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, email, password, name } = req.body;

  // Check if user already exists
  DB.update();
  const existingUser = DB.users.find(user => 
    user.username === username || user.email === email
  );

  if (existingUser) {
    return res.status(400).json({
      error: 'User already exists with this username or email'
    });
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create new user
  const newUser = {
    id: DB.users.length > 0 ? Math.max(...DB.users.map(u => u.id)) + 1 : 1,
    username,
    email,
    password: hashedPassword,
    name,
    createdAt: new Date().toISOString()
  };

  DB.users.push(newUser);
  DB.save();

  // Generate token
  const token = generateToken(newUser.id);

  // Remove password from response
  const { password: _, ...userResponse } = newUser;

  res.status(201).json({
    message: 'User registered successfully',
    user: userResponse,
    token
  });
}));

// Login user
router.post('/login', validateLogin, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Find user
  DB.update();
  const user = DB.users.find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate token
  const token = generateToken(user.id);

  // For backward compatibility, also set cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Remove password from response
  const { password: _, ...userResponse } = user;

  res.json({
    message: 'Logged in successfully',
    user: userResponse,
    token
  });
}));

// Logout user
router.post('/logout', (req, res) => {
  // Clear cookie
  res.clearCookie('token');
  
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;