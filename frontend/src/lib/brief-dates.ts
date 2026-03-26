export function toDateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function getBriefDateCandidates(
    today: Date,
    lastTradingDay: Date
): string[] {
    const todayDate = toDateOnly(today);
    const lastTradingDate = toDateOnly(lastTradingDay);

    return todayDate === lastTradingDate ? [todayDate] : [todayDate, lastTradingDate];
}
