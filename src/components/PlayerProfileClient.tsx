'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; created_at: string; custom_rate: number | null; birth_year: number | null; skill_level: string | null; archived: boolean; archived_at: string | null }
interface Session { id: string; player_id: string; session_date: string; session_type: string; notes: string | null }
interface DrillWeek { id: string; title: string; week_start: string; player_id: string | null; group_id: string | null }
interface Drill { id: string; title: string; reps: string; description: string; drill_week_id: string; sort_order: number }
interface Completion { id: string; drill_id: string; player_id: string }
interface Group { id: string; name: string; sport: string }

interface Props {
  player: Player
  sessions: Session[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
  group: Group | null
  trainerName?: string
  trainerEmail?: string
}

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'elite']

export default function PlayerProfileClient({ player, sessions, drillWeeks, drills, completions, group, trainerName, trainerEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [linkShared, setLinkShared] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [birthYear, setBirthYear] = useState(player.birth_year?.toString() || '')
  const [skillLevel, setSkillLevel] = useState(player.skill_level || 'intermediate')
  const [savingInfo, setSavingInfo] = useState(false)
  const [savedInfo, setSavedInfo] = useState(false)
  const [drillNudge, setDrillNudge] = useState<string | null>(null)
  const [drillNudgeLoading, setDrillNudgeLoading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (drillWeeks.length === 0) return
    const latestWeek = drillWeeks[0]
    const weekDrills = drills.filter(d => d.drill_week_id === latestWeek.id)
    if (weekDrills.length === 0) return
    const done = weekDrills.filter(d => completions.some(c => c.drill_id === d.id && c.player_id === player.id)).length
    const pct = Math.round((done / weekDrills.length) * 100)
    if (pct >= 70) return
    setDrillNudgeLoading(true)
    const firstName = player.full_name.split(' ')[0]
    fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `You are a youth sports coach. ${firstName} has completed ${pct}% (${done}/${weekDrills.length}) of their assigned drills this week. Write one short, encouraging sentence to motivate them to finish. Address them by first name. No emojis. Return only the sentence.`,
        }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        const text = data.content?.find((b: { type: string; text: string }) => b.type === 'text')?.text?.trim()
        setDrillNudge(text || null)
      })
      .catch(() => {})
      .finally(() => setDrillNudgeLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleShareLink() {
    const url = `${window.location.origin}/player?id=${player.id}`
    if (navigator.share) {
      navigator.share({
        title: `${player.full_name}'s drill work`,
        text: `Hey! Here's your SkillPathIQ drill link — tap it to see your assigned drills and check them off as you complete them.`,
        url,
      }).catch(() => {
        navigator.clipboard.writeText(url)
        setLinkShared(true)
        setTimeout(() => setLinkShared(false), 2000)
      })
    } else {
      navigator.clipboard.writeText(url)
      setLinkShared(true)
      setTimeout(() => setLinkShared(false), 2000)
    }
  }

  async function sendEmail() {
    if (!player.parent_email || !emailBody.trim()) return
    setSendingEmail(true)
    setEmailError(null)
    const playerUrl = `${window.location.origin}/player?id=${player.id}`
    try {
      const res = await fetch('/api/send-player-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: player.parent_email,
          subject: emailSubject.trim() || `Update from ${trainerName || 'your trainer'}`,
          body: emailBody,
          playerName: player.full_name.split(' ')[0],
          playerUrl,
          trainerName: trainerName || '',
          trainerEmail: trainerEmail || '',
        }),
      })
      const data = await res.json()
      setSendingEmail(false)
      if (data.error) {
        setEmailError('Failed to send. Please try again.')
      } else {
        setEmailSent(true)
        setTimeout(() => { setEmailOpen(false); setEmailSent(false); setEmailSubject(''); setEmailBody(''); setEmailError(null) }, 2000)
      }
    } catch {
      setSendingEmail(false)
      setEmailError('Failed to send. Please try again.')
    }
  }

  async function handleSaveInfo() {
    setSavingInfo(true)
    await supabase.from('players').update({
      birth_year: birthYear ? parseInt(birthYear) : null,
      skill_level: skillLevel,
    }).eq('id', player.id)
    setSavingInfo(false)
    setSavedInfo(true)
    setEditingInfo(false)
    setTimeout(() => setSavedInfo(false), 2000)
  }

  async function handleArchive() {
    setArchiving(true)
    await supabase.from('players').update({ archived: true, archived_at: new Date().toISOString() }).eq('id', player.id)
    setArchiving(false)
    setArchiveOpen(false)
    router.push('/dashboard/clients')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function getAge() {
    if (!player.birth_year) return null
    return new Date().getFullYear() - player.birth_year
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getDaysSince(dateStr: string) {
    return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  function formatDaysAgo(days: number) {
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`
  }

  function getDrillsForWeek(weekId: string) {
    return drills.filter(d => d.drill_week_id === weekId)
  }

  function getCompletionsForWeek(weekId: string) {
    const weekDrills = getDrillsForWeek(weekId)
    return completions.filter(c => weekDrills.some(d => d.id === c.drill_id))
  }

  function getCompletionPct(weekId: string) {
    const weekDrills = getDrillsForWeek(weekId)
    if (!weekDrills.length) return 0
    const done = getCompletionsForWeek(weekId).length
    return Math.round((done / weekDrills.length) * 100)
  }

  function getStatus() {
    if (!sessions.length) return 'new'
    const days = getDaysSince(sessions[0].session_date)
    if (days <= 14) return 'active'
    if (days <= 30) return 'at-risk'
    return 'lapsed'
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'active': return { color: '#00FF9F', bg: 'rgba(0,255,159,0.12)', label: 'Active' }
      case 'at-risk': return { color: '#F5A623', bg: 'rgba(245,166,35,0.15)', label: 'At risk' }
      case 'lapsed': return { color: '#E03131', bg: 'rgba(224,49,49,0.15)', label: 'Lapsed' }
      default: return { color: '#9A9A9F', bg: 'rgba(154,154,159,0.15)', label: 'New' }
    }
  }

  const status = getStatus()
  const statusStyle = getStatusStyle(status)
  const lastSession = sessions[0] || null
  const memberSince = formatDate(player.created_at)
  const age = getAge()

  const totalDrillsAssigned = drills.length
  const totalDrillsDone = completions.length
  const allTimeCompletionRate = totalDrillsAssigned > 0
    ? Math.round((totalDrillsDone / totalDrillsAssigned) * 100)
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        @media (max-width: 640px) {
          .profile-grid { grid-template-columns: 1fr !important; }
          .stat-row { grid-template-columns: repeat(2, 1fr) !important; }
          .action-btns { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <NavBar />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>

        {/* SUCCESS */}
        {savedInfo && (
          <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#00FF9F', fontWeight: 500 }}>
            ✓ Player info saved
          </div>
        )}

        {/* PLAYER HEADER */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#00FF9F', flexShrink: 0 }}>
                {getInitials(player.full_name)}
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', margin: 0 }}>{player.full_name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' as const }}>
                  {group && <span style={{ fontSize: '12px', background: '#2A2A2D', color: '#9A9A9F', padding: '2px 8px', borderRadius: '6px' }}>{group.name}</span>}
                  {!group && <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>}
                  {age && <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Age {age}</span>}
                  {player.skill_level && <span style={{ fontSize: '12px', background: '#2A2A2D', color: '#9A9A9F', padding: '2px 8px', borderRadius: '6px', textTransform: 'capitalize' as const }}>{player.skill_level}</span>}
                  {player.parent_email && <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{player.parent_email}</span>}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
          </div>
          {/* ACTION BUTTONS — 2×2 on mobile, single row on desktop */}
          <div className="action-btns" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <button
              onClick={() => router.push(`/dashboard/players/${player.id}/log`)}
              style={{ padding: '9px 8px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              + Log Session
            </button>
            <button
              onClick={() => router.push(`/dashboard/drills/new?player=${player.id}`)}
              style={{ padding: '9px 8px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              Assign Drills
            </button>
            <button
              onClick={() => { setEmailOpen(true); setEmailSubject(''); setEmailBody(''); setEmailSent(false); setEmailError(null) }}
              disabled={!player.parent_email}
              style={{ padding: '9px 8px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: player.parent_email ? '#ffffff' : '#555558', fontSize: '13px', fontWeight: 600, cursor: player.parent_email ? 'pointer' : 'default', whiteSpace: 'nowrap' as const }}>
              Send Email
            </button>
            <button
              onClick={handleShareLink}
              style={{ padding: '9px 8px', borderRadius: '8px', border: `1px solid ${linkShared ? '#00FF9F' : '#2A2A2D'}`, background: 'transparent', color: linkShared ? '#00FF9F' : '#9A9A9F', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const }}>
              {linkShared ? '✓ Copied!' : 'Share Profile'}
            </button>
          </div>
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => setArchiveOpen(true)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: '#9A9A9F', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
              Archive player
            </button>
          </div>
        </div>

        {/* PLAYER INFO — birth year + skill level */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingInfo ? '16px' : '0' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Player info</div>
            <button
              onClick={() => setEditingInfo(!editingInfo)}
              style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {editingInfo ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {!editingInfo && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '12px', flexWrap: 'wrap' as const }}>
              <div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Age</div>
                <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500 }}>{age ? `${age} years old` : 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Skill level</div>
                <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500, textTransform: 'capitalize' as const }}>{player.skill_level || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Member since</div>
                <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500 }}>{memberSince}</div>
              </div>
            </div>
          )}

          {editingInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' as const }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Birth year</label>
                  <input
                    type="number"
                    placeholder="e.g. 2012"
                    value={birthYear}
                    onChange={e => setBirthYear(e.target.value)}
                    min="1990"
                    max={new Date().getFullYear()}
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                  />
                  {birthYear && parseInt(birthYear) > 1990 && (
                    <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Age: {new Date().getFullYear() - parseInt(birthYear)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Skill level</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                    {SKILL_LEVELS.map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSkillLevel(level)}
                        style={{
                          padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' as const,
                          border: `1px solid ${skillLevel === level ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`,
                          background: skillLevel === level ? 'rgba(0,255,159,0.1)' : 'transparent',
                          color: skillLevel === level ? '#00FF9F' : '#9A9A9F',
                        }}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveInfo}
                disabled={savingInfo}
                style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' as const }}>
                {savingInfo ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* STAT ROW */}
        <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Total sessions</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{sessions.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>All time</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Last session</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: lastSession ? '#ffffff' : '#9A9A9F', lineHeight: 1.2 }}>
              {lastSession ? formatDaysAgo(getDaysSince(lastSession.session_date)) : 'No sessions'}
            </div>
            {lastSession && <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatDate(lastSession.session_date)}</div>}
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Drills Completed</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{totalDrillsDone}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>Total completed</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Completion Rate</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: allTimeCompletionRate !== null ? '#ffffff' : '#9A9A9F', lineHeight: 1 }}>
              {allTimeCompletionRate !== null ? `${allTimeCompletionRate}%` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>All time rate</div>
          </div>
        </div>

        <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>

          {/* DRILL WORK */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Drill work</div>
            {(drillNudge || drillNudgeLoading) && (
              <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>💡</span>
                <div style={{ fontSize: '12px', color: '#9A9A9F', lineHeight: 1.5, fontStyle: drillNudgeLoading ? 'italic' : 'normal' }}>
                  {drillNudgeLoading ? 'Getting coaching tip…' : drillNudge}
                </div>
              </div>
            )}
            {drillWeeks.length === 0 ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '12px' }}>No drill work assigned yet</p>
                <button onClick={() => router.push(`/dashboard/drills/new?player=${player.id}`)} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Assign drill work
                </button>
              </div>
            ) : (
              drillWeeks.map((week, wi) => {
                const weekDrills = getDrillsForWeek(week.id)
                const weekCompletions = getCompletionsForWeek(week.id)
                const pct = getCompletionPct(week.id)
                const isCurrentWeek = wi === 0
                return (
                  <div key={week.id} style={{ background: '#1A1A1C', border: `1px solid ${isCurrentWeek ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{week.title}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>Week of {formatDate(week.week_start)}</div>
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 700, color: pct === 100 ? '#00FF9F' : '#ffffff' }}>{pct}%</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{weekCompletions.length}/{weekDrills.length} done</div>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ height: '100%', width: pct + '%', background: '#00FF9F', borderRadius: '99px', opacity: pct === 100 ? 1 : 0.5 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {weekDrills.map(drill => {
                        const done = completions.some(c => c.drill_id === drill.id)
                        return (
                          <div key={drill.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: done ? '#00FF9F' : '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {done && (
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                  <polyline points="1,4 3,6 7,2" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: done ? '#9A9A9F' : '#ffffff', textDecoration: done ? 'line-through' : 'none' }}>{drill.title}</span>
                            {drill.reps && <span style={{ fontSize: '11px', color: '#9A9A9F', marginLeft: 'auto', whiteSpace: 'nowrap' as const }}>{drill.reps}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* SESSION HISTORY */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Session history</div>
            {sessions.length === 0 ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '12px' }}>No sessions logged yet</p>
                <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Log first session
                </button>
              </div>
            ) : (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
                {sessions.slice(0, 10).map((session, i) => {
                  const isLast = i === Math.min(sessions.length, 10) - 1
                  return (
                    <div key={session.id} style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: session.notes ? '4px' : '0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>{formatDate(session.session_date)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '99px', background: session.session_type === 'group' ? 'rgba(245,166,35,0.15)' : 'rgba(0,255,159,0.12)', color: session.session_type === 'group' ? '#F5A623' : '#00FF9F', fontWeight: 600, textTransform: 'capitalize' as const }}>
                            {session.session_type}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{formatDaysAgo(getDaysSince(session.session_date))}</span>
                        </div>
                      </div>
                      {session.notes && (
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>{session.notes}</div>
                      )}
                    </div>
                  )
                })}
                {sessions.length > 10 && (
                  <div style={{ padding: '10px 16px', textAlign: 'center' as const, borderTop: '1px solid #2A2A2D' }}>
                    <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{sessions.length - 10} more sessions</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EMAIL MODAL */}
      {emailOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Email {player.full_name.split(' ')[0]}&apos;s Parent</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player.parent_email}</div>
              </div>
              <button onClick={() => setEmailOpen(false)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            {emailSent ? (
              <div style={{ padding: '20px', textAlign: 'center' as const, color: '#00FF9F', fontWeight: 600 }}>✓ Email sent!</div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '6px' }}>Subject (optional)</div>
                    <input
                      type="text"
                      placeholder={`Update from ${trainerName || 'your trainer'}`}
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      style={{ width: '100%', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '6px' }}>Message</div>
                    <textarea
                      rows={5}
                      placeholder="Write your message here…"
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      style={{ width: '100%', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
                    />
                  </div>
                </div>
                {emailError && <div style={{ fontSize: '13px', color: '#E03131', marginBottom: '12px' }}>{emailError}</div>}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEmailOpen(false)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={sendEmail}
                    disabled={sendingEmail || !emailBody.trim()}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontSize: '13px', fontWeight: 700, cursor: sendingEmail || !emailBody.trim() ? 'default' : 'pointer', opacity: sendingEmail || !emailBody.trim() ? 0.6 : 1 }}>
                    {sendingEmail ? 'Sending…' : 'Send Email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {archiveOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setArchiveOpen(false) }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>Archive {player.full_name.split(' ')[0]}?</div>
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '20px' }}>
              They won&apos;t appear in your active roster or retention metrics. You can reactivate them any time.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setArchiveOpen(false)} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleArchive} disabled={archiving} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid rgba(224,49,49,0.4)', background: 'rgba(224,49,49,0.08)', color: '#E03131', fontSize: '14px', fontWeight: 700, cursor: archiving ? 'default' : 'pointer', opacity: archiving ? 0.7 : 1 }}>
                {archiving ? 'Archiving…' : 'Archive player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: '#00FF9F', fontWeight: 500, zIndex: 2000, whiteSpace: 'nowrap' as const }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
