import express from "express"
import cors from 'cors'
import authRouter from "./routes/auth.js"
import dataRouter from "./routes/data.js"
import connectMongoDB from "./services/mongodb.js"
import dotenv from 'dotenv'
dotenv.config();

const PORT = process.env.PORT || 3000

const app = express()

await connectMongoDB()

app.use(cors())
app.use(express.json());

app.use('/auth', authRouter)
app.use('/data', dataRouter)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://<your-local-ip>:${PORT}`);
});