const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const cors = require('cors');

// Email configuration - FIXED VERSION
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS  // Use App Password, not regular password
    },
    // FIX for SSL certificate issues
    tls: {
      rejectUnauthorized: false  // Allow self-signed certificates
    },
    // Alternative fix - use secure connection
    secure: true,
    port: 465
  });
};

// Alternative configuration using direct SMTP settings
const createTransporterAlternative = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
};

// Validation middleware
const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  
  // Name validation
  if (name.trim().length < 2) {
    return res.status(400).json({ message: 'Name must be at least 3 characters long' });
  }
  
  if (name.trim().length > 50) {
    return res.status(400).json({ message: 'Name must be less than 50 characters' });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  
  // Password validation
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  next();
};

const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  
  next();
};

// Register route
router.post('/register', cors(), validateRegister, async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    console.log('Received registration request for:', email);
    
    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
    user = new User({ 
      name: name.trim(),
      email: email.toLowerCase(), 
      password: await bcrypt.hash(password, 12)
    });
    
    await user.save();

    res.status(201).json({ 
      message: 'User registered successfully',
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Login route
router.post('/login', cors(), validateLogin, async (req, res) => {
  const { email, password } = req.body;
  
  try {
    console.log('Received login request for:', email);
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Forgot Password route - ENHANCED ERROR HANDLING
router.post('/forgot-password', cors(), validateEmail, async (req, res) => {
  const { email } = req.body;
  
  try {
    console.log('Received forgot password request for:', email);
    
    // Find user by email
    // Using findOneAndUpdate to update the token and expiry directly
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { 
        passwordResetToken: resetToken,
        passwordResetExpires: resetTokenExpiry
      },
      { new: true } // Return the updated document
    );

    if (!user) {
      return res.status(404).json({ 
        message: 'Account doesn\'t exist with this email. Please register first.' 
      });
    }

    // Check if email service is enabled
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email service not configured. Reset token:', resetToken);
      return res.json({ 
        message: 'Email service not configured. Please contact admin.',
        resetToken: resetToken // Only for development - remove in production
      });
    }

    // Create reset URL
    // Use environment variable for client base URL, fallback to localhost for development
    const clientBaseUrl = process.env.CLIENT_BASE_URL || 'https://finance-tracker-backend-w5uu.onrender.com';
    const resetUrl = `${clientBaseUrl}?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request - Finance Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color:rgba(59, 246, 59, 0.84); margin-bottom: 10px;">Finance Tracker</h1>
            <h2 style="color: #374151; margin-top: 0;">Password Reset Request</h2>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #374151; margin-bottom: 15px;">Hello,</p>
            <p style="color: #374151; margin-bottom: 15px;">
              We received a request to reset the password for your Finance Tracker account associated with <strong>${email}</strong>.
            </p>
            <p style="color: #374151; margin-bottom: 20px;">
              Click the button below to reset your password. This link will expire in 1 hour for security reasons.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color:rgb(59, 246, 59); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              <strong>Security Note:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              This link will expire in 1 hour for your security.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">
              © 2025 Finance Tracker. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    try {
      // Try primary transporter first
      const transporter = createTransporter();
      await transporter.sendMail(mailOptions);
      
      res.json({ 
        message: 'Password reset email sent successfully. Please check your inbox.' 
      });
      
    } catch (emailError) {
      console.log('Primary email method failed, trying alternative...');
      
      try {
        // Try alternative transporter
        const altTransporter = createTransporterAlternative();
        await altTransporter.sendMail(mailOptions);
        
        res.json({ 
          message: 'Password reset email sent successfully. Please check your inbox.' 
        });
        
      } catch (altEmailError) {
        console.error('Both email methods failed:', altEmailError);
        
        // For development - return the token directly
        if (process.env.NODE_ENV === 'development') {
          res.json({ 
            message: 'Email service unavailable. Use this reset token for testing.',
            resetToken: resetToken,
            resetUrl: resetUrl
          });
        } else {
          res.status(500).json({ 
            message: 'Unable to send reset email. Please try again later.' 
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Reset Password route
router.post('/reset-password', cors(), async (req, res) => {
  const { email, token, newPassword } = req.body;

  try {
    console.log('Received reset password request for:', email);

    // Validation
    if (!email || !token || !newPassword) {
      return res.status(400).json({ 
        message: 'Email, token, and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Find user with valid reset token and update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const user = await User.findOneAndUpdate(
      {
        email: email.toLowerCase(),
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      },
      { 
        password: hashedPassword,
        passwordResetToken: undefined,
        passwordResetExpires: undefined
      },
      { new: true } // Return the updated document
    );

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired reset token. Please request a new password reset.' 
      });
    }

    res.json({ 
      message: 'Password reset successfully. You can now login with your new password.' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Token validation route
router.get('/verify', cors(), require('../middleware/authMiddleware'), async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile route
router.put('/api/user/update', cors(), require('../middleware/authMiddleware'), async (req, res) => {
    try {
        const { name } = req.body;
        
        // Validate name
        if (!name || name.trim().length < 2 || name.trim().length > 50) {
            return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
        }

        // Update user in database
        const user = await User.findByIdAndUpdate(
            req.user,
            { name: name.trim() },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

module.exports = router;