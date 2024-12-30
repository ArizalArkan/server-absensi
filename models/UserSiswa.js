const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    nis: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    phone: { type: Number, required: false, sparse: true },
    role: { type: String, enum: ['siswa'], required: true },
}, { timestamps: true });

userSchema.pre('validate', function (next) {
    if (this.role === 'siswa' && (!this.nis)) {
        return next(new Error('Students must have an NIS'));
    }
    next();
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function(plainText) {
    return bcrypt.compare(plainText, this.password);
};

const User = mongoose.model('UserSiswa', userSchema);

module.exports = User;
