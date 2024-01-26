import mongoose, { Document } from "mongoose";

export interface Video extends Document {
  title: string;
  description: string;
  owner_user_id: string;
}

export const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, minlength: 1, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  owner_user_id: { type: String, required: true, minlength: 1 },
});

export const VideoModel = mongoose.model<Video>("Video", videoSchema);
