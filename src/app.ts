import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { JwtUser, decodeJWT } from "./jwt";
import { setupMongo } from "./mongodb/connection";
import { setupKafka } from "./kafka";
import { VideoModel } from "./mongodb/video";

const app = express();
const port = 5001;

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

const setupExpress = () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

setupMongo().then(setupKafka).then(setupExpress);
