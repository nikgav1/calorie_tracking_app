import express from 'express'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { User } from '../schemas/User.js'

const router = express.Router()

// GET /data/user
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const user = await User.findById(userId)
    if (!user) return res.status(404).send({ message: 'User not found' })

    res.status(200).send({
      email: user.email,
      userId: user._id,
      calorie_goal: user.calorie_goal,
      protein_goal: user.protein_goal,
      fat_goal: user.fat_goal,
      carbohydrates_goal: user.carbohydrates_goal,
      weight: user.weight,
      height: user.height,
      activityLevel: user.activity_level,
      age: user.age,
      sex: user.sex,
      utcOffsetMinutes: user.utcOffsetMinutes ?? null,
    })
  } catch (err) {
    console.error('GET /user error', err)
    res.status(500).send({ message: 'Server error' })
  }
})

/**
 * PUT /data/user
 * Body (any subset):
 *  - age (integer 10-120)
 *  - sex ("male"|"female")
 *  - weight (number kg 20-500)
 *  - height (number cm 50-300)
 *  - activity_level (one of: sedentary, lightly, moderate, very, extra) OR activityLevel
 *  - calorie_goal (integer >0) OR ccal
 *  - protein_goal (number 0-500)
 *  - fat_goal (number 0-500)
 *  - carbohydrates_goal (number 0-1000)
 *  - utcOffsetMinutes (integer, minutes east of UTC)
 */
router.put('/user', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const body = req.body || {}

    // Accept aliases from frontend
    const {
      age,
      sex,
      weight,
      height,
      activity_level,
      activityLevel, // alias
      calorie_goal,
      ccal, // alias
      protein_goal,
      fat_goal,
      carbohydrates_goal,
      utcOffsetMinutes,
    } = body

    const activityKeys = ['sedentary', 'lightly', 'moderate', 'very', 'extra']
    const sexKeys = ['male', 'female']

    const validationErrors = []

    // validate if field present
    if (typeof age !== 'undefined') {
      const a = parseInt(age, 10)
      if (Number.isNaN(a) || a < 10 || a > 120) validationErrors.push('age must be integer between 10 and 120')
    }

    if (typeof sex !== 'undefined') {
      if (!sexKeys.includes(String(sex))) validationErrors.push('sex must be "male" or "female"')
    }

    if (typeof weight !== 'undefined') {
      const w = parseFloat(weight)
      if (Number.isNaN(w) || w < 20 || w > 500) validationErrors.push('weight must be number between 20 and 500 (kg)')
    }

    if (typeof height !== 'undefined') {
      const h = parseFloat(height)
      if (Number.isNaN(h) || h < 50 || h > 300) validationErrors.push('height must be number between 50 and 300 (cm)')
    }

    const activityVal = typeof activity_level !== 'undefined' ? activity_level : activityLevel
    if (typeof activityVal !== 'undefined') {
      if (!activityKeys.includes(String(activityVal))) validationErrors.push(`activity_level must be one of: ${activityKeys.join(', ')}`)
    }

    const calorieVal = typeof calorie_goal !== 'undefined' ? calorie_goal : ccal
    if (typeof calorieVal !== 'undefined') {
      const c = parseInt(calorieVal, 10)
      if (Number.isNaN(c) || c <= 0 || c > 20000) validationErrors.push('calorie_goal must be positive integer and reasonable')
    }

    if (typeof protein_goal !== 'undefined') {
      const p = parseFloat(protein_goal)
      if (Number.isNaN(p) || p < 0 || p > 500) validationErrors.push('protein_goal must be number between 0 and 500 (g)')
    }

    if (typeof fat_goal !== 'undefined') {
      const f = parseFloat(fat_goal)
      if (Number.isNaN(f) || f < 0 || f > 500) validationErrors.push('fat_goal must be number between 0 and 500 (g)')
    }

    if (typeof carbohydrates_goal !== 'undefined') {
      const cgs = parseFloat(carbohydrates_goal)
      if (Number.isNaN(cgs) || cgs < 0 || cgs > 1000) validationErrors.push('carbohydrates_goal must be number between 0 and 1000 (g)')
    }

    if (typeof utcOffsetMinutes !== 'undefined') {
      const u = parseInt(utcOffsetMinutes, 10)
      // reasonable bounds: -12h .. +14h => -720 .. +840
      if (Number.isNaN(u) || u < -720 || u > 840) validationErrors.push('utcOffsetMinutes must be integer between -720 and 840')
    }

    // If macros and calories are present, ensure macro calories <= calorie_goal (if calorie_goal provided)
    const incomingCalorie = typeof calorieVal !== 'undefined' ? parseInt(calorieVal, 10) : undefined
    const incomingProtein = typeof protein_goal !== 'undefined' ? parseFloat(protein_goal) : undefined
    const incomingFat = typeof fat_goal !== 'undefined' ? parseFloat(fat_goal) : undefined
    const incomingCarbs = typeof carbohydrates_goal !== 'undefined' ? parseFloat(carbohydrates_goal) : undefined

    if (typeof incomingCalorie !== 'undefined' && (typeof incomingProtein !== 'undefined' || typeof incomingFat !== 'undefined' || typeof incomingCarbs !== 'undefined')) {
      const p = typeof incomingProtein !== 'undefined' ? incomingProtein : (typeof req.user?.protein_goal !== 'undefined' ? req.user.protein_goal : 0)
      const f = typeof incomingFat !== 'undefined' ? incomingFat : (typeof req.user?.fat_goal !== 'undefined' ? req.user.fat_goal : 0)
      const c = typeof incomingCarbs !== 'undefined' ? incomingCarbs : (typeof req.user?.carbohydrates_goal !== 'undefined' ? req.user.carbohydrates_goal : 0)
      const macroCal = ( (Number(p) || 0) * 4 ) + ( (Number(c) || 0) * 4 ) + ( (Number(f) || 0) * 9 )
      if (macroCal > incomingCalorie) validationErrors.push('Macro calories exceed calorie goal. Lower macros or increase calorie_goal.')
    }

    if (validationErrors.length) {
      return res.status(400).send({ message: 'Validation failed', errors: validationErrors })
    }

    // Fetch user and apply updates
    const user = await User.findById(userId)
    if (!user) return res.status(404).send({ message: 'User not found' })

    if (typeof age !== 'undefined') user.age = parseInt(age, 10)
    if (typeof sex !== 'undefined') user.sex = sex
    if (typeof weight !== 'undefined') user.weight = parseFloat(weight)
    if (typeof height !== 'undefined') user.height = parseFloat(height)
    if (typeof activityVal !== 'undefined') user.activity_level = activityVal
    if (typeof calorieVal !== 'undefined') user.calorie_goal = parseInt(calorieVal, 10)
    if (typeof protein_goal !== 'undefined') user.protein_goal = parseFloat(protein_goal)
    if (typeof fat_goal !== 'undefined') user.fat_goal = parseFloat(fat_goal)
    if (typeof carbohydrates_goal !== 'undefined') user.carbohydrates_goal = parseFloat(carbohydrates_goal)
    if (typeof utcOffsetMinutes !== 'undefined') user.utcOffsetMinutes = parseInt(utcOffsetMinutes, 10)

    await user.save()

    return res.status(200).send({
      email: user.email,
      userId: user._id,
      calorie_goal: user.calorie_goal,
      protein_goal: user.protein_goal,
      fat_goal: user.fat_goal,
      carbohydrates_goal: user.carbohydrates_goal,
      weight: user.weight,
      height: user.height,
      activityLevel: user.activity_level,
      age: user.age,
      sex: user.sex,
      utcOffsetMinutes: user.utcOffsetMinutes ?? null,
    })
  } catch (err) {
    console.error('PUT /user error', err)
    return res.status(500).send({ message: 'Server error' })
  }
})

export default router
