import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

// 从 backend/.env、frontend/.env 加载，便于复用 USER_SESSION_SECRET、COMPARE_USER_ID、TURSO_*
try {
  // __dirname: <repo>/workers/price-broadcast/scripts
  // repo root is ../../..
  const root = path.resolve(__dirname, "../../..");
  for (const p of ["backend/.env", "frontend/.env", "frontend/.env.local", ".env"]) {
    const fp = path.join(root, p);
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) {
          const val = m[2].replace(/^["']|["']$/g, "").trim();
          if (val) process.env[m[1]] = val;
        }
      }
    }
  }
} catch {
  // ignore
}

const VERCEL_URL =
  process.env.VERCEL_PRICES_URL ??
  "https://app.ziso.cc/api/stock/prices?symbols=00700,03690";

const WORKER_URL =
  process.env.WORKER_PRICES_ALL_URL ??
  "http://127.0.0.1:8787/api/stock/prices/all?market=hk";

const SYMBOLS =
  (process.env.SYMBOLS ?? "00700,03690")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

type PriceRow = {
  symbol: string;
  close: number | null;
  change_percent: number | null;
  lastUpdated?: string | null;
};

type BroadcastItem = {
  symbol: string;
  lastPrice: number;
  change: number;
  changePct: number;
  updatedAt: string;
};

function createSessionToken(userId: string, secret: string): string {
  const payload = {
    u: userId,
    exp: Date.now() + 60 * 60 * 24 * 180 * 1000,
    n: crypto.randomBytes(16).toString("hex"),
  };
  const enc = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(enc).digest("base64url");
  return `${enc}.${sig}`;
}

async function fetchOneUserIdFromTurso(): Promise<string | null> {
  const url = process.env.TURSO_DB_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !token) return null;
  const base = url.replace(/^libsql:\/\//, "https://").replace(/^wss:\/\//, "https://").replace(/\/$/, "");
  const pipelineUrl = `${base}/v2/pipeline`;
  const body = JSON.stringify({
    requests: [
      { type: "execute", stmt: { sql: "SELECT user_id FROM users LIMIT 1" } },
      { type: "close" },
    ],
  });
  return new Promise((resolve) => {
    const opts = new URL(pipelineUrl);
    const reqOpts: https.RequestOptions = {
      hostname: opts.hostname,
      port: opts.port || 443,
      path: opts.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(reqOpts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          const r = json?.results?.[0];
          if (r?.type === "ok" && r?.response?.result?.rows?.[0]) {
            const cell = r.response.result.rows[0][0];
            resolve(cell?.value != null ? String(cell.value) : null);
          } else resolve(null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

function doJsonFetch<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const opts = new URL(url);
    const reqOpts: https.RequestOptions = {
      hostname: opts.hostname,
      port: opts.port || (opts.protocol === "https:" ? 443 : 80),
      path: opts.pathname + opts.search,
      method: "GET",
      headers: { ...extraHeaders },
    };
    const req = lib.get(reqOpts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 400) {
            return reject(
              new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`),
            );
          }
          const json = JSON.parse(body);
          resolve(json as T);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
  });
}

async function run() {
  console.log("Comparing Vercel prices vs Worker broadcast...");
  console.log("Symbols:", SYMBOLS.join(", "));
  console.log("Vercel URL:", VERCEL_URL);
  console.log("Worker URL:", WORKER_URL);

  let vercelHeaders: Record<string, string> = {};
  const secret = process.env.USER_SESSION_SECRET?.trim();
  let userId = process.env.COMPARE_USER_ID?.trim();
  if (!userId && secret) {
    userId = (await fetchOneUserIdFromTurso()) ?? undefined;
  }
  if (secret && userId) {
    const token = createSessionToken(userId, secret);
    vercelHeaders.Cookie = `stockwise_user_session=${token}`;
    console.log("Using session cookie for Vercel (userId:", userId.slice(0, 8) + "...)");
  } else if (VERCEL_URL.includes("app.ziso.cc")) {
    console.warn(
      "Vercel /api/stock/prices requires auth. Set USER_SESSION_SECRET and COMPARE_USER_ID (or TURSO_* to auto-fetch a user) in backend/.env or frontend/.env"
    );
  }

  const vercelResp = await doJsonFetch<{ prices: PriceRow[] }>(VERCEL_URL, vercelHeaders);
  const workerResp = await doJsonFetch<{
    items: BroadcastItem[];
  }>(WORKER_URL);

  const vercelMap = new Map<string, PriceRow>();
  for (const p of vercelResp.prices) {
    if (SYMBOLS.includes(p.symbol)) {
      vercelMap.set(p.symbol, p);
    }
  }

  const workerMap = new Map<string, BroadcastItem>();
  for (const item of workerResp.items) {
    if (SYMBOLS.includes(item.symbol)) {
      workerMap.set(item.symbol, item);
    }
  }

  console.log("\n=== Comparison ===");
  const tolerancePct = Number(process.env.TOLERANCE_PCT ?? "0.01"); // 1% 默认

  for (const symbol of SYMBOLS) {
    const vp = vercelMap.get(symbol);
    const wp = workerMap.get(symbol);

    if (!vp) {
      console.log(`${symbol}: missing in Vercel response`);
      continue;
    }
    if (!wp) {
      console.log(`${symbol}: missing in Worker response`);
      continue;
    }

    const vClose = vp.close ?? 0;
    const wClose = wp.lastPrice ?? 0;

    const vPct = vp.change_percent ?? 0;
    const wPct = wp.changePct ?? 0;

    const closeDiff =
      vClose === 0 ? Math.abs(wClose) : Math.abs(wClose - vClose) / vClose;
    const pctDiff =
      vPct === 0 ? Math.abs(wPct) : Math.abs(wPct - vPct) / Math.abs(vPct);

    const closeOk = closeDiff <= tolerancePct;
    const pctOk = pctDiff <= tolerancePct;

    console.log(
      `${symbol}: close vercel=${vClose} worker=${wClose} ` +
        `diff=${(closeDiff * 100).toFixed(2)}% [${closeOk ? "OK" : "MISMATCH"}]`,
    );
    console.log(
      `         change% vercel=${vPct} worker=${wPct} ` +
        `diff=${(pctDiff * 100).toFixed(2)}% [${pctOk ? "OK" : "MISMATCH"}]`,
    );
  }
}

run().catch((err) => {
  console.error("Comparison failed:", err);
  process.exit(1);
});

