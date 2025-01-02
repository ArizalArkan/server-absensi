const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const UserAdmin = require('../models/UserAdmin');
const UserSiswa = require('../models/UserSiswa');
const UserGuru = require('../models/UserGuru');

const router = express.Router();

// Add user
router.post('/add-user-admin', async (req, res) => {
    const Body = req.body;

    try {
        const user = await UserAdmin.create(Body);
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/add-user-siswa', async (req, res) => {
    const Body = req.body;

    try {
        const user = await UserSiswa.create(Body);
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/add-user-guru', async (req, res) => {
    const Body = req.body;

    try {
        const user = await UserGuru.create(Body);
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// Login
router.post('/login-admin', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await UserAdmin.findOne({ username });
        if (!admin) throw new Error('Invalid credentials, username not found');

        // Create the payload using only the fields you need
        const payload = {
            _id: admin._id,
            username: admin.username,
            role: admin.role  // assuming you have a "role" field
        };

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) throw new Error('Invalid credentials, password not match');

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        res.json({
            token,
            user: {
                id: admin._id,
                name: admin.username,
                role: admin.role
            }
        });
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

router.post('/login-siswa', async (req, res) => {
    const { username, password } = req.body;

    try {
        const siswa = await UserSiswa.findOne({ username });
        if (!siswa) throw new Error('Invalid credentials, username not found');

        const isMatch = await bcrypt.compare(password, siswa.password);
        if (!isMatch) throw new Error('Invalid credentials, password not match');

        // Create the payload using only the fields you need
        const payload = {
            _id: siswa._id,
            username: siswa.username,
            role: siswa.role  // assuming you have a "role" field
        };

        // Sign the token with the payload (which is now a plain object)
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '30d'
        });

        res.json({
            token,
            user: {
                id: siswa._id,
                name: siswa.username,
                role: siswa.role,
                nis: siswa.nis,
                phone: siswa.phone
            }
        });
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});


router.post('/login-guru', async (req, res) => {
    const { nip, password } = req.body;
    try {
        const guru = await UserGuru.findOne({ nip });
        if (!guru) throw new Error('Invalid credentials, nis not found');

        const isMatch = await bcrypt.compare(password, guru.password);
        if (!isMatch) throw new Error('Invalid credentials, password not match');

        const token = jwt.sign(guru, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        res.json({ token });
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

module.exports = router;
