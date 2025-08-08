import mongoose from "mongoose";

async function connectMongoDB() {
    try {
        mongoose.connect(process.env.MONGO_URI)
        console.log('Connected to MongoDB Atlas')
    } catch (err) {
        console.error('Could not connect to MongoDB Atlas')
        process.exit(1)
    }
}

export default connectMongoDB