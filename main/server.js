// main/server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Routes

import authRoutes from './routes/auth.route.js';
import customerRoutes from './routes/customer.route.js';
import orderRoutes from './routes/order.route.js';


const app = express();
// Increase body size limits to support base64 images in JSON payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// Mount routes

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);

// __dirname replacement in ES modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine whether the app is packaged
// Adjust this logic depending on your Electron packaging
const isPackaged = process.argv[0].includes('MyApp.exe');

// Path for production build:
const prodEnv = path.join(process.resourcesPath || __dirname, '.env');

// Path for development:
const devEnv = path.join(process.cwd(), '.env');

// Decide which .env file to load
const envPath = fs.existsSync(prodEnv) ? prodEnv : devEnv;
console.log("Loading .env from:", envPath);

dotenv.config({ path: envPath });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
