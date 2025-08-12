import mongoose from 'mongoose';
const { Schema } = mongoose;

const logSchema = new Schema({
  _id:           { type: Schema.Types.ObjectId, auto: true },
  name:          { type: String, required: true },
  ccal:          { type: Number, required: true, default: 0 },
  protein:       { type: Number, required: true, default: 0 },
  fat:           { type: Number, required: true, default: 0 },
  carbohydrates: { type: Number, required: true, default: 0 },
  createdAt:     { type: Date, default: Date.now } // keep exact time
}, { _id: true });

const mealSchema = new Schema({
  logs:   { type: [logSchema], required: true, default: [] },
  totals: {
    ccal:          { type: Number, required: true, default: 0 },
    protein:       { type: Number, required: true, default: 0 },
    fat:           { type: Number, required: true, default: 0 },
    carbohydrates: { type: Number, required: true, default: 0 }
  }
}, { _id: false });

const DaySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // normalized day-start timestamp (UTC moment corresponding to user's local midnight)
  date: { type: Date, required: true, index: true },
  breakfast: { type: mealSchema, required: true, default: () => ({}) },
  lunch:     { type: mealSchema, required: true, default: () => ({}) },
  dinner:    { type: mealSchema, required: true, default: () => ({}) },
  snacks:    { type: mealSchema, required: true, default: () => ({}) },
  totals: {
    ccal:          { type: Number, required: true, default: 0 },
    protein:       { type: Number, required: true, default: 0 },
    fat:           { type: Number, required: true, default: 0 },
    carbohydrates: { type: Number, required: true, default: 0 }
  }
}, { timestamps: true });

// Recalc helpers
function recalcMealTotals(meal) {
  const sums = (meal.logs || []).reduce((acc, log) => {
    acc.ccal += Number(log.ccal) || 0;
    acc.protein += Number(log.protein) || 0;
    acc.fat += Number(log.fat) || 0;
    acc.carbohydrates += Number(log.carbohydrates) || 0;
    return acc;
  }, { ccal: 0, protein: 0, fat: 0, carbohydrates: 0 });
  meal.totals = sums;
}

DaySchema.methods.recalcTotals = function () {
  ['breakfast','lunch','dinner','snacks'].forEach(m => {
    if (this[m]) recalcMealTotals(this[m]);
  });
  const daySums = ['breakfast','lunch','dinner','snacks'].reduce((acc, m) => {
    const t = (this[m] && this[m].totals) ? this[m].totals : { ccal:0,protein:0,fat:0,carbohydrates:0 };
    acc.ccal += t.ccal || 0;
    acc.protein += t.protein || 0;
    acc.fat += t.fat || 0;
    acc.carbohydrates += t.carbohydrates || 0;
    return acc;
  }, { ccal: 0, protein: 0, fat: 0, carbohydrates: 0 });
  this.totals = daySums;
  return this.totals;
};

DaySchema.pre('save', function (next) {
  this.recalcTotals();
  next();
});

// Single unique index to prevent duplicate day per user
DaySchema.index({ user: 1, date: 1 }, { unique: true });

export const Day = mongoose.model('Day', DaySchema);
export default Day;
