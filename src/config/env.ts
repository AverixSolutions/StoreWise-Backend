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
  PORT: parseInt(required("PORT", "3003"), 10),
  BCRYPT_SALT_ROUNDS: parseInt(required("BCRYPT_SALT_ROUNDS", "10"), 10),
  // R2
  R2_ACCOUNT_ID: required("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET_NAME: required("R2_BUCKET_NAME", "kynflow-bucket"),
  R2_PUBLIC_URL: required("R2_PUBLIC_URL"),
};
