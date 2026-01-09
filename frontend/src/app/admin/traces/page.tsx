'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Terminal, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Cpu, 
  FileJson, 
  MessageSquare, 
  AlignLeft,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

// Types
interface TraceSummary {
  trace_id: string;
  symbol: string;
  date: string;
  model_id: string;
  strategy_name: string;
  status: string;
  total_duration_ms: number;
  created_at: string;
  error_reason?: string;
  error_step?: string;
}

interface TraceDetail extends TraceSummary {
  steps_executed: string; // JSON string
  steps_details: string; // JSON string
  chain_artifacts: string; // JSON string
  final_result: string; // JSON string
}

export default function TraceViewer() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');

  const fetchTraces = async () => {
    setLoadingList(true);
    try {
      const url = search ? `/api/admin/traces?symbol=${search}` : '/api/admin/traces';
      const res = await fetch(url);
      const data = await res.json();
      setTraces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/traces/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Fetch List
  useEffect(() => {
    fetchTraces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Detail when selected
  useEffect(() => {
    if (!selectedId) return;
    fetchDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-[#050508] text-slate-300 font-sans flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* Sidebar List */}
      <div className="w-full md:w-96 border-r border-white/5 flex flex-col bg-[#08080c]">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/admin" className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-black italic text-white tracking-tight">TRACE LOGS</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter by symbol..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTraces()}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingList ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {traces.map((trace) => (
                <div 
                  key={trace.trace_id}
                  onClick={() => setSelectedId(trace.trace_id)}
                  className={`p-4 cursor-pointer hover:bg-white/5 transition-colors ${selectedId === trace.trace_id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-white">{trace.symbol}</span>
                    <span className="text-[10px] font-mono text-slate-500">{trace.created_at?.substring(5, 16).replace('T', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${trace.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {trace.status}
                    </div>
                    <span className="text-xs text-slate-500">{trace.strategy_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-600 font-mono">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {(trace.total_duration_ms / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#050508]">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
            <Terminal className="w-16 h-16 opacity-20" />
            <p className="text-sm font-medium">Select a trace to verify execution details</p>
          </div>
        ) : loadingDetail || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <TraceDetailView trace={detail} />
        )}
      </div>
    </div>
  );
}

// Sub-component for Details
function TraceDetailView({ trace }: { trace: TraceDetail }) {
  const steps = parseSafe(trace.steps_executed, []);
  const details = parseSafe(trace.steps_details, []); // [{step, duration_ms}]
  const artifacts = parseSafe(trace.chain_artifacts, {});

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#08080c]">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${trace.status === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
          <h2 className="text-lg font-bold text-white tracking-tight">{trace.symbol} <span className="text-slate-500 font-normal">/ {trace.date}</span></h2>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
            <Cpu className="w-3 h-3 text-indigo-400" />
            {trace.model_id}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
            <Clock className="w-3 h-3 text-emerald-400" />
            {(trace.total_duration_ms / 1000).toFixed(2)}s Total
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Timeline Steps */}
          <div className="space-y-6 relative">
            {/* Vertical Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-white/10" />

            {steps.map((stepName: string, i: number) => {
              const stepDuration = details.find((d: { step: string; duration_ms: number }) => d.step === stepName)?.duration_ms || 0;
              const prompt = artifacts[`${stepName}_prompt`] || "No prompt captured";
              const result = artifacts[stepName] || artifacts[`${stepName}_raw`] || "No output";
              
              // Special case for Synthesis raw vs parsed
              const isSynthesis = stepName === 'synthesis';
              const rawReturn = artifacts[`${stepName}_raw`];
              const parsedResult = artifacts[stepName];

              return (
                <StepCard 
                  key={i} 
                  index={i} 
                  name={stepName} 
                  duration={stepDuration} 
                  prompt={prompt}
                  result={isSynthesis && rawReturn ? rawReturn : result}
                  parsed={isSynthesis ? parsedResult : null}
                />
              );
            })}
          </div>

          {/* Final Error (if any) */}
          {trace.error_reason && (
             <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex gap-4">
               <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
               <div className="space-y-2">
                 <h3 className="text-rose-400 font-bold">Execution Failed</h3>
                 <p className="text-rose-300/80 font-mono text-sm">{trace.error_reason}</p>
                 <p className="text-xs text-slate-500">Failed at step: {trace.error_step || 'unknown'}</p>
               </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}

function StepCard({ index, name, duration, prompt, result, parsed }: { 
  index: number; 
  name: string; 
  duration: number; 
  prompt: string; 
  result: string | Record<string, unknown>; 
  parsed: Record<string, unknown> | null; 
}) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'result' | 'parsed'>('result');
  
  // Default to prompt if result is missing (unlikely now)
  // Default to Parsed if available (Synthesis)
  useEffect(() => {
    if (parsed) setActiveTab('parsed');
  }, [parsed]);

  return (
    <div className="relative pl-12 group">
      {/* Node Dot */}
      <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-[#111] border-4 border-[#050508] flex items-center justify-center z-10 box-content">
        <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-black text-indigo-400">
           {index + 1}
        </div>
      </div>

      <div className="glass-card bg-[#0A0A0E] border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-colors">
        {/* Step Header */}
        <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
           <div>
             <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{name} Step</h3>
           </div>
           <span className="text-[10px] font-mono text-slate-500">{(duration / 1000).toFixed(2)}s</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 px-6 gap-6 text-xs font-bold tracking-wide">
          <button 
            onClick={() => setActiveTab('prompt')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'prompt' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            <MessageSquare className="w-3 h-3" /> INPUT PROMPT
          </button>
          
          {parsed && (
             <button 
               onClick={() => setActiveTab('parsed')}
               className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'parsed' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
             >
               <FileJson className="w-3 h-3" /> PARSED JSON
             </button>
          )}

          <button 
            onClick={() => setActiveTab('result')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'result' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            <AlignLeft className="w-3 h-3" /> {parsed ? 'RAW RESPONSE' : 'OUTPUT'}
          </button>
        </div>

        {/* Content */}
        <div className="bg-[#050508] p-0 relative group/code">
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-6">
             <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
               {activeTab === 'prompt' && prompt}
               {activeTab === 'result' && (typeof result === 'string' ? result : JSON.stringify(result, null, 2))}
               {activeTab === 'parsed' && JSON.stringify(parsed, null, 2)}
             </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseSafe(str: string, fallback: unknown) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
