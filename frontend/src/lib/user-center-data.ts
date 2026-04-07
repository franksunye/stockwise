export interface NotificationTypeSetting {
    enabled: boolean;
    priority?: string;
}

export interface NotificationSettings {
    enabled?: boolean;
    types: {
        signal_flip: NotificationTypeSetting;
        morning_call: NotificationTypeSetting;
        validation_glory: NotificationTypeSetting;
        prediction_updated: NotificationTypeSetting;
        daily_brief: NotificationTypeSetting;
        price_update: NotificationTypeSetting;
        market_almanac: NotificationTypeSetting;
        ai_radar_alert: NotificationTypeSetting;
    };
}

export interface UserCenterModeSummary {
    name: string;
    risk_band: string;
    tagline: string;
    default_horizon: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: true,
    types: {
        signal_flip: { enabled: true, priority: 'high' },
        morning_call: { enabled: true, priority: 'medium' },
        validation_glory: { enabled: true, priority: 'medium' },
        prediction_updated: { enabled: true, priority: 'low' },
        daily_brief: { enabled: false, priority: 'low' },
        price_update: { enabled: false, priority: 'low' },
        market_almanac: { enabled: false, priority: 'medium' },
        ai_radar_alert: { enabled: true, priority: 'high' },
    },
};

export function normalizeNotificationSettings(
    settings?: Partial<NotificationSettings> | null,
): NotificationSettings {
    return {
        enabled: settings?.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
        types: {
            signal_flip: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.signal_flip,
                ...(settings?.types?.signal_flip || {}),
            },
            morning_call: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.morning_call,
                ...(settings?.types?.morning_call || {}),
            },
            validation_glory: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.validation_glory,
                ...(settings?.types?.validation_glory || {}),
            },
            prediction_updated: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.prediction_updated,
                ...(settings?.types?.prediction_updated || {}),
            },
            daily_brief: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.daily_brief,
                ...(settings?.types?.daily_brief || {}),
            },
            price_update: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.price_update,
                ...(settings?.types?.price_update || {}),
            },
            market_almanac: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.market_almanac,
                ...(settings?.types?.market_almanac || {}),
            },
            ai_radar_alert: {
                ...DEFAULT_NOTIFICATION_SETTINGS.types.ai_radar_alert,
                ...(settings?.types?.ai_radar_alert || {}),
            },
        },
    };
}

export function readCachedUserCenterMode(raw: string | null): UserCenterModeSummary | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as {
            modeResponse?: {
                mode?: UserCenterModeSummary;
            };
        };
        return parsed?.modeResponse?.mode || null;
    } catch {
        return null;
    }
}
