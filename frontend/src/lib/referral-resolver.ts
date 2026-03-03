
/**
 * Referral Resolution Deduplicator
 * ensures that multiple components requesting the same alias 
 * result in only one network request.
 */

interface ResolutionResult {
    userId: string;
    success: boolean;
}

const inFlightResolutions = new Map<string, Promise<ResolutionResult | null>>();

export async function resolveReferralCode(code: string): Promise<ResolutionResult | null> {
    if (!code) return null;

    // 1. If there's already a request for this code, return the same promise
    if (inFlightResolutions.has(code)) {
        return inFlightResolutions.get(code)!;
    }

    // 2. Start a new resolution
    const resolutionPromise = (async () => {
        try {
            const res = await fetch(`/api/user/resolve-referral?code=${encodeURIComponent(code)}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.success ? { userId: data.userId, success: true } : null;
        } catch (error) {
            console.error('Resolution utility error:', error);
            return null;
        } finally {
            // Clear from in-flight after a short delay (or keep it as short-term cache)
            setTimeout(() => inFlightResolutions.delete(code), 5000);
        }
    })();

    inFlightResolutions.set(code, resolutionPromise);
    return resolutionPromise;
}
