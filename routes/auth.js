const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const auth = require('../middleware/auth');

// Helper to run database queries with Promises
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // 'this' contains lastID and changes
    });
  });
};

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_in_production';

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Simple validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Please enter all fields (username, email, password).' });
  }

  // Regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check for existing user by username or email
    const existingUser = await dbGet(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ error: 'Email is already registered.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user to DB
    const result = await dbRun(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    const userId = result.lastID;

    // Generate JWT token
    const payload = {
      id: userId,
      username,
      email
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          message: 'User registered successfully!',
          token,
          user: {
            id: userId,
            username,
            email
          }
        });
      }
    );

  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Server error during registration. Please try again.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { identity, password } = req.body; // identity can be username or email

  if (!identity || !password) {
    return res.status(400).json({ error: 'Please enter all fields (identity, password).' });
  }

  try {
    // Fetch user by username OR email
    const user = await dbGet(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [identity, identity]
    );

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials. User does not exist.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    // Generate JWT token
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          message: 'Login successful!',
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        });
      }
    );

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login. Please try again.' });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ error: 'Server error fetching profile details.' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile details
// @access  Private
router.put('/profile', auth, async (req, res) => {
  const { username, email, password, newPassword } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email cannot be empty.' });
  }

  // Regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  try {
    // 1. Fetch current user data from database (including password hash to check authorization)
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // 2. Validate current password if updating password or username/email
    if (!password) {
      return res.status(400).json({ error: 'Please provide your current password to authorize profile changes.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid authorization. Current password does not match.' });
    }

    // 3. If username or email is changing, verify they are unique
    if (username !== user.username || email !== user.email) {
      const conflictUser = await dbGet(
        'SELECT id, username, email FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username, email, req.user.id]
      );

      if (conflictUser) {
        if (conflictUser.username.toLowerCase() === username.toLowerCase()) {
          return res.status(400).json({ error: 'Username is already taken.' });
        }
        if (conflictUser.email.toLowerCase() === email.toLowerCase()) {
          return res.status(400).json({ error: 'Email is already registered by another user.' });
        }
      }
    }

    // 4. Handle password change if requested
    let finalPasswordHash = user.password;
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      finalPasswordHash = await bcrypt.hash(newPassword, salt);
    }

    // 5. Update user fields
    await dbRun(
      'UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?',
      [username, email, finalPasswordHash, req.user.id]
    );

    // 6. Generate a new token with updated information
    const payload = {
      id: req.user.id,
      username,
      email
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          message: 'Profile updated successfully!',
          token,
          user: {
            id: req.user.id,
            username,
            email
          }
        });
      }
    );

  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Server error during profile update.' });
  }
});

// @route   DELETE /api/auth/profile
// @desc    Delete user account
// @access  Private
router.delete('/profile', auth, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Please provide your current password to authorize account deletion.' });
  }

  try {
    // Verify user exists and credentials match
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid authorization. Incorrect password.' });
    }

    // Delete user from DB
    await dbRun('DELETE FROM users WHERE id = ?', [req.user.id]);

    res.json({ message: 'User account deleted successfully.' });
  } catch (err) {
    console.error('Account deletion error:', err.message);
    res.status(500).json({ error: 'Server error during account deletion.' });
  }
});

module.exports = router;
