// auth.service.js
import User from '../models/user.js';
import roleConstants from '../constants/roles.js';

const { ASSIGNABLE_ROLES } = roleConstants;

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
  // This endpoint takes no credentials, so it must never be able to hand out a
  // privileged role. Without this, anyone who can reach the API could register
  // themselves as sysadmin and from there run upgrade scripts against every
  // collection. Staff accounts are created from the Users screen, which goes
  // through users.service and applies the same restriction.
  if (!ASSIGNABLE_ROLES.includes(userRole)) {
    const err = new Error(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`);
    err.status = 403;
    throw err;
  }

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
