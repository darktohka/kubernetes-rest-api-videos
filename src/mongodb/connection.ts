import mongoose from "mongoose";

let connectionString = process.env.MONGO_CONNECTION_STRING;

if (!connectionString) {
  connectionString =
    "mongodb://user:pass@localhost:27017/videos?authSource=admin";
}

export const setupMongo = () => {
  return mongoose.connect(connectionString, {});
};
