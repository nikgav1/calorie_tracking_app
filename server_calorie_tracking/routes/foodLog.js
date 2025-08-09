import express from 'express';
import { User } from '../models/User.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
const router = express.Router();

/**
 * Helper: upsert one log entry into today's day-doc
 */
async function addMealLog(userId, mealName, log, date) {
  // normalize date
  const dayDate = new Date(date);
  dayDate.setHours(0, 0, 0, 0);

  // First try pushing into existing day
  const updateResult = await User.updateOne(
    { _id: userId, 'foodLogs.date': dayDate },
    { $push: { [`foodLogs.$.${mealName}.logs`]: log } }
  );

  // If no existing, push entire new day template
  if (updateResult.modifiedCount === 0) {
    const newDay = {
      date:      dayDate,
      breakfast: { logs: [], totals: {} },
      lunch:     { logs: [], totals: {} },
      dinner:    { logs: [], totals: {} },
      snacks:    { logs: [], totals: {} },
      totals:    {}
    };
    newDay[mealName].logs.push(log);
    await User.updateOne(
      { _id: userId },
      { $push: { foodLogs: newDay } }
    );
  }

  // Re-fetch & save to trigger pre-save hooks (so totals recalc)
  const user = await User.findById(userId);
  await user.save();
  return user.foodLogs.find(d => d.date.getTime() === dayDate.getTime());
}

/**
 * POST /api/foodLog
 * Body: { meal: 'breakfast'|'lunch'|'dinner'|'snacks', log: { name, ccal, protein, fat, carbohydrates }, date?: string }
 */
router.post(
  '/foodLog',
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { meal, log, date } = req.body;
      if (!['breakfast','lunch','dinner','snacks'].includes(meal)) {
        return res.status(400).json({ error: 'Invalid meal name' });
      }
      const entry = await addMealLog(userId, meal, log, date || new Date());
      res.json({ success: true, dayEntry: entry });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
