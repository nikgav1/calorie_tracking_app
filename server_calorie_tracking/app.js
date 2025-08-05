import express from "express"
import jwt from "jsonwebtoken"
import cors from 'cors'

const PORT = process.env.PORT || 3000

const app = express()

app.use(cors())
app.use(express.json());

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://<your-local-ip>:${port}`);
});