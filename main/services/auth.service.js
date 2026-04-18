// auth.service.js
import User from '../models/user.js';

export async function login({ userName, password }) {
  const user = await User.findOne({ userName });
  if (!user) throw new Error('Invalid username or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Invalid username or password');

  return {
    user: {
      _id: user._id,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      userRole: user.userRole,
    }
  };
}

export async function register({ firstName, lastName, userName, password, userRole }) {
  const existing = await User.findOne({ userName });
  if (existing) throw new Error('Username already exists');

  const user = new User({ firstName, lastName, userName, password, userRole });
  await user.save();

  return {
    user: {
      _id: user._id,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      userRole: user.userRole,
    }
  };
}
