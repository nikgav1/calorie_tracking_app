// models/User.js
import mongoose from 'mongoose';
import { daySchema } from './FoodEntrySchemas.js';

const UserSchema = new mongoose.Schema({
  email: {
    type:     String,
    required: true,
    unique:   true,
    lowercase:true,
    trim:     true
  },
  password: {
    type:     String,
    required: true
  },
  calorie_goal: {
    type:     Number,
    required: true,
    default:  2000
  },
  createdAt: {
    type:    Date,
    default: Date.now
  },
  foodLogs: {
    type:    [daySchema],
    default: []
  }
}, {
  timestamps: true
});

export const User = mongoose.model('User', UserSchema);
