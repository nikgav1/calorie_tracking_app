import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../schemas/User.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const {
      email,
      password,
      age,
      sex,
      weight,
      height,
      activityLevel,
      protein,
      fat,
      carbohydrates,
      ccal,
      utcOffsetMinutes
    } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(422).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      age: parseInt(age, 10),
      sex,
      weight: parseFloat(weight),
      height: parseFloat(height),
      activity_level: activityLevel,
      utcOffsetMinutes: parseInt(utcOffsetMinutes, 10),

      calorie_goal: parseInt(ccal, 10),
      protein_goal: parseFloat(protein),
      fat_goal: parseFloat(fat),
      carbohydrates_goal: parseFloat(carbohydrates)
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(401).json({ message: "No email or password" });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Login successful",
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
