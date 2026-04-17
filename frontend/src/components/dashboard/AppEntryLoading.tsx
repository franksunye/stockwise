'use client';

import { Zap } from 'lucide-react';

export function AppEntryLoading({
  route = 'onboarding',
}: {
  route?: 'onboarding' | 'shell';
}) {
  const subtitle =
    route === 'onboarding' ? 'Getting your trial ready...' : 'Loading...';

  return (
    <div
      data-app-entry-loading={route}
      className="min-h-screen flex items-center justify-center px-6"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl">
            <Zap className="h-10 w-10 text-indigo-300" strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2">
            <span className="h-1.5 w-8 rounded-full bg-indigo-400" />
            <span className="h-1.5 w-2 rounded-full bg-white/20" />
            <span className="h-1.5 w-2 rounded-full bg-white/20" />
            <span className="h-1.5 w-2 rounded-full bg-white/20" />
          </div>
          <div className="text-center">
            <div className="text-3xl font-black tracking-tight text-white">
              ZISO AI
            </div>
            <p className="mt-2 text-sm font-medium text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="w-full rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mx-auto h-4 w-28 rounded-full bg-white/8" />
          <div className="mx-auto mt-4 h-8 w-56 rounded-2xl bg-white/10" />
          <div className="mx-auto mt-8 h-3 w-48 rounded-full bg-white/8" />
          <div className="mx-auto mt-2 h-3 w-40 rounded-full bg-white/6" />
          <div className="mt-8 h-14 rounded-[20px] bg-white" />
        </div>
      </div>
    </div>
  );
}
