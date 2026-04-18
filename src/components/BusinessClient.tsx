'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Profile { id: string; full_name: string; individual_rate: number | null; group_rate: number | null }
interface Player { id: string; full_name: string; created_at: string; custom_rate: number | null; group_id: string | null }
interface Session { id: string; player_id: string; session_date: string; session_type: string; rate_override: number | null; group_id: string | null }
interface Attendance { session_id: string; player_id: string; attended: boolean }

interface Props { profile: Profile | null; players: Player[]; sessions: Session[]; attendance: Attendance[] }


export default function BusinessClient({ profile, players, sessions, attendance }: Props) {
  const router = useRouter()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  function sd(s: Session) { return new Date(s.session_date) }

  function getNewPlayersInRange(from: Date, to: Date) {
    return players.filter(p => { const d = new Date(p.created_at); return d >= from && d <= to }).length
  }

  function getUniquePlayerCount(from: Date, to: Date) {
    return new Set(sessions.filter(s => sd(s) >= from && sd(s) <= to).map(s => s.player_id)).size
  }

  function getAtRiskCount() {
    const activeIds = new Set(sessions.filter(s => sd(s) >= thirtyDaysAgo).map(s => s.player_id))
    const recentIds = new Set(sessions.filter(s => sd(s) >= sixtyDaysAgo && sd(s) < thirtyDaysAgo).map(s => s.player_id))
    return [...recentIds].filter(id => !activeIds.has(id)).length
  }

  function getSessionRevenue(s: Session) {
    if (s.rate_override !== null && s.rate_override !== undefined) return Number(s.rate_override) || 0
    if (s.session_type === 'group') {
      const groupRate = Number(profile?.group_rate) || 0
      const attendingCount = attendance.filter(a => a.session_id === s.id && a.attended).length
      if (attendingCount > 0) return groupRate * attendingCount
      // Fall back to group player count
      const groupPlayerCount = players.filter(p => p.group_id === s.group_id).length
      return groupRate * Math.max(groupPlayerCount, 1)
    }
    // Individual session — use player's custom rate or default individual rate
    const player = players.find(p => p.id === s.player_id)
    const rate = player?.custom_rate ?? profile?.individual_rate ?? 0
    return Number(rate) || 0
  }

  function getRevenue(from: Date, to: Date) {
    const relevant = sessions.filter(s => sd(s) >= from && sd(s) <= to)
    let total = 0
    const countedGroupSessions = new Set<string>()

    for (const s of relevant) {
      if (s.session_type === 'group') {
        // Only count the scheduled group session (no player_id) once per session
        if (!s.player_id && !countedGroupSessions.has(s.id)) {
          countedGroupSessions.add(s.id)
          total += getSessionRevenue(s)
        }
      } else {
        // Only count individual sessions that are logged (have player_id)
        if (s.player_id) {
          total += getSessionRevenue(s)
        }
      }
    }
    return total
  }

  function getSessionCount(from: Date, to: Date) {
    return new Set(sessions.filter(s => sd(s) >= from && sd(s) <= to).map(s => s.session_date + s.session_type)).size
  }

  function getPctChange(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  function formatCurrency(val: number) {
    const safe = isNaN(val) || !isFinite(val) ? 0 : val
    return safe.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  function changeColor(val: number) {
    if (val > 0) return '#00FF9F'
    if (val < 0) return '#E03131'
    return '#9A9A9F'
  }

  function changeLabel(val: number) {
    if (val > 0) return `+${val}%`
    if (val < 0) return `${val}%`
    return '—'
  }

  function getMonthlyData(type: 'players' | 'sessions' | 'revenue') {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const label = from.toLocaleString('default', { month: 'short' })
      let value = 0
      if (type === 'players') value = getNewPlayersInRange(from, to)
      if (type === 'sessions') value = getSessionCount(from, to)
      if (type === 'revenue') value = getRevenue(from, to)
      months.push({ label, value })
    }
    return months
  }

  function MiniChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
    const max = Math.max(...data.map(d => d.value), 1)
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '48px', marginTop: '12px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', height: d.value === 0 ? '3px' : `${Math.max((d.value / max) * 40, 4)}px`, background: d.value === 0 ? '#2A2A2D' : color, borderRadius: '3px 3px 0 0', opacity: i === data.length - 1 ? 1 : 0.5, transition: 'height 0.3s' }} />
            <div style={{ fontSize: '9px', color: '#9A9A9F', textAlign: 'center' }}>{d.label}</div>
          </div>
        ))}
      </div>
    )
  }

  function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{subtitle}</div>
      </div>
    )
  }

  function StatCard({ label, value, change, compare, mono, accent }: { label: string; value: string | number; change?: number | null; compare?: string; mono?: boolean; accent?: string }) {
    return (
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
        <div style={{ fontFamily: mono !== false ? 'monospace' : 'sans-serif', fontSize: '32px', fontWeight: 700, color: accent || '#ffffff', lineHeight: 1, marginBottom: '8px' }}>{value}</div>
        {(change !== null && change !== undefined) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: changeColor(change) }}>{changeLabel(change)}</span>
            {compare && <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{compare}</span>}
          </div>
        )}
        {compare && (change === null || change === undefined) && (
          <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{compare}</div>
        )}
      </div>
    )
  }

  const hasRates = (profile?.individual_rate || 0) > 0 || (profile?.group_rate || 0) > 0

  const newThisMonth = getNewPlayersInRange(startOfMonth, now)
  const newLastMonth = getNewPlayersInRange(startOfLastMonth, endOfLastMonth)
  const activeLast30 = getUniquePlayerCount(thirtyDaysAgo, now)
  const activePrev30 = getUniquePlayerCount(sixtyDaysAgo, thirtyDaysAgo)
  const atRisk = getAtRiskCount()
  const totalPlayers = players.length
  const sessionsThisMonth = getSessionCount(startOfMonth, now)
  const sessionsLastMonth = getSessionCount(startOfLastMonth, endOfLastMonth)
  const sessionsThisYear = getSessionCount(startOfYear, now)
  const weeklyData = (() => {
    const weeks = []
    for (let i = 11; i >= 0; i--) {
      const wStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
      const wEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      weeks.push(getSessionCount(wStart, wEnd))
    }
    return weeks
  })()
  const avgSessionsPerWeek = weeklyData.length > 0 ? (weeklyData.reduce((a, b) => a + b, 0) / weeklyData.length).toFixed(1) : '0'
  const revenueThisMonth = getRevenue(startOfMonth, now)
  const revenueLastMonth = getRevenue(startOfLastMonth, endOfLastMonth)
  const revenueThisYear = getRevenue(startOfYear, now)
  const playerMonthly = getMonthlyData('players')
  const sessionMonthly = getMonthlyData('sessions')
  const revenueMonthly = getMonthlyData('revenue')

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        @media (max-width: 640px) {
          .biz-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .biz-revenue-row { grid-template-columns: 1fr !important; }
          .biz-header { flex-direction: column !important; gap: 12px !important; }
        }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>

        {/* HEADER */}
        <div className="biz-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '28px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0 }}>My Numbers</h1>
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>{now.toLocaleString('default', { month: 'long', year: 'numeric' })} · {now.getFullYear()} overview</p>
          </div>
          {!hasRates && (
            <button onClick={() => router.push('/dashboard/settings')} style={{ background: 'rgba(0,255,159,0.08)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#00FF9F', cursor: 'pointer', fontWeight: 500 }}>
              Set your rates to unlock revenue →
            </button>
          )}
        </div>

        {/* PLAYERS SECTION */}
        <SectionHeader title="Players" subtitle="Growth and engagement across your roster" />
        <div className="biz-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <StatCard label="New players" value={newThisMonth} change={getPctChange(newThisMonth, newLastMonth)} compare={`vs ${newLastMonth} last month`} />
          <StatCard label="Active players" value={activeLast30} change={getPctChange(activeLast30, activePrev30)} compare={`vs ${activePrev30} prev 30d`} accent="#00FF9F" />
          <StatCard label="Total trained" value={totalPlayers} compare="All time" change={null} />
          <StatCard label="Re-engage opportunities" value={atRisk} compare="At risk of churning" change={null} accent={atRisk > 0 ? '#F5A623' : '#ffffff'} />
        </div>
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>New players — last 6 months</div>
          <MiniChart data={playerMonthly} color="#00FF9F" />
        </div>

        {/* SESSIONS SECTION */}
        <SectionHeader title="Sessions" subtitle="Your training activity over time" />
        <div className="biz-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <StatCard label="Sessions this month" value={sessionsThisMonth} change={getPctChange(sessionsThisMonth, sessionsLastMonth)} compare={`vs ${sessionsLastMonth} last month`} />
          <StatCard label="Sessions this year" value={sessionsThisYear} compare={`${now.getFullYear()} year to date`} change={null} />
          <StatCard label="Avg sessions/week" value={avgSessionsPerWeek} compare="Last 12 weeks" change={null} />
        </div>
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Sessions — last 6 months</div>
          <MiniChart data={sessionMonthly} color="#00FF9F" />
        </div>

        {/* REVENUE SECTION */}
        <SectionHeader title="Revenue" subtitle={hasRates ? 'Estimated based on your logged sessions and rates' : 'Set your rates in Settings to unlock revenue tracking'} />
        <div className="biz-revenue-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <StatCard label="Est. revenue this month" value={hasRates ? formatCurrency(revenueThisMonth) : '—'} change={hasRates ? getPctChange(revenueThisMonth, revenueLastMonth) : null} compare={hasRates ? `vs ${formatCurrency(revenueLastMonth)} last month` : 'Set rates to track'} mono={false} />
            <StatCard label={`Est. revenue ${now.getFullYear()}`} value={hasRates ? formatCurrency(revenueThisYear) : '—'} compare="Year to date" change={null} mono={false} />
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Monthly revenue trend</div>
            {hasRates ? (
              <>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#00FF9F', fontFamily: 'monospace', marginTop: '8px' }}>{formatCurrency(revenueThisMonth)}</div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '4px' }}>this month</div>
                <MiniChart data={revenueMonthly} color="#00FF9F" />
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '10px' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F', textAlign: 'center' }}>Set your rates to see revenue trends</p>
                <button onClick={() => router.push('/dashboard/settings')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Set rates →</button>
              </div>
            )}
          </div>
        </div>

        {/* RATES SUMMARY */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '20px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your rates</div>
            <button onClick={() => router.push('/dashboard/settings')} style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Edit →</button>
          </div>
          {[
            { label: 'Individual session', value: profile?.individual_rate ? `$${profile.individual_rate}/session` : 'Not set' },
            { label: 'Group session', value: profile?.group_rate ? `$${profile.group_rate}/session` : 'Not set' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '13px', color: '#9A9A9F' }}>{r.label}</span>
              <span style={{ fontSize: '13px', color: r.value.includes('Not set') ? '#9A9A9F' : '#00FF9F', fontWeight: 500 }}>{r.value}</span>
            </div>
          ))}
          {!hasRates && (
            <button onClick={() => router.push('/dashboard/settings')} style={{ width: '100%', marginTop: '14px', background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Set your rates to enable revenue tracking
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
