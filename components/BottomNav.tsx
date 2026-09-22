'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Upload, List, Wallet, Tag } from 'lucide-react'

const items = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/transactions', label: 'Lançar', icon: List },
  { href: '/import', label: 'Importar', icon: Upload },
  { href: '/accounts', label: 'Contas', icon: Wallet },
  { href: '/categories', label: 'Categorias', icon: Tag },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center py-2 px-1 text-[10px] ${
                active ? 'text-blue-600' : 'text-gray-500'
              }`}>
              <Icon size={20} />
              <span className="mt-0.5">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}