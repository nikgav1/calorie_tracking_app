import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  age: Number,
  sex: { type: String, enum: ['male','female'] },
  weight: Number,
  height: Number,
  activity_level: String,
  // minutes east of UTC. Example: UTC+3 => 180
  utcOffsetMinutes: { type: Number, default: null },

  calorie_goal: Number,
  protein_goal: Number,
  fat_goal: Number,
  carbohydrates_goal: Number,
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
