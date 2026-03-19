"use strict";
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
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
var http = require("http");
var https = require("https");
var TARGET = (_a = process.env.BENCH_TARGET_URL) !== null && _a !== void 0 ? _a : "http://127.0.0.1:8787/api/stock/prices/all?market=hk";
var TOTAL_REQUESTS = Number((_b = process.env.BENCH_REQUESTS) !== null && _b !== void 0 ? _b : "200");
var CONCURRENCY = Number((_c = process.env.BENCH_CONCURRENCY) !== null && _c !== void 0 ? _c : "20");
var TIMEOUT_MS = Number((_d = process.env.BENCH_TIMEOUT_MS) !== null && _d !== void 0 ? _d : "10000");
function doFetch(url) {
    return new Promise(function (resolve) {
        var _a;
        var start = performance.now();
        var lib = url.startsWith("https") ? https : http;
        var cookie = (_a = process.env.BENCH_COOKIE) === null || _a === void 0 ? void 0 : _a.trim();
        var headers = cookie ? { Cookie: cookie } : undefined;
        var onResponse = function (res) {
            res.on("data", function () {
                // drain
            });
            res.on("end", function () {
                var _a;
                var end = performance.now();
                resolve({
                    ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
                    status: (_a = res.statusCode) !== null && _a !== void 0 ? _a : 0,
                    durationMs: end - start,
                });
            });
        };
        var req = headers ? lib.get(url, { headers: headers }, onResponse) : lib.get(url, onResponse);
        req.setTimeout(TIMEOUT_MS, function () {
            req.destroy(new Error("timeout after ".concat(TIMEOUT_MS, "ms")));
        });
        req.on("error", function () {
            var end = performance.now();
            resolve({
                ok: false,
                status: 0,
                durationMs: end - start,
            });
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        function launch() {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    while (sent < TOTAL_REQUESTS && inFlight < CONCURRENCY) {
                        inFlight++;
                        sent++;
                        void (function () { return __awaiter(_this, void 0, void 0, function () {
                            var res;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, doFetch(TARGET)];
                                    case 1:
                                        res = _a.sent();
                                        durations.push(res.durationMs);
                                        if (res.ok)
                                            success++;
                                        else
                                            failure++;
                                        inFlight--;
                                        void launch();
                                        return [2 /*return*/];
                                }
                            });
                        }); })();
                    }
                    return [2 /*return*/];
                });
            });
        }
        var durations, success, failure, inFlight, sent, globalStart, globalEnd, p, avg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Benchmarking ".concat(TARGET, " - ").concat(TOTAL_REQUESTS, " requests, concurrency=").concat(CONCURRENCY));
                    durations = [];
                    success = 0;
                    failure = 0;
                    inFlight = 0;
                    sent = 0;
                    globalStart = performance.now();
                    return [4 /*yield*/, launch()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    if (!(inFlight > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 10); })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 2];
                case 4:
                    globalEnd = performance.now();
                    durations.sort(function (a, b) { return a - b; });
                    p = function (q) { return durations[Math.floor((durations.length - 1) * q)]; };
                    avg = durations.reduce(function (sum, v) { return sum + v; }, 0) / Math.max(1, durations.length);
                    console.log("=== Summary ===");
                    console.log("Total:       ".concat(durations.length));
                    console.log("Success:     ".concat(success));
                    console.log("Failure:     ".concat(failure));
                    console.log("Avg (ms):    ".concat(avg.toFixed(1)));
                    console.log("p50 (ms):    ".concat(p(0.5).toFixed(1)));
                    console.log("p90 (ms):    ".concat(p(0.9).toFixed(1)));
                    console.log("p95 (ms):    ".concat(p(0.95).toFixed(1)));
                    console.log("p99 (ms):    ".concat(p(0.99).toFixed(1)));
                    console.log("Wall time:   ".concat((globalEnd - globalStart).toFixed(1), " ms for ").concat(TOTAL_REQUESTS, " requests"));
                    return [2 /*return*/];
            }
        });
    });
}
run().catch(function (err) {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
