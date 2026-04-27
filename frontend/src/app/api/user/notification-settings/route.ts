import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireUserSession } from '@/lib/user-session';

// Default notification settings
const getDefaultSettings = () => ({
  enabled: true,
  types: {
    signal_flip: { enabled: true, priority: 'high' },
    morning_call: { enabled: true, priority: 'medium' },
    validation_glory: { enabled: true, priority: 'medium' },
    prediction_updated: { enabled: true, priority: 'low' },
    daily_brief: { enabled: false, priority: 'low' },
    price_update: { enabled: false, priority: 'low' },  // 实时价格更新，默认关闭避免打扰
    market_almanac: { enabled: false, priority: 'medium' }, // 投资黄历
    ai_radar_alert: { enabled: true, priority: 'high' }, // 盘中结构雷达
  },
});

export async function GET(req: NextRequest) {
  const auth = requireUserSession(req);
  if ('response' in auth) return auth.response;
  const userId = auth.userId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  try {
    db = getDbClient();
    const isCloud = db.$type === 'cloud';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = db as any;

    let settingsJson: string | null = null;

    if (isCloud) {
      const result = await client.execute({
        sql: 'SELECT notification_settings FROM users WHERE user_id = ?',
        args: [userId],
      });
      settingsJson = result.rows[0]?.notification_settings || null;
    } else {
      const row = client.prepare('SELECT notification_settings FROM users WHERE user_id = ?').get(userId) as { notification_settings?: string } | undefined;
      settingsJson = row?.notification_settings || null;
    }

    const settings = settingsJson
      ? JSON.parse(settingsJson)
      : getDefaultSettings();

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch notification settings:', error);
    return NextResponse.json({ settings: getDefaultSettings() });
  } finally {
    if (db && typeof db.close === 'function') {
      db.close();
    }
  }
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  try {
    const auth = requireUserSession(req);
    if ('response' in auth) return auth.response;
    const userId = auth.userId;
    const { settings } = await req.json();

    db = getDbClient();
    const isCloud = db.$type === 'cloud';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = db as any;

    const settingsJson = JSON.stringify(settings);

    if (isCloud) {
      await client.execute({
        sql: 'UPDATE users SET notification_settings = ? WHERE user_id = ?',
        args: [settingsJson, userId],
      });
    } else {
      client.prepare('UPDATE users SET notification_settings = ? WHERE user_id = ?').run(settingsJson, userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save notification settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  } finally {
    if (db && typeof db.close === 'function') {
      db.close();
    }
  }
}
