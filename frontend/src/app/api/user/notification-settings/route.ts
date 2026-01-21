import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

// Default notification settings
const getDefaultSettings = () => ({
  enabled: true,
  types: {
    signal_flip: { enabled: true, priority: 'high' },
    morning_call: { enabled: true, priority: 'medium' },
    validation_glory: { enabled: true, priority: 'medium' },
    prediction_updated: { enabled: true, priority: 'low' },
    daily_brief: { enabled: true, priority: 'low' },
  },
});

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ settings: getDefaultSettings() });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  try {
    db = getDbClient();
    const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

    let settingsJson: string | null = null;
    
    if (isCloud) {
      const result = await db.execute({
        sql: 'SELECT notification_settings FROM users WHERE user_id = ?',
        args: [userId],
      });
      settingsJson = result.rows[0]?.notification_settings || null;
    } else {
      const row = db.prepare('SELECT notification_settings FROM users WHERE user_id = ?').get(userId) as { notification_settings?: string } | undefined;
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
    const { userId, settings } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    db = getDbClient();
    const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

    const settingsJson = JSON.stringify(settings);

    if (isCloud) {
      await db.execute({
        sql: 'UPDATE users SET notification_settings = ? WHERE user_id = ?',
        args: [settingsJson, userId],
      });
    } else {
      db.prepare('UPDATE users SET notification_settings = ? WHERE user_id = ?').run(settingsJson, userId);
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
