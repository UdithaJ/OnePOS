import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  userName: { type: String, required: true, unique: true },
  userRole: { type: String, required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: false },
  referenceNo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Base64 (no data URL prefix) or full data URL string of profile image
  profileImage: { type: String, required: false },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
