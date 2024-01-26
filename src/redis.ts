import { commandOptions, createClient } from "redis";
import { decode, encode } from "@msgpack/msgpack";

let client = null;

export const getValues = async <T>(keys: string[]): Promise<T[]> => {
  const result = await client.mGet(
    commandOptions({ returnBuffers: true }),
    keys
  );

  const unpackedValues = result
    .filter((value) => value != null)
    .map((value) => {
      return decode(value) as T;
    });

  console.log("Unpacked values:", unpackedValues);
  return unpackedValues;
};

export const setValues = async <T>(values: Record<string, T>) => {
  const packedValues: Record<string, Buffer> = Object.entries(values).reduce(
    (acc, cur) => {
      acc[cur[0]] = Buffer.from(encode(cur[1]));
      return acc;
    },
    {}
  );

  const result = await client.mSet(packedValues);
  console.log("Packed values:", packedValues);
  return result;
};

export const setupRedis = async () => {
  if (client != null) {
    return;
  }

  client = await createClient({
    url: process.env.REDIS_URI,
  }).connect();
};
