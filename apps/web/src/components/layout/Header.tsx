'use client'
import { useState, useRef, useEffect } from 'react'
import { Bell, Search, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

export function Header() {
  const { user } = useAuthStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list() as Promise<any[]>,
    refetchInterval: 30_000,
  })
  const { data: unread = { count: 0 } } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => notificationsApi.unread() as Promise<{ count: number }>,
    refetchInterval: 15_000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id) as Promise<any>,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }) },
  })
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead() as Promise<any>,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-unread'] }) },
  })

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Search */}
      <div className="relative max-w-xs w-full">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C8D400]/40 focus:bg-white transition"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition">
            <Bell size={16} className="text-slate-600" />
            {(unread as any)?.count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#C8D400] text-[#1E1E1E] text-[9px] font-black rounded-full flex items-center justify-center">
                {(unread as any).count > 9 ? '9+' : (unread as any).count}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-800">Notifications</span>
                <button onClick={() => markAll.mutate()} className="text-xs text-[#C8D400] hover:underline flex items-center gap-1">
                  <RefreshCw size={10} /> Tout lire
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0
                  ? <p className="text-center text-slate-400 text-sm py-6">Aucune notification</p>
                  : notifications.slice(0, 10).map((n: any) => (
                    <div key={n.id} onClick={() => markRead.mutate(n.id)}
                      className={clsx('px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition', !n.read && 'bg-[#C8D400]/5')}>
                      <div className="flex items-start gap-2">
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#C8D400] mt-1.5 flex-shrink-0" />}
                        <div className={clsx(!n.read ? 'ml-0' : 'ml-3.5')}>
                          <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-xl bg-[#C8D400] flex items-center justify-center text-[#1E1E1E] text-xs font-black">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
      </div>
    </header>
  )
}
