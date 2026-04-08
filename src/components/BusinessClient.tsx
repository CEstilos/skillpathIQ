'use client'

import { useRouter } from 'next/navigation'

interface Profile { id: string; full_name: string; individual_rate: number | null; group_rate: number | null }
interface Player { id: string; full_name: string; created_at: string; custom_rate: number | null }
interface Session { id: string; player_id: string; session_date: string; session_type: string; rate_override: number | null }

interface Props {
  profile: Profile | null
  players: Player[]
  sessions: Session[]
}

export default function BusinessClient({ profile, players, sessions }: Props) {
  const router = useRouter()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  function sessionDate(s: Session) { return new Date(s.session_date) }

  function getUniquePlayerCount(fromDate: Date, toDate: Date) {
    const ids = new Set(
      sessions
        .filter(s => sessionDate(s) >= fromDate && sessionDate(s) <= toDate)
        .map(s => s.player_id)
    )
    return ids.size
  }

  function getNewPlayersInRange(fromDate: Date, toDate: Date) {
    return players.filter(p => {
      const created = new Date(p.created_at)
      return created >= fromDate && created <= toDate
    }).length
  }

  function getSessionRevenue(s: Session) {
    if (s.rate_override !== null) return s.rate_override
    if (s.session_type === 'group') return profile?.group_rate || 0
    const player = players.find(p => p.id === s.player_id)
    return player?.custom_rate || profile?.individual_rate || 0
  }

  function getRevenue(fromDate: Date, toDate: Date) {
    const relevantSessions = sessions.filter(s => sessionDate(s) >= fromDate && sessionDate(s) <= toDate)
    const groupSessionDates = new Set<string>()
    let total = 0
    for (const s of relevantSessions) {
      if (s.session_type === 'group') {
        const key = s.session_date
        if (!groupSessionDates.has(key)) {
          groupSessionDates.add(key)
          total += getSessionRevenue(s)
        }
      } else {
        total += getSessionRevenue(s)
      }
    }
    return total
  }

  function getPctChange(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  function formatCurrency(val: number) {
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  function getWeeklySessionCounts() {
    const weeks: { label: string; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      const count = new Set(
        sessions
          .filter(s => sessionDate(s) >= weekStart && sessionDate(s) < weekEnd)
          .map(s => s.session_date)
      ).size
      const label = `W${12 - i}`
      weeks.push({ label, count })
    }
    return weeks
  }

  const activeLast30 = getUniquePlayerCount(thirtyDaysAgo, now)
  const activePrev30 = getUniquePlayerCount(sixtyDaysAgo, thirtyDaysAgo)
  const activeChange = getPctChange(activeLast30, activePrev30)

  const newThisMonth = getNewPlayersInRange(startOfMonth, now)
  const newLastMonth = getNewPlayersInRange(startOfLastMonth, endOfLastMonth)
  const newChange = getPctChange(newThisMonth, newLastMonth)

  const revenueThisMonth = getRevenue(startOfMonth, now)
  const revenueLastMonth = getRevenue(startOfLastMonth, endOfLastMonth)
  const revenueChange = getPctChange(revenueThisMonth, revenueLastMonth)

  const revenueThisYear = getRevenue(startOfYear, now)
  const totalPlayersThisYear = getNewPlayersInRange(startOfYear, now)

  const weeklyData = getWeeklySessionCounts()
  const maxWeekCount = Math.max(...weeklyData.map(w => w.count), 1)

  const hasRates = (profile?.individual_rate || 0) > 0 || (profile?.group_rate || 0) > 0

  function changeColor(val: number) {
    if (val > 0) return '#00FF9F'
    if (val < 0) return '#E03131'
    return '#9A9A9F'
  }

  function changeLabel(val: number) {
    if (val > 0) return `+${val}%`
    if (val < 0) return `${val}%`
    return 'No change'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>

      <style>{`
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        @media (max-width: 640px) {
          .biz-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .biz-header { flex-direction: column !important; gap: 12px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100, width: '100%' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ fontSize: '15px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>Training Hub</button>
          <button style={{ fontSize: '15px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Business</button>
          <button onClick={() => router.push('/dashboard/settings')} style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>Settings</button>
        </div>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div className="biz-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0 }}>Business</h1>
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>{now.toLocaleString('default', { month: 'long', year: 'numeric' })} · {now.getFullYear()} overview</p>
          </div>
          {!hasRates && (
            <button onClick={() => router.push('/dashboard/settings')} style={{ background: 'rgba(0,255,159,0.08)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#00FF9F', cursor: 'pointer', fontWeight: 500 }}>
              Set your rates to unlock revenue tracking →
            </button>
          )}
        </div>

        {/* MAIN STATS */}
        <div className="biz-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            {
              label: 'Active players',
              sublabel: 'Last 30 days',
              value: activeLast30,
              change: activeChange,
              compare: `vs ${activePrev30} prev 30d`,
              mono: true,
            },
            {
              label: 'New players',
              sublabel: 'This month',
              value: newThisMonth,
              change: newChange,
              compare: `vs ${newLastMonth} last month`,
              mono: true,
            },
            {
              label: 'Est. revenue',
              sublabel: 'This month',
              value: hasRates ? formatCurrency(revenueThisMonth) : '—',
              change: hasRates ? revenueChange : null,
              compare: hasRates ? `vs ${formatCurrency(revenueLastMonth)} last month` : 'Set rates to track',
              mono: false,
            },
            {
              label: 'Est. revenue',
              sublabel: `${now.getFullYear()} year to date`,
              value: hasRates ? formatCurrency(revenueThisYear) : '—',
              change: null,
              compare: `${totalPlayersThisYear} new player${totalPlayersThisYear !== 1 ? 's' : ''} this year`,
              mono: false,
            },
          ].map(s => (
            <div key={s.label + s.sublabel} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '10px' }}>{s.sublabel}</div>
              <div style={{ fontFamily: s.mono ? 'monospace' : 'sans-serif', fontSize: s.mono ? '32px' : '24px', fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: '8px' }}>{s.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {s.change !== null && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: changeColor(s.change) }}>{changeLabel(s.change)}</span>
                )}
                <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{s.compare}</span>
              </div>
            </div>
          ))}
        </div>

        {/* SECONDARY STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Total players</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: '6px' }}>{players.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F' }}>All time</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Total sessions</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: '6px' }}>
              {new Set(sessions.map(s => s.session_date + s.session_type)).size}
            </div>
            <div style={{ fontSize: '11px', color: '#9A9A9F' }}>All time logged</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Avg sessions/week</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: '6px' }}>
              {weeklyData.length > 0 ? (weeklyData.reduce((s, w) => s + w.count, 0) / weeklyData.length).toFixed(1) : '0'}
            </div>
            <div style={{ fontSize: '11px', color: '#9A9A9F' }}>Last 12 weeks</div>
          </div>
        </div>

        {/* ACTIVITY CHART */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '20px' }}>Session activity — last 12 weeks</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
            {weeklyData.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%',
                  height: w.count === 0 ? '4px' : `${Math.max((w.count / maxWeekCount) * 72, 8)}px`,
                  background: w.count === 0 ? '#2A2A2D' : '#00FF9F',
                  borderRadius: '4px 4px 0 0',
                  opacity: w.count === 0 ? 0.3 : 1,
                  transition: 'height 0.3s',
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {weeklyData.map((w, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: '#9A9A9F' }}>{w.label}</div>
            ))}
          </div>
        </div>

        {/* RATES SUMMARY */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '20px' }}>
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
