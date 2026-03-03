export const runtime = 'edge';

export default function UXExperimentPage() {
    const serverTime = new Date().toISOString();
    
    return (
        <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md space-y-8 text-center">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black italic tracking-tighter">PHASE 0: CF TEST</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Performance Validation</p>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6 backdrop-blur-xl">
                    <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Server Render Time</p>
                        <p className="text-xl font-mono text-indigo-400">{serverTime}</p>
                    </div>
                    
                    <div className="h-px bg-white/5 w-full" />
                    
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                            如果你在晚上 8-10 点能流畅看到此页面，说明当前 Vercel 的延迟主要源于其网络分发节点在国内的路由表现，而非应用本身。
                        </p>
                        
                        <div className="flex justify-center gap-4">
                            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                Pure SSR
                            </div>
                            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold">
                                No DB Dependency
                            </div>
                        </div>
                    </div>
                </div>
                
                <p className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">
                    Platform: Cloudflare Pages (Edge)
                </p>
            </div>
        </div>
    );
}
