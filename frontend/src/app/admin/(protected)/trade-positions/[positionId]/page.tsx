'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock3, RefreshCw } from 'lucide-react';

interface TradePositionDetail {
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  entry_date: string;
  entry_price: number;
  position_size: number;
  remaining_size: number;
  status: string;
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
}

interface TradePositionEvent {
  event_id: string;
  event_date: string;
  event_type: 'BUY' | 'SELL';
  quantity: number;
  price: number | null;
  note: string | null;
}

interface TradeAdviceLog {
  advice_id: string;
  latest_trade_date: string;
  next_trade_date: string | null;
  state_id: string | null;
  signal_state: string | null;
  lane_id: string | null;
  recommended_policy: string | null;
  action_summary: string | null;
  webhook_delivery_status: string | null;
  card_markdown: string | null;
  updated_at: string | null;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(2);
}

function formatEventLabel(type: string | null | undefined): string {
  if (type === 'BUY') return '加仓';
  if (type === 'SELL') return '减仓';
  return '-';
}

export default function TradePositionDetailPage() {
  const params = useParams<{ positionId: string }>();
  const [positionId, setPositionId] = useState<string>('');
  const [position, setPosition] = useState<TradePositionDetail | null>(null);
  const [events, setEvents] = useState<TradePositionEvent[]>([]);
  const [adviceLogs, setAdviceLogs] = useState<TradeAdviceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPositionId(params.positionId || '');
  }, [params]);

  useEffect(() => {
    if (!positionId) return;
    void fetchAll(positionId);
  }, [positionId]);

  async function fetchAll(id: string) {
    setLoading(true);
    try {
      const [positionRes, eventsRes, adviceRes] = await Promise.all([
        fetch(`/api/admin/trade-positions/${id}`),
        fetch(`/api/admin/trade-positions/${id}/events`),
        fetch(`/api/admin/trade-positions/${id}/advice`),
      ]);
      const [positionData, eventsData, adviceData] = await Promise.all([
        positionRes.json(),
        eventsRes.json(),
        adviceRes.json(),
      ]);
      setPosition(positionData.position || null);
      setEvents(eventsData.events || []);
      setAdviceLogs(adviceData.advice || []);
    } catch (error) {
      console.error('Failed to load trade position detail:', error);
      alert('加载持仓详情失败');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">加载持仓详情...</div>;
  }

  if (!position) {
    return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">未找到持仓详情</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/trade-positions" className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{position.stock_name || position.symbol}</h1>
              <p className="text-sm text-slate-500">
                {position.symbol} · {position.user_id} · 当前剩余 {position.remaining_size}/{position.position_size}
              </p>
            </div>
          </div>
          <button onClick={() => void fetchAll(position.position_id)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">持仓概览</div>
            <div className="mt-5 space-y-4">
              <div className="text-3xl font-black">{position.remaining_size}/{position.position_size}</div>
              <div className="text-sm text-slate-400">仓位（剩余 / 原始）</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">成本</div>
                  <div className="text-slate-100 mt-1">{formatPrice(position.entry_price)}</div>
                </div>
                <div>
                  <div className="text-slate-500">建仓日</div>
                  <div className="text-slate-100 mt-1">{position.entry_date}</div>
                </div>
                <div>
                  <div className="text-slate-500">事件数</div>
                  <div className="text-slate-100 mt-1">{position.event_count}</div>
                </div>
                <div>
                  <div className="text-slate-500">状态</div>
                  <div className="text-slate-100 mt-1">{position.status}</div>
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-4 text-sm text-slate-300">
                最近操作：{position.latest_event_date || '-'} · {formatEventLabel(position.latest_event_type)}
                {position.latest_event_quantity ? ` ${position.latest_event_quantity}` : ''}
                {position.latest_event_price != null ? ` @ ${formatPrice(position.latest_event_price)}` : ''}
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">最新建议</div>
            {adviceLogs[0] ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xl font-bold">{adviceLogs[0].action_summary || '-'}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {adviceLogs[0].latest_trade_date} · {adviceLogs[0].state_id || '-'} · next {adviceLogs[0].next_trade_date || '-'}
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">{adviceLogs[0].webhook_delivery_status || '-'}</div>
                </div>
                <pre className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4 text-sm whitespace-pre-wrap leading-7 text-slate-200">
                  {adviceLogs[0].card_markdown}
                </pre>
              </div>
            ) : (
              <div className="mt-5 text-slate-500">暂无建议记录</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">
              <Clock3 className="w-4 h-4" />
              实际执行时间线
            </div>
            <div className="mt-5 space-y-3">
              {events.length === 0 ? (
                <div className="text-slate-500">暂无成交事件</div>
              ) : (
                events.map((event) => (
                  <div key={event.event_id} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{formatEventLabel(event.event_type)}</div>
                      <div className="text-xs text-slate-500">{event.event_date}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {event.quantity}
                      {event.price != null ? ` 股 @ ${formatPrice(event.price)}` : ' 股'}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{event.note || '无备注'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">建议历史</div>
            <div className="mt-5 space-y-3">
              {adviceLogs.length === 0 ? (
                <div className="text-slate-500">暂无建议历史</div>
              ) : (
                adviceLogs.map((log) => (
                  <div key={log.advice_id} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold">{log.action_summary || '-'}</div>
                      <div className="text-xs text-slate-500">{log.updated_at || '-'}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {log.state_id || '-'} · {log.signal_state || '-'} · {log.webhook_delivery_status || '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
