'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function NavBar({ trainerName }: { trainerName?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const links = [
    { label: 'Training Hub', path: '/dashboard' },
    { label: 'My Players', path: '/dashboard/clients' },
    { label: 'My Numbers', path: '/dashboard/business' },
    { label: 'Settings', path: '/dashboard/settings' },
  ]

  function isActive(path: string) {
    return pathname === path
  }

  return (
    <>
      <style>{`
        .nav-links { display: flex !important; }
        .nav-menu-btn { display: none !important; }
        @media (max-width: 640px) {
          .nav-links { display: none !important; }
          .nav-menu-btn { display: flex !important; }
        }
      `}</style>

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100, width: '100%', maxWidth: '100vw' }}>

        {/* LOGO */}
        <div onClick={() => router.push('/dashboard')} style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
        </div>

        {/* DESKTOP LINKS */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {links.map(link => (
            <button
              key={link.label}
              onClick={() => router.push(link.path)}
              style={{
                fontSize: link.label === 'Settings' ? '13px' : '15px',
                color: isActive(link.path) ? '#ffffff' : '#9A9A9F',
                background: 'none', border: 'none',
                borderBottom: isActive(link.path) ? '2px solid #00FF9F' : '2px solid transparent',
                paddingBottom: '4px', cursor: 'pointer',
                fontWeight: isActive(link.path) ? 600 : 400,
                transition: 'color 0.15s',
              }}>
              {link.label}
            </button>
          ))}
        </div>

        {/* RIGHT SIDE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {trainerName && (
            <span style={{ fontSize: '13px', color: '#9A9A9F' }}>{trainerName}</span>
          )}
          <button
            onClick={handleSignOut}
            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
            Log out
          </button>

          {/* HAMBURGER */}
          <button
            className="nav-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', flexDirection: 'column', gap: '5px', alignItems: 'center', justifyContent: 'center', display: 'none' }}>
            <div style={{ width: '20px', height: '2px', background: '#ffffff' }} />
            <div style={{ width: '20px', height: '2px', background: '#ffffff' }} />
            <div style={{ width: '20px', height: '2px', background: '#ffffff' }} />
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div style={{ background: '#1A1A1C', borderBottom: '1px solid #2A2A2D', width: '100%', zIndex: 99 }}>
          {links.map(link => (
            <button
              key={link.label}
              onClick={() => { router.push(link.path); setMenuOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 20px', background: 'none', border: 'none',
                color: isActive(link.path) ? '#00FF9F' : '#9A9A9F',
                fontSize: '14px', cursor: 'pointer',
                borderBottom: '1px solid #2A2A2D',
              }}>
              {link.label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#9A9A9F', fontSize: '14px', cursor: 'pointer' }}>
            Log out
          </button>
        </div>
      )}
    </>
  )
}
