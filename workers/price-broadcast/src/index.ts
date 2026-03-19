export interface Env {
  /**
   * Turso HTTP endpoint, e.g. "https://<db>.turso.io"
   */
  TURSO_DB_URL: string;
  TURSO_AUTH_TOKEN?: string;
}

type PriceBroadcastRequest = {
  market?: "hk" | "cn";
  /**
   * POC/对比用：显式指定要返回的 symbol 列表。
   * 不传时走 broadcast 语义（global_stock_pool + stock_meta）。
   */
  symbols?: string;
  limit?: string;
};

type PriceBroadcastItem = {
  symbol: string;
  lastPrice: number;
  change: number;
  changePct: number;
  updatedAt: string; // ISO timestamp
};

type PriceBroadcastResponse = {
  market: string;
  asOf: string;
  items: PriceBroadcastItem[];
};

export default {
  /**
   * Minimal POC handler: validates input and returns a static payload.
   * 后续接 Turso 时，只需要替换 `fetchPricesFromTurso` 的实现。
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== "/api/stock/prices/all") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const params: PriceBroadcastRequest = {
      market:
        (url.searchParams.get("market") as PriceBroadcastRequest["market"]) ?? "hk",
      symbols: url.searchParams.get("symbols") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    };

    try {
      const payload = await fetchPricesFromTurso(params, env);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({
          error: "INTERNAL_ERROR",
          message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    }
  },
};

function encodeTursoArg(value: string | number | null): { type: string; value: string | number | null } {
  if (value === null) return { type: "null", value: null };
  if (typeof value === "number") {
    // 关键：与 backend/database.py 的实现保持一致
    // integer.value 需要是字符串，避免 Turso /v2/pipeline 返回 400。
    return {
      type: Number.isInteger(value) ? "integer" : "float",
      value: Number.isInteger(value) ? String(value) : value,
    };
  }
  return { type: "text", value: String(value) };
}

async function tursoQuery<T = unknown>(
  env: Env,
  sql: string,
  params: (string | number)[] = [],
  timeoutMs: number = 2000,
): Promise<T[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const baseUrl = env.TURSO_DB_URL.replace(/^libsql:\/\//, "https://").replace(/^wss:\/\//, "https://");
  const pipelineUrl = baseUrl.endsWith("/v2/pipeline") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/v2/pipeline`;

  try {
    const stmt: { sql: string; args?: { type: string; value: string | number | null }[] } = { sql };
    if (params.length > 0) {
      stmt.args = params.map(encodeTursoArg);
    }

    const res = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.TURSO_AUTH_TOKEN ? { Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt },
          { type: "close" },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Turso HTTP error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      results?: { type?: string; response?: { result?: { cols?: { name: string }[]; rows?: { value: unknown; type: string }[][] } } }[];
    };

    const first = json.results?.[0];
    const result = first?.response?.result;
    if (!result || first?.type === "error") return [];

    const cols = result.cols ?? [];
    const rawRows = result.rows ?? [];
    const columnNames = cols.map((c) => c.name);

    return rawRows.map((row) => {
      const obj: Record<string, unknown> = {};
      row.forEach((cell, idx) => {
        const name = columnNames[idx] ?? String(idx);
        const t = cell?.type ?? "text";
        const v = cell?.value;
        if (t === "integer") obj[name] = v != null ? Number(v) : null;
        else if (t === "float") obj[name] = v != null ? Number(v) : null;
        else obj[name] = v != null ? String(v) : null;
      });
      return obj as T;
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPricesFromTurso(
  req: PriceBroadcastRequest,
  env: Env,
): Promise<PriceBroadcastResponse> {
  if (!env.TURSO_DB_URL) {
    // 保持 POC 可用：如果没有配置 Turso，就直接返回静态示例。
    return buildStaticResponse(req);
  }

  try {
    type Row = {
      symbol: string;
      close: number | null;
      change_percent: number | null;
      date: string;
    };

    const requestedSymbols = (req.symbols ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const limit = Number(req.limit ?? "200");

    let sql = "";
    let queryParams: (string | number)[] = [];

    // POC 对比路径：显式 symbols，语义对齐 frontend 的 getLatestPrices
    if (requestedSymbols.length > 0) {
      const clipped = requestedSymbols.slice(0, 100);
      const placeholders = clipped.map(() => "?").join(",");
      sql = `
        SELECT dp.symbol, dp.close, dp.change_percent, dp.date
        FROM daily_prices dp
        INNER JOIN (
          SELECT symbol, MAX(date) as max_date
          FROM daily_prices
          WHERE symbol IN (${placeholders})
          GROUP BY symbol
        ) latest
        ON dp.symbol = latest.symbol AND dp.date = latest.max_date
        ORDER BY dp.symbol
        LIMIT ?
      `;
      queryParams = [...clipped, limit];
    } else {
      // 默认 broadcast 语义：global_stock_pool + stock_meta.market
      sql = `
        WITH pool AS (
          SELECT gp.symbol
          FROM global_stock_pool gp
          JOIN stock_meta sm ON gp.symbol = sm.symbol
          WHERE sm.market = ?
        ),
        latest AS (
          SELECT symbol, MAX(date) AS max_date
          FROM daily_prices
          WHERE symbol IN (SELECT symbol FROM pool)
          GROUP BY symbol
        )
        SELECT dp.symbol,
              dp.close,
              dp.change_percent,
              dp.date
        FROM daily_prices dp
        JOIN latest l
          ON dp.symbol = l.symbol
         AND dp.date = l.max_date
        ORDER BY dp.symbol
        LIMIT ?
      `;
      queryParams = [req.market ?? "hk", limit];
    }

    const rows = await tursoQuery<Row>(env, sql, queryParams);

    const now = new Date().toISOString();
    const items: PriceBroadcastItem[] = rows.map((r) => ({
      symbol: r.symbol,
      lastPrice: typeof r.close === "number" ? r.close : 0,
      // 近似还原绝对涨跌额：change_percent 是百分比
      change:
        typeof r.close === "number" && typeof r.change_percent === "number"
          ? (r.close * r.change_percent) / 100
          : 0,
      changePct: r.change_percent ?? 0,
      updatedAt: r.date || now,
    }));

    return {
      market: req.market ?? "hk",
      asOf: now,
      items,
    };
  } catch (error) {
    // 若 Turso 查询失败，退回静态示例，保证 POC Worker 不成为单点。
    console.error("[price-broadcast] Turso query failed, falling back to static data:", error);
    return buildStaticResponse(req);
  }
}

function buildStaticResponse(req: PriceBroadcastRequest): PriceBroadcastResponse {
  const now = new Date().toISOString();

  const items: PriceBroadcastItem[] = [
    {
      symbol: "00700",
      lastPrice: 320.5,
      change: 3.2,
      changePct: 1.01,
      updatedAt: now,
    },
    {
      symbol: "03690",
      lastPrice: 92.3,
      change: -1.5,
      changePct: -1.60,
      updatedAt: now,
    },
  ];

  return {
    market: req.market ?? "hk",
    asOf: now,
    items,
  };
}

