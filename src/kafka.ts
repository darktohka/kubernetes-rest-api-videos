import {
  Consumer,
  ConsumerSubscribeTopics,
  EachMessagePayload,
  Kafka,
  KafkaConfig,
} from "kafkajs";
import { decode, encode } from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { setJwtSecret } from "./jwt.js";
import { VideoModel } from "./mongodb/video.js";
import { User } from "./user.js";
import { setValues } from "./redis.js";

interface JwtRotatedPayload {
  jwt: string;
}

interface UserDeletedPayload {
  id: string;
}

interface PopulateUsersPayload {
  userIds: string[];
}

interface UsersPopulatedPayload {
  users: User[];
}

const kafkaConfig: KafkaConfig = {
  brokers: [process.env.KAFKA_URI],
  sasl: {
    mechanism: "scram-sha-256",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
};
const kafka = new Kafka(kafkaConfig);

const producer = kafka.producer();
const jwtConsumer = kafka.consumer({ groupId: `jwt-group-${uuidv4()}` });
const UsersPopulatedConsumer = kafka.consumer({
  groupId: "users-populated-consumer",
});
const userDeletedConsumer = kafka.consumer({
  groupId: "user-deleted-group",
});

const onJwtRotated = async (data: JwtRotatedPayload) => {
  console.log("Rotated JWT secret:", data.jwt);
  setJwtSecret(new TextEncoder().encode(data.jwt));
};

const onUserDeleted = async (data: UserDeletedPayload) => {
  const { id } = data;

  const result = await VideoModel.deleteMany({ owner_user_id: id });
  console.log(`User deleted. Removed ${result.deletedCount} videos`);
};

const onUsersPopulated = async (data: UsersPopulatedPayload) => {
  const { users } = data;
  const userRecords: Record<string, User> = users.reduce((acc, cur) => {
    acc[cur.id] = cur;
    return acc;
  }, {});

  console.log("Populating user records:", userRecords);
  await setValues(userRecords);
};

const setupListener = <T>(
  consumer: Consumer,
  topic: ConsumerSubscribeTopics,
  onEventReceived: (data: T) => void
) => {
  return consumer.connect().then(() => {
    consumer.subscribe(topic).then(() => {
      consumer.run({
        eachMessage: async ({ message }: EachMessagePayload) => {
          const data = decode(message.value) as T;
          onEventReceived(data);
        },
      });
    });
  });
};

export const setupKafka = () => {
  setupListener<JwtRotatedPayload>(
    jwtConsumer,
    { topics: ["jwt-rotated"], fromBeginning: true },
    onJwtRotated
  );

  setupListener<UserDeletedPayload>(
    userDeletedConsumer,
    { topics: ["user-deleted"] },
    onUserDeleted
  );

  setupListener<UsersPopulatedPayload>(
    UsersPopulatedConsumer,
    { topics: ["users-populated"] },
    onUsersPopulated
  );

  return producer.connect();
};

export const requestPopulateUsers = (payload: PopulateUsersPayload) => {
  return producer.send({
    topic: "populate-users",
    messages: [{ value: Buffer.from(encode(payload)) }],
  });
};
