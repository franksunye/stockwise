'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';

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
  latest_event_date: string | null;
  latest_event_type: string | null;
  latest_event_price: number | null;
  latest_event_quantity: number | null;
  event_count: number;
  buy_event_count: number;
  sell_event_count: number;
  updated_at: string | null;
}

interface TradePositionEvent {
  event_id: string;
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  event_date: string;
  event_type: 'BUY' | 'SELL';
  quantity: number;
  price: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PositionFormState {
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

interface EventFormState {
  user_id: string;
  symbol: string;
  market: string;
  event_date: string;
  event_type: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  note: string;
}

const emptyPositionForm: PositionFormState = {
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

const emptyEventForm: EventFormState = {
  user_id: 'ADMIN',
  symbol: '',
  market: 'HK',
  event_date: '',
  event_type: 'SELL',
  quantity: '',
  price: '',
  note: '',
};

function formatEventLabel(eventType: string | null | undefined): string {
  if (eventType === 'BUY') return '加仓';
  if (eventType === 'SELL') return '减仓';
  return '-';
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(2);
}

export default function TradePositionsAdminPage() {
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [positionForm, setPositionForm] = useState<PositionFormState>(emptyPositionForm);

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [eventsByPosition, setEventsByPosition] = useState<Record<string, TradePositionEvent[]>>({});
  const [eventsLoadingId, setEventsLoadingId] = useState<string | null>(null);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventEditingId, setEventEditingId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>(emptyEventForm);

  useEffect(() => {
    fetchPositions();
  }, []);

  const selectedPosition = useMemo(
    () => positions.find((item) => item.position_id === selectedPositionId) || null,
    [positions, selectedPositionId],
  );

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

  function resetPositionForm() {
    setPositionForm(emptyPositionForm);
    setEditingId(null);
    setShowForm(false);
  }

  function resetEventForm(position?: TradePosition | null) {
    setEventEditingId(null);
    setEventForm({
      ...emptyEventForm,
      user_id: position?.user_id || 'ADMIN',
      symbol: position?.symbol || '',
      market: position?.market || 'HK',
    });
  }

  function startCreate() {
    setEditingId(null);
    setPositionForm(emptyPositionForm);
    setShowForm(true);
  }

  function startEdit(position: TradePosition) {
    setEditingId(position.position_id);
    setPositionForm({
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

  async function handleSubmitPosition() {
    if (
      !positionForm.user_id ||
      !positionForm.symbol ||
      !positionForm.entry_date ||
      !positionForm.entry_price ||
      !positionForm.position_size ||
      !positionForm.remaining_size
    ) {
      alert('请填写完整字段');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: positionForm.user_id.trim(),
        symbol: positionForm.symbol.trim().toUpperCase(),
        market: positionForm.market.trim().toUpperCase(),
        entry_date: positionForm.entry_date,
        entry_price: Number(positionForm.entry_price),
        position_size: Number(positionForm.position_size),
        remaining_size: Number(positionForm.remaining_size),
        status: positionForm.status,
        note: positionForm.note.trim() || null,
      };

      const res = await fetch(
        editingId ? `/api/admin/trade-positions/${editingId}` : '/api/admin/trade-positions',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');

      await fetchPositions();
      resetPositionForm();
    } catch (error) {
      console.error('Failed to save trade position:', error);
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePosition(position: TradePosition) {
    if (!confirm(`确定删除 ${position.symbol} / ${position.user_id} 这条持仓吗？这会同时删除事件时间线。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/trade-positions/${position.position_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
      if (selectedPositionId === position.position_id) {
        setSelectedPositionId(null);
        resetEventForm(null);
      }
      await fetchPositions();
    } catch (error) {
      console.error('Failed to delete trade position:', error);
      alert(error instanceof Error ? error.message : '删除失败');
    }
  }

  async function fetchEvents(position: TradePosition) {
    setSelectedPositionId(position.position_id);
    setEventsLoadingId(position.position_id);
    resetEventForm(position);
    try {
      const res = await fetch(`/api/admin/trade-positions/${position.position_id}/events`);
      const data = await res.json();
      setEventsByPosition((prev) => ({ ...prev, [position.position_id]: data.events || [] }));
    } catch (error) {
      console.error('Failed to fetch trade position events:', error);
      alert('加载成交时间线失败');
    } finally {
      setEventsLoadingId(null);
    }
  }

  function startEditEvent(position: TradePosition, event: TradePositionEvent) {
    setSelectedPositionId(position.position_id);
    setEventEditingId(event.event_id);
    setEventForm({
      user_id: event.user_id,
      symbol: event.symbol,
      market: event.market || position.market || 'HK',
      event_date: event.event_date,
      event_type: event.event_type,
      quantity: String(event.quantity),
      price: event.price == null ? '' : String(event.price),
      note: event.note || '',
    });
  }

  async function handleSubmitEvent() {
    if (!selectedPosition || !eventForm.user_id || !eventForm.symbol || !eventForm.event_date || !eventForm.quantity) {
      alert('请填写完整的成交事件字段');
      return;
    }

    setEventSaving(true);
    try {
      const payload = {
        user_id: eventForm.user_id.trim(),
        symbol: eventForm.symbol.trim().toUpperCase(),
        market: eventForm.market.trim().toUpperCase(),
        event_date: eventForm.event_date,
        event_type: eventForm.event_type,
        quantity: Number(eventForm.quantity),
        price: eventForm.price === '' ? null : Number(eventForm.price),
        note: eventForm.note.trim() || null,
      };

      const url = eventEditingId
        ? `/api/admin/trade-positions/${selectedPosition.position_id}/events/${eventEditingId}`
        : `/api/admin/trade-positions/${selectedPosition.position_id}/events`;
      const method = eventEditingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存事件失败');

      await fetchPositions();
      await fetchEvents(selectedPosition);
      resetEventForm(selectedPosition);
    } catch (error) {
      console.error('Failed to save trade position event:', error);
      alert(error instanceof Error ? error.message : '保存事件失败');
    } finally {
      setEventSaving(false);
    }
  }

  async function handleDeleteEvent(position: TradePosition, event: TradePositionEvent) {
    if (!confirm(`确定删除 ${event.event_date} 这条${formatEventLabel(event.event_type)}事件吗？`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/trade-positions/${position.position_id}/events/${event.event_id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除事件失败');
      await fetchPositions();
      await fetchEvents(position);
      resetEventForm(position);
    } catch (error) {
      console.error('Failed to delete trade position event:', error);
      alert(error instanceof Error ? error.message : '删除事件失败');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">加载持仓数据...</div>
      </div>
    );
  }

  const selectedEvents = selectedPosition ? (eventsByPosition[selectedPosition.position_id] || []) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">持仓数据管理</h1>
              <p className="text-sm text-slate-500">管理持仓主记录、成交事件时间线与最新建议，作为交易管理闭环的运营底座。</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPositions} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
              <RefreshCw size={16} />
              刷新
            </button>
            <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition font-medium">
              <Plus size={16} />
              新增持仓
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-6 p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? '编辑持仓' : '新增持仓'}</h2>
              <button onClick={resetPositionForm} className="p-2 rounded-lg hover:bg-white/5 transition">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="用户 ID" value={positionForm.user_id} onChange={(e) => setPositionForm((prev) => ({ ...prev, user_id: e.target.value }))} />
              <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="股票代码" value={positionForm.symbol} onChange={(e) => setPositionForm((prev) => ({ ...prev, symbol: e.target.value }))} />
              <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={positionForm.market} onChange={(e) => setPositionForm((prev) => ({ ...prev, market: e.target.value }))}>
                <option value="HK">HK</option>
                <option value="CN">CN</option>
              </select>
              <input type="date" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={positionForm.entry_date} onChange={(e) => setPositionForm((prev) => ({ ...prev, entry_date: e.target.value }))} />
              <input type="number" step="0.01" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="成本价" value={positionForm.entry_price} onChange={(e) => setPositionForm((prev) => ({ ...prev, entry_price: e.target.value }))} />
              <input type="number" step="1" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="初始仓位" value={positionForm.position_size} onChange={(e) => setPositionForm((prev) => ({ ...prev, position_size: e.target.value }))} />
              <input type="number" step="1" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="剩余仓位" value={positionForm.remaining_size} onChange={(e) => setPositionForm((prev) => ({ ...prev, remaining_size: e.target.value }))} />
              <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={positionForm.status} onChange={(e) => setPositionForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="active">active</option>
                <option value="closed">closed</option>
              </select>
            </div>
            <textarea className="w-full min-h-[92px] px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg" placeholder="备注（可选）" value={positionForm.note} onChange={(e) => setPositionForm((prev) => ({ ...prev, note: e.target.value }))} />
            <div className="flex gap-3">
              <button onClick={handleSubmitPosition} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg transition">
                <Save size={16} />
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={resetPositionForm} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">取消</button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="grid grid-cols-[1.15fr_0.8fr_0.7fr_0.8fr_0.8fr_1fr_1fr_0.9fr] gap-3 px-4 py-3 text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
            <div>标的 / 用户</div>
            <div>建仓</div>
            <div>成本</div>
            <div>仓位</div>
            <div>状态</div>
            <div>事件时间线</div>
            <div>最新建议</div>
            <div className="text-right">操作</div>
          </div>

          {positions.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">还没有持仓记录</div>
          ) : (
            positions.map((position) => (
              <div
                key={position.position_id}
                className={`grid grid-cols-[1.15fr_0.8fr_0.7fr_0.8fr_0.8fr_1fr_1fr_0.9fr] gap-3 px-4 py-4 border-b border-slate-800 last:border-b-0 items-start ${
                  selectedPositionId === position.position_id ? 'bg-white/[0.02]' : ''
                }`}
              >
                <div>
                  <Link href={`/admin/trade-positions/${position.position_id}`} className="font-mono text-base font-semibold hover:text-cyan-300 transition">
                    {position.symbol}
                  </Link>
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
                  <div className="font-medium">{position.event_count || 0} 条</div>
                  <div className="text-xs text-slate-500 mt-1">
                    买入 {position.buy_event_count || 0} / 卖出 {position.sell_event_count || 0}
                  </div>
                  {position.latest_event_date && position.latest_event_type ? (
                    <div className="text-xs text-slate-400 mt-2">
                      最近{formatEventLabel(position.latest_event_type)}：{position.latest_event_date}
                      {position.latest_event_quantity ? ` · ${position.latest_event_quantity}` : ''}
                      {position.latest_event_price != null ? ` @ ${formatPrice(position.latest_event_price)}` : ''}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 mt-2">暂无事件</div>
                  )}
                </div>
                <div className="text-sm text-slate-300">
                  <div>{position.latest_state_id || '-'}</div>
                  <div className="text-xs text-slate-500 mt-1">{position.latest_action_summary || '暂无'}</div>
                  {position.latest_next_trade_date ? <div className="text-[11px] text-slate-600 mt-1">next: {position.latest_next_trade_date}</div> : null}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => fetchEvents(position)} className="p-2 rounded-lg hover:bg-white/5 transition text-amber-300" title="管理事件时间线">
                    <Clock3 size={16} />
                  </button>
                  <button onClick={() => startEdit(position)} className="p-2 rounded-lg hover:bg-white/5 transition text-indigo-300">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDeletePosition(position)} className="p-2 rounded-lg hover:bg-rose-500/10 transition text-rose-300">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedPosition && (
          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[0.95fr_1.25fr] gap-6">
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">成交事件时间线</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedPosition.stock_name || selectedPosition.symbol} · {selectedPosition.symbol} · 当前剩余 {selectedPosition.remaining_size}/{selectedPosition.position_size}
                  </p>
                </div>
                <button onClick={() => resetEventForm(selectedPosition)} className="p-2 rounded-lg hover:bg-white/5 transition">
                  <Plus size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="用户 ID" value={eventForm.user_id} onChange={(e) => setEventForm((prev) => ({ ...prev, user_id: e.target.value }))} />
                <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="股票代码" value={eventForm.symbol} onChange={(e) => setEventForm((prev) => ({ ...prev, symbol: e.target.value }))} />
                <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={eventForm.market} onChange={(e) => setEventForm((prev) => ({ ...prev, market: e.target.value }))}>
                  <option value="HK">HK</option>
                  <option value="CN">CN</option>
                </select>
                <input type="date" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={eventForm.event_date} onChange={(e) => setEventForm((prev) => ({ ...prev, event_date: e.target.value }))} />
                <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" value={eventForm.event_type} onChange={(e) => setEventForm((prev) => ({ ...prev, event_type: e.target.value as 'BUY' | 'SELL' }))}>
                  <option value="SELL">SELL</option>
                  <option value="BUY">BUY</option>
                </select>
                <input type="number" step="1" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="数量" value={eventForm.quantity} onChange={(e) => setEventForm((prev) => ({ ...prev, quantity: e.target.value }))} />
                <input type="number" step="0.01" className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg" placeholder="成交价（可选）" value={eventForm.price} onChange={(e) => setEventForm((prev) => ({ ...prev, price: e.target.value }))} />
                <input className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg md:col-span-2" placeholder="备注（可选）" value={eventForm.note} onChange={(e) => setEventForm((prev) => ({ ...prev, note: e.target.value }))} />
              </div>

              <div className="flex gap-3">
                <button onClick={handleSubmitEvent} disabled={eventSaving} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 rounded-lg transition">
                  <Save size={16} />
                  {eventSaving ? '保存中...' : eventEditingId ? '更新事件' : '新增事件'}
                </button>
                <button onClick={() => resetEventForm(selectedPosition)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
                  重置
                </button>
              </div>
            </div>

            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">时间线明细</h2>
                  <p className="text-sm text-slate-500 mt-1">按事件日期倒序，后续建议卡将基于这些真实动作解释剩余仓位。</p>
                </div>
              </div>

              {eventsLoadingId === selectedPosition.position_id ? (
                <div className="py-16 text-center text-slate-500">加载事件中...</div>
              ) : selectedEvents.length === 0 ? (
                <div className="py-16 text-center text-slate-500">还没有成交事件，当前仍是单笔静态持仓。</div>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((event) => (
                    <div key={event.event_id} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${event.event_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                              {formatEventLabel(event.event_type)}
                            </span>
                            <span className="text-sm text-slate-300">{event.event_date}</span>
                          </div>
                          <div className="mt-3 text-sm text-slate-200">
                            数量 {event.quantity}
                            {event.price != null ? ` · 价格 ${formatPrice(event.price)}` : ''}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {event.note || '无备注'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEditEvent(selectedPosition, event)} className="p-2 rounded-lg hover:bg-white/5 transition text-indigo-300">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteEvent(selectedPosition, event)} className="p-2 rounded-lg hover:bg-rose-500/10 transition text-rose-300">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 text-sm text-slate-500">
          共 {positions.length} 条持仓记录。当前页面管理 `user_trade_positions + user_trade_position_events`，已经具备真实持仓生命周期的后台运营能力。
        </div>
      </div>
    </div>
  );
}
