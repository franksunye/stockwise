'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';

interface TradePosition {
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  entry_date: string;
  entry_price: number;
  position_size: number;
  remaining_size: number;
  direction: string;
  status: string;
  source: string | null;
  note: string | null;
  stock_name: string | null;
  latest_trade_date: string | null;
  latest_state_id: string | null;
  latest_action_summary: string | null;
  latest_next_trade_date: string | null;
  latest_delivery_status: string | null;
  updated_at: string | null;
}

interface FormState {
  user_id: string;
  symbol: string;
  market: string;
  entry_date: string;
  entry_price: string;
  position_size: string;
  remaining_size: string;
  status: string;
  note: string;
}

const emptyForm: FormState = {
  user_id: 'ADMIN',
  symbol: '',
  market: 'HK',
  entry_date: '',
  entry_price: '',
  position_size: '',
  remaining_size: '',
  status: 'active',
  note: '',
};

export default function TradePositionsAdminPage() {
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    fetchPositions();
  }, []);

  async function fetchPositions() {
    try {
      const res = await fetch('/api/admin/trade-positions');
      const data = await res.json();
      setPositions(data.positions || []);
    } catch (error) {
      console.error('Failed to fetch trade positions:', error);
      alert('加载持仓失败');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(position: TradePosition) {
    setEditingId(position.position_id);
    setForm({
      user_id: position.user_id,
      symbol: position.symbol,
      market: position.market || '',
      entry_date: position.entry_date,
      entry_price: String(position.entry_price),
      position_size: String(position.position_size),
      remaining_size: String(position.remaining_size),
      status: position.status,
      note: position.note || '',
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.user_id || !form.symbol || !form.entry_date || !form.entry_price || !form.position_size || !form.remaining_size) {
      alert('请填写完整字段');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: form.user_id.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        market: form.market.trim().toUpperCase(),
        entry_date: form.entry_date,
        entry_price: Number(form.entry_price),
        position_size: Number(form.position_size),
        remaining_size: Number(form.remaining_size),
        status: form.status,
        note: form.note.trim() || null,
      };

      const res = await fetch(
        editingId ? `/api/admin/trade-positions/${editingId}` : '/api/admin/trade-positions',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }

      await fetchPositions();
      resetForm();
    } catch (error) {
      console.error('Failed to save trade position:', error);
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(position: TradePosition) {
    if (!confirm(`确定删除 ${position.symbol} / ${position.user_id} 这条持仓吗？`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/trade-positions/${position.position_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }
      await fetchPositions();
    } catch (error) {
      console.error('Failed to delete trade position:', error);
      alert(error instanceof Error ? error.message : '删除失败');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">加载持仓数据...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">持仓数据管理</h1>
              <p className="text-sm text-slate-500">管理 `user_trade_positions`，供交易管理后台闭环消费。</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPositions}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              <RefreshCw size={16} />
              刷新
            </button>
            <button
              onClick={startCreate}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition font-medium"
            >
              <Plus size={16} />
              新增持仓
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-6 p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? '编辑持仓' : '新增持仓'}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/5 transition">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="用户 ID" value={form.user_id} onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))} />
              <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="股票代码" value={form.symbol} onChange={(e) => setForm((prev) => ({ ...prev, symbol: e.target.value }))} />
              <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={form.market} onChange={(e) => setForm((prev) => ({ ...prev, market: e.target.value }))}>
                <option value="HK">HK</option>
                <option value="CN">CN</option>
              </select>
              <input type="date" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={form.entry_date} onChange={(e) => setForm((prev) => ({ ...prev, entry_date: e.target.value }))} />
              <input type="number" step="0.01" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="成本价" value={form.entry_price} onChange={(e) => setForm((prev) => ({ ...prev, entry_price: e.target.value }))} />
              <input type="number" step="1" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="初始仓位" value={form.position_size} onChange={(e) => setForm((prev) => ({ ...prev, position_size: e.target.value }))} />
              <input type="number" step="1" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="剩余仓位" value={form.remaining_size} onChange={(e) => setForm((prev) => ({ ...prev, remaining_size: e.target.value }))} />
              <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="active">active</option>
                <option value="closed">closed</option>
              </select>
            </div>
            <textarea
              className="w-full min-h-[92px] px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg"
              placeholder="备注（可选）"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg transition"
              >
                <Save size={16} />
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
                取消
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.7fr_1fr_0.9fr_0.8fr] gap-3 px-4 py-3 text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
            <div>标的 / 用户</div>
            <div>建仓</div>
            <div>成本</div>
            <div>仓位</div>
            <div>状态</div>
            <div>最新建议</div>
            <div>发送状态</div>
            <div className="text-right">操作</div>
          </div>

          {positions.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">还没有持仓记录</div>
          ) : (
            positions.map((position) => (
              <div
                key={position.position_id}
                className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.7fr_1fr_0.9fr_0.8fr] gap-3 px-4 py-4 border-b border-slate-800 last:border-b-0 items-start"
              >
                <div>
                  <div className="font-mono text-base font-semibold">{position.symbol}</div>
                  <div className="text-sm text-slate-300">{position.stock_name || '-'}</div>
                  <div className="text-xs text-slate-500 mt-1">{position.user_id}</div>
                </div>
                <div className="text-sm text-slate-300">
                  <div>{position.entry_date}</div>
                  <div className="text-xs text-slate-500 mt-1">{position.market || '-'}</div>
                </div>
                <div className="text-sm text-slate-200">{position.entry_price.toFixed(2)}</div>
                <div className="text-sm text-slate-200">
                  <div>{position.remaining_size}</div>
                  <div className="text-xs text-slate-500 mt-1">总 {position.position_size}</div>
                </div>
                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${position.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                    {position.status}
                  </span>
                </div>
                <div className="text-sm text-slate-300">
                  <div>{position.latest_state_id || '-'}</div>
                  <div className="text-xs text-slate-500 mt-1">{position.latest_action_summary || '暂无'}</div>
                  {position.latest_next_trade_date ? (
                    <div className="text-[11px] text-slate-600 mt-1">next: {position.latest_next_trade_date}</div>
                  ) : null}
                </div>
                <div className="text-sm text-slate-300">{position.latest_delivery_status || '-'}</div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => startEdit(position)} className="p-2 rounded-lg hover:bg-white/5 transition text-indigo-300">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(position)} className="p-2 rounded-lg hover:bg-rose-500/10 transition text-rose-300">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 text-sm text-slate-500">
          共 {positions.length} 条持仓记录。当前页面直接管理 `user_trade_positions`，供后台交易管理闭环消费。
        </div>
      </div>
    </div>
  );
}
