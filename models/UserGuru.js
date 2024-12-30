const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    nip: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    phone: { type: Number, required: false, sparse: true },
    role: { type: String, enum: ['guru'], required: true },
}, { timestamps: true });

userSchema.pre('validate', function (next) {
    if (this.role === 'guru' && (!this.nip || this.ni)) {
        return next(new Error('Teachers must have a NIP'));
    }
    next();
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('UserGuru', userSchema);

module.exports = User;
