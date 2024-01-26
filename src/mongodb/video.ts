import mongoose, { Document } from "mongoose";
import { User } from "../user";

export interface BaseVideo {
  title: string;
  description: string;
}

export interface PopulatedVideo extends BaseVideo {
  owner: User;
}

export interface Video extends Document, BaseVideo {
  owner_user_id: string;
}

export const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, minlength: 1, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  owner_user_id: { type: String, required: true, minlength: 1 },
});

export const VideoModel = mongoose.model<Video>("Video", videoSchema);
