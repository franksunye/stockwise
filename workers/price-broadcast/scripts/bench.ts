import * as http from "http";
import * as https from "https";

const TARGET =
  process.env.BENCH_TARGET_URL ??
  "http://127.0.0.1:8787/api/stock/prices/all?market=hk";

const TOTAL_REQUESTS = Number(process.env.BENCH_REQUESTS ?? "200");
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY ?? "20");
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS ?? "10000");

type Result = {
  ok: boolean;
  status: number;
  durationMs: number;
};

function doFetch(url: string): Promise<Result> {
  return new Promise((resolve) => {
    const start = performance.now();
    const lib = url.startsWith("https") ? https : http;
    const cookie = process.env.BENCH_COOKIE?.trim();
    const headers = cookie ? { Cookie: cookie } : undefined;

    const onResponse = (res: import("http").IncomingMessage) => {
      res.on("data", () => {
        // drain
      });
      res.on("end", () => {
        const end = performance.now();
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode ?? 0,
          durationMs: end - start,
        });
      });
    };

    const req =
      headers ? lib.get(url, { headers }, onResponse) : lib.get(url, onResponse);

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`timeout after ${TIMEOUT_MS}ms`));
    });

    req.on("error", () => {
      const end = performance.now();
      resolve({
        ok: false,
        status: 0,
        durationMs: end - start,
      });
    });
  });
}

async function run() {
  console.log(
    `Benchmarking ${TARGET} - ${TOTAL_REQUESTS} requests, concurrency=${CONCURRENCY}`,
  );

  const durations: number[] = [];
  let success = 0;
  let failure = 0;

  let inFlight = 0;
  let sent = 0;

  async function launch() {
    while (sent < TOTAL_REQUESTS && inFlight < CONCURRENCY) {
      inFlight++;
      sent++;
      void (async () => {
        const res = await doFetch(TARGET);
        durations.push(res.durationMs);
        if (res.ok) success++;
        else failure++;
        inFlight--;
        void launch();
      })();
    }
  }

  const globalStart = performance.now();
  await launch();

  // wait for all to finish
  while (inFlight > 0) {
    await new Promise((r) => setTimeout(r, 10));
  }
  const globalEnd = performance.now();

  durations.sort((a, b) => a - b);
  const p = (q: number) => durations[Math.floor((durations.length - 1) * q)];
  const avg =
    durations.reduce((sum, v) => sum + v, 0) / Math.max(1, durations.length);

  console.log("=== Summary ===");
  console.log(`Total:       ${durations.length}`);
  console.log(`Success:     ${success}`);
  console.log(`Failure:     ${failure}`);
  console.log(`Avg (ms):    ${avg.toFixed(1)}`);
  console.log(`p50 (ms):    ${p(0.5).toFixed(1)}`);
  console.log(`p90 (ms):    ${p(0.9).toFixed(1)}`);
  console.log(`p95 (ms):    ${p(0.95).toFixed(1)}`);
  console.log(`p99 (ms):    ${p(0.99).toFixed(1)}`);
  console.log(
    `Wall time:   ${(globalEnd - globalStart).toFixed(1)} ms for ${TOTAL_REQUESTS} requests`,
  );
}

run().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});

