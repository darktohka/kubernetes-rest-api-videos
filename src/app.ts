import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { JwtUser, decodeJWT } from "./jwt.js";
import { setupMongo } from "./mongodb/connection.js";
import { setupKafka } from "./kafka.js";
import { VideoModel } from "./mongodb/video.js";
import { populateVideos } from "./populate.js";

const app = express();
const port = 5001;

app.use(express.json());

app.get("/api/videos", async (req: Request, res: Response) => {
  const videos = await VideoModel.find();

  try {
    const populatedVideos = await populateVideos(videos);

    res.json(populatedVideos);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Circuit breaker engaged" });
  }
});

app.post(
  "/api/videos",
  [
    body("title").isLength({ min: 1, max: 100 }),
    body("description").isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let user: JwtUser;

    try {
      user = await decodeJWT(req);
    } catch (error) {
      return res.status(401).json({ errors: [{ msg: error.message }] });
    }

    const data = {
      title: req.body.title,
      description: req.body.description,
      owner_user_id: user.id,
    };

    const video = new VideoModel(data);

    try {
      const savedVideo = await video.save();

      try {
        const populatedVideo = await populateVideos([savedVideo])[0];

        res.json(populatedVideo);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Circuit breaker engaged" });
      }
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

const setupExpress = () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

setupMongo().then(setupKafka).then(setupExpress);
