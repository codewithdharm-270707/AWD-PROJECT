
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// --- ENVIRONMENT VARIABLES ---
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!JWT_SECRET) {
  console.error('JWT_SECRET environment variable is missing');
}

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is missing');
}

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- HOME ROUTE ---
app.get('/', (req, res) => {
  res.json({
    message: 'AWD-PROJECT Backend is running successfully!',
    status: 'OK'
  });
});

// --- MONGODB CONNECTION ---
let dbConnectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!dbConnectionPromise) {
    dbConnectionPromise = mongoose.connect(MONGODB_URI)
      .then(() => {
        console.log('MongoDB Atlas Connected');
      })
      .catch((error) => {
        dbConnectionPromise = null;
        throw error;
      });
  }

  await dbConnectionPromise;
}

// Ensure database is connected before API requests.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    res.status(503).json({
      message: 'Database connection failed'
    });
  }
});

// --- USER SCHEMA & MODEL ---
const userSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: String,
  age: Number,
  gender: String,
  course: String,
  time_slot: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

const User = mongoose.models.User ||
  mongoose.model('User', userSchema);

// --- JWT AUTHENTICATION ---
const auth = (req, res, next) => {
  if (!JWT_SECRET) {
    return res.status(500).json({
      message: 'Server authentication is not configured'
    });
  }

  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: 'No token, authorization denied'
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Token is invalid or expired'
    });
  }
};

// --- ADMIN AUTHORIZATION ---
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      message: 'Access denied: Admin rights required'
    });
  }

  next();
};

// --- REGISTER ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      age,
      gender,
      course,
      time_slot
    } = req.body;

    if (
      typeof full_name !== 'string' ||
      !full_name.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: 'Name and email are required; password must be at least 8 characters'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      full_name: full_name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      age,
      gender,
      course,
      time_slot,
      role: 'user'
    });

    if (!JWT_SECRET) {
      return res.status(500).json({
        message: 'Server authentication is not configured'
      });
    }

    const token = jwt.sign(
      {
        id: newUser._id.toString(),
        role: newUser.role
      },
      JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    const user = newUser.toObject();
    delete user.password;

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user
    });
  } catch (error) {
    console.error('Registration Error:', error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email already registered'
      });
    }

    return res.status(500).json({
      message: 'Registration failed'
    });
  }
});

// --- LOGIN ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({
        message: 'Server authentication is not configured'
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role
      },
      JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Login Error:', error.message);

    return res.status(500).json({
      message: 'Login failed'
    });
  }
});

// --- GET LOGGED-IN USER PROFILE ---
app.get('/api/user/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({
      message: 'Server error'
    });
  }
});

// --- UPDATE LOGGED-IN USER PROFILE ---
app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      age,
      gender,
      course,
      time_slot
    } = req.body;

    const updates = {};

    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (gender !== undefined) updates.gender = gender;
    if (course !== undefined) updates.course = course;
    if (time_slot !== undefined) updates.time_slot = time_slot;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update profile'
    });
  }
});

// --- PUBLIC STUDENT LIST FOR AUTHENTICATED USERS ---
app.get('/api/users/list', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('full_name course time_slot');

    return res.json(users);
  } catch (error) {
    return res.status(500).json({
      message: 'Server error fetching user list'
    });
  }
});

// --- ADMIN: GET ALL USERS ---
app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    return res.json(users);
  } catch (error) {
    return res.status(500).json({
      message: 'Server error fetching all users'
    });
  }
});

// --- ADMIN: UPDATE USER ---
app.put('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const allowedFields = [
      'full_name',
      'email',
      'phone',
      'age',
      'gender',
      'course',
      'time_slot',
      'role'
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.email) {
      updates.email = updates.email.trim().toLowerCase();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update user'
    });
  }
});

// --- ADMIN: DELETE USER ---
app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete user'
    });
  }
});

// --- 404 HANDLER ---
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.path
  });
});

// --- LOCAL SERVER & VERCEL EXPORT ---
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
