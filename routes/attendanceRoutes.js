// src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const Attendance = require('../models/AttendanceSiswa');
const SchoolSettings = require('../models/SchoolSettings');
const auth = require('../middleware/auth');
const UserSiswa = require('../models/UserSiswa');
const multer = require('multer');

// Multer setup (stores in local 'uploads/' folder)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // you need to create this folder
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Helper function to calculate distance in kilometers (Haversine formula)
function getDistanceFromLatLonInKm(lon1, lat1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// @route  POST /api/attendances
// @desc   Mark attendance
// @access Private (student/teacher)
router.post('/', auth, upload.single('photo'), async (req, res) => {
    try {
        const { username, latitude, longitude } = req.body;

        // Get school settings (assuming only one settings doc)
        const schoolSettings = await SchoolSettings.findOne({});
        if (!schoolSettings) {
            return res.status(400).json({ msg: 'School settings not configured' });
        }

        const [schoolLon, schoolLat] = schoolSettings.schoolLocation.coordinates;

        // Distance check
        const distance = getDistanceFromLatLonInKm(
            parseFloat(latitude),  // Correct (user’s latitude)
            parseFloat(longitude), // Correct (user’s longitude)
            schoolLat,
            schoolLon
        );

        if (distance > schoolSettings.attendanceRadius) {
            return res.status(400).json({ msg: 'You are not within the allowed radius' });
        }

        // Save attendance
        const user = await UserSiswa.findOne({ username });
        if (!user) throw new Error('User not found');

        // Create a new attendance record
        const newAttendance = new Attendance({
            username: user._id, // Use ObjectId reference
            location: {
                type: 'Point',
                coordinates: [parseFloat(latitude), parseFloat(longitude)],
            },
            imageUrl: req.file.path,
            status: 'pending',
        });

        await newAttendance.save();

        // Populate the username field in the response
        const populatedAttendance = await Attendance.findById(newAttendance._id).populate('username', 'username');

        res.json({ msg: 'Attendance marked successfully', attendance: populatedAttendance });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route  GET /api/attendances
// @desc   Get all attendances (for admin or teacher maybe)
// @access Private
router.get('/', auth, async (req, res) => {
    try {
        const attendances = await Attendance.find()
            .populate('username', 'username') // Replace ObjectId with username field
            .exec();

        res.json(attendances);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// @route  PUT /api/attendances/:id/confirm
// @desc   Confirm or reject attendance
// @access Private (admin or teacher)
router.put('/:id/confirm', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ msg: 'Not authorized' });
        }
        const { status } = req.body; // "confirmed" or "rejected"

        const attendance = await Attendance.findById(req.params.id);
        if (!attendance) return res.status(404).json({ msg: 'Attendance not found' });

        attendance.status = status;
        await attendance.save();

        res.json({ msg: 'Attendance status updated', attendance });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
