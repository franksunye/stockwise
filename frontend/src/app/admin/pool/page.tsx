'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, Download } from 'lucide-react';

interface Stock {
  symbol: string;
  name: string;
  added_at: string;
}

export default function CorePoolAdmin() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchStocks();
  }, []);

  async function fetchStocks() {
    try {
      const res = await fetch('/api/admin/pool');
      const data = await res.json();
      setStocks(data.stocks || []);
    } catch (error) {
      console.error('Failed to fetch stocks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newSymbol) {
      alert('请输入股票代码');
      return;
    }

    try {
      const res = await fetch('/api/admin/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol: newSymbol, 
          name: newName || undefined  // 名称可选
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setNewSymbol('');
        setNewName('');
        setShowAddForm(false);
        fetchStocks();
      } else {
        alert(data.error || '添加失败');
      }
    } catch (error) {
      console.error('Failed to add stock:', error);
      alert('添加失败，请查看控制台');
    }
  }

  async function handleDelete(symbol: string) {
    if (!confirm(`确定删除 ${symbol}?`)) return;

    try {
      const res = await fetch(`/api/admin/pool/${symbol}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchStocks();
      }
    } catch (error) {
      console.error('Failed to delete stock:', error);
    }
  }

  function handleExport() {
    const json = JSON.stringify(stocks.map(s => s.symbol), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'core-pool.json';
    a.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">股票池管理</h1>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            <Download size={18} />
            导出
          </button>
        </div>

        {/* Add Button */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition font-medium"
          >
            <Plus size={20} />
            添加股票
          </button>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-slate-900 rounded-lg border border-slate-800">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="股票代码 (如: 00700)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="股票名称 (可选，留空自动查询)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition"
                >
                  确认添加
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stock List */}
        <div className="space-y-2">
          {stocks.map((stock) => (
            <div
              key={stock.symbol}
              className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 transition"
            >
              <div>
                <div className="font-mono text-lg font-semibold">{stock.symbol}</div>
                <div className="text-slate-400 text-sm">{stock.name}</div>
              </div>
              <button
                onClick={() => handleDelete(stock.symbol)}
                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          共 {stocks.length} 只股票
        </div>
      </div>
    </div>
  );
}
