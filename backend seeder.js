// backend/seeder.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// --- Schemas ---
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
const User = mongoose.model('User', UserSchema);

const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  qrCodeData: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Attendance = mongoose.model('Attendance', AttendanceSchema);

const dbUri = process.env.MONGO_URI;

// --- Seeder Function ---
async function seed() {
  await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });

  await User.deleteMany({});
  await Attendance.deleteMany({});

  // Seed Users
  const users = [
    { username: 'student1', password: 'pass123', role: 'student' },
    { username: 'student2', password: 'pass123', role: 'student' },
    { username: 'admin', password: 'admin123', role: 'admin' }
  ];

  const savedUsers = [];
  for (const userData of users) {
    const user = new User(userData);
    await user.save();
    savedUsers.push(user);
  }

  // Seed Attendance
  const attendances = [
    {
      studentId: savedUsers[0]._id,
      qrCodeData: 'KABARAK2025',
      timestamp: new Date()
    },
    {
      studentId: savedUsers[1]._id,
      qrCodeData: 'KABARAK2025',
      timestamp: new Date(Date.now() - 86400000)
    }
  ];

  for (const attendanceData of attendances) {
    const att = new Attendance(attendanceData);
    await att.save();
  }

  console.log('Database seeded!');
  mongoose.disconnect();
}

seed();
