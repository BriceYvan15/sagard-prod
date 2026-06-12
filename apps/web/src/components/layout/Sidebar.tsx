'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, MapPin, Shield, ClipboardList,
  Receipt, Package, Car, UserCheck, LogOut, ChevronRight, ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { clsx } from 'clsx'

const nav = [
  { href: '/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard, roles: ['ALL'] },
  { href: '/clients',     label: 'Clients & CRM',   icon: Users,           roles: ['DIRECTEUR_GENERAL','COMMERCIAL','COMPTABLE'] },
  { href: '/contrats',    label: 'Contrats',         icon: FileText,        roles: ['DIRECTEUR_GENERAL','COMMERCIAL','COMPTABLE'] },
  { href: '/facturation', label: 'Facturation',      icon: Receipt,         roles: ['DIRECTEUR_GENERAL','COMMERCIAL','COMPTABLE'] },
  { href: '/sites',       label: 'Sites',            icon: MapPin,          roles: ['DIRECTEUR_GENERAL','CHEF_OPERATIONS'] },
  { href: '/agents',      label: 'Agents',           icon: Shield,          roles: ['DIRECTEUR_GENERAL','CHEF_OPERATIONS','RH'] },
  { href: '/operations',  label: 'Opérations',       icon: ClipboardList,   roles: ['DIRECTEUR_GENERAL','CHEF_OPERATIONS','CONTROLEUR'] },
  { href: '/rh',          label: 'Ressources Humaines', icon: UserCheck,    roles: ['DIRECTEUR_GENERAL','RH'] },
  { href: '/stock',       label: 'Stock & Véhicules', icon: Package,        roles: ['DIRECTEUR_GENERAL','CHEF_OPERATIONS'] },
  { href: '/vehicules',   label: 'Véhicules',        icon: Car,             roles: ['DIRECTEUR_GENERAL','CHEF_OPERATIONS'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const visible = nav.filter(n =>
    n.roles.includes('ALL') || n.roles.includes(user?.role ?? ''),
  )

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#1E1E1E] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 bg-[#C8D400] rounded-xl flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={20} className="text-[#1E1E1E]" />
        </div>
        <div>
          <p className="text-white font-black text-sm tracking-tight">SAGARD</p>
          <p className="text-[#C8D400] text-[9px] font-semibold uppercase tracking-widest">Sécurité</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visible.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-[#C8D400] text-[#1E1E1E]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}>
              <item.icon size={16} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={12} />}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-[#C8D400]/20 flex items-center justify-center text-[#C8D400] text-xs font-bold flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-slate-500 text-xs truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl text-sm transition-colors">
          <LogOut size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
