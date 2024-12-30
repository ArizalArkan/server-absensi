const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  username: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSiswa',
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  location: {
    // store location as GeoJSON (if you want to do geospatial queries)
    type: {
      type: String, 
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  imageUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

attendanceSchema.index({ location: '2dsphere' }); // for geospatial queries

module.exports = mongoose.model('Attendance', attendanceSchema);
