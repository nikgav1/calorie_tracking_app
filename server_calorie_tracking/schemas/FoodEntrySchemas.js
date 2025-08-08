import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const logSchema = new Schema({
  name:          { type: String, required: true },
  ccal:          { type: Number, required: true, default: 0 },
  protein:       { type: Number, required: true, default: 0 },
  fat:           { type: Number, required: true, default: 0 },
  carbohydrates: { type: Number, required: true, default: 0 }
}, { _id: false });

const mealSchema = new Schema({
  logs:   { type: [logSchema], required: true, default: [] },
  totals: {
    ccal:          { type: Number, required: true, default: 0 },
    protein:       { type: Number, required: true, default: 0 },
    fat:           { type: Number, required: true, default: 0 },
    carbohydrates: { type: Number, required: true, default: 0 }
  }
}, { _id: false });

// Pre-save hook on each meal to sum its logs
mealSchema.pre('save', function(next) {
  const sums = this.logs.reduce((acc, log) => {
    acc.ccal          += log.ccal;
    acc.protein       += log.protein;
    acc.fat           += log.fat;
    acc.carbohydrates += log.carbohydrates;
    return acc;
  }, { ccal: 0, protein: 0, fat: 0, carbohydrates: 0 });
  this.totals = sums;
  next();
});

// Day schema: four meals + overall day totals
export const daySchema = new Schema({
  date:      { type: Date, required: true },
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

// Pre-save hook on day to sum its four meals
daySchema.pre('save', function(next) {
  // ensure each sub-meal recalculates its totals first
  ['breakfast','lunch','dinner','snacks'].forEach(mealName => {
    if (this[mealName] && typeof this[mealName].save === 'function') {
      this[mealName].save();
    }
  });

  // now sum across meals
  const daySums = ['breakfast','lunch','dinner','snacks']
    .reduce((acc, mealName) => {
      const m = this[mealName].totals;
      acc.ccal          += m.ccal;
      acc.protein       += m.protein;
      acc.fat           += m.fat;
      acc.carbohydrates += m.carbohydrates;
      return acc;
    }, { ccal: 0, protein: 0, fat: 0, carbohydrates: 0 });
  this.totals = daySums;
  next();
});
