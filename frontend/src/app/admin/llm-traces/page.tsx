'use client';

import { ArrowLeft, Search, Cpu, Clock, MessageSquare, Terminal, AlignLeft, CheckCircle2, Copy, XCircle, Bug } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';

// Types
interface LLMTraceSummary {
  trace_id: string;
  symbol: string;
  model: string;
  status: string;
  latency_ms: number;
  total_tokens: number;
  created_at: string;
  retry_count: number;
}

interface LLMTraceDetail extends LLMTraceSummary {
  system_prompt: string;
  user_prompt: string;
  response_raw: string;
  response_parsed: string;
  input_tokens: number;
  output_tokens: number;
  error_message?: string;
}

export default function LLMTraceViewer() {
  const [traces, setTraces] = useState<LLMTraceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LLMTraceDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTraces = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('symbol', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '100');

      const res = await fetch(`/api/admin/llm-traces?${params.toString()}`);
      const data = await res.json();
      setTraces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }, [search, statusFilter]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/llm-traces/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Fetch List on Filter Change
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchTraces();
    }, 500); // Debounce
    return () => clearTimeout(timer);
  }, [search, statusFilter, fetchTraces]);

  // Fetch Detail when selected
  useEffect(() => {
    if (!selectedId) return;
    fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  return (
    <div className="min-h-screen bg-[#050508] text-slate-300 font-sans flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* Sidebar List */}
      <div className="w-full md:w-80 border-r border-white/5 flex flex-col bg-[#08080c]">
        {/* Header */}
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/admin" className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
            <h1 className="text-base font-black italic text-white tracking-tight">LLM CALLS</h1>
          </div>
          
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Filter by symbol..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex gap-2">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-indigo-500"
                >
                    <option value="">All Status</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                    <option value="parse_failed">Parse Failed</option>
                </select>
            </div>
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
                  className={`p-3 cursor-pointer hover:bg-white/5 transition-colors ${selectedId === trace.trace_id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-white text-sm">{trace.symbol || 'N/A'}</span>
                    <span className="text-[10px] font-mono text-slate-500">{trace.created_at?.substring(5, 19).replace('T', ' ')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        trace.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 
                        trace.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 
                        'bg-rose-500/20 text-rose-400'
                    }`}>
                      {trace.status}
                    </div>
                    {trace.retry_count > 0 && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1 rounded">
                            RETRY {trace.retry_count}
                        </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-600 font-mono">
                    <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> {trace.model}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {(trace.latency_ms / 1000).toFixed(1)}s
                    </span>
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
            <Bug className="w-16 h-16 opacity-20" />
            <p className="text-sm font-medium">Select a trace to verify raw LLM interaction</p>
          </div>
        ) : loadingDetail || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <LLMTraceDetailView trace={detail} />
        )}
      </div>
    </div>
  );
}

// Sub-component for Details
function LLMTraceDetailView({ trace }: { trace: LLMTraceDetail }) {
  const [activeTab, setActiveTab] = useState<'system' | 'user' | 'raw' | 'parsed'>('raw');
  
  // Format JSON if possible
  const formatJSON = (str: string) => {
    try {
        return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
        return str;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple alert for now, could be a toast
    // alert('Copied to clipboard'); 
  };

  const currentContent = 
    activeTab === 'system' ? trace.system_prompt :
    activeTab === 'user' ? trace.user_prompt :
    activeTab === 'parsed' ? formatJSON(trace.response_parsed || '{}') :
    formatJSON(trace.response_raw || ''); // Try to format raw if it is JSON

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#08080c]">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${trace.status === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-baseline gap-2">
                {trace.model} 
                <span className="text-slate-500 font-mono text-sm font-normal">{trace.trace_id.substring(0,8)}</span>
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded">
            <span className="text-slate-500">TOKENS:</span>
            <span className="text-indigo-400 font-bold">{trace.total_tokens.toLocaleString()}</span>
            <span className="text-slate-600">({trace.input_tokens} in / {trace.output_tokens} out)</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded">
             <span className="text-slate-500">LATENCY:</span>
             <span className="text-emerald-400 font-bold">{trace.latency_ms}ms</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-white/5 px-6 gap-6 text-xs font-bold tracking-wide bg-[#0A0A0E]">
        <button onClick={() => setActiveTab('user')} className={`py-4 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'user' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
            <MessageSquare className="w-3.5 h-3.5" /> USER PROMPT
        </button>
        <button onClick={() => setActiveTab('system')} className={`py-4 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'system' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
            <Terminal className="w-3.5 h-3.5" /> SYSTEM PROMPT
        </button>
        <button onClick={() => setActiveTab('raw')} className={`py-4 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'raw' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
            <AlignLeft className="w-3.5 h-3.5" /> RAW RESPONSE
        </button>
        {trace.response_parsed && (
            <button onClick={() => setActiveTab('parsed')} className={`py-4 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'parsed' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> PARSED JSON
            </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative group">
         <div className="absolute top-4 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => copyToClipboard(currentContent)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm transition-colors"
            >
                <Copy className="w-3 h-3" /> Copy
            </button>
         </div>
         
         <div className="h-full overflow-y-auto custom-scrollbar p-6">
            {trace.error_message && (
                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex gap-3">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-rose-400 font-bold text-sm mb-1">Execution Error</h4>
                        <p className="text-rose-300/80 text-xs font-mono whitespace-pre-wrap">{trace.error_message}</p>
                    </div>
                </div>
            )}
            
            <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
                {currentContent || <span className="text-slate-700 italic">No content available for this section.</span>}
            </pre>
         </div>
      </div>
    </div>
  );
}
