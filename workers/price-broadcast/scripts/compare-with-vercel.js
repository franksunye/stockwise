"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
var http = require("http");
var https = require("https");
var path = require("path");
var fs = require("fs");
var crypto = require("crypto");
// 从 backend/.env、frontend/.env 加载，便于复用 USER_SESSION_SECRET、COMPARE_USER_ID、TURSO_*
try {
    // __dirname: <repo>/workers/price-broadcast/scripts
    // repo root is ../../..
    var root = path.resolve(__dirname, "../../..");
    for (var _i = 0, _d = ["backend/.env", "frontend/.env", "frontend/.env.local", ".env"]; _i < _d.length; _i++) {
        var p = _d[_i];
        var fp = path.join(root, p);
        if (fs.existsSync(fp)) {
            var content = fs.readFileSync(fp, "utf-8");
            for (var _e = 0, _f = content.split("\n"); _e < _f.length; _e++) {
                var line = _f[_e];
                var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
                if (m && !process.env[m[1]]) {
                    var val = m[2].replace(/^["']|["']$/g, "").trim();
                    if (val)
                        process.env[m[1]] = val;
                }
            }
        }
    }
}
catch (_g) {
    // ignore
}
var VERCEL_URL = (_a = process.env.VERCEL_PRICES_URL) !== null && _a !== void 0 ? _a : "https://app.ziso.cc/api/stock/prices?symbols=00700,03690";
var WORKER_URL = (_b = process.env.WORKER_PRICES_ALL_URL) !== null && _b !== void 0 ? _b : "http://127.0.0.1:8787/api/stock/prices/all?market=hk";
var SYMBOLS = ((_c = process.env.SYMBOLS) !== null && _c !== void 0 ? _c : "00700,03690")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
function createSessionToken(userId, secret) {
    var payload = {
        u: userId,
        exp: Date.now() + 60 * 60 * 24 * 180 * 1000,
        n: crypto.randomBytes(16).toString("hex"),
    };
    var enc = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    var sig = crypto.createHmac("sha256", secret).update(enc).digest("base64url");
    return "".concat(enc, ".").concat(sig);
}
function fetchOneUserIdFromTurso() {
    return __awaiter(this, void 0, void 0, function () {
        var url, token, base, pipelineUrl, body;
        var _a, _b;
        return __generator(this, function (_c) {
            url = (_a = process.env.TURSO_DB_URL) === null || _a === void 0 ? void 0 : _a.trim();
            token = (_b = process.env.TURSO_AUTH_TOKEN) === null || _b === void 0 ? void 0 : _b.trim();
            if (!url || !token)
                return [2 /*return*/, null];
            base = url.replace(/^libsql:\/\//, "https://").replace(/^wss:\/\//, "https://").replace(/\/$/, "");
            pipelineUrl = "".concat(base, "/v2/pipeline");
            body = JSON.stringify({
                requests: [
                    { type: "execute", stmt: { sql: "SELECT user_id FROM users LIMIT 1" } },
                    { type: "close" },
                ],
            });
            return [2 /*return*/, new Promise(function (resolve) {
                    var opts = new URL(pipelineUrl);
                    var reqOpts = {
                        hostname: opts.hostname,
                        port: opts.port || 443,
                        path: opts.pathname,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(token),
                            "Content-Length": Buffer.byteLength(body),
                        },
                    };
                    var req = https.request(reqOpts, function (res) {
                        var chunks = [];
                        res.on("data", function (d) { return chunks.push(d); });
                        res.on("end", function () {
                            var _a, _b, _c, _d;
                            try {
                                var json = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
                                var r = (_a = json === null || json === void 0 ? void 0 : json.results) === null || _a === void 0 ? void 0 : _a[0];
                                if ((r === null || r === void 0 ? void 0 : r.type) === "ok" && ((_d = (_c = (_b = r === null || r === void 0 ? void 0 : r.response) === null || _b === void 0 ? void 0 : _b.result) === null || _c === void 0 ? void 0 : _c.rows) === null || _d === void 0 ? void 0 : _d[0])) {
                                    var cell = r.response.result.rows[0][0];
                                    resolve((cell === null || cell === void 0 ? void 0 : cell.value) != null ? String(cell.value) : null);
                                }
                                else
                                    resolve(null);
                            }
                            catch (_e) {
                                resolve(null);
                            }
                        });
                    });
                    req.on("error", function () { return resolve(null); });
                    req.write(body);
                    req.end();
                })];
        });
    });
}
function doJsonFetch(url, extraHeaders) {
    return new Promise(function (resolve, reject) {
        var lib = url.startsWith("https") ? https : http;
        var opts = new URL(url);
        var reqOpts = {
            hostname: opts.hostname,
            port: opts.port || (opts.protocol === "https:" ? 443 : 80),
            path: opts.pathname + opts.search,
            method: "GET",
            headers: __assign({}, extraHeaders),
        };
        var req = lib.get(reqOpts, function (res) {
            var chunks = [];
            res.on("data", function (d) { return chunks.push(d); });
            res.on("end", function () {
                try {
                    var body = Buffer.concat(chunks).toString("utf-8");
                    if (res.statusCode && res.statusCode >= 400) {
                        return reject(new Error("HTTP ".concat(res.statusCode, ": ").concat(body.slice(0, 200))));
                    }
                    var json = JSON.parse(body);
                    resolve(json);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on("error", reject);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var vercelHeaders, secret, userId, token, vercelResp, workerResp, vercelMap, _i, _a, p, workerMap, _b, _c, item, tolerancePct, _d, SYMBOLS_1, symbol, vp, wp, vClose, wClose, vPct, wPct, closeDiff, pctDiff, closeOk, pctOk;
        var _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    console.log("Comparing Vercel prices vs Worker broadcast...");
                    console.log("Symbols:", SYMBOLS.join(", "));
                    console.log("Vercel URL:", VERCEL_URL);
                    console.log("Worker URL:", WORKER_URL);
                    vercelHeaders = {};
                    secret = (_e = process.env.USER_SESSION_SECRET) === null || _e === void 0 ? void 0 : _e.trim();
                    userId = (_f = process.env.COMPARE_USER_ID) === null || _f === void 0 ? void 0 : _f.trim();
                    if (!(!userId && secret)) return [3 /*break*/, 2];
                    return [4 /*yield*/, fetchOneUserIdFromTurso()];
                case 1:
                    userId = (_g = (_o.sent())) !== null && _g !== void 0 ? _g : undefined;
                    _o.label = 2;
                case 2:
                    if (secret && userId) {
                        token = createSessionToken(userId, secret);
                        vercelHeaders.Cookie = "stockwise_user_session=".concat(token);
                        console.log("Using session cookie for Vercel (userId:", userId.slice(0, 8) + "...)");
                    }
                    else if (VERCEL_URL.includes("app.ziso.cc")) {
                        console.warn("Vercel /api/stock/prices requires auth. Set USER_SESSION_SECRET and COMPARE_USER_ID (or TURSO_* to auto-fetch a user) in backend/.env or frontend/.env");
                    }
                    return [4 /*yield*/, doJsonFetch(VERCEL_URL, vercelHeaders)];
                case 3:
                    vercelResp = _o.sent();
                    return [4 /*yield*/, doJsonFetch(WORKER_URL)];
                case 4:
                    workerResp = _o.sent();
                    vercelMap = new Map();
                    for (_i = 0, _a = vercelResp.prices; _i < _a.length; _i++) {
                        p = _a[_i];
                        if (SYMBOLS.includes(p.symbol)) {
                            vercelMap.set(p.symbol, p);
                        }
                    }
                    workerMap = new Map();
                    for (_b = 0, _c = workerResp.items; _b < _c.length; _b++) {
                        item = _c[_b];
                        if (SYMBOLS.includes(item.symbol)) {
                            workerMap.set(item.symbol, item);
                        }
                    }
                    console.log("\n=== Comparison ===");
                    tolerancePct = Number((_h = process.env.TOLERANCE_PCT) !== null && _h !== void 0 ? _h : "0.01");
                    for (_d = 0, SYMBOLS_1 = SYMBOLS; _d < SYMBOLS_1.length; _d++) {
                        symbol = SYMBOLS_1[_d];
                        vp = vercelMap.get(symbol);
                        wp = workerMap.get(symbol);
                        if (!vp) {
                            console.log("".concat(symbol, ": missing in Vercel response"));
                            continue;
                        }
                        if (!wp) {
                            console.log("".concat(symbol, ": missing in Worker response"));
                            continue;
                        }
                        vClose = (_j = vp.close) !== null && _j !== void 0 ? _j : 0;
                        wClose = (_k = wp.lastPrice) !== null && _k !== void 0 ? _k : 0;
                        vPct = (_l = vp.change_percent) !== null && _l !== void 0 ? _l : 0;
                        wPct = (_m = wp.changePct) !== null && _m !== void 0 ? _m : 0;
                        closeDiff = vClose === 0 ? Math.abs(wClose) : Math.abs(wClose - vClose) / vClose;
                        pctDiff = vPct === 0 ? Math.abs(wPct) : Math.abs(wPct - vPct) / Math.abs(vPct);
                        closeOk = closeDiff <= tolerancePct;
                        pctOk = pctDiff <= tolerancePct;
                        console.log("".concat(symbol, ": close vercel=").concat(vClose, " worker=").concat(wClose, " ") +
                            "diff=".concat((closeDiff * 100).toFixed(2), "% [").concat(closeOk ? "OK" : "MISMATCH", "]"));
                        console.log("         change% vercel=".concat(vPct, " worker=").concat(wPct, " ") +
                            "diff=".concat((pctDiff * 100).toFixed(2), "% [").concat(pctOk ? "OK" : "MISMATCH", "]"));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
run().catch(function (err) {
    console.error("Comparison failed:", err);
    process.exit(1);
});
