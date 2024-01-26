import express, { Request, Response } from "express";
import mongoose, { Document } from "mongoose";
import { body, validationResult } from "express-validator";
import { EachMessagePayload, Kafka, KafkaConfig } from "kafkajs";
import { encode, decode } from "@msgpack/msgpack";
import { KeyLike, jwtVerify } from "jose";
import { v4 as uuidv4 } from "uuid";

interface JwtRotatedPayload {
  jwt: string;
}

interface JwtUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

const app = express();
const port = 5001;

let connectionString = process.env.MONGO_CONNECTION_STRING;

if (!connectionString) {
  connectionString =
    "mongodb://user:pass@localhost:27017/videos?authSource=admin";
}

mongoose.connect(connectionString, {});

const kafkaConfig: KafkaConfig = {
  brokers: [process.env.KAFKA_URI],
  sasl: {
    mechanism: "scram-sha-256",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
};
const kafka = new Kafka(kafkaConfig);

let jwtSecret: Uint8Array | null = null;

const jwtConsumer = kafka.consumer({ groupId: `jwt-group-${uuidv4()}` });

jwtConsumer.connect().then(() => {
  jwtConsumer
    .subscribe({ topic: "jwt-rotated", fromBeginning: true })
    .then(() => {
      jwtConsumer.run({
        eachMessage: async ({
          topic,
          partition,
          message,
        }: EachMessagePayload) => {
          const data = decode(message.value) as JwtRotatedPayload;
          console.log("data", data);
          var enc = new TextEncoder();
          jwtSecret = enc.encode(data.jwt);
        },
      });
    });
});

const getBearerToken = (req) => {
  if (
    !req.headers.authorization ||
    req.headers.authorization.split(" ")[0] !== "Bearer"
  ) {
    throw new Error("Invalid Authorization header");
  }

  return req.headers.authorization.split(" ")[1];
};

const decodeJWT = async (req) => {
  const token = getBearerToken(req);
  const { payload } = await jwtVerify(token, jwtSecret);

  console.log(payload);
  return payload as unknown as JwtUser;
};

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
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await decodeJWT(req);

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
