import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Finanças',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Finanças' },
  themeColor: '#2563eb',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 min-h-screen pb-20">
        <main className="max-w-2xl mx-auto p-4">{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}