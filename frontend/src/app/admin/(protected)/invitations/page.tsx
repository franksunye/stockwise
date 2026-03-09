'use client';

import { useState, useEffect } from 'react';
import { 
  Ticket, 
  Plus, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  Filter,
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Zap,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Invitation {
  code: string;
  type: string;
  duration_days: number;
  is_used: boolean | number;
  used_by_user_id: string | null;
  used_at: string | null;
  created_at: string;
}

export default function InvitationManagement() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Create New Code States
  const [isCreating, setIsCreating] = useState(false);
  const [newCodeType, setNewCodeType] = useState('beta');
  const [newCodeCount, setNewCodeCount] = useState(5);
  const [newCodeDuration, setNewCodeDuration] = useState(30);

  const fetchInvitations = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/invitations');
      const data = await res.json();
      if (data.invitations) {
        setInvitations(data.invitations);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCodes = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: newCodeCount,
          type: newCodeType,
          duration_days: newCodeDuration
        })
      });
      if (res.ok) {
        fetchInvitations();
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create codes:', error);
      setIsCreating(false);
    }
  };

  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch = inv.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (inv.used_by_user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesType = filterType === 'all' || inv.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'used' ? inv.is_used : !inv.is_used);
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">邀请码数据加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Link href="/admin" className="flex items-center gap-2 text-slate-500 hover:text-indigo-400 transition-colors mb-4 group w-fit">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] uppercase font-black tracking-widest">返回管理中心</span>
            </Link>
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-5 h-5 text-indigo-500" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">Growth & Ops</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter">INVITATION <span className="text-indigo-500 underline decoration-4 underline-offset-8">MANAGER</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCreating(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-2 font-bold text-sm shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
              批量生成邀请码
            </button>
            <button 
              onClick={fetchInvitations}
              disabled={refreshing}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-90 transition-all ${refreshing ? 'animate-spin opacity-50' : 'hover:bg-white/10'}`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Create Modal Overlay */}
        <AnimatePresence>
          {isCreating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCreating(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-[#0a0a0f] border border-white/10 rounded-[32px] p-8 w-full max-w-md shadow-2xl"
              >
                <h2 className="text-2xl font-black italic mb-6">生成新邀请码</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">类型 (Type)</label>
                    <select 
                      value={newCodeType}
                      onChange={(e) => setNewCodeType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="beta">Beta Access (默认)</option>
                      <option value="pro_trial">Pro 会员试用</option>
                      <option value="gift">礼品赠送</option>
                      <option value="event">活动专用</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">生成数量 (Count)</label>
                      <input 
                        type="number" 
                        value={newCodeCount}
                        onChange={(e) => setNewCodeCount(parseInt(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">有效期 (Days)</label>
                      <input 
                        type="number" 
                        value={newCodeDuration}
                        onChange={(e) => setNewCodeDuration(parseInt(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors font-bold text-sm"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleCreateCodes}
                      className="flex-1 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 transition-colors font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      立即生成
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Filters & Search */}
        <section className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="搜索邀请码或使用者 ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-indigo-500 transition-all text-sm"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4">
              <Tag className="w-4 h-4 text-slate-500" />
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent text-sm py-3 outline-none"
              >
                <option value="all">所有类型</option>
                <option value="beta">Beta Access</option>
                <option value="pro_trial">Pro 试用</option>
                <option value="gift">礼品</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4">
              <Filter className="w-4 h-4 text-slate-500" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-sm py-3 outline-none"
              >
                <option value="all">所有状态</option>
                <option value="unused">未使用</option>
                <option value="used">已使用</option>
              </select>
            </div>
          </div>
        </section>

        {/* Table / Grid */}
        <section className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">邀请码</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">类型 / 权益</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">状态</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">使用者</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">时间 / 状态</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map((inv, i) => (
                  <motion.tr 
                    key={inv.code}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group text-sm"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-black mono text-indigo-400 group-hover:text-indigo-300 transition-colors uppercase tracking-wider">{inv.code}</span>
                        <button 
                          onClick={() => handleCopy(inv.code)}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          {copiedCode === inv.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-200 capitalize">{inv.type.replace('_', ' ')}</span>
                        <span className="text-[10px] text-slate-500 font-medium">权益: {inv.duration_days} 天会员</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {inv.is_used ? (
                        <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                          <Check className="w-3 h-3" /> 已使用
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <Clock className="w-3 h-3" /> 待领取
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {inv.used_by_user_id ? (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="mono truncate max-w-[120px]">{inv.used_by_user_id}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-200 font-medium">
                            {inv.is_used && inv.used_at 
                              ? new Date(inv.used_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : new Date(inv.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                            }
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                          {inv.is_used ? '使用于' : '创建于'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!inv.is_used && (
                        <button 
                          onClick={() => handleCopy(inv.code)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all"
                        >
                          拷贝
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            
            {filteredInvitations.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Search className="w-8 h-8 text-slate-600" />
                </div>
                <div>
                  <p className="text-slate-400 font-bold">没有找到匹配的邀请码</p>
                  <p className="text-xs text-slate-600">尝试更换搜索词或重置过滤器</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CSS for local usage if needed */}
        <style jsx global>{`
          .glass-card {
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 32px;
          }
          .mono {
            font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
          }
        `}</style>
      </div>
    </div>
  );
}
