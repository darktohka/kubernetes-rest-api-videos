import {
  Consumer,
  ConsumerSubscribeTopics,
  EachMessagePayload,
  Kafka,
  KafkaConfig,
} from "kafkajs";
import { decode } from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { setJwtSecret } from "./jwt.js";
import { VideoModel } from "./mongodb/video.js";

interface JwtRotatedPayload {
  jwt: string;
}

interface UserDeletedPayload {
  id: string;
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

const jwtConsumer = kafka.consumer({ groupId: `jwt-group-${uuidv4()}` });
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

const setupKafka = () => {
  setupListener<JwtRotatedPayload>(
    jwtConsumer,
    { topics: ["jwt-rotated"], fromBeginning: true },
    onJwtRotated
  );

  return setupListener<UserDeletedPayload>(
    userDeletedConsumer,
    { topics: ["user-deleted"] },
    onUserDeleted
  );
};

export { setupKafka };
