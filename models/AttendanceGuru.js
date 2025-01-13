const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  username: { type: mongoose.Schema.Types.ObjectId, ref: 'UserGuru' }, // Reference to UserSiswa
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  flag: { type: String, enum: ['check-in', 'check-out'], required: true }, // New flag field
  status: { type: String, enum: ['absent', 'present'], default: 'present' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

attendanceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('AttendanceGuru', attendanceSchema);
