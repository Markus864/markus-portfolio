import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { gunzipSync } from "zlib";
import pLimit from "p-limit";
import type { HistoricalDataPoint } from "./market-data-service";

const POLYGON_S3_ENDPOINT = "https://files.massive.com";
const POLYGON_S3_BUCKET = "flatfiles";

const s3Client = new S3Client({
  endpoint: POLYGON_S3_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.POLYGON_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.POLYGON_S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

const dayFileCache = new Map<string, { rows: FlatfileRow[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 10;
const MAX_DAYS_PER_REQUEST = 180;

export function isPolygonFlatfilesConfigured(): boolean {
  return !!(
    process.env.POLYGON_S3_ACCESS_KEY_ID &&
    process.env.POLYGON_S3_SECRET_ACCESS_KEY
  );
}

export type Timeframe = "1d" | "5m" | "15m" | "30m" | "1h" | "4h";

interface FlatfileRow {
  ticker: string;
  volume: number;
  open: number;
  close: number;
  high: number;
  low: number;
  window_start: number;
  transactions: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): FlatfileRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: FlatfileRow[] = [];

  const tickerIdx = headers.indexOf("ticker");
  const volumeIdx = headers.indexOf("volume");
  const openIdx = headers.indexOf("open");
  const closeIdx = headers.indexOf("close");
  const highIdx = headers.indexOf("high");
  const lowIdx = headers.indexOf("low");
  const windowStartIdx = headers.indexOf("window_start");
  const transactionsIdx = headers.indexOf("transactions");

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    rows.push({
      ticker: values[tickerIdx] || "",
      volume: parseFloat(values[volumeIdx]) || 0,
      open: parseFloat(values[openIdx]) || 0,
      close: parseFloat(values[closeIdx]) || 0,
      high: parseFloat(values[highIdx]) || 0,
      low: parseFloat(values[lowIdx]) || 0,
      window_start: parseFloat(values[windowStartIdx]) || 0,
      transactions: parseInt(values[transactionsIdx]) || 0,
    });
  }

  return rows;
}

function getDateRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && current.getTime() < today.getTime()) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatDateForPath(date: Date): { year: string; month: string; day: string } {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return { year, month, day };
}

function getDateKey(date: Date): string {
  const { year, month, day } = formatDateForPath(date);
  return `${year}-${month}-${day}`;
}

async function fetchDayAggregateFile(date: Date): Promise<FlatfileRow[] | null> {
  const dateKey = getDateKey(date);

  const cached = dayFileCache.get(dateKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.rows;
  }

  const { year, month, day } = formatDateForPath(date);
  const key = `us_stocks_sip/day_aggs_v1/${year}/${month}/${year}-${month}-${day}.csv.gz`;

  try {
    const command = new GetObjectCommand({
      Bucket: POLYGON_S3_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return null;
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const decompressed = gunzipSync(buffer);
    const content = decompressed.toString("utf-8");

    const rows = parseCSV(content);

    dayFileCache.set(dateKey, { rows, timestamp: Date.now() });

    return rows;
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
      dayFileCache.set(dateKey, { rows: [], timestamp: Date.now() });
      return null;
    }
    return null;
  }
}

export async function getHistoricalCandlesFromFlatfiles(
  symbol: string,
  timeframe: Timeframe,
  from: Date,
  to: Date
): Promise<HistoricalDataPoint[]> {
  const upperSymbol = symbol.toUpperCase();

  console.log(
    `[Flatfiles] Fetching ${timeframe} data for ${upperSymbol} from ${from.toISOString()} to ${to.toISOString()}`
  );

  if (!isPolygonFlatfilesConfigured()) {
    console.warn("[Flatfiles] S3 credentials not configured");
    return [];
  }

  if (timeframe !== "1d") {
    console.warn(
      `[Flatfiles] Timeframe ${timeframe} not yet supported, only 1d is currently implemented`
    );
    return [];
  }

  let tradingDates = getDateRange(from, to);
  
  if (tradingDates.length > MAX_DAYS_PER_REQUEST) {
    console.log(`[Flatfiles] Date range (${tradingDates.length} days) exceeds max (${MAX_DAYS_PER_REQUEST}), truncating to most recent ${MAX_DAYS_PER_REQUEST} days`);
    tradingDates = tradingDates.slice(-MAX_DAYS_PER_REQUEST);
  }
  
  console.log(`[Flatfiles] Fetching ${tradingDates.length} trading days (parallel, max ${MAX_CONCURRENT_REQUESTS} concurrent)...`);

  const limit = pLimit(MAX_CONCURRENT_REQUESTS);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    tradingDates.map((date) =>
      limit(async () => {
        const rows = await fetchDayAggregateFile(date);
        if (!rows || rows.length === 0) return null;

        const symbolRow = rows.find((r) => r.ticker.toUpperCase() === upperSymbol);
        if (!symbolRow) return null;

        const windowStartMs = symbolRow.window_start / 1_000_000;
        return {
          date: new Date(windowStartMs),
          open: symbolRow.open,
          high: symbolRow.high,
          low: symbolRow.low,
          close: symbolRow.close,
          volume: symbolRow.volume,
        } as HistoricalDataPoint;
      })
    )
  );

  const candles: HistoricalDataPoint[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      candles.push(result.value);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Flatfiles] Retrieved ${candles.length} candles for ${upperSymbol} in ${elapsed}ms`);

  candles.sort((a, b) => a.date.getTime() - b.date.getTime());

  return candles;
}

export async function listAvailableDates(year: number, month: number): Promise<string[]> {
  if (!isPolygonFlatfilesConfigured()) {
    return [];
  }

  const monthStr = month.toString().padStart(2, "0");
  const prefix = `us_stocks_sip/day_aggs_v1/${year}/${monthStr}/`;

  try {
    const command = new ListObjectsV2Command({
      Bucket: POLYGON_S3_BUCKET,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      return [];
    }

    return response.Contents.map((obj) => obj.Key || "").filter(Boolean);
  } catch (error: any) {
    console.error(`[Flatfiles] Error listing ${prefix}:`, error.message);
    return [];
  }
}

export function clearFlatfileCache(): void {
  dayFileCache.clear();
  console.log("[Flatfiles] Cache cleared");
}

export function getFlatfileCacheStats(): { size: number; keys: string[] } {
  return {
    size: dayFileCache.size,
    keys: Array.from(dayFileCache.keys()),
  };
}
