import User from '../models/user.js';

const PUBLIC_FIELDS = '-password';

export async function listUsers() {
  return await User.find().select(PUBLIC_FIELDS);
}

export async function getUserById(id) {
  return await User.findById(id).select(PUBLIC_FIELDS);
}

export async function createUser({ firstName, lastName, userName, password, userRole }) {
  if (await User.findOne({ userName })) {
    throw new Error('Username already exists');
  }

  const user = new User({ firstName, lastName, userName, password, userRole });
  await user.save();

  return sanitize(user);
}

export async function updateUser(id, updates) {
  const user = await User.findById(id);
  if (!user) return null;

  if (updates.userName && updates.userName !== user.userName) {
    if (await User.findOne({ userName: updates.userName })) {
      throw new Error('Username already exists');
    }
    user.userName = updates.userName;
  }

  if (updates.firstName !== undefined) user.firstName = updates.firstName;
  if (updates.lastName !== undefined) user.lastName = updates.lastName;
  if (updates.userRole !== undefined) user.userRole = updates.userRole;

  if (updates.password) {
    user.password = updates.password;
  }

  await user.save();
  return sanitize(user);
}

export async function deleteUser(id) {
  return await User.findByIdAndDelete(id);
}

function sanitize(user) {
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    userName: user.userName,
    userRole: user.userRole,
  };
}
