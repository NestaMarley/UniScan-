// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');
const Attendance = require('./models/Attendance');

const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// --- User Model ---
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

mongoose.model('User', UserSchema);

// --- Attendance Model ---
const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  qrCodeData: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

mongoose.model('Attendance', AttendanceSchema);

const UserModel = mongoose.model('User');
const AttendanceModel = mongoose.model('Attendance');

// --- Auth Middleware ---
const auth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Auth Routes ---
app.post('/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const user = await UserModel.create({ username, password, role });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await UserModel.findOne({ username });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Attendance Routes ---
app.post('/attendance', auth, async (req, res) => {
  const { qrCodeData } = req.body;
  const studentId = req.user.id;
  try {
    // Prevent duplicate attendance for the day
    const today = new Date();
    today.setHours(0,0,0,0);
    const alreadyMarked = await AttendanceModel.findOne({
      studentId,
      qrCodeData,
      timestamp: { $gte: today }
    });
    if (alreadyMarked) return res.status(400).json({ error: 'Attendance already marked today.' });

    const attendance = new AttendanceModel({ studentId, qrCodeData });
    await attendance.save();
    res.status(200).json({ message: 'Attendance validated and saved!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/attendance/:id', auth, async (req, res) => {
  try {
    const records = await AttendanceModel.find({ studentId: req.params.id }).sort({ timestamp: -1 });
    res.json(records);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('UniScan backend is running!'));

// --- Connect DB and Start ---
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

app.listen(3000, () => console.log('Backend running on port 3000'));
