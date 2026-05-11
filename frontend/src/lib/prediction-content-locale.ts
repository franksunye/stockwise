export type PredictionContentLocale = 'cn' | 'en';

/**
 * Reads `locale` query param for prediction APIs.
 * Must align with `ai_predictions_v2.content_locale` (default stored/fallback is `cn`).
 */
export function parsePredictionContentLocaleParam(searchParams: URLSearchParams): PredictionContentLocale {
  const raw = searchParams.get('locale') ?? searchParams.get('contentLocale');
  return raw?.trim().toLowerCase() === 'en' ? 'en' : 'cn';
}

export function appLocaleToPredictionContentLocale(appLocale: string | undefined): PredictionContentLocale {
  return appLocale === 'en' ? 'en' : 'cn';
}
