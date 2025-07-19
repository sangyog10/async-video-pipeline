const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const DB = require('../DB');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware for user updates
const validateUserUpdate = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters')
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

// Get current user info
router.get('/', (req, res) => {
  const { password, ...userInfo } = req.user;
  res.json(userInfo);
});

// Update user info
router.put('/', validateUserUpdate, handleValidationErrors, asyncHandler(async (req, res) => {
  const { username, email, password, name } = req.body;

  DB.update();
  const user = DB.users.find(u => u.id === req.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if username or email is already taken by another user
  if (username && username !== user.username) {
    const existingUser = DB.users.find(u => u.username === username && u.id !== req.userId);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    user.username = username;
  }

  if (email && email !== user.email) {
    const existingUser = DB.users.find(u => u.email === email && u.id !== req.userId);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already taken' });
    }
    user.email = email;
  }

  if (name) {
    user.name = name;
  }

  // Hash new password if provided
  if (password) {
    const saltRounds = 12;
    user.password = await bcrypt.hash(password, saltRounds);
  }

  user.updatedAt = new Date().toISOString();

  DB.save();

  // Remove password from response
  const { password: _, ...userResponse } = user;

  res.json({
    message: 'User updated successfully',
    user: userResponse
  });
}));

// Delete user account
router.delete('/', asyncHandler(async (req, res) => {
  DB.update();
  
  // Remove user
  const userIndex = DB.users.findIndex(u => u.id === req.userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  DB.users.splice(userIndex, 1);

  // Remove user's sessions
  DB.sessions = DB.sessions.filter(session => session.userId !== req.userId);

  // Remove user's videos
  DB.videos = DB.videos.filter(video => video.userId !== req.userId);

  DB.save();

  res.json({ message: 'User account deleted successfully' });
}));

module.exports = router;