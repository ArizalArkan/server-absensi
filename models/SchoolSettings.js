// src/models/SchoolSettings.js
const mongoose = require('mongoose');

const schoolSettingsSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    default: 'My School',
  },
  schoolLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  attendanceRadius: {
    type: Number, // in kilometers
    default: 1,   // 1 km by default
  },
  startTime: {
    type: String, // e.g. "08:00"
  },
  endTime: {
    type: String, // e.g. "09:00"
  },
}, { timestamps: true });

schoolSettingsSchema.index({ schoolLocation: '2dsphere' });

module.exports = mongoose.model('SchoolSettings', schoolSettingsSchema);
