import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { User } from '../schemas/User.js'

const router = express.Router()

router.use(authMiddleware)

router.get('/user', async (req, res) => {
    const { userId } = req.user
    const user = await User.findById(userId)
    res.status(200).send({email: user.email, userId: user._id, calorie_goal: user.calorie_goal})
})

export default router