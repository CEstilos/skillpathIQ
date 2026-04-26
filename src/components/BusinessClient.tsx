'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Profile { id: string; full_name: string; individual_rate: number | null; group_rate: number | null }
interface Player { id: string; full_name: string; created_at: string; custom_rate: number | null; group_id: string | null }
interface Session { id: string; player_id: string; session_date: string; session_type: string; rate_override: number | null; group_id: string | null }
interface Attendance { session_id: string; player_id: string; attended: boolean }

interface Props { profile: Profile | null; players: Player[]; sessions: Session[]; attendance: Attendance[] }

const GREEN = '#1dce7c'

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
    return new Set(sessions.filter(s => sd(s) >= from && sd(s) <= to && s.player_id).map(s => s.player_id)).size
  }

  function getAtRiskCount() {
    const activeIds = new Set(sessions.filter(s => sd(s) >= thirtyDaysAgo && s.player_id).map(s => s.player_id))
    const recentIds = new Set(sessions.filter(s => sd(s) >= sixtyDaysAgo && sd(s) < thirtyDaysAgo && s.player_id).map(s => s.player_id))
    return [...recentIds].filter(id => !activeIds.has(id)).length
  }

  function getLapsedCount() {
    const allIds = new Set(sessions.filter(s => s.player_id).map(s => s.player_id))
    const recentIds = new Set(sessions.filter(s => sd(s) >= sixtyDaysAgo && s.player_id).map(s => s.player_id))
    return [...allIds].filter(id => !recentIds.has(id)).length
  }

  function getSessionRevenue(s: Session) {
    if (s.rate_override !== null && s.rate_override !== undefined) return Number(s.rate_override) || 0
    if (s.session_type === 'group') {
      const groupRate = Number(profile?.group_rate) || 0
      const attendingCount = attendance.filter(a => a.session_id === s.id && a.attended).length
      if (attendingCount > 0) return groupRate * attendingCount
      const groupPlayerCount = players.filter(p => p.group_id === s.group_id).length
      return groupRate * Math.max(groupPlayerCount, 1)
    }
    const player = players.find(p => p.id === s.player_id)
    const rate = player?.custom_rate ?? profile?.individual_rate ?? 0
    return Number(rate) || 0
  }

  function getRevenue(from: Date, to: Date) {
    const relevant = sessions.filter(s => sd(s) >= from && sd(s) <= to)
    let total = 0
    const countedGroup = new Set<string>()
    for (const s of relevant) {
      if (s.session_type === 'group') {
        if (!s.player_id && !countedGroup.has(s.id)) { countedGroup.add(s.id); total += getSessionRevenue(s) }
      } else {
        if (s.player_id) total += getSessionRevenue(s)
      }
    }
    return total
  }

  function getSessionCount(from: Date, to: Date) {
    const indiv = sessions.filter(s => sd(s) >= from && sd(s) <= to && s.player_id && s.session_type !== 'group').length
    const group = new Set(sessions.filter(s => sd(s) >= from && sd(s) <= to && !s.player_id && s.session_type === 'group').map(s => s.id)).size
    return indiv + group
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
    if (val > 0) return GREEN
    if (val < 0) return '#E03131'
    return '#9A9A9F'
  }

  function changeLabel(val: number) {
    if (val > 0) return `+${val}%`
    if (val < 0) return `${val}%`
    return '—'
  }

  function getMonthlyData(type: 'revenue') {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const label = from.toLocaleString('default', { month: 'short' })
      months.push({ label, value: getRevenue(from, to) })
    }
    return months
  }

  // ─── Inner components ────────────────────────────────────────────────────────

  function SectionLabel({ text }: { text: string }) {
    return <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '10px' }}>{text}</div>
  }

  function StatCard({ label, value, change, compare, accent }: { label: string; value: string | number; change?: number | null; compare?: string; accent?: string }) {
    return (
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: accent || '#ffffff', lineHeight: 1, marginBottom: '6px' }}>{value}</div>
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

  // ─── Computed values ─────────────────────────────────────────────────────────

  const hasRates = (profile?.individual_rate || 0) > 0 || (profile?.group_rate || 0) > 0

  const newThisMonth     = getNewPlayersInRange(startOfMonth, now)
  const newLastMonth     = getNewPlayersInRange(startOfLastMonth, endOfLastMonth)
  const activeLast30     = getUniquePlayerCount(thirtyDaysAgo, now)
  const activePrev30     = getUniquePlayerCount(sixtyDaysAgo, thirtyDaysAgo)
  const atRisk           = getAtRiskCount()
  const lapsedCount      = getLapsedCount()
  const engagedTotal     = activeLast30 + atRisk + lapsedCount
  const retentionRate    = engagedTotal > 0 ? Math.round((activeLast30 / engagedTotal) * 100) : null

  const sessionsThisMonth  = getSessionCount(startOfMonth, now)
  const sessionsLastMonth  = getSessionCount(startOfLastMonth, endOfLastMonth)
  const sessionsThisYear   = getSessionCount(startOfYear, now)

  const avgSessionsPerPlayer = activeLast30 > 0
    ? (sessionsThisMonth / activeLast30).toFixed(1)
    : '0'

  // Individual vs Group split this month
  const rawThisMonth      = sessions.filter(s => sd(s) >= startOfMonth && sd(s) <= now)
  const individualCount   = rawThisMonth.filter(s => s.player_id && s.session_type !== 'group').length
  const groupCount        = new Set(rawThisMonth.filter(s => !s.player_id && s.session_type === 'group').map(s => s.id)).size
  const splitTotal        = individualCount + groupCount

  // Top players by sessions this month
  const playerCountMap = sessions
    .filter(s => sd(s) >= startOfMonth && sd(s) <= now && s.player_id && s.session_type !== 'group')
    .reduce((acc: Record<string, number>, s) => { acc[s.player_id] = (acc[s.player_id] || 0) + 1; return acc }, {})
  const topPlayers = Object.entries(playerCountMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ name: players.find(p => p.id === id)?.full_name || 'Unknown', count }))
  const maxPlayerSessions = topPlayers[0]?.count || 1

  // Revenue
  const revenueThisMonth = getRevenue(startOfMonth, now)
  const revenueLastMonth = getRevenue(startOfLastMonth, endOfLastMonth)
  const revenueThisYear  = getRevenue(startOfYear, now)
  const blendedRate      = sessionsThisMonth > 0 && hasRates ? Math.round(revenueThisMonth / sessionsThisMonth) : 0
  const revenueMonthly   = getMonthlyData('revenue')

  // SVG ring
  const RING_R    = 54
  const RING_CIRC = 2 * Math.PI * RING_R

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        .biz-bottom-nav { display: none; }
        @media (max-width: 640px) {
          .biz-2col { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .biz-revenue-grid { grid-template-columns: 1fr !important; }
          .biz-header { flex-direction: column !important; gap: 12px !important; }
          .biz-hero-inner { flex-direction: column !important; gap: 16px !important; }
          .biz-ring { align-self: center; }
          .biz-bottom-nav { display: flex !important; }
          .biz-content { padding-bottom: 88px !important; }
        }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div className="biz-content" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px 48px', width: '100%' }}>

        {/* ── HEADER ── */}
        <div className="biz-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', margin: 0 }}>My Business</h1>
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>Your training operation at a glance</p>
          </div>
          {!hasRates && (
            <button
              onClick={() => router.push('/dashboard/settings')}
              style={{ background: `rgba(29,206,124,0.08)`, border: `1px solid rgba(29,206,124,0.3)`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: GREEN, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' as const }}>
              Set rates to unlock revenue →
            </button>
          )}
        </div>

        {/* ── CLIENT HEALTH ── */}
        <SectionLabel text="Client Health" />
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', marginBottom: '28px' }}>
          <div className="biz-hero-inner" style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {/* Left: ring chart */}
            <div className="biz-ring" style={{ flexShrink: 0 }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={RING_R} fill="none" stroke="#2A2A2D" strokeWidth="11" />
                <circle
                  cx="70" cy="70" r={RING_R}
                  fill="none"
                  stroke={GREEN}
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC * (1 - (retentionRate ?? 0) / 100)}
                  transform="rotate(-90 70 70)"
                />
                <text x="70" y="64" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="22" fontWeight="800">
                  {retentionRate !== null ? `${retentionRate}%` : '—'}
                </text>
                <text x="70" y="84" textAnchor="middle" dominantBaseline="middle" fill="#9A9A9F" fontSize="10">
                  retention
                </text>
              </svg>
            </div>

            {/* Right: labels */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '6px' }}>Retention Rate</div>
              <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '20px' }}>
                {engagedTotal > 0
                  ? `Based on ${engagedTotal} clients with sessions`
                  : 'No session history yet'}
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
                {[
                  { label: 'Active', count: activeLast30, color: GREEN },
                  { label: 'At Risk', count: atRisk, color: '#F5A623' },
                  { label: 'Lapsed', count: lapsedCount, color: '#E03131' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.count}</span>
                    <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── PLAYER STATS GRID ── */}
        <SectionLabel text="Player Stats" />
        <div className="biz-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <StatCard
            label="Active players"
            value={activeLast30}
            change={getPctChange(activeLast30, activePrev30)}
            compare={`vs ${activePrev30} prev 30d`}
            accent={GREEN}
          />
          <StatCard
            label="Avg sessions / player"
            value={avgSessionsPerPlayer}
            compare="This month"
            change={null}
          />
          <StatCard
            label="At risk"
            value={atRisk}
            compare="No session 30–60d"
            change={null}
            accent={atRisk > 0 ? '#F5A623' : '#ffffff'}
          />
          <StatCard
            label="Avg client tenure"
            value="—"
            compare="Coming soon"
            change={null}
          />
        </div>

        {/* ── SESSION SPLIT ── */}
        {splitTotal > 0 && (
          <>
            <SectionLabel text="Session Split · This Month" />
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: GREEN }} />
                  <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#4A9EFF' }} />
                  <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Group</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Individual', count: individualCount, color: GREEN },
                  { label: 'Group', count: groupCount, color: '#4A9EFF' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', width: '72px', flexShrink: 0 }}>{row.label}</div>
                    <div style={{ flex: 1, height: '8px', background: '#2A2A2D', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: splitTotal > 0 ? `${(row.count / splitTotal) * 100}%` : '0%', background: row.color, borderRadius: '4px', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', width: '32px', textAlign: 'right' as const, flexShrink: 0 }}>{row.count}</div>
                    <div style={{ fontSize: '11px', color: '#9A9A9F', width: '36px', flexShrink: 0 }}>
                      {splitTotal > 0 ? `${Math.round((row.count / splitTotal) * 100)}%` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── TOP ACTIVE PLAYERS ── */}
        {topPlayers.length > 0 && (
          <>
            <SectionLabel text="Top Players · This Month" />
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topPlayers.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', width: '14px', textAlign: 'right' as const, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500, width: '140px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.name}</div>
                    <div style={{ flex: 1, height: '6px', background: '#2A2A2D', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(p.count / maxPlayerSessions) * 100}%`, background: i === 0 ? GREEN : '#2e6655', borderRadius: '3px', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: i === 0 ? GREEN : '#ffffff', width: '28px', textAlign: 'right' as const, flexShrink: 0 }}>{p.count}</div>
                    <div style={{ fontSize: '11px', color: '#9A9A9F', flexShrink: 0 }}>sess.</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── REVENUE ── */}
        <SectionLabel text={hasRates ? 'Revenue' : 'Revenue · Set rates to unlock'} />
        <div className="biz-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' }}>
          <StatCard
            label="Est. revenue this month"
            value={hasRates ? formatCurrency(revenueThisMonth) : '—'}
            change={hasRates ? getPctChange(revenueThisMonth, revenueLastMonth) : null}
            compare={hasRates ? `vs ${formatCurrency(revenueLastMonth)} last month` : 'Set rates to track'}
          />
          <StatCard
            label={`Est. revenue ${now.getFullYear()}`}
            value={hasRates ? formatCurrency(revenueThisYear) : '—'}
            compare="Year to date"
            change={null}
          />
          <StatCard
            label="Blended rate"
            value={hasRates && blendedRate > 0 ? `$${blendedRate}` : '—'}
            compare="Avg per session this month"
            change={null}
            accent={hasRates && blendedRate > 0 ? GREEN : undefined}
          />
        </div>
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '4px' }}>Monthly revenue trend</div>
          {hasRates ? (
            <>
              <div style={{ fontSize: '22px', fontWeight: 700, color: GREEN, marginTop: '8px' }}>{formatCurrency(revenueThisMonth)}</div>
              <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '4px' }}>this month</div>
              <MiniChart data={revenueMonthly} color={GREEN} />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', gap: '10px' }}>
              <p style={{ fontSize: '13px', color: '#9A9A9F', textAlign: 'center' }}>Set your rates to see revenue trends</p>
              <button onClick={() => router.push('/dashboard/settings')} style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Set rates →</button>
            </div>
          )}
        </div>

        {/* ── RATES SUMMARY ── */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '20px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Your Rates</div>
            <button onClick={() => router.push('/dashboard/settings')} style={{ fontSize: '12px', color: GREEN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Edit →</button>
          </div>
          {[
            { label: 'Individual session', value: profile?.individual_rate ? `$${profile.individual_rate}/session` : 'Not set' },
            { label: 'Group session (per player)', value: profile?.group_rate ? `$${profile.group_rate}/session` : 'Not set' },
          ].map((r, i, arr) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #2A2A2D' : 'none' }}>
              <span style={{ fontSize: '13px', color: '#9A9A9F' }}>{r.label}</span>
              <span style={{ fontSize: '13px', color: r.value.includes('Not set') ? '#9A9A9F' : GREEN, fontWeight: 500 }}>{r.value}</span>
            </div>
          ))}
          {!hasRates && (
            <button onClick={() => router.push('/dashboard/settings')} style={{ width: '100%', marginTop: '14px', background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Set your rates to enable revenue tracking
            </button>
          )}
        </div>

      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="biz-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '72px', background: '#0E0E0F', borderTop: '1px solid #2A2A2D', zIndex: 200, alignItems: 'stretch' }}>
        {([
          { label: 'Hub', path: '/dashboard', active: false, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          )},
          { label: 'Players', path: '/dashboard/clients', active: false, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          )},
          { label: 'Sessions', path: '/dashboard/sessions/new', active: false, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          )},
          { label: 'Business', path: '/dashboard/business', active: true, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          )},
        ] as { label: string; path: string; active: boolean; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.label}
            onClick={() => router.push(tab.path)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: tab.active ? GREEN : '#9A9A9F', padding: '8px 0' }}>
            {tab.icon}
            <span style={{ fontSize: '10px', fontWeight: tab.active ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
