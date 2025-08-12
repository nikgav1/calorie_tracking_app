import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { User } from '../schemas/User.js'

const router = express.Router()

router.get('/user', authMiddleware, async (req, res) => {
    const { userId } = req.user
    const user = await User.findById(userId)
    res.status(200).send({email: user.email,
                          userId: user._id,
                          calorie_goal: user.calorie_goal,
                          protein_goal: user.protein_goal,
                          fat_goal: user.fat_goal,
                          carbohydrates_goal: user.carbohydrates_goal
                        })
})

export default router