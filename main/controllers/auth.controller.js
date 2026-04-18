import { login, register } from '../services/auth.service.js';

// Login
export const loginUser = async (req, res) => {
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

// Register
export const registerUser = async (req, res) => {
  try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
