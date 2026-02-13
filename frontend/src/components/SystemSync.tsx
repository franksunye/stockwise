"use client";

import { useEffect } from "react";
import { updateHolidays } from "@/lib/date-utils";

/**
 * Global component to sync key system configurations on app start.
 * Currently syncs:
 * - Market Holidays (from DB)
 */
export function SystemSync() {
  useEffect(() => {
    const syncHolidays = async () => {
      try {
        const res = await fetch("/api/system/calendar");
        if (res.ok) {
          const data = await res.json();
          if (data && (data.HK || data.CN)) {
            console.log("📅 System Sync: Market holidays updated from DB");
            updateHolidays(data);
          }
        }
      } catch (err) {
        console.warn("📅 System Sync: Failed to fetch holidays", err);
      }
    };

    // Execute immediately
    syncHolidays();
    
    // Optional: Re-sync every hour (if long running tab)
    const interval = setInterval(syncHolidays, 3600 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
