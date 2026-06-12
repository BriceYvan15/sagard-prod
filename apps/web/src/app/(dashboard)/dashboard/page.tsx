'use client'
import { useQuery } from '@tanstack/react-query'
import { Users, FileText, Receipt, Shield, TrendingUp, AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

function KpiCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', color)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats') as Promise<any>,
  })

  const kpis = [
    { label: 'Clients actifs',    value: stats?.clients ?? 0,    icon: Users,    color: 'bg-blue-100 text-blue-600' },
    { label: 'Contrats actifs',   value: stats?.contracts ?? 0,  icon: FileText, color: 'bg-green-100 text-green-600' },
    { label: 'Factures en retard', value: stats?.overdueInvoices ?? 0, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
    { label: 'Agents en poste',   value: stats?.agentsOnDuty ?? 0, icon: Shield,  color: 'bg-[#C8D400]/20 text-yellow-700' },
    { label: 'Sites couverts',    value: stats?.sites ?? 0,       icon: MapPin,   color: 'bg-purple-100 text-purple-600' },
    { label: 'Pointages aujourd\'hui', value: stats?.todayPointages ?? 0, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#C8D400]" /> Revenus mensuels (XOF)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.monthlyRevenue ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v: any) => [`${v.toLocaleString('fr-FR')} XOF`, 'Revenus']} />
              <Bar dataKey="amount" fill="#C8D400" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Shield size={16} className="text-[#C8D400]" /> Pointages semaine (agents)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats?.weeklyPointages ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#C8D400" strokeWidth={2.5} dot={{ fill: '#C8D400', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-5">
        {/* Factures en retard */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" /> Factures en retard
          </h3>
          <div className="space-y-2.5">
            {(stats?.overdueInvoicesList ?? []).slice(0, 5).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{inv.reference}</p>
                  <p className="text-xs text-slate-400">{inv.client?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-500">{Number(inv.totalAmount).toLocaleString('fr-FR')} XOF</p>
                  <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(inv.dueDate), { addSuffix: true, locale: fr })}</p>
                </div>
              </div>
            ))}
            {(stats?.overdueInvoicesList ?? []).length === 0 &&
              <p className="text-slate-400 text-sm text-center py-4">Aucune facture en retard ✓</p>}
          </div>
        </div>

        {/* Pointages du jour */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" /> Pointages aujourd'hui
          </h3>
          <div className="space-y-2.5">
            {(stats?.todayPointagesList ?? []).slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {p.agent?.user?.firstName?.[0]}{p.agent?.user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.agent?.user?.firstName} {p.agent?.user?.lastName}</p>
                    <p className="text-xs text-slate-400">{p.shift}</p>
                  </div>
                </div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold',
                  p.status === 'EN_COURS' ? 'bg-green-100 text-green-700' :
                  p.status === 'RETARD' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600')}>
                  {p.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
