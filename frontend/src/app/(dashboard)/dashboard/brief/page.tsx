'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Share2, NotebookText, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { getCurrentUser } from '@/lib/user'

interface BriefData {
  date: string
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
            const today = new Date().toISOString().split('T')[0]
            
            let res = await fetch(`/api/brief?date=${today}`, {
              headers: { 'x-user-id': user.userId }
            })
            
            let data = await res.json()
            
            // Fallback to yesterday if today is null
            if (!data.brief) {
              const yesterday = new Date()
              yesterday.setDate(yesterday.getDate() - 1)
              const yesterdayStr = yesterday.toISOString().split('T')[0]
              
              res = await fetch(`/api/brief?date=${yesterdayStr}`, {
                headers: { 'x-user-id': user.userId }
              })
              data = await res.json()
            }
            
            setBrief(data.brief)
          } catch (err) {
            setError('无法加载简报')
            console.error('Failed to fetch brief:', err)
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
          title: '每日简报 - StockWise AI',
          text: brief.push_hook,
          url: window.location.href,
        })
      } catch {
        console.log('Share cancelled')
      }
    }
  }

  // Loading State - matching BriefDrawer
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#050508] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">AI 正在调取简报...</p>
      </div>
    )
  }

  // Error/Empty State - matching BriefDrawer
  if (error || !brief) {
    return (
      <div className="fixed inset-0 bg-[#050508] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-8 pt-12 shrink-0">
          <Link href="/dashboard" className="p-2.5 rounded-full bg-white/5 border border-white/10">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center">
              <NotebookText className="w-7 h-7 text-indigo-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black italic tracking-tighter text-white">每日简报</h2>
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-indigo-500" />
                DAILY REVIEW
                <span className="opacity-50 ml-2">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>
              </p>
            </div>
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </header>

        {/* Empty State Content */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center px-8">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-slate-600" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg mb-2">{error || '今日暂无简报'}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              请确保您的监控列表不为空。<br />
              AI 可能会在收盘后生成。
            </p>
          </div>
          <Link 
            href="/dashboard"
            className="mt-4 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95"
          >
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  // Main Content - matching BriefDrawer structure exactly
  return (
    <div className="fixed inset-0 bg-[#050508] flex flex-col overflow-hidden">
      {/* Solid Header - No transparency */}
      <header className="flex items-center justify-between p-8 pt-12 pb-6 shrink-0 bg-[#050508] z-20">
        <Link href="/dashboard" className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center">
            <NotebookText className="w-7 h-7 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black italic tracking-tighter text-white">每日简报</h2>
            <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-indigo-500" />
              DAILY REVIEW
              {brief ? (brief.date.split('-')[1] + '/' + brief.date.split('-')[2]) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </p>
          </div>
        </div>

        <button 
          onClick={handleShare}
          className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all text-slate-400 hover:text-white"
        >
          <Share2 size={18} />
        </button>
      </header>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-8 pb-12">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Push Hook Summary Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 blur-xl rounded-full" />
            <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2 relative z-10">
              <Sparkles size={12} /> AI 核心摘要
            </h3>
            <p className="text-sm font-medium text-indigo-100 leading-relaxed relative z-10">
              {brief.push_hook}
            </p>
          </div>

          {/* Main Markdown Content */}
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({children}) => <h3 className="text-lg font-black text-white mt-8 mb-4 tracking-tight">{children}</h3>,
                h2: ({children}) => <h4 className="text-base font-bold text-slate-200 mt-6 mb-3">{children}</h4>,
                h3: ({children}) => <h5 className="text-sm font-bold text-slate-300 mt-4 mb-2 uppercase tracking-wide">{children}</h5>,
                p: ({children}) => <p className="text-sm text-slate-400 leading-relaxed mb-4 text-justify">{children}</p>,
                ul: ({children}) => <ul className="space-y-2 mb-4 list-disc pl-4 marker:text-indigo-500/50">{children}</ul>,
                li: ({children}) => <li className="text-sm text-slate-400 pl-1">{children}</li>,
                strong: ({children}) => <span className="text-indigo-200 font-bold">{children}</span>,
                a: ({href, children}) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 transition-colors inline-flex items-center gap-1"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({children}) => (
                  <blockquote className="border-l-2 border-indigo-500/30 pl-4 py-2 my-6 bg-white/[0.02] rounded-r-xl italic text-slate-400">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="border-white/10 my-8" />,
              }}
            >
              {brief.content}
            </ReactMarkdown>
          </div>
          
          {/* Footer */}
          <div className="pt-8 border-t border-white/5 flex flex-col items-center space-y-4">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="w-1 h-1 rounded-full bg-indigo-500" />
              Generated by StockWise AI
              <span className="w-1 h-1 rounded-full bg-indigo-500" />
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
