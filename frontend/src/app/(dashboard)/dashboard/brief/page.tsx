'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Share2, NotebookText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { getCurrentUser } from '@/lib/user'

interface BriefData {
  content: string
  push_hook: string
  created_at: string
}

export default function BriefPage() {
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const user = await getCurrentUser()
        
        // Get today's date in YYYY-MM-DD format (local timezone)
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const res = await fetch(`/api/brief?date=${today}`, {
          headers: {
            'x-user-id': user.userId
          }
        })
        
        if (!res.ok) {
          throw new Error('Failed to fetch brief')
        }
        
        const data = await res.json()
        setBrief(data.brief)
      } catch (err) {
        setError('无法加载今日简报')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchBrief()
  }, [])

  const handleShare = async () => {
    if (navigator.share && brief) {
      try {
        await navigator.share({
          title: '每日简报 - StockWise',
          text: brief.push_hook,
          url: window.location.href,
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen bg-[#050508] p-6">
        <Link href="/dashboard" className="flex items-center text-indigo-400 mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span className="text-sm">返回</span>
        </Link>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <NotebookText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">{error || '今日暂无简报'}</p>
          <p className="text-sm text-slate-600 mt-2">简报通常在收盘后生成</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050508]">
      {/* Header */}
      <div className="sticky top-0 bg-[#050508]/90 backdrop-blur-xl z-10 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-white/5 border border-white/10 flex items-center justify-center">
              <NotebookText className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">每日简报</h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">DAILY REVIEW</p>
            </div>
          </div>
          <button onClick={handleShare} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
          {/* Brief meta */}
          <div className="px-6 py-4 border-b border-white/5">
            <p className="text-sm text-slate-500">
              {new Date(brief.created_at).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Markdown content */}
          <div className="px-6 py-6 prose prose-sm prose-invert prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-li:text-slate-300 max-w-none">
            <ReactMarkdown>{brief.content}</ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          此简报由 StockWise AI 自动生成，仅供参考
        </p>
      </div>
    </div>
  )
}
