import { jwtVerify } from "jose";

let jwtSecret: Uint8Array = null;

export interface JwtUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export const setJwtSecret = (secret: Uint8Array) => (jwtSecret = secret);

const getBearerToken = (req) => {
  if (
    !req.headers.authorization ||
    req.headers.authorization.split(" ")[0] !== "Bearer"
  ) {
    throw new Error("Invalid Authorization header");
  }

  return req.headers.authorization.split(" ")[1];
};

export const decodeJWT = async (req) => {
  if (!jwtSecret) {
    throw new Error("JWT secret not ready");
  }

  const token = getBearerToken(req);
  const { payload } = await jwtVerify(token, jwtSecret);

  return payload as unknown as JwtUser;
};
