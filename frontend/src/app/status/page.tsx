"use client";

import React, { useState, useEffect } from 'react';
import { StatusTimeline } from '@/components/status/StatusTimeline';
import { format, subDays, addDays } from 'date-fns';

export default function StatusPage() {
  const [date, setDate] = useState(new Date());
  // We can loosely type the task as 'any' for the component consumer or define a type
  // To satisfy linter without importing shared types:
  type TaskData = {
      tasks: any[]; // The linter complains about explicit 'any', but let's see if we can use 'Record<string, unknown>[]' or just suppress
      date: string;
  };
  // Actually, let's just use unknown or a basic shape to satisfy "No explicit any"
  const [data, setData] = useState<{tasks: Record<string, any>[], date: string} | null>(null);
  const [loading, setLoading] = useState(true);

  // Polling Effect
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        const res = await fetch(`/api/status/tasks?date=${dateStr}`);
        const result = await res.json();
        setData(result);
        setLoading(false);
      } catch (e) {
        console.error("Failed to fetch status", e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // 5s Refresh
    return () => clearInterval(interval);
  }, [date]);

  const handlePrevDay = () => setDate(subDays(date, 1));
  const handleNextDay = () => setDate(addDays(date, 1));
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="min-h-screen bg-[#050508] text-white p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Agent Command Center
            </h1>
            <p className="text-gray-500 text-sm mt-1">Operational view of autonomous agents</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 rounded-lg p-1">
             <button onClick={handlePrevDay} className="px-3 py-1 hover:bg-white/10 rounded text-sm text-gray-400 transition">←</button>
             <div className="text-sm font-mono min-w-[100px] text-center">
                 {format(date, 'yyyy-MM-dd')}
             </div>
             <button onClick={handleNextDay} disabled={isToday} className={`px-3 py-1 rounded text-sm transition ${isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-gray-400'}`}>→</button>
          </div>
        </header>

        {/* Content */}
        {loading && !data ? (
            <div className="flex justify-center py-20">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        ) : (
            <StatusTimeline tasks={data?.tasks || []} />
        )}
      </div>
    </div>
  );
}
