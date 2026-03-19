"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSessionToken = createUserSessionToken;
/**
 * 生成 stockwise_user_session cookie，用于 compare-with-vercel 脚本访问需登录的 Vercel API。
 * 用法：COMPARE_USER_ID=xxx USER_SESSION_SECRET=xxx node scripts/gen-session-cookie.js
 * 或从 backend/.env / frontend/.env 加载（需先 npm install dotenv）
 */
var crypto = require("crypto");
var USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days
function base64UrlEncode(input) {
    return Buffer.from(input, "utf8").toString("base64url");
}
function signPayload(payloadEncoded, secret) {
    return crypto.createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}
function createUserSessionToken(userId, secret) {
    var payload = {
        u: userId,
        exp: Date.now() + USER_SESSION_TTL_SECONDS * 1000,
        n: crypto.randomBytes(16).toString("hex"),
    };
    var payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    var signature = signPayload(payloadEncoded, secret);
    return "".concat(payloadEncoded, ".").concat(signature);
}
function main() {
    var _a, _b;
    var secret = (_a = process.env.USER_SESSION_SECRET) === null || _a === void 0 ? void 0 : _a.trim();
    var userId = (_b = process.env.COMPARE_USER_ID) === null || _b === void 0 ? void 0 : _b.trim();
    if (!secret || !userId) {
        console.error("Usage: USER_SESSION_SECRET=xxx COMPARE_USER_ID=xxx node gen-session-cookie.js\n" +
            "Or load from backend/.env / frontend/.env via dotenv");
        process.exit(1);
    }
    var token = createUserSessionToken(userId, secret);
    console.log("stockwise_user_session=".concat(token));
}
main();
