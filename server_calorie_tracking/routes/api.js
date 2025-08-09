import express from "express";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs";
import sharp from "sharp";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post(
  "/analyze",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // Resize image with sharp to reduce size and optimize cost
      const optimizedPath = `uploads/optimized-${req.file.filename}.jpg`;
      await sharp(req.file.path)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(optimizedPath);

      // Upload optimized image to OpenAI Files for 'vision' purpose
      const fileUpload = await openai.files.create({
        file: fs.createReadStream(optimizedPath),
        purpose: "vision",
      });

      // Delete temp files
      fs.unlinkSync(req.file.path);
      fs.unlinkSync(optimizedPath);

      // Now send the analysis request with the file_id and input_text
      const fileId = fileUpload.id;

      const aiResponse = await openai.responses.create({
        model: "gpt-5",
        input: [
          {
            role: "system",
            content:
              "You are a nutrition assistant. Respond only with a valid JSON with keys: name, ccal, protein, fat, carbohydrates.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Analyze this meal photo and give me nutrition info in JSON format.",
              },
              { type: "input_image", file_id: fileId },
            ],
          },
        ],
      });

      res.json({
        nutritionData: aiResponse.output_text,
      });
      console.log(aiResponse.output_text);
    } catch (err) {
      console.error("Error processing image:", err);
      res.status(500).json({ error: "Image processing failed" });
    }
  }
);

export default router;
