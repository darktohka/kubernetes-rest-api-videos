import { EachMessagePayload, Kafka, KafkaConfig } from "kafkajs";
import { decode } from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { setJwtSecret } from "./jwt.js";

interface JwtRotatedPayload {
  jwt: string;
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

const onJwtRotated = async (data: JwtRotatedPayload) => {
  console.log("Rotated JWT secret:", data.jwt);
  setJwtSecret(new TextEncoder().encode(data.jwt));
};

const setupKafka = () => {
  return jwtConsumer.connect().then(() => {
    jwtConsumer
      .subscribe({ topic: "jwt-rotated", fromBeginning: true })
      .then(() => {
        jwtConsumer.run({
          eachMessage: async ({ message }: EachMessagePayload) => {
            const data = decode(message.value) as JwtRotatedPayload;
            onJwtRotated(data);
          },
        });
      });
  });
};

export { setupKafka };
