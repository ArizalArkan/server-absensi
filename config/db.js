const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Connect to MongoDB using the URI from environment variables
        const conn = await mongoose.connect(process.env.MONGO_URI);

        // Log successful connection
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        // Log connection error with detailed message
        console.error(`Error connecting to MongoDB: ${error.message}`);
        
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;
