import { PopulatedVideo, Video } from "./mongodb/video.js";
import { getValues } from "./redis.js";
import { User } from "./user.js";
import { requestPopulateUsers } from "./kafka.js";

const CircuitBreaker = require("opossum");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const protectedPopulateVideos = async (
  videos: Video[]
): Promise<PopulatedVideo[]> => {
  const userIds = [...new Set(videos.map((video) => video.owner_user_id))];
  const userMap: Record<string, User> = {};
  let populated = false;

  while (Object.keys(userMap).length < userIds.length) {
    const currentUserIds = Object.keys(userMap);
    const missingUserIds = userIds.filter(
      (userId) => !currentUserIds.includes(userId)
    );

    const cachedUsers = await getValues<User>(missingUserIds);

    if (!populated) {
      const cachedUserIds = cachedUsers.map((user) => user.id);
      const populateUserIds = missingUserIds.filter(
        (userId) => !cachedUserIds.includes(userId)
      );

      console.log("Populating user IDs...", populateUserIds);
      await requestPopulateUsers({ userIds: populateUserIds });
      populated = true;
    }

    cachedUsers.forEach((user) => {
      console.log("got:", user.id);
      console.log("got user:", user);
      userMap[user.id] = user;
    });

    console.log("Waiting for population...");
    console.log(userMap);
    console.log(userIds);

    if (Object.keys(userMap).length < userIds.length) {
      await delay(50);
    }
  }

  console.log("population complete.");

  const populatedVideos: PopulatedVideo[] = videos.map((video) => ({
    owner: userMap[video.owner_user_id],
    title: video.title,
    description: video.description,
  }));

  return populatedVideos;
};

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
};
const breaker = new CircuitBreaker(protectedPopulateVideos, options);

export const populateVideos = async (
  videos: Video[]
): Promise<PopulatedVideo[]> => breaker.fire(videos);
