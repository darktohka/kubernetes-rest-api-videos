import express, { Request, Response } from "express";
import mongoose, { Document } from "mongoose";
import { body, validationResult } from "express-validator";

const app = express();
const port = 5001;

let connectionString = process.env.MONGO_CONNECTION_STRING;

if (!connectionString) {
  connectionString =
    "mongodb://user:pass@localhost:27017/azoradb?authSource=admin";
}

mongoose.connect(connectionString, {});

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, minlength: 1, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  owner_user_id: { type: String, required: true, minlength: 1 },
});

const VideoModel = mongoose.model<Video>("Video", videoSchema);

interface Video extends Document {
  title: string;
  description: string;
  owner_user_id: string;
}

app.use(express.json());

app.get("/api/videos", async (req: Request, res: Response) => {
  const videos = await VideoModel.find();
  res.json(videos);
});

app.post(
  "/api/videos",
  [
    body("title").isLength({ min: 1, max: 100 }),
    body("description").isLength({ max: 500 }),
    body("owner_user_id").isLength({ min: 1 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const video = new VideoModel(req.body);

    try {
      const savedVideo = await video.save();
      res.json(savedVideo);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.get("/api/videos/version", (req: Request, res: Response) => {
  res.json({
    version: 2,
    description: "This is the second API, in TypeScript",
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
