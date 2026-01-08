'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Share2 } from 'lucide-react'
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
        // Get current user
        const user = await getCurrentUser()
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0]
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">加载中...</div>
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <Link href="/dashboard" className="flex items-center text-blue-600 mb-4">
          <ArrowLeft className="w-5 h-5 mr-1" />
          返回
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm text-center">
          <p className="text-gray-500">{error || '今日暂无简报'}</p>
          <p className="text-sm text-gray-400 mt-2">简报通常在收盘后生成</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-semibold text-gray-900 dark:text-white">每日简报</h1>
          <button onClick={handleShare} className="text-gray-600 dark:text-gray-300">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {/* Brief meta */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(brief.created_at).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Markdown content */}
          <div className="px-6 py-6 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{brief.content}</ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          此简报由 StockWise AI 自动生成，仅供参考
        </p>
      </div>
    </div>
  )
}
