// src/routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const SchoolSettings = require('../models/SchoolSettings');
const auth = require('../middleware/auth');

// @route  GET /api/settings
// @desc   Get school settings
router.get('/', async (req, res) => {
  try {
    const settings = await SchoolSettings.findOne({});
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route  POST /api/settings
// @desc   Create or update school settings
// @access Private (admin)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    const { schoolName, schoolLocation, attendanceRadius, startTime, endTime } = req.body;
    
    let settings = await SchoolSettings.findOne({});
    if (!settings) {
      // create new
      settings = new SchoolSettings({
        schoolName,
        schoolLocation,
        attendanceRadius,
        startTime,
        endTime
      });
    } else {
      // update existing
      settings.schoolName = schoolName || settings.schoolName;
      settings.schoolLocation = schoolLocation || settings.schoolLocation;
      settings.attendanceRadius = attendanceRadius || settings.attendanceRadius;
      settings.startTime = startTime || settings.startTime;
      settings.endTime = endTime || settings.endTime;
    }
    await settings.save();
    
    res.json({ msg: 'Settings updated successfully', settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
