/**
 * 生成 stockwise_user_session cookie，用于 compare-with-vercel 脚本访问需登录的 Vercel API。
 * 用法：COMPARE_USER_ID=xxx USER_SESSION_SECRET=xxx node scripts/gen-session-cookie.js
 * 或从 backend/.env / frontend/.env 加载（需先 npm install dotenv）
 */
import * as crypto from "crypto";

const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function signPayload(payloadEncoded: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}

export function createUserSessionToken(userId: string, secret: string): string {
  const payload = {
    u: userId,
    exp: Date.now() + USER_SESSION_TTL_SECONDS * 1000,
    n: crypto.randomBytes(16).toString("hex"),
  };
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(payloadEncoded, secret);
  return `${payloadEncoded}.${signature}`;
}

function main() {
  const secret = process.env.USER_SESSION_SECRET?.trim();
  const userId = process.env.COMPARE_USER_ID?.trim();
  if (!secret || !userId) {
    console.error(
      "Usage: USER_SESSION_SECRET=xxx COMPARE_USER_ID=xxx node gen-session-cookie.js\n" +
        "Or load from backend/.env / frontend/.env via dotenv"
    );
    process.exit(1);
  }
  const token = createUserSessionToken(userId, secret);
  console.log(`stockwise_user_session=${token}`);
}

main();
