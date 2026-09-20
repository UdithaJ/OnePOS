import User from '../models/user.js';
import roleConstants from '../constants/roles.js';

const { HIDDEN_ROLES } = roleConstants;

const PUBLIC_FIELDS = '-password';

// The built-in sysadmin account is not part of the staff list: it is
// infrastructure, not a person, and showing it only invites someone to edit or
// delete the account that exists to recover access.
const VISIBLE = { userRole: { $nin: HIDDEN_ROLES } };

function hiddenUserError() {
  const err = new Error('This account is managed by the system and cannot be changed here.');
  err.status = 403;
  return err;
}

export async function listUsers() {
  return await User.find(VISIBLE).select(PUBLIC_FIELDS);
}

const USER_SORTABLE = new Set(['firstName', 'lastName', 'userName', 'userRole']);

export async function listUsersPaginated({ page = 1, limit = 10, sort = 'firstName', order = 'asc' } = {}) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.max(1, parseInt(limit) || 10);
  const field = USER_SORTABLE.has(sort) ? sort : 'firstName';
  const dir = order === 'desc' ? -1 : 1;
  const [items, total] = await Promise.all([
    User.find(VISIBLE).select(PUBLIC_FIELDS).sort({ [field]: dir }).skip((p - 1) * l).limit(l).lean(),
    User.countDocuments(VISIBLE),
  ]);
  return { items, total, page: p, limit: l };
}

export async function getUserById(id) {
  return await User.findById(id).select(PUBLIC_FIELDS);
}

export async function createUser({ firstName, lastName, userName, password, userRole }) {
  if (await User.findOne({ userName })) {
    throw new Error('Username already exists');
  }
  // Nobody creates a second built-in account through the API.
  if (HIDDEN_ROLES.includes(userRole)) throw hiddenUserError();

  const user = new User({ firstName, lastName, userName, password, userRole });
  await user.save();

  return sanitize(user);
}

export async function updateUser(id, updates) {
  const user = await User.findById(id);
  if (!user) return null;
  if (HIDDEN_ROLES.includes(user.userRole)) throw hiddenUserError();
  if (updates.userRole !== undefined && HIDDEN_ROLES.includes(updates.userRole)) throw hiddenUserError();

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
  const user = await User.findById(id);
  if (!user) return null;
  if (HIDDEN_ROLES.includes(user.userRole)) throw hiddenUserError();
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
