import express from 'express';
import User from '../models/user.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, userName, userRole, referenceNo, password, profileImage } = req.body;

    // Check if userName exists
    const existingUserName = await User.findOne({ userName });
    if (existingUserName) {
      return res.status(400).json({ message: 'User Name is already taken' });
    }

    // Check if referenceNo exists
    const existingRef = await User.findOne({ referenceNo });
    if (existingRef) {
      return res.status(400).json({ message: 'Reference number already exists' });
    }

    const newUser = new User({ firstName, lastName, userName, userRole, referenceNo, password, profileImage });
    await newUser.save();

    res.json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { userName, password } = req.body;

    // Find user by userName
    const user = await User.findOne({ userName });
    if (!user) {
      return res.status(400).json({ message: 'Invalid user name or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid user name or password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        referenceNo: user.referenceNo,
        userRole: user.userRole,
        profileImage: user.profileImage || null
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matches = await user.comparePassword(currentPassword);
    if (!matches) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword; // pre-save hook will hash
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    // Extract query parameters for pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // default 10
    const skip = (page - 1) * limit;

    // Support exclude query param: /users?exclude=profileImage
    const excludeFields = req.query.exclude ? req.query.exclude.split(',') : [];
    let selectFields = '-password'; // always exclude password
    
    if (excludeFields.length > 0) {
      excludeFields.forEach(field => {
        selectFields += ` -${field}`;
      });
    }

    // Count total documents for pagination metadata
    const totalCount = await User.countDocuments();
    
    const users = await User.find()
      .select(selectFields)
      .sort({ firstName: 1, _id: 1 }) // Sort by firstName ASC, then _id ASC for stable pagination
      .skip(skip)
      .limit(limit);
    
    res.json({
      users,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user by ID
router.put('/users/:id', async (req, res) => {
  try {
    const { firstName, lastName, userName, profileImage, userRole, section, referenceNo, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if new userName is already taken by another user
    if (userName && userName !== user.userName) {
      const existingUserName = await User.findOne({ userName });
      if (existingUserName) {
        return res.status(400).json({ message: 'User Name is already taken' });
      }
      user.userName = userName;
    }

    // Check if new referenceNo is already taken by another user
    if (referenceNo && referenceNo !== user.referenceNo) {
      const existingRef = await User.findOne({ referenceNo });
      if (existingRef) {
        return res.status(400).json({ message: 'Reference number already exists' });
      }
      user.referenceNo = referenceNo;
    }

    if (firstName) user.firstName = firstName;
    if (userRole) user.userRole = userRole;
    if (section) user.section = section;
    if (lastName) user.lastName = lastName;
    if (password) user.password = password; // pre-save hook will hash it
    if (profileImage !== undefined) {
      user.profileImage = profileImage === '' ? undefined : profileImage;
    }

    await user.save();
    res.json({ message: 'User updated successfully', user: user.toObject({ getters: true, versionKey: false }) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
