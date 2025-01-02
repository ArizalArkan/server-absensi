// src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const Attendance = require('../models/AttendanceSiswa');
const SchoolSettings = require('../models/SchoolSettings');
const auth = require('../middleware/auth');
const UserSiswa = require('../models/UserSiswa');
const UserGuru = require('../models/UserGuru');
// const multer = require('multer');

// Multer setup (stores in local 'uploads/' folder)
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'uploads/'); // you need to create this folder
//     },
//     filename: (req, file, cb) => {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, uniqueSuffix + '-' + file.originalname);
//     }
// });
// const upload = multer({ storage });

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
router.post('/', auth, async (req, res) => {
    try {
        const { username, latitude, longitude, flag } = req.body; // Add flag (check-in or check-out)
        console.log(req.body);

        if (!flag || !['check-in', 'check-out'].includes(flag)) {
            return res.status(400).json({ msg: 'Invalid flag. Use "check-in" or "check-out"' });
        }

        // Get school settings (assuming only one settings doc)
        const schoolSettings = await SchoolSettings.findOne({});
        if (!schoolSettings) {
            return res.status(400).json({ msg: 'School settings not configured' });
        }

        const [schoolLon, schoolLat] = schoolSettings.schoolLocation.coordinates;

        // Distance check
        const distance = getDistanceFromLatLonInKm(
            schoolLon, schoolLat, // School's coordinates
            parseFloat(longitude), parseFloat(latitude) // User's coordinates
        );

        if (distance > schoolSettings.attendanceRadius) {
            return res.status(400).json({ msg: 'You are not within the allowed radius' });
        }

        // Find the user by username
        const user = await UserSiswa.findOne({ username });
        if (!user) throw new Error('User not found');

        // Check for an existing attendance record for today
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayEnd = new Date().setHours(23, 59, 59, 999);

        const existingAttendance = await Attendance.findOne({
            username: user._id,
            createdAt: { $gte: todayStart, $lte: todayEnd }, // Attendance for today
            flag: 'check-in', // Only check-in records
        });

        if (flag === 'check-in') {
            // If flag is "check-in" and an existing record is found, update it
            if (existingAttendance) {
                existingAttendance.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
                existingAttendance.imageUrl = req.file.path;
                existingAttendance.updatedAt = new Date();
                await existingAttendance.save();
                const populatedCheckinExisting = await Attendance.findById(existingAttendance._id).populate('username', 'username');

                return res.json({ msg: 'Check-in updated successfully', attendance: populatedCheckinExisting });
            }

            // If no existing check-in, create a new record
            const newAttendance = new Attendance({
                username: user._id,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)], // ✅ Correct order
                },
                flag: 'check-in', // Set flag to check-in
                status: 'present', // Default status
            });

            await newAttendance.save();
            const populatedCheckin = await Attendance.findById(newAttendance._id).populate('username', 'username');
            return res.json({ msg: 'Check-in created successfully', attendance: populatedCheckin });
        }

        if (flag === 'check-out') {
            // If flag is "check-out", update or create a check-out record
            const checkOutAttendance = new Attendance({
                username: user._id,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)], // ✅ Correct order
                },
                flag: 'check-out', // Set flag to check-out
                status: 'present', // Default status
            });

            await checkOutAttendance.save();
            const populatedCheckout = await Attendance.findById(checkOutAttendance._id).populate('username', 'username');

            return res.json({ msg: 'Check-out created successfully', attendance: populatedCheckout });
        }
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


router.get('/siswa-with-attendance', async (req, res) => {
    try {
        // Fetch all users
        const users = await UserSiswa.find().lean();

        // Fetch attendance records
        const attendanceRecords = await Attendance.find().populate('username', 'name role').lean();

        // Combine users with attendance data
        const combinedData = users.map(user => ({
            ...user,
            attendance: attendanceRecords.filter(record => record.username._id.toString() === user._id.toString()),
        }));

        res.json(combinedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/guru-with-attendance', async (req, res) => {
    try {
        // Fetch all users
        const users = await UserGuru.find().lean();

        // Fetch attendance records
        const attendanceRecords = await Attendance.find().populate('username', 'name role').lean();

        // Combine users with attendance data
        const combinedData = users.map(user => ({
            ...user,
            attendance: attendanceRecords.filter(record => record.username._id.toString() === user._id.toString()),
        }));

        res.json(combinedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
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
