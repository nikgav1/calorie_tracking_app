import express from 'express';
import mongoose from 'mongoose';
import { Day } from '../schemas/Day.js';
import { User } from '../schemas/User.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

function normalizeToUserDayStart(inputDate = Date.now(), userOffsetMinutes = null) {
  const d = new Date(inputDate);
  if (userOffsetMinutes === null || typeof userOffsetMinutes !== 'number') {
    const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    return new Date(utcMidnight);
  }
  const localMs = d.getTime() + userOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const utcMidnightOfLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0);
  const userLocalDayStartUtcMs = utcMidnightOfLocal - userOffsetMinutes * 60_000;
  return new Date(userLocalDayStartUtcMs);
}

/**
 * Add a log (POST /log/foodLog)
 * body: { meal, log: { name, ccal, protein, fat, carbohydrates }, date?: string }
 */
router.post('/foodLog', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { meal, log, date } = req.body;

    if (!['breakfast','lunch','dinner','snacks'].includes(meal)) {
      return res.status(400).json({ error: 'Invalid meal' });
    }
    if (!log || !log.name) return res.status(400).json({ error: 'Log must include name' });

    // get user's offset if available
    const user = await User.findById(userId).select('utcOffsetMinutes').lean();
    const offset = (user && Number.isFinite(user.utcOffsetMinutes)) ? Number(user.utcOffsetMinutes) : null;
    const dayDate = normalizeToUserDayStart(date || Date.now(), offset);

    const newLogId = new mongoose.Types.ObjectId();
    const newLog = {
      _id: newLogId,
      name: String(log.name).trim(),
      ccal: Number(log.ccal) || 0,
      protein: Number(log.protein) || 0,
      fat: Number(log.fat) || 0,
      carbohydrates: Number(log.carbohydrates) || 0,
      createdAt: log.createdAt ? new Date(log.createdAt) : new Date()
    };

    const pushPath = `${meal}.logs`;
    const incOps = {
      [`${meal}.totals.ccal`]: newLog.ccal,
      [`${meal}.totals.protein`]: newLog.protein,
      [`${meal}.totals.fat`]: newLog.fat,
      [`${meal}.totals.carbohydrates`]: newLog.carbohydrates,
      'totals.ccal': newLog.ccal,
      'totals.protein': newLog.protein,
      'totals.fat': newLog.fat,
      'totals.carbohydrates': newLog.carbohydrates
    };

    // --- STEP 1: ensure Day doc exists with proper nested meal defaults (upsert) ---
    await Day.updateOne(
      { user: new mongoose.Types.ObjectId(userId), date: dayDate },
      {
        $setOnInsert: {
          user: new mongoose.Types.ObjectId(userId),
          date: dayDate,
          breakfast: { logs: [], totals: { ccal:0,protein:0,fat:0,carbohydrates:0 } },
          lunch:     { logs: [], totals: { ccal:0,protein:0,fat:0,carbohydrates:0 } },
          dinner:    { logs: [], totals: { ccal:0,protein:0,fat:0,carbohydrates:0 } },
          snacks:    { logs: [], totals: { ccal:0,protein:0,fat:0,carbohydrates:0 } },
          totals:    { ccal:0,protein:0,fat:0,carbohydrates:0 }
        }
      },
      { upsert: true }
    );

    // --- STEP 2: push the log and increment totals (now that nested paths exist) ---
    const dayDoc = await Day.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(userId), date: dayDate },
      {
        $push: { [pushPath]: newLog },
        $inc: incOps
      },
      { new: true }
    ).lean();

    return res.json({ success: true, day: dayDoc, logId: newLogId });
  } catch (err) {
    return next(err);
  }
});

/**
 * Update a log (PUT /log/days/:date/:meal/:logId)
 */
router.put('/days/:date/:meal/:logId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { date, meal, logId } = req.params;
    if (!['breakfast','lunch','dinner','snacks'].includes(meal)) return res.status(400).json({ error: 'Invalid meal' });

    // normalize date to user's local day
    const user = await User.findById(userId).select('utcOffsetMinutes').lean();
    const offset = (user && Number.isFinite(user.utcOffsetMinutes)) ? Number(user.utcOffsetMinutes) : null;
    const dayDate = normalizeToUserDayStart(date, offset);

    // load day to compute diffs
    const day = await Day.findOne({ user: userId, date: dayDate }).exec();
    if (!day) return res.status(404).json({ error: 'Day not found' });

    const mealDoc = day[meal];
    if (!mealDoc) return res.status(404).json({ error: 'Meal not found' });

    const log = mealDoc.logs.id(logId);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const old = {
      ccal: Number(log.ccal) || 0,
      protein: Number(log.protein) || 0,
      fat: Number(log.fat) || 0,
      carbohydrates: Number(log.carbohydrates) || 0
    };

    const newValues = {
      name: req.body.name !== undefined ? req.body.name : log.name,
      ccal: req.body.ccal !== undefined ? Number(req.body.ccal) : old.ccal,
      protein: req.body.protein !== undefined ? Number(req.body.protein) : old.protein,
      fat: req.body.fat !== undefined ? Number(req.body.fat) : old.fat,
      carbohydrates: req.body.carbohydrates !== undefined ? Number(req.body.carbohydrates) : old.carbohydrates
    };

    const diff = {
      ccal: newValues.ccal - old.ccal,
      protein: newValues.protein - old.protein,
      fat: newValues.fat - old.fat,
      carbohydrates: newValues.carbohydrates - old.carbohydrates
    };

    const setOps = {
      [`${meal}.logs.$[log].name`]: newValues.name,
      [`${meal}.logs.$[log].ccal`]: newValues.ccal,
      [`${meal}.logs.$[log].protein`]: newValues.protein,
      [`${meal}.logs.$[log].fat`]: newValues.fat,
      [`${meal}.logs.$[log].carbohydrates`]: newValues.carbohydrates
    };

    const incOps = {
      [`${meal}.totals.ccal`]: diff.ccal,
      [`${meal}.totals.protein`]: diff.protein,
      [`${meal}.totals.fat`]: diff.fat,
      [`${meal}.totals.carbohydrates`]: diff.carbohydrates,
      'totals.ccal': diff.ccal,
      'totals.protein': diff.protein,
      'totals.fat': diff.fat,
      'totals.carbohydrates': diff.carbohydrates
    };

    const updated = await Day.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(userId), date: dayDate },
      { $set: setOps, $inc: incOps },
      { new: true, arrayFilters: [{ 'log._id': new mongoose.Types.ObjectId(logId) }] }
    ).lean();

    return res.json({ success: true, day: updated });
  } catch (err) {
    return next(err);
  }
});

/**
 * Delete log (DELETE /log/days/:date/:meal/:logId)
 */
router.delete('/days/:date/:meal/:logId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { date, meal, logId } = req.params;
    if (!['breakfast','lunch','dinner','snacks'].includes(meal)) return res.status(400).json({ error: 'Invalid meal' });

    const user = await User.findById(userId).select('utcOffsetMinutes').lean();
    const offset = (user && Number.isFinite(user.utcOffsetMinutes)) ? Number(user.utcOffsetMinutes) : null;
    const dayDate = normalizeToUserDayStart(date, offset);

    const day = await Day.findOne({ user: userId, date: dayDate }).exec();
    if (!day) return res.status(404).json({ error: 'Day not found' });
    const log = day[meal].logs.id(logId);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const ccal = Number(log.ccal) || 0;
    const protein = Number(log.protein) || 0;
    const fat = Number(log.fat) || 0;
    const carbohydrates = Number(log.carbohydrates) || 0;

    const update = {
      $pull: { [`${meal}.logs`]: { _id: new mongoose.Types.ObjectId(logId) } },
      $inc: {
        [`${meal}.totals.ccal`]: -ccal,
        [`${meal}.totals.protein`]: -protein,
        [`${meal}.totals.fat`]: -fat,
        [`${meal}.totals.carbohydrates`]: -carbohydrates,
        'totals.ccal': -ccal,
        'totals.protein': -protein,
        'totals.fat': -fat,
        'totals.carbohydrates': -carbohydrates
      }
    };

    const updated = await Day.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(userId), date: dayDate },
      update,
      { new: true }
    ).lean();
    return res.json({ success: true, day: updated });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET day (GET /log/days/:date) -- date can be 'YYYY-MM-DD' or ISO string; server normalizes by user's offset
 */
router.get('/days/:date', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const date = req.params.date;
    const user = await User.findById(userId).select('utcOffsetMinutes').lean();
    const offset = (user && Number.isFinite(user.utcOffsetMinutes)) ? Number(user.utcOffsetMinutes) : null;
    const dayDate = normalizeToUserDayStart(date, offset);

    const day = await Day.findOne({ user: userId, date: dayDate }).lean();
    if (!day) return res.status(204).json({ error: 'Day not found' });
    return res.json({ success: true, day });
  } catch (err) {
    return next(err);
  }
});

/**
 * List recent days (GET /log/days?limit=30)
 */
router.get('/days', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit || '30', 10) || 30, 365);
    const days = await Day.find({ user: userId }).sort({ date: -1 }).limit(limit).lean();
    return res.json({ success: true, days });
  } catch (err) {
    return next(err);
  }
});

export default router;
