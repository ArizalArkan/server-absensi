// src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const AttendanceSiswa = require('../models/AttendanceSiswa');
const AttendanceGuru = require('../models/AttendanceGuru');
const SchoolSettings = require('../models/SchoolSettings');
const auth = require('../middleware/auth');
const UserSiswa = require('../models/UserSiswa');
const UserGuru = require('../models/UserGuru');

const XLSX = require('xlsx');
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
router.post('/absen-siswa', auth, async (req, res) => {
    try {
        const { username, latitude, longitude, flag } = req.body;

        if (!flag || !['check-in', 'check-out'].includes(flag)) {
            return res.status(400).json({ msg: 'Invalid flag. Use "check-in" or "check-out"' });
        }

        // Get school settings
        const schoolSettings = await SchoolSettings.findOne({});
        if (!schoolSettings) {
            return res.status(400).json({ msg: 'School settings not configured' });
        }

        const [schoolLon, schoolLat] = schoolSettings.schoolLocation.coordinates;

        // Distance check
        const distance = getDistanceFromLatLonInKm(
            schoolLon, schoolLat, // School's coordinates
            longitude, latitude // User's coordinates
        );

        if (distance > schoolSettings.attendanceRadius) {
            return res.json({ msg: 'You are not within the allowed radius' });
        }

        // Find the user by username
        const user = await UserSiswa.findOne({ username });
        if (!user) throw new Error('User not found');

        // Helper function to parse time in "HH:mm" format to a Date object
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const now = new Date();
            now.setHours(hours, minutes, 0, 0);
            return now;
        };

        // Helper function to format late message
        const formatLateMessage = (minutesLate) => {
            const hours = Math.floor(minutesLate / 60);
            const minutes = minutesLate % 60;

            if (hours > 0 && minutes > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
            } else if (hours > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
        };

        // Get start and end times from school settings
        const startTime = parseTime(schoolSettings.startTime);
        const endTime = parseTime(schoolSettings.endTime);
        const now = new Date();

        let lateMessage = null;

        // Determine lateness for check-in or check-out
        if (flag === 'check-in') {
            if (now > startTime) {
                const lateMinutes = Math.round((now - startTime) / 60000); // Difference in minutes
                lateMessage = `You are late for check-in by ${formatLateMessage(lateMinutes)}.`;
            }
        } else if (flag === 'check-out') {
            if (now > endTime) {
                const lateMinutes = Math.round((now - endTime) / 60000); // Difference in minutes
                lateMessage = `You are late for check-out by ${formatLateMessage(lateMinutes)}.`;
            }
        }

        // Check for an existing attendance record for today
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayEnd = new Date().setHours(23, 59, 59, 999);

        const existingAttendance = await AttendanceSiswa.findOne({
            username: user._id,
            createdAt: { $gte: todayStart, $lte: todayEnd },
            flag: 'check-in', // Only check-in records
        });

        if (flag === 'check-in') {
            if (existingAttendance) {
                // Update existing check-in
                existingAttendance.location.coordinates = [parseFloat(latitude), parseFloat(longitude)];
                existingAttendance.updatedAt = new Date();
                await existingAttendance.save();

                return res.json({
                    msg: 'Check-in updated successfully',
                    attendance: existingAttendance,
                    lateMessage: lateMessage || 'You are on time for check-in.',
                });
            }

            // Create new check-in
            const newAttendance = new AttendanceSiswa({
                username: user._id,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)], // Correct order
                },
                flag: 'check-in',
                status: 'present',
            });

            await newAttendance.save();
            return res.json({
                msg: 'Check-in created successfully',
                attendance: newAttendance,
                lateMessage: lateMessage || 'You are on time for check-in.',
            });
        }

        if (flag === 'check-out') {
            const newAttendance = new Attendance({
                username: user._id,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)], // Correct order
                },
                flag: 'check-out',
                status: 'present',
            });

            await newAttendance.save();
            return res.json({
                msg: 'Check-out created successfully',
                attendance: newAttendance,
                lateMessage: lateMessage || 'You are on time for check-out.',
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/absen-guru', auth, async (req, res) => {
    try {
        const { username, latitude, longitude, flag } = req.body;

        if (!flag || !['check-in', 'check-out'].includes(flag)) {
            return res.status(400).json({ msg: 'Invalid flag. Use "check-in" or "check-out"' });
        }

        // Get school settings
        const schoolSettings = await SchoolSettings.findOne({});
        if (!schoolSettings) {
            return res.status(400).json({ msg: 'School settings not configured' });
        }

        const [schoolLon, schoolLat] = schoolSettings.schoolLocation.coordinates;

        // Distance check
        const distance = getDistanceFromLatLonInKm(
            schoolLon, schoolLat, // School's coordinates
            longitude, latitude // User's coordinates
        );

        if (distance > schoolSettings.attendanceRadius) {
            return res.json({ msg: 'You are not within the allowed radius' });
        }

        // Find the user by username
        const user = await UserGuru.findOne({ username });
        if (!user) throw new Error('User not found');

        // Helper function to parse time in "HH:mm" format to a Date object
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const now = new Date();
            now.setHours(hours, minutes, 0, 0);
            return now;
        };

        // Helper function to format late message
        const formatLateMessage = (minutesLate) => {
            const hours = Math.floor(minutesLate / 60);
            const minutes = minutesLate % 60;

            if (hours > 0 && minutes > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
            } else if (hours > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
        };

        // Get start and end times from school settings
        const startTime = parseTime(schoolSettings.startTime);
        const endTime = parseTime(schoolSettings.endTime);
        const now = new Date();

        let lateMessage = null;

        // Determine lateness for check-in or check-out
        if (flag === 'check-in') {
            if (now > startTime) {
                const lateMinutes = Math.round((now - startTime) / 60000); // Difference in minutes
                lateMessage = `You are late for check-in by ${formatLateMessage(lateMinutes)}.`;
            }
        } else if (flag === 'check-out') {
            if (now > endTime) {
                const lateMinutes = Math.round((now - endTime) / 60000); // Difference in minutes
                lateMessage = `You are late for check-out by ${formatLateMessage(lateMinutes)}.`;
            }
        }

        // Check for an existing attendance record for today
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayEnd = new Date().setHours(23, 59, 59, 999);

        const existingAttendance = await AttendanceGuru.findOne({
            username: user._id,
            createdAt: { $gte: todayStart, $lte: todayEnd },
            flag: 'check-in', // Only check-in records
        });

        if (flag === 'check-in') {
            if (existingAttendance) {
                // Update existing check-in
                existingAttendance.location.coordinates = [parseFloat(latitude), parseFloat(longitude)];
                existingAttendance.updatedAt = new Date();
                await existingAttendance.save();

                return res.json({
                    msg: 'Check-in updated successfully',
                    attendance: existingAttendance,
                    lateMessage: lateMessage || 'You are on time for check-in.',
                });
            }

            // Create new check-in
            const newAttendance = new AttendanceGuru({
                username: user._id,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)], // Correct order
                },
                flag: 'check-in',
                status: 'present',
            });

            await newAttendance.save();
            return res.json({
                msg: 'Check-in created successfully',
                attendance: newAttendance,
                lateMessage: lateMessage || 'You are on time for check-in.',
            });
        }

        if (flag === 'check-out') {
            const newAttendance = new Attendance({
                username: user._id,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(latitude), parseFloat(longitude)], // Correct order
                },
                flag: 'check-out',
                status: 'present',
            });

            await newAttendance.save();
            return res.json({
                msg: 'Check-out created successfully',
                attendance: newAttendance,
                lateMessage: lateMessage || 'You are on time for check-out.',
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});


// @route  GET /api/attendances
// @desc   Get all attendances (for admin or teacher maybe)
// @access Private
router.get('/list-absen-siswa', auth, async (req, res) => {
    try {
        const attendances = await AttendanceSiswa.find()
            .populate('username', 'username') // Replace ObjectId with username field
            .exec();

        res.json(attendances);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// @route  GET /api/attendances
// @desc   Get all attendances (for admin or teacher maybe)
// @access Private
router.get('/list-absen-guru', auth, async (req, res) => {
    try {
        const attendances = await AttendanceGuru.find()
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
        const { username, id } = req.query; // Accept username or id as query parameters

        const schoolSettings = await SchoolSettings.findOne({});
        if (!schoolSettings) {
            return res.status(400).json({ msg: 'School settings not configured' });
        }

        // Helper function to parse time in "HH:mm" format to a Date object
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const now = new Date();
            now.setHours(hours, minutes, 0, 0);
            return now;
        };

        // Helper function to format late message
        const formatLateMessage = (minutesLate) => {
            const hours = Math.floor(minutesLate / 60);
            const minutes = minutesLate % 60;

            if (hours > 0 && minutes > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
            } else if (hours > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
        };

        // Parse school start and end times
        const startTime = parseTime(schoolSettings.startTime);
        const endTime = parseTime(schoolSettings.endTime);

        // Build query to find a specific user
        const userQuery = {};
        if (username) userQuery.username = username;
        if (id) userQuery._id = id;

        // Find user(s)
        const users = await UserSiswa.find(userQuery).lean();

        if (users.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Fetch attendance records for the found users
        const userIds = users.map(user => user._id.toString());
        const attendanceRecords = await AttendanceSiswa.find({
            username: { $in: userIds },
        })
            .populate('username', 'name role')
            .lean();

        const combinedDataDownload = users.map(user => ({
            Name: user.name,
            Username: user.username,
            Role: user.role,
            Attendance: attendanceRecords
                .filter(record => record.username._id.toString() === user._id.toString())
                .map(record => ({
                    Date: new Date(record.createdAt).toLocaleDateString('id-ID'),
                    Time: new Date(record.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    }),
                    Status: record.status,
                })),
        }));

        // If export is requested, generate Excel
        if (req.query.export === 'excel') {
            // Prepare flat data for Excel
            const excelData = [];
            combinedDataDownload.forEach(user => {
                user.Attendance.forEach(att => {
                    excelData.push({
                        Name: user.Name,
                        Username: user.Username,
                        Role: user.Role,
                        AttendanceDate: att.Date,
                        AttendanceTime: att.Time, // Properly formatted
                        Status: att.Status,
                    });
                });
            });

            // Create Excel workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

            // Write workbook to a buffer
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            // Send the buffer as a downloadable file
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="attendance.xlsx"'
            );
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

            return;
        }
        // Combine users with attendance data and calculate lateness
        const combinedData = users.map(user => ({
            ...user,
            attendance: attendanceRecords
                .filter(record => record.username._id.toString() === user._id.toString())
                .map(record => {
                    let lateMessage = null;

                    // Calculate lateness
                    if (record.flag === 'check-in' && record.createdAt > startTime) {
                        const lateMinutes = Math.round((new Date(record.createdAt) - startTime) / 60000);
                        lateMessage = `Late for check-in by ${formatLateMessage(lateMinutes)}.`;
                    } else if (record.flag === 'check-out' && record.createdAt > endTime) {
                        const lateMinutes = Math.round((new Date(record.createdAt) - endTime) / 60000);
                        lateMessage = `Late for check-out by ${formatLateMessage(lateMinutes)}.`;
                    }

                    return {
                        ...record,
                        lateMessage: lateMessage || 'On time.',
                    };
                }),
        }));

        res.json(combinedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/guru-with-attendance', async (req, res) => {
    try {
        const { username, id } = req.query; // Accept username or id as query parameters

        const schoolSettings = await SchoolSettings.findOne({});
        if (!schoolSettings) {
            return res.status(400).json({ msg: 'School settings not configured' });
        }

        // Helper function to parse time in "HH:mm" format to a Date object
        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const now = new Date();
            now.setHours(hours, minutes, 0, 0);
            return now;
        };

        // Helper function to format late message
        const formatLateMessage = (minutesLate) => {
            const hours = Math.floor(minutesLate / 60);
            const minutes = minutesLate % 60;

            if (hours > 0 && minutes > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
            } else if (hours > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
        };

        // Parse school start and end times
        const startTime = parseTime(schoolSettings.startTime);
        const endTime = parseTime(schoolSettings.endTime);

        // Build query to find a specific user
        const userQuery = {};
        if (username) userQuery.username = username;
        if (id) userQuery._id = id;

        // Find user(s)
        const users = await UserGuru.find(userQuery).lean();

        if (users.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Fetch attendance records for the found users
        const userIds = users.map(user => user._id.toString());
        const attendanceRecords = await AttendanceGuru.find({
            username: { $in: userIds },
        })
            .populate('username', 'name role')
            .lean();

        const combinedDataDownload = users.map(user => ({
            Name: user.name,
            Username: user.username,
            Role: user.role,
            Attendance: attendanceRecords
                .filter(record => record.username._id.toString() === user._id.toString())
                .map(record => ({
                    Date: new Date(record.createdAt).toLocaleDateString('id-ID'),
                    Time: new Date(record.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    }),
                    Status: record.status,
                })),
        }));

        // If export is requested, generate Excel
        if (req.query.export === 'excel') {
            // Prepare flat data for Excel
            const excelData = [];
            combinedDataDownload.forEach(user => {
                user.Attendance.forEach(att => {
                    excelData.push({
                        Name: user.Name,
                        Username: user.Username,
                        Role: user.Role,
                        AttendanceDate: att.Date,
                        AttendanceTime: att.Time, // Properly formatted
                        Status: att.Status,
                    });
                });
            });

            // Create Excel workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

            // Write workbook to a buffer
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            // Send the buffer as a downloadable file
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="attendance_guru.xlsx"'
            );
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

            return;
        }

        // Combine users with attendance data and calculate lateness
        const combinedData = users.map(user => ({
            ...user,
            attendance: attendanceRecords
                .filter(record => record.username._id.toString() === user._id.toString())
                .map(record => {
                    let lateMessage = null;

                    // Calculate lateness
                    if (record.flag === 'check-in' && record.createdAt > startTime) {
                        const lateMinutes = Math.round((new Date(record.createdAt) - startTime) / 60000);
                        lateMessage = `Late for check-in by ${formatLateMessage(lateMinutes)}.`;
                    } else if (record.flag === 'check-out' && record.createdAt > endTime) {
                        const lateMinutes = Math.round((new Date(record.createdAt) - endTime) / 60000);
                        lateMessage = `Late for check-out by ${formatLateMessage(lateMinutes)}.`;
                    }

                    return {
                        ...record,
                        lateMessage: lateMessage || 'On time.',
                    };
                }),
        }));

        res.json(combinedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
