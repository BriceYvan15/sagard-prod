'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Footprints, MapPin, Clock, CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronRight, Filter } from 'lucide-react'
import { patrolsApi } from '@/lib/api'
import { clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  EN_COURS: { label: 'En cours', icon: Loader2, color: 'bg-blue-100 text-blue-700' },
  TERMINEE: { label: 'Terminée', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  INCOMPLETE: { label: 'Incomplète', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
  INTERROMPUE: { label: 'Interrompue', icon: XCircle, color: 'bg-red-100 text-red-700' },
}

export default function RondesPage() {
  const [filterState, setFilterState] = useState<string>('')
  const [selectedRound, setSelectedRound] = useState<any>(null)

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['patrols', filterState],
    queryFn: () => patrolsApi.list(filterState ? { state: filterState } : {}),
  })

  const { data: roundDetail } = useQuery({
    queryKey: ['patrol', selectedRound?.id],
    queryFn: () => patrolsApi.get(selectedRound.id),
    enabled: !!selectedRound,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Footprints size={24} className="text-[#C8D400]" />
            Rondes
          </h1>
          <p className="text-slate-500 text-sm mt-1">Historique des rondes de patrol des agents</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-slate-400" />
        <button
          onClick={() => setFilterState('')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition',
            filterState === '' ? 'bg-[#C8D400] text-slate-900' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
          )}
        >
          Toutes
        </button>
        {Object.entries(STATE_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterState(key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition',
              filterState === key ? 'bg-[#C8D400] text-slate-900' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATE_CONFIG).map(([key, cfg]) => {
          const count = (rounds as any[])?.filter(r => r.state === key).length ?? 0
          return (
            <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">{cfg.label}</span>
                <cfg.icon size={14} className={cfg.color.split(' ')[1]} />
              </div>
              <p className="text-2xl font-black text-slate-900">{count}</p>
            </div>
          )
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      ) : (rounds as any[])?.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <Footprints size={40} className="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Aucune ronde enregistrée</p>
          <p className="text-slate-300 text-sm mt-1">Les rondes effectuées par les agents apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Référence</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Agent</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Site</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Durée</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Progression</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">État</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(rounds as any[])?.map((r: any) => {
                const cfg = STATE_CONFIG[r.state] ?? STATE_CONFIG.EN_COURS
                const agentName = r.agent?.user ? `${r.agent.user.firstName} ${r.agent.user.lastName}` : '—'
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRound(r)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-800 text-sm">{r.reference}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-600 text-sm">{agentName}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-slate-300" />
                        <span className="text-slate-600 text-sm">{r.site?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-300" />
                        <span className="text-slate-500 text-sm">
                          {r.dateStart ? format(new Date(r.dateStart), 'dd MMM yyyy à HH:mm', { locale: fr }) : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-500 text-sm">
                        {r.durationMin ? `${r.durationMin} min` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#C8D400] rounded-full"
                            style={{ width: `${Math.min(r.completionPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{r.completionPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold', cfg.color)}>
                        <cfg.icon size={12} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <ChevronRight size={14} className="text-slate-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selectedRound && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedRound(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-black text-slate-900 text-lg">{selectedRound.reference}</h2>
                <p className="text-slate-400 text-sm">Détails de la ronde</p>
              </div>
              <button
                onClick={() => setSelectedRound(null)}
                className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200"
              >
                <XCircle size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Agent</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {selectedRound.agent?.user ? `${selectedRound.agent.user.firstName} ${selectedRound.agent.user.lastName}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Site</p>
                  <p className="text-sm font-semibold text-slate-700">{selectedRound.site?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Début</p>
                  <p className="text-sm text-slate-600">
                    {selectedRound.dateStart ? format(new Date(selectedRound.dateStart), 'dd MMM yyyy à HH:mm', { locale: fr }) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Fin</p>
                  <p className="text-sm text-slate-600">
                    {selectedRound.dateEnd ? format(new Date(selectedRound.dateEnd), 'dd MMM yyyy à HH:mm', { locale: fr }) : 'En cours...'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Durée</p>
                  <p className="text-sm text-slate-600">{selectedRound.durationMin ? `${selectedRound.durationMin} min` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Progression</p>
                  <p className="text-sm text-slate-600">{selectedRound.pointsDone}/{selectedRound.pointsTotal} points ({selectedRound.completionPct}%)</p>
                </div>
              </div>

              {/* Checks list */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Points de contrôle scannés</p>
                {roundDetail?.checks?.length > 0 ? (
                  <div className="space-y-2">
                    {roundDetail.checks.map((c: any, i: number) => (
                      <div key={c.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                        <div className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                          c.hasAnomaly ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-700">
                            {c.pointCode ?? c.point?.code ?? 'Point inconnu'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {format(new Date(c.checkTime), 'HH:mm:ss', { locale: fr })}
                            {c.note ? ` · ${c.note}` : ''}
                          </p>
                        </div>
                        {c.hasAnomaly && (
                          <AlertTriangle size={16} className="text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-4">Aucun point scanné</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
