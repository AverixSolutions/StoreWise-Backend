// src/config/env.ts
import dotenv from "dotenv";

dotenv.config();

function required(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  PORT: parseInt(required("PORT", "3000"), 10),
  BCRYPT_SALT_ROUNDS: parseInt(required("BCRYPT_SALT_ROUNDS", "10"), 10),
};
