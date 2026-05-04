'use client'

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react'
import { apiRequestWithRefresh } from '@/lib/api-auth'
import InspireHubButton from '@/components/competitions/InspireHubButton'
import InspireHubModal from '@/components/competitions/InspireHubModal'

type GroupType = 'HOUSE' | 'CLUB' | 'CUSTOM'

interface Group {
  id: number
  name: string
  type: GroupType
  emoji: string
  description: string | null
  color: string
  bgColor: string
  capacity: number
  studentCount: number
}

interface Student {
  id: number
  name: string
  admissionNo: string
  class: string
  section: string
  classIndex: number
  currentGroupId: number | null  // HOUSE FK (single group)
  clubIds: number[]              // CLUB M2M (multiple clubs)
  aiHint: string | null
}

interface Stats {
  totalStudents: number
  assigned: number
  unassigned: number
  houseCount: number
  clubCount: number
}

interface PreviewItem {
  groupId: number
  groupName: string
  emoji: string
  color: string
  bgColor: string
  count: number
}

interface FilterState {
  cls: string[]
  sec: string[]
  house: string[]
  club: string[]
  status: string
}

type ApiList<T> = T[] | { results?: T[] }

const CLASSES = [
  'Nursery', 'LKG', 'UKG',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5',
  'Grade 6','Grade 7','Grade 8','Grade 9','Grade 10',
]

/** Normalize raw DB class name to a canonical display name. */
function normalizeClassName(raw: string): string | null {
  const c = raw.trim()
  if (!c) return null
  const up = c.toUpperCase()
  if (up === 'NURSERY') return 'Nursery'
  if (up === 'LKG') return 'LKG'
  if (up === 'UKG') return 'UKG'
  // Already "Grade N" format
  if (/^Grade \d+$/i.test(c)) return `Grade ${parseInt(c.split(' ')[1], 10)}`
  // Plain number e.g. "1", "10"
  if (/^\d+$/.test(c)) return `Grade ${parseInt(c, 10)}`
  // "Class 8", "Standard 8" etc.
  const m = c.match(/(?:class|std|standard|grade)\s*(\d+)/i)
  if (m) return `Grade ${parseInt(m[1], 10)}`
  return null
}

const HOUSE_COLORS = ['#00b894','#6c5ce7','#e67e22','#e74c3c']
const HOUSE_BGS    = ['#e6f9f5','#f0eeff','#fef3e8','#fdeaea']
const CLUB_COLORS  = ['#2980b9','#27ae60','#f39c12','#8e44ad']
const CLUB_BGS     = ['#e8f4fd','#eafaf1','#fef9e7','#f5eefb']
const AVATAR_COLORS = ['#00b894','#6c5ce7','#e67e22','#2980b9','#e74c3c','#27ae60','#f39c12','#8e44ad']

const DEFAULT_HOUSES = [
  { name:'Tagore House', emoji:'🎨', description:'Arts, literature & cultural leadership', type:'HOUSE' as GroupType, capacity:200, color:'#00b894', bgColor:'#e6f9f5' },
  { name:'Kalam House', emoji:'🚀', description:'Science, technology & innovation', type:'HOUSE' as GroupType, capacity:200, color:'#6c5ce7', bgColor:'#f0eeff' },
  { name:'Gandhi House', emoji:'☮️', description:'Values, community & social leadership', type:'HOUSE' as GroupType, capacity:200, color:'#e67e22', bgColor:'#fef3e8' },
  { name:'Bose House', emoji:'⚡', description:'Courage, discipline & resilience', type:'HOUSE' as GroupType, capacity:200, color:'#e74c3c', bgColor:'#fdeaea' },
]

const DEFAULT_CLUBS = [
  { name:'Science Club', emoji:'🔬', description:'Hands-on science exploration', type:'CLUB' as GroupType, capacity:80, color:'#2980b9', bgColor:'#e8f4fd' },
  { name:'Drama Club', emoji:'🎭', description:'Stagecraft and performance', type:'CLUB' as GroupType, capacity:80, color:'#8e44ad', bgColor:'#f5eefb' },
  { name:'Eco Club', emoji:'🌿', description:'Environment and sustainability', type:'CLUB' as GroupType, capacity:80, color:'#27ae60', bgColor:'#eafaf1' },
  { name:'Math Circle', emoji:'➗', description:'Problem solving and olympiad prep', type:'CLUB' as GroupType, capacity:80, color:'#f39c12', bgColor:'#fef9e7' },
]

const GROUP_EMOJI_SUGGESTIONS = ['🏛️','🏫','🎓','📚','🧠','🧮','🔬','🌍','🎨','🎼','🚀','⚡','🛡️','🌟','🏆','🕊️','🌿','🎯']
const CLUB_EMOJI_SUGGESTIONS = ['🎭','🔬','🌿','➗','🎵','⚽','♟️','💻','🧪','📸','🎤','🏀','🧵','📖','🧑‍🏫','📰','🤖','🛰️']

function suggestEmojiFromName(name: string, type: GroupType) {
  const lower = name.trim().toLowerCase()
  const rules: Array<{ keywords: string[]; emoji: string }> = [
    { keywords: ['drama','theatre','theater','stage','acting'], emoji: '🎭' },
    { keywords: ['science','lab','stem','physics','chemistry','biology'], emoji: '🔬' },
    { keywords: ['math','mathematics','number','abacus','algebra'], emoji: '🧮' },
    { keywords: ['music','band','choir','orchestra'], emoji: '🎼' },
    { keywords: ['art','paint','drawing','design'], emoji: '🎨' },
    { keywords: ['debate','speech','public speaking','moot'], emoji: '🎤' },
    { keywords: ['robot','coding','code','tech','computer'], emoji: '🤖' },
    { keywords: ['eco','environment','green','nature'], emoji: '🌿' },
    { keywords: ['space','astronomy','satellite'], emoji: '🛰️' },
    { keywords: ['sport','football','soccer','cricket','basketball'], emoji: '🏆' },
    { keywords: ['literature','book','reading','library'], emoji: '📖' },
    { keywords: ['peace','service','community'], emoji: '🕊️' },
    { keywords: ['lead','leader','house','captain'], emoji: '🏛️' },
  ]

  for (const rule of rules) {
    if (rule.keywords.some(keyword => lower.includes(keyword))) {
      return rule.emoji
    }
  }

  if (type === 'HOUSE') return '🏛️'
  if (type === 'CLUB') return '🎭'
  return '📚'
}

function splitDescription(value: string | null | undefined) {
  const lines = String(value || '').split(/\r?\n/).map(part => part.trim()).filter(Boolean)
  return {
    slogan: lines[0] || '',
    body: lines.slice(1).join(' '),
  }
}

function generateDescriptionFromName(name: string, type: GroupType) {
  const cleanName = name.trim().replace(/\s+/g, ' ')
  if (!cleanName) return ''

  const lower = cleanName.toLowerCase()
  const slogan = (() => {
    if (lower.includes('science') || lower.includes('stem') || lower.includes('lab')) return 'Experiment with curiosity. Learn with evidence.'
    if (lower.includes('math')) return 'Think precisely. Solve confidently.'
    if (lower.includes('art')) return 'Imagine freely. Create beautifully.'
    if (lower.includes('drama') || lower.includes('theatre') || lower.includes('stage')) return 'Express boldly. Perform with confidence.'
    if (lower.includes('music') || lower.includes('band') || lower.includes('choir')) return 'Feel the rhythm. Share the harmony.'
    if (lower.includes('eco') || lower.includes('green') || lower.includes('nature')) return 'Protect today. Sustain tomorrow.'
    if (lower.includes('debate') || lower.includes('speech')) return 'Speak with clarity. Lead with ideas.'
    if (lower.includes('robot') || lower.includes('tech') || lower.includes('coding')) return 'Build smart. Innovate responsibly.'
    if (lower.includes('house') || lower.includes('leader') || lower.includes('captain')) return 'Lead with pride. Serve with purpose.'
    return type === 'HOUSE' ? 'Unity in spirit. Excellence in action.' : type === 'CLUB' ? 'Discover talents. Grow together.' : 'Belong, build, become.'
  })()

  const body = (() => {
    if (type === 'HOUSE') {
      return `${cleanName} strengthens school culture through leadership, discipline, mentoring, and inter-house participation that builds confidence and responsibility across every grade.`
    }
    if (type === 'CLUB') {
      return `${cleanName} offers students a guided platform to practise core skills, collaborate on projects, prepare for competitions or showcases, and learn through consistent mentor support.`
    }
    return `${cleanName} brings students together around shared goals, positive identity, and meaningful participation in academics, campus events, and peer collaboration.`
  })()

  return `${slogan}\n${body}`
}

const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length]
const initials    = (name: string) =>
  name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

const Ico = {
  Plus:    ({ s=14 }:{s?:number}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  Edit:    () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:   () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  ChevD:   () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevR:   () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  Filter:  () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Sort:    () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="5" y1="12" x2="19" y2="12"/><circle cx="12" cy="7" r="1" fill="currentColor"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>,
  Check:   () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  X:       () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Spin:    () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation:'sgSpin .8s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
}

export default function StudentGroupPage() {
  const [groups,   setGroups]   = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(true)

  const [sf, setSF] = useState<FilterState>({ cls:[], sec:[], house:[], club:[], status:'' })
  const [pendingSF, setPendingSF] = useState<FilterState>({ cls:[], sec:[], house:[], club:[], status:'' })
  const [quickSearch, setQuickSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const [openAccs, setOpenAccs] = useState<Set<number>>(new Set())
  const [openCRs,  setOpenCRs]  = useState<Set<string>>(new Set())

  const [sel, setSel] = useState<Record<number, Set<number>>>({})

  const [swOpen,  setSWOpen]  = useState(false)
  const [agOpen,  setAGOpen]  = useState(false)
  const [inspireOpen, setInspireOpen] = useState(false)
  const [acOpen,  setACOpen]  = useState(false)
  const [editTgt, setEditTgt] = useState<Group|null>(null)
  const [aiDismissed, setAIDismissed] = useState(false)
  const [clubModal, setClubModal] = useState<Group|null>(null)

  const [swMethod,  setSWMethod]  = useState<'random'|'alpha'|'classwise'|'gender'>('random')
  const [swScope,   setSWScope]   = useState<'unassigned'|'all'>('unassigned')
  const [swPreview, setSWPreview] = useState<PreviewItem[]>([])
  const [swLoading, setSWLoading] = useState(false)

  const [savingSid,  setSavingSid]  = useState<number|null>(null)
  const [bulkSaving, setBulkSaving] = useState<number|null>(null)

  const [toast,    setToast]   = useState('')
  const [toastOn,  setToastOn] = useState(false)
  const toastTmr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scrollPosRef = useRef<number>(0)
  const didSeedDefaults = useRef(false)
  const filterJumpReady = useRef(false)
  const houseListRef = useRef<HTMLDivElement | null>(null)
  const clubListRef = useRef<HTMLDivElement | null>(null)

  const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
    const url = new URL(path, 'http://local')
    const pathname = url.pathname
    const query = url.search || ''
    const method = (init?.method || 'GET').toUpperCase()

    const toBackendPath = (() => {
      if (pathname === '/api/student-groups') return '/api/v1/students/groups/' + query
      if (pathname === '/api/student-groups/students') return '/api/v1/students/groups/students/' + query
      if (pathname === '/api/student-groups/stats') return '/api/v1/students/groups/stats/' + query
      if (pathname === '/api/student-groups/assign') return '/api/v1/students/groups/assign/' + query
      if (pathname === '/api/student-groups/bulk-assign') return '/api/v1/students/groups/bulk-assign/' + query
      if (pathname === '/api/student-groups/sortwell-preview') return '/api/v1/students/groups/sortwell-preview/' + query
      if (pathname === '/api/student-groups/sortwell') return '/api/v1/students/groups/sortwell/' + query
      if (pathname.startsWith('/api/student-groups/')) {
        const id = pathname.replace('/api/student-groups/', '')
        return `/api/v1/students/groups/${id}/${query}`
      }
      return path
    })()

    const hasBody = init?.body !== undefined

    const parseBody = (body: RequestInit['body']) => {
      if (!body) return undefined
      if (typeof body === 'string') {
        try {
          return JSON.parse(body)
        } catch {
          return body
        }
      }
      return body
    }

    const mappedBody = (() => {
      const raw = parseBody(init?.body)
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
      const obj = { ...(raw as Record<string, unknown>) }

      if (pathname === '/api/student-groups' && method === 'POST') {
        if (obj.bgColor !== undefined && obj.bg_color === undefined) obj.bg_color = obj.bgColor
        delete obj.bgColor
      }

      if (pathname.startsWith('/api/student-groups/') && method === 'PATCH') {
        if (obj.bgColor !== undefined && obj.bg_color === undefined) obj.bg_color = obj.bgColor
        delete obj.bgColor
      }

      if (pathname === '/api/student-groups/bulk-assign' && method === 'POST') {
        if (obj.studentIds !== undefined && obj.student_ids === undefined) obj.student_ids = obj.studentIds
        if (obj.groupId !== undefined && obj.group_id === undefined) obj.group_id = obj.groupId
        delete obj.studentIds
        delete obj.groupId
      }

      return obj
    })()

    const data = await apiRequestWithRefresh<unknown>(toBackendPath, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(mappedBody) : undefined,
    })

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }, [])

  function asList<T>(data: ApiList<T>): T[] {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.results)) return data.results
    return []
  }

  function normalizeGroup(g: any): Group {
    const t = String(g?.type || 'CUSTOM').toUpperCase()
    const type: GroupType = t === 'HOUSE' || t === 'CLUB' || t === 'CUSTOM' ? t : 'CUSTOM'
    return {
      id: Number(g?.id || 0),
      name: String(g?.name || 'Untitled Group'),
      type,
      emoji: String(g?.emoji || '📌'),
      description: g?.description ?? null,
      color: String(g?.color || '#00b894'),
      bgColor: String(g?.bgColor || g?.bg_color || '#e6f9f5'),
      capacity: Number(g?.capacity || 40),
      studentCount: Number(g?.studentCount ?? g?.students_count ?? 0),
    }
  }

  function normalizeStudent(s: any): Student {
    const full = s?.name || `${s?.first_name || ''} ${s?.last_name || ''}`.trim()
    const rawClass = String(s?.class || s?.class_name || '')
    const cls = normalizeClassName(rawClass) ?? (rawClass || '-')
    // clubIds: from M2M field (array of numbers) — falls back to empty array
    const rawClubIds: number[] = Array.isArray(s?.clubIds)
      ? s.clubIds.map(Number).filter(Boolean)
      : []
    return {
      id: Number(s?.id || 0),
      name: String(full || 'Student'),
      admissionNo: String(s?.admissionNo || s?.admission_no || '-'),
      class: cls,
      section: String(s?.section || '-'),
      classIndex: Number(s?.classIndex ?? s?.class_index ?? 99),
      currentGroupId: s?.currentGroupId ?? s?.current_group_id ?? s?.student_group ?? null,
      clubIds: rawClubIds,
      aiHint: s?.aiHint ?? s?.ai_hint ?? null,
    }
  }

  function normalizeStats(st: any): Stats {
    const total = Number(st?.totalStudents ?? st?.total_students ?? 0)
    const assigned = Number(st?.assigned ?? 0)
    return {
      totalStudents: total,
      assigned,
      unassigned: Number(st?.unassigned ?? Math.max(total - assigned, 0)),
      houseCount: Number(st?.houseCount ?? st?.house_count ?? 0),
      clubCount: Number(st?.clubCount ?? st?.club_count ?? 0),
    }
  }

  const loadAll = useCallback(async () => {
    const [g, s, st] = await Promise.all([
      apiFetch('/api/student-groups').then(r => r.json()),
      apiFetch('/api/student-groups/students').then(r => r.json()),
      apiFetch('/api/student-groups/stats').then(r => r.json()),
    ])
    setGroups(asList<any>(g).map(normalizeGroup))
    setStudents(asList<any>(s).map(normalizeStudent))
    setStats(normalizeStats(st))
    setLoading(false)
  }, [apiFetch])

  const rGroups = async () => {
    const [g, st] = await Promise.all([
      apiFetch('/api/student-groups').then(r => r.json()),
      apiFetch('/api/student-groups/stats').then(r => r.json()),
    ])
    setGroups(asList<any>(g).map(normalizeGroup))
    setStats(normalizeStats(st))
  }

  const rStudents = useCallback(async () => {
    const s = await apiFetch('/api/student-groups/students').then(r => r.json())
    setStudents(asList<any>(s).map(normalizeStudent))
  }, [apiFetch])

  useEffect(() => { void loadAll() }, [loadAll])

  useEffect(() => {
    if (loading || didSeedDefaults.current) return
    didSeedDefaults.current = true

    const run = async () => {
      const keyOf = (t: GroupType, n: string) => `${t}:${n.trim().toLowerCase()}`
      const existing = new Set(groups.map(g => keyOf(g.type, g.name)))
      const missing = [...DEFAULT_HOUSES, ...DEFAULT_CLUBS].filter(g => !existing.has(keyOf(g.type, g.name)))
      if (!missing.length) return

      let created = 0
      for (const g of missing) {
        try {
          await apiFetch('/api/student-groups', { method:'POST', body: JSON.stringify(g) })
          created += 1
        } catch (e) {
          const msg = e instanceof Error ? e.message.toLowerCase() : ''
          if (!(msg.includes('duplicate') || msg.includes('unique') || msg.includes('already'))) {
            // non-duplicate errors are ignored here to avoid blocking page usage
          }
        }
      }
      if (created > 0) {
        await rGroups()
        showToast(`Added ${created} default groups`)
      }
    }

    void run()
  }, [loading, groups, apiFetch])

  useEffect(() => {
    if (!swOpen) return
    void apiFetch(`/api/student-groups/sortwell-preview?scope=${swScope}`)
      .then(r => r.json()).then((p: any) => {
        const list = asList<any>(p)
        setSWPreview(list.map((x) => ({
          groupId: Number(x?.groupId || 0),
          groupName: String(x?.groupName || '-'),
          emoji: String(x?.emoji || '📌'),
          color: String(x?.color || '#00b894'),
          bgColor: String(x?.bgColor || x?.bg_color || '#e6f9f5'),
          count: Number(x?.count || 0),
        })))
      })
  }, [swOpen, swScope])

  // Preserve scroll position when filters change
  useEffect(() => {
    const handleBeforeFilterChange = () => {
      scrollPosRef.current = window.scrollY
    }
    
    const handleAfterFilterChange = () => {
      // Restore scroll position after layout has updated
      setTimeout(() => {
        window.scrollTo(0, scrollPosRef.current)
      }, 0)
    }
    
    handleBeforeFilterChange()
    return handleAfterFilterChange
  }, [sf, quickSearch])

  const houses = groups.filter(g => g.type === 'HOUSE')
  const clubs  = groups.filter(g => g.type === 'CLUB')

  // Always show all classes from the CLASSES constant so Nursery/LKG/UKG are always visible.
  // Section pills are derived from actual student data (they vary by school setup).
  const availableClasses = CLASSES  // Nursery → LKG → UKG → Grade 1 → … → Grade 10
  const availableSections = React.useMemo(() =>
    [...new Set(students.map(s => s.section).filter(s => s && s !== '-'))].sort(),
    [students]
  )

  function fStudents() {
    return students.filter(s => {
      const query = quickSearch.trim().toLowerCase()
      const group = groups.find(x => x.id === s.currentGroupId)
      // clubs the student belongs to (via M2M)
      const studentClubs = clubs.filter(c => (s.clubIds || []).includes(c.id))

      // Text search
      if (query) {
        const clubNames = studentClubs.map(c => c.name).join(' ')
        const haystack = [s.name, s.admissionNo, s.class, s.section, group?.name || '', clubNames].join(' ').toLowerCase()
        if (!haystack.includes(query)) return false
      }

      // Class filter (client-side)
      if (sf.cls.length && !sf.cls.includes(s.class)) return false

      // Section filter (client-side)
      if (sf.sec.length && !sf.sec.includes(s.section)) return false

      // Status filter (client-side): assigned = has a group or club, unassigned = no group AND no clubs
      if (sf.status.toLowerCase() === 'assigned' && !s.currentGroupId && (s.clubIds || []).length === 0) return false
      if (sf.status.toLowerCase() === 'unassigned' && (s.currentGroupId || (s.clubIds || []).length > 0)) return false

      // House filter (client-side)
      if (sf.house.length) {
        if (!group || !houses.find(h => h.id === group.id && sf.house.includes(h.name))) return false
      }

      // Club filter (client-side): student must belong to at least one filtered club
      if (sf.club.length) {
        const hasClub = studentClubs.some(c => sf.club.includes(c.name))
        if (!hasClub) return false
      }

      return true
    })
  }

  function showToast(msg: string) {
    setToast(msg)
    setToastOn(true)
    if (toastTmr.current) clearTimeout(toastTmr.current)
    toastTmr.current = setTimeout(() => setToastOn(false), 2800)
  }

  function toggleF(key: keyof FilterState, value: string) {
    setSF(p => {
      if (key === 'status') return { ...p, status: p.status === value ? '' : value }
      const arr = p[key] as string[]
      return { ...p, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  function togglePendingF(key: keyof FilterState, value: string) {
    setPendingSF(p => {
      if (key === 'status') return { ...p, status: p.status === value ? '' : value }
      const arr = p[key] as string[]
      return { ...p, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  function applyFilters() {
    setSF(pendingSF)
    setFilterOpen(false)
  }

  function clearAllF() {
    const empty = { cls:[], sec:[], house:[], club:[], status:'' }
    setSF(empty)
    setPendingSF(empty)
    setQuickSearch('')
  }

  const chips = [
    ...(quickSearch.trim() ? [{ key:'search' as const, val: `Search: ${quickSearch.trim()}` }] : []),
    ...sf.cls.map(v    => ({ key:'cls'   as keyof FilterState, val: v })),
    ...sf.sec.map(v    => ({ key:'sec'   as keyof FilterState, val: v })),
    ...sf.house.map(v  => ({ key:'house' as keyof FilterState, val: v })),
    ...sf.club.map(v   => ({ key:'club'  as keyof FilterState, val: v })),
    ...(sf.status ? [{ key:'status' as keyof FilterState, val: `Status: ${sf.status}` }] : []),
  ]

  const pendingCount = pendingSF.cls.length + pendingSF.sec.length + pendingSF.house.length + pendingSF.club.length + (pendingSF.status ? 1 : 0)
  const hasFilterChanges = JSON.stringify(sf) !== JSON.stringify(pendingSF)

  useEffect(() => {
    if (loading) return
    filterJumpReady.current = true
  }, [loading])

  const togAcc = (id: number) => setOpenAccs(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  const togCR  = (k: string)  => setOpenCRs(p  => { const n=new Set(p); n.has(k) ?n.delete(k) :n.add(k);  return n })

  function togRow(gid: number, sid: number, checked: boolean) {
    setSel(p => { const n=new Set(p[gid]||[]); checked?n.add(sid):n.delete(sid); return {...p,[gid]:n} })
  }
  function togCls(gid: number, cls: string, checked: boolean) {
    const grp = groups.find(g => g.id === gid)
    const ids = grp?.type === 'CLUB'
      ? fStudents().filter(s => (s.clubIds || []).includes(gid) && s.class === cls).map(s => s.id)
      : fStudents().filter(s => s.currentGroupId === gid && s.class === cls).map(s => s.id)
    setSel(p => { const n=new Set(p[gid]||[]); ids.forEach(id=>checked?n.add(id):n.delete(id)); return {...p,[gid]:n} })
  }
  function clearSel(gid: number) { setSel(p=>({...p,[gid]:new Set()})) }

  async function assignOne(studentId: number, groupId: number|null) {
    const grp = groupId ? groups.find(g => g.id === groupId) : null
    const isClub = grp?.type === 'CLUB'

    setSavingSid(studentId)

    if (isClub && groupId) {
      // Club assignment: toggle M2M membership
      const alreadyMember = students.find(s => s.id === studentId)?.clubIds.includes(groupId) ?? false
      // Optimistic update
      setStudents(p => p.map(s => {
        if (s.id !== studentId) return s
        return {
          ...s,
          clubIds: alreadyMember
            ? s.clubIds.filter(id => id !== groupId)
            : [...s.clubIds, groupId],
        }
      }))
      try {
        const res = await apiFetch('/api/student-groups/club-toggle', {
          method: 'POST',
          body: JSON.stringify({ studentId, clubId: groupId }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json() as { action: string; clubIds: number[] }
        // Sync exact server state
        setStudents(p => p.map(s => s.id === studentId ? { ...s, clubIds: data.clubIds || [] } : s))
        await rGroups()
        const s = students.find(x => x.id === studentId)
        showToast(data.action === 'added'
          ? `${s?.name} joined ${grp.emoji} ${grp.name}`
          : `${s?.name} left ${grp.emoji} ${grp.name}`)
      } catch {
        await rStudents()
        showToast('Save failed - please try again')
      } finally { setSavingSid(null) }
    } else {
      // House assignment: single FK
      setStudents(p => p.map(s => s.id === studentId ? {...s, currentGroupId: groupId} : s))
      try {
        const res = await apiFetch('/api/student-groups/assign', {
          method: 'POST',
          body: JSON.stringify({ studentId, groupId }),
        })
        if (!res.ok) throw new Error()
        await rGroups()
        const s = students.find(x => x.id === studentId)
        showToast(grp ? `${s?.name} -> ${grp.emoji} ${grp.name}` : `${s?.name} unassigned`)
      } catch {
        await rStudents()
        showToast('Save failed - please try again')
      } finally { setSavingSid(null) }
    }
  }

  async function bulkClubAdd(studentIds: number[], clubId: number) {
    const grp = groups.find(g => g.id === clubId)
    if (!grp) return
    // Optimistic update: add clubId to each student's clubIds
    setStudents(p => p.map(s =>
      studentIds.includes(s.id) && !s.clubIds.includes(clubId)
        ? { ...s, clubIds: [...s.clubIds, clubId] }
        : s
    ))
    try {
      await Promise.all(studentIds.map(sid =>
        apiFetch('/api/student-groups/club-assign', {
          method: 'POST',
          body: JSON.stringify({ studentId: sid, clubId }),
        })
      ))
      // Sync server state for all updated students
      const refreshed = await apiFetch('/api/student-groups/students').then(r => r.json())
      setStudents(asList<any>(refreshed).map(normalizeStudent))
      await rGroups()
      showToast(`${studentIds.length} student${studentIds.length !== 1 ? 's' : ''} added to ${grp.emoji} ${grp.name}`)
    } catch {
      await rStudents()
      showToast('Some adds failed — please retry')
    }
  }

  async function doBulk(groupId: number, targetGroupId: number) {
    const ids = Array.from(sel[groupId]||[])
    if (!ids.length) return
    setBulkSaving(groupId)
    await apiFetch('/api/student-groups/bulk-assign', {
      method:'POST',
      body: JSON.stringify({ studentIds: ids, groupId: targetGroupId }),
    })
    const g = groups.find(x=>x.id===targetGroupId)
    clearSel(groupId)
    await Promise.all([rGroups(), rStudents()])
    showToast(`${ids.length} students -> ${g?.emoji} ${g?.name}`)
    setBulkSaving(null)
  }

  async function applyAI() {
    const un = students.filter(s=>s.currentGroupId===null)
    if (!un.length) { showToast('All students already assigned'); return }
    await Promise.all(
      houses.map((h,i) => {
        const slice = un.filter((_,idx)=>idx%houses.length===i).map(s=>s.id)
        if (!slice.length) return Promise.resolve()
        return apiFetch('/api/student-groups/bulk-assign', {
          method:'POST',
          body: JSON.stringify({ studentIds:slice, groupId:h.id }),
        })
      })
    )
    await Promise.all([rGroups(), rStudents()])
    setAIDismissed(true)
    showToast(`${un.length} students assigned via AI suggestion`)
  }

  async function applyDivide() {
    setSWLoading(true)
    const res = await apiFetch('/api/student-groups/sortwell', {
      method:'POST',
      body: JSON.stringify({ method:swMethod, scope:swScope }),
    })
    const data = await res.json()
    setSWLoading(false)
    setSWOpen(false)
    await Promise.all([rGroups(), rStudents(),
      apiFetch('/api/student-groups/stats').then(r=>r.json()).then((st) => setStats(normalizeStats(st)))])
    showToast(`OK ${data.assigned} students sorted across ${houses.length} houses`)
  }

  async function saveGroup(data:{name:string;type:string;emoji:string;description:string;capacity:number}) {
    if (!data.name.trim()) { showToast('Group name required'); return }
    try {
      if (editTgt) {
        await apiFetch(`/api/student-groups/${editTgt.id}`, {
          method:'PATCH',
          body: JSON.stringify(data),
        })
        showToast(`${data.name} updated`)
      } else {
        const ci = data.type==='HOUSE' ? houses.length%4 : clubs.length%4
        await apiFetch('/api/student-groups', {
          method:'POST',
          body: JSON.stringify({
            ...data,
            color:   data.type==='HOUSE' ? HOUSE_COLORS[ci] : CLUB_COLORS[ci],
            bgColor: data.type==='HOUSE' ? HOUSE_BGS[ci]    : CLUB_BGS[ci],
          }),
        })
        showToast(`${data.name} created`)
      }
      setAGOpen(false)
      setEditTgt(null)
      await rGroups()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to save group'
      const low = msg.toLowerCase()
      const isDup = low.includes('duplicate') || low.includes('unique') || low.includes('already')
      if (!editTgt && isDup) {
        const found = groups.find(g => g.type === data.type && g.name.trim().toLowerCase() === data.name.trim().toLowerCase())
        if (found) {
          try {
            await apiFetch(`/api/student-groups/${found.id}`, {
              method:'PATCH',
              body: JSON.stringify({ name:data.name, emoji:data.emoji, description:data.description, capacity:data.capacity }),
            })
            setAGOpen(false)
            setEditTgt(null)
            await rGroups()
            showToast(`${data.name} already existed - updated instead`)
            return
          } catch {}
        }
      }
      showToast(msg)
    }
  }

  async function saveClub(data:{name:string;emoji:string;description:string;capacity:number}) {
    if (!data.name.trim()) { showToast('Club name required'); return }
    try {
      const ci = clubs.length%4
      await apiFetch('/api/student-groups', {
        method:'POST',
        body: JSON.stringify({ ...data, type:'CLUB', color:CLUB_COLORS[ci], bgColor:CLUB_BGS[ci] }),
      })
      setACOpen(false)
      await rGroups()
      showToast(`${data.emoji} ${data.name} club created`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to create club'
      const low = msg.toLowerCase()
      const isDup = low.includes('duplicate') || low.includes('unique') || low.includes('already')
      if (isDup) {
        const found = groups.find(g => g.type === 'CLUB' && g.name.trim().toLowerCase() === data.name.trim().toLowerCase())
        if (found) {
          try {
            await apiFetch(`/api/student-groups/${found.id}`, {
              method:'PATCH',
              body: JSON.stringify({ name:data.name, emoji:data.emoji, description:data.description, capacity:data.capacity }),
            })
            setACOpen(false)
            await rGroups()
            showToast(`${data.name} already existed - updated instead`)
            return
          } catch {}
        }
      }
      showToast(msg)
    }
  }

  async function deleteGroup(id: number) {
    if (!confirm('Delete this group? All student assignments will be removed.')) return
    await apiFetch(`/api/student-groups/${id}`, { method:'DELETE' })
    await Promise.all([rGroups(), rStudents()])
    showToast('Group deleted')
  }

  if (loading) return <Skeleton />

  const filtered = fStudents()

  return (
    <>
      <style>{`@keyframes sgSpin{to{transform:rotate(360deg)}}`}</style>

      <div className="ph">
        <div>
          <div className="ph-pre">Student Information</div>
          <div className="ph-title">Student <span>Group</span></div>
          <div className="ph-sub">
            Manage {stats?.totalStudents ?? '-'} students across houses &amp; clubs - assign in bulk, class by class
          </div>
        </div>
        <div className="ph-actions">
          <div className="btn-sortwell-wrap">
            <button className="btn-sortwell" onClick={()=>setSWOpen(true)}>
              <Ico.Sort /> Sortwell
            </button>
            <div className="sw-tooltip">
              <strong>Sortwell</strong> divides the entire school into houses equally -
              by random shuffle, alphabetical order, class rotation, or gender balance. One click, done.
            </div>
          </div>
          <button className="btn-new" onClick={()=>{setEditTgt(null);setAGOpen(true)}}>
            <Ico.Plus /> Add Group
          </button>
          <InspireHubButton onClick={() => setInspireOpen(true)} />
        </div>
        <InspireHubModal
          isOpen={inspireOpen}
          onClose={() => setInspireOpen(false)}
          houses={groups.filter(g => g.type === 'HOUSE').map(g => ({ id: String(g.id), name: g.name, emoji: g.emoji, color: g.color, bgColor: g.bgColor }))}
          clubs={groups.filter(g => g.type === 'CLUB').map(g => ({ id: String(g.id), name: g.name, emoji: g.emoji, color: g.color, bgColor: g.bgColor }))}
          students={students.map(s => {
            const grp = groups.find(g => g.id === s.currentGroupId)
            const firstClub = clubs.find(c => (s.clubIds || []).includes(c.id))
            return {
              id: s.id,
              full_name: (s as any).fullName || (s as any).full_name || s.name || `Student ${s.id}`,
              admission_no: s.admissionNo,
              class_name: s.class,
              section: s.section,
              house_id:   grp?.type === 'HOUSE' ? String(grp.id) : null,
              house_name: grp?.type === 'HOUSE' ? grp.name : null,
              club_id:    firstClub ? String(firstClub.id) : null,
              club_name:  firstClub ? firstClub.name : null,
            }
          })}
        />
      </div>

      <div className="stats">
        {[
          { tone:'students', eyebrow:'Students', val:stats?.totalStudents, lbl:'Total Students' },
          { tone:'assigned', eyebrow:'Assigned', val:stats?.assigned, lbl:'Assigned Students' },
          { tone:'waiting', eyebrow:'Waiting', val:stats?.unassigned, lbl:'Unassigned Students' },
          { tone:'houses', eyebrow:'House', val:stats?.houseCount, lbl:'School Houses' },
          { tone:'clubs', eyebrow:'Club', val:stats?.clubCount, lbl:'School Clubs' },
        ].map((s,i) => (
          <div key={i} className={`sc sc-${s.tone}`}>
            <div className="sc-copy">
              <div className="sc-eyebrow">{s.eyebrow}</div>
              <div className="sc-v">{s.val??'-'}</div>
              <div className="sc-l">{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sec-head">
        <div className="sec-title"><div className="sec-dot" style={{background:'var(--teal)'}}/>School Houses</div>
        <span className="sec-cnt">{houses.length} Houses</span>
      </div>
      <div className="houses-grid">
        {houses.map(h=>(
          <HCard key={h.id} g={h}
            onEdit={()=>{setEditTgt(h);setAGOpen(true)}}
            onDelete={()=>{ void deleteGroup(h.id) }}/>
        ))}
      </div>

      <div className="sec-head">
        <div className="sec-title"><div className="sec-dot" style={{background:'var(--purple)'}}/>School Clubs</div>
        <div className="sec-right">
          <span className="sec-cnt">{clubs.length} Clubs</span>
        </div>
      </div>
      <div className="clubs-grid">
        {clubs.map(c=>(
          <CCard key={c.id} g={c}
            onEdit={()=>{setEditTgt(c);setAGOpen(true)}}
            onDelete={()=>{ void deleteGroup(c.id) }}/>
        ))}
        <div className="cc-ghost" onClick={()=>setACOpen(true)}>
          <div className="cc-ghost-icon">+</div>
          <div className="cc-ghost-txt">New Club</div>
        </div>
      </div>

      <div className="sg-filter-shell">
        {/* ── Always-visible: search + controls ── */}
        <div className="sg-search-row">
          <div className="sg-searchbox">
            <Ico.Filter />
            <input
              value={quickSearch}
              onChange={e=>setQuickSearch(e.target.value)}
              placeholder="Search student, admission no, class, section, house or club"
            />
            {quickSearch&&<button className="sg-search-clear" onClick={()=>setQuickSearch('')}><Ico.X/></button>}
          </div>
          <button
            className={`sg-filter-toggle-btn${filterOpen?' open':''}`}
            onClick={()=>setFilterOpen(v=>!v)}
          >
            <Ico.Filter/>
            <span>Filters</span>
            {pendingCount>0&&<span className="sg-filter-badge">{pendingCount}</span>}
            {hasFilterChanges&&<span className="sg-filter-pending-dot"/>}
            <span className="sg-filter-caret">{filterOpen?'▲':'▼'}</span>
          </button>
          {(chips.length>0||hasFilterChanges)&&<button className="sg-reset-btn" onClick={(e)=>{e.preventDefault();clearAllF()}}>Reset all</button>}
          <button className="sg-filter-jump" onClick={(e)=>{e.preventDefault();houseListRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })}}>Houses ↓</button>
          <button className="sg-filter-jump" onClick={(e)=>{e.preventDefault();clubListRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })}}>Clubs ↓</button>
        </div>

        {/* ── Active applied filter chips ── */}
        {chips.length>0&&(
          <div className="sg-active-strip">
            {chips.map((c,i)=>(
              <span key={i} className="sg-active-chip">{c.val}
                <button className="sg-active-chip-x" onClick={(e)=>{e.preventDefault();
                  if(c.key==='search') setQuickSearch('')
                  else if(c.key==='status') { setSF(p=>({...p,status:''})); setPendingSF(p=>({...p,status:''})) }
                  else { setSF(p=>({...p,[c.key]:(p[c.key] as string[]).filter(v=>v!==c.val)})); setPendingSF(p=>({...p,[c.key]:(p[c.key] as string[]).filter(v=>v!==c.val)})) }
                }}><Ico.X/></button>
              </span>
            ))}
          </div>
        )}

        {/* ── Collapsible filter pills (use pendingSF, applied on click of Apply) ── */}
        {filterOpen&&(
          <div className="sg-filter-body">
            <div className="sg-filter-group">
              <div className="sg-filter-label">Class</div>
              <div className="sg-pill-row">
                <button className={`sg-pill${pendingSF.cls.length===0?' active':''}`} onClick={(e)=>{e.preventDefault();setPendingSF(p=>({...p,cls:[]}))}}>All</button>
                {availableClasses.map(cls=>(
                  <button key={cls} className={`sg-pill${pendingSF.cls.includes(cls)?' active':''}`} onClick={(e)=>{e.preventDefault();togglePendingF('cls',cls)}}>{cls}</button>
                ))}
              </div>
            </div>
            <div className="sg-filter-row-pair">
              <div className="sg-filter-group">
                <div className="sg-filter-label">Section</div>
                <div className="sg-pill-row">
                  <button className={`sg-pill${pendingSF.sec.length===0?' active':''}`} onClick={(e)=>{e.preventDefault();setPendingSF(p=>({...p,sec:[]}))}}>All</button>
                  {availableSections.map(sec=>(
                    <button key={sec} className={`sg-pill${pendingSF.sec.includes(sec)?' active':''}`} onClick={(e)=>{e.preventDefault();togglePendingF('sec',sec)}}>{sec}</button>
                  ))}
                </div>
              </div>
              <div className="sg-filter-group">
                <div className="sg-filter-label">Status</div>
                <div className="sg-pill-row">
                  <button className={`sg-pill${!pendingSF.status?' active':''}`} onClick={(e)=>{e.preventDefault();setPendingSF(p=>({...p,status:''}))}}>All</button>
                  {['Assigned','Unassigned'].map(status=>(
                    <button key={status} className={`sg-pill${pendingSF.status===status?' active':''}`} onClick={(e)=>{e.preventDefault();togglePendingF('status',status)}}>{status}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="sg-filter-row-pair">
              <div className="sg-filter-group">
                <div className="sg-filter-label">House</div>
                <div className="sg-pill-row">
                  <button className={`sg-pill${pendingSF.house.length===0?' active':''}`} onClick={(e)=>{e.preventDefault();setPendingSF(p=>({...p,house:[]}))}}>Any</button>
                  {houses.map(h=>(
                    <button key={h.id} className={`sg-pill${pendingSF.house.includes(h.name)?' active':''}`} onClick={(e)=>{e.preventDefault();togglePendingF('house',h.name)}}>{h.emoji} {h.name}</button>
                  ))}
                </div>
              </div>
              <div className="sg-filter-group">
                <div className="sg-filter-label">Club</div>
                <div className="sg-pill-row">
                  <button className={`sg-pill${pendingSF.club.length===0?' active':''}`} onClick={(e)=>{e.preventDefault();setPendingSF(p=>({...p,club:[]}))}}>Any</button>
                  {clubs.map(c=>(
                    <button key={c.id} className={`sg-pill${pendingSF.club.includes(c.name)?' active':''}`} onClick={(e)=>{e.preventDefault();togglePendingF('club',c.name)}}>{c.emoji} {c.name}</button>
                  ))}
                </div>
              </div>
            </div>
            {/* Apply / Cancel row */}
            <div className="sg-filter-apply-row">
              <button
                className={`sg-apply-btn${hasFilterChanges?' changed':''}`}
                onClick={(e)=>{e.preventDefault();applyFilters()}}
              >
                {hasFilterChanges ? '✓ Apply Filter' : '✓ Applied'}
              </button>
              {hasFilterChanges&&(
                <button className="sg-cancel-btn" onClick={(e)=>{e.preventDefault();setPendingSF(sf);setFilterOpen(false)}}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Filtered student results list ── */}
      {(chips.length>0||quickSearch.trim())&&(
        <div className="sg-results-panel">
          <div className="sg-results-hdr">
            <span className="sg-results-count">{filtered.length} student{filtered.length!==1?'s':''} found</span>
            <span className="sg-results-sub">matching applied filters</span>
          </div>
          {filtered.length===0?(
            <div className="sg-no-results">
              <span>🔍</span>
              <span>No students match the selected filters. Try adjusting your search or filters above.</span>
            </div>
          ):(
            <div className="sg-result-list">
              {filtered.map(s=>{
                const grp = groups.find(g=>g.id===s.currentGroupId)
                const studentClubs = clubs.filter(c=>(s.clubIds||[]).includes(c.id))
                const av = AVATAR_COLORS[s.id % AVATAR_COLORS.length]
                return (
                  <div key={s.id} className="sg-result-row">
                    <div className="sg-result-av" style={{background:av}}>{s.name.charAt(0).toUpperCase()}</div>
                    <div className="sg-result-info">
                      <div className="sg-result-name">{s.name}</div>
                      <div className="sg-result-meta">{s.admissionNo} · {s.class}{s.section&&s.section!=='-'?` · Sec ${s.section}`:''}</div>
                    </div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {grp&&grp.type!=='CLUB'&&(
                        <div className="sg-result-tag" style={{background:grp.bgColor,color:grp.color}}>{grp.emoji} {grp.name}</div>
                      )}
                      {studentClubs.map(c=>(
                        <div key={c.id} className="sg-result-tag" style={{background:c.bgColor,color:c.color}}>{c.emoji} {c.name}</div>
                      ))}
                      {!grp&&studentClubs.length===0&&(
                        <div className="sg-result-tag unassigned">Unassigned</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="divider"><div className="div-line"/><div className="div-lbl">House - Student List</div><div className="div-line"/></div>
      <div className="acc-section" ref={houseListRef}>
        <div className="acc-section-hd">
          <div className="acc-section-title">
            <div className="sec-dot" style={{background:'var(--teal)'}}/>
            School Houses
            <span className="acc-section-sub" style={{fontWeight:400,marginLeft:4}}>- filtered results shown immediately after selection</span>
          </div>
        </div>
        {houses.map((h,hi)=>(
          <Accordion key={h.id} group={h} students={filtered}
            isOpen={openAccs.has(h.id)} onToggle={()=>togAcc(h.id)}
            openCRs={openCRs} onToggleCR={togCR}
            selected={sel[h.id]||new Set()}
            onToggleRow={(sid,chk)=>togRow(h.id,sid,chk)}
            onToggleCls={(cls,chk)=>togCls(h.id,cls,chk)}
            onClearSel={()=>clearSel(h.id)}
            onBulkAssign={(tgt)=>{ void doBulk(h.id,tgt) }}
            onAssignOne={(sid,gid)=>{ void assignOne(sid,gid) }}
            bulkSaving={bulkSaving===h.id}
            savingSid={savingSid}
            allGroups={groups}
            showAI={hi===0&&!aiDismissed&&(stats?.unassigned??0)>0}
            onAIApply={()=>{ void applyAI() }}
            onAIDismiss={()=>setAIDismissed(true)}
            onOpenClubModal={setClubModal}/>
        ))}
      </div>

      <div className="divider"><div className="div-line"/><div className="div-lbl">Club - Student List</div><div className="div-line"/></div>
      <div className="acc-section" ref={clubListRef}>
        <div className="acc-section-hd">
          <div className="acc-section-title">
            <div className="sec-dot" style={{background:'var(--purple)'}}/>
            School Clubs
            <span className="acc-section-sub" style={{fontWeight:400,marginLeft:4}}>- keep filtering and jump straight into matching club members</span>
          </div>
        </div>
        {clubs.map(c=>(
          <Accordion key={c.id} group={c} students={filtered}
            isOpen={openAccs.has(c.id)} onToggle={()=>togAcc(c.id)}
            openCRs={openCRs} onToggleCR={togCR}
            selected={sel[c.id]||new Set()}
            onToggleRow={(sid,chk)=>togRow(c.id,sid,chk)}
            onToggleCls={(cls,chk)=>togCls(c.id,cls,chk)}
            onClearSel={()=>clearSel(c.id)}
            onBulkAssign={(tgt)=>{ void doBulk(c.id,tgt) }}
            onAssignOne={(sid,gid)=>{ void assignOne(sid,gid) }}
            bulkSaving={bulkSaving===c.id}
            savingSid={savingSid}
            allGroups={groups}
            showAI={false} onAIApply={()=>{}} onAIDismiss={()=>{}}
            onOpenClubModal={setClubModal}/>
        ))}
      </div>

      {clubModal&&(
        <ClubMembersModal
          club={clubModal}
          allStudents={students}
          onAssignOne={(sid,gid)=>{ void assignOne(sid,gid) }}
          onBulkAdd={(sids,gid)=>{ void bulkClubAdd(sids,gid) }}
          savingSid={savingSid}
          onClose={()=>setClubModal(null)}/>
      )}

      {swOpen&&<SWModal method={swMethod} setMethod={setSWMethod} scope={swScope} setScope={setSWScope}
        preview={swPreview} loading={swLoading} onApply={()=>{ void applyDivide() }} onClose={()=>setSWOpen(false)}/>}

      {agOpen&&<AGModal editTarget={editTgt} onSave={(data)=>{ void saveGroup(data) }} onClose={()=>{setAGOpen(false);setEditTgt(null)}}/>}

      {acOpen&&<ACModal onSave={(data)=>{ void saveClub(data) }} onClose={()=>setACOpen(false)}/>}

      <div className={`toast${toastOn?' show':''}`}>
        <div className="t-dot"/><span>{toast}</span>
      </div>
    </>
  )
}

function HCard({g,onEdit,onDelete}:{g:Group;onEdit():void;onDelete():void}) {
  const pct = Math.min(100,Math.round(g.studentCount/g.capacity*100))
  const desc = splitDescription(g.description)
  return (
    <div className="hc">
      <div className="hc-stripe" style={{background:g.color}}/>
      <div className="hc-top">
        <div className="hc-emblem" style={{background:g.bgColor}}>{g.emoji}</div>
        <div className="hc-name">{g.name}</div>
        <div className="hc-motto">{desc.slogan || desc.body || 'Student leadership and house identity'}</div>
        <div className="hc-stats">
          <span className="hc-big" style={{color:g.color}}>{g.studentCount}</span>
          <span className="hc-of">students<br/><small style={{fontSize:10,color:'var(--light)'}}>of {g.capacity}</small></span>
        </div>
        <div className="hc-bar-wrap">
          <div className="hc-bar"><div className="hc-fill" style={{width:`${pct}%`,background:g.color}}/></div>
          <div className="hc-pct">{pct}%</div>
        </div>
      </div>
      <div className="hc-bot">
        <span style={{fontSize:11,color:'var(--light)'}}>{g.studentCount} student{g.studentCount!==1?'s':''} assigned</span>
        <div className="hact">
          <button className="hbtn" onClick={onEdit} title="Edit"><Ico.Edit/></button>
          <button className="hbtn danger" onClick={onDelete} title="Delete"><Ico.Trash/></button>
        </div>
      </div>
    </div>
  )
}

function CCard({g,onEdit,onDelete}:{g:Group;onEdit():void;onDelete():void}) {
  const desc = splitDescription(g.description)
  return (
    <div className="cc">
      <div className="cc-head">
        <div className="cc-icon" style={{background:g.bgColor}}>{g.emoji}</div>
        <div>
          <div className="cc-name">{g.name}</div>
          <span className="cc-tag" style={{background:g.bgColor,color:g.color}}>Club</span>
        </div>
      </div>
      <div className="cc-desc">
        {desc.slogan && <strong>{desc.slogan}</strong>}
        {desc.body && <span>{desc.body}</span>}
        {!desc.slogan && !desc.body && 'Student-led activities and collaborative learning.'}
      </div>
      <div className="cc-foot">
        <span className="cc-chip">{g.studentCount} / {g.capacity}</span>
        <div style={{display:'flex',gap:5}}>
          <button className="cc-btn" onClick={onEdit} title="Edit"><Ico.Edit/></button>
          <button className="cc-btn danger" onClick={onDelete} title="Delete"><Ico.Trash/></button>
        </div>
      </div>
    </div>
  )
}

interface AccProps {
  group:Group; students:Student[]
  isOpen:boolean; onToggle():void
  openCRs:Set<string>; onToggleCR(k:string):void
  selected:Set<number>
  onToggleRow(sid:number,chk:boolean):void
  onToggleCls(cls:string,chk:boolean):void
  onClearSel():void
  onBulkAssign(targetGroupId:number):void
  onAssignOne(sid:number,gid:number|null):void
  bulkSaving:boolean; savingSid:number|null
  allGroups:Group[]
  showAI:boolean; onAIApply():void; onAIDismiss():void
  onOpenClubModal(g:Group):void
}

function Accordion(p:AccProps) {
  const {group:g, students} = p
  const isClub = g.type === 'CLUB'

  // For houses: show only members. For clubs: show ALL students so admin can add/remove.
  const houseMembers = students.filter(s => s.currentGroupId === g.id)
  const memberIds    = new Set(students.filter(s => (s.clubIds||[]).includes(g.id)).map(s => s.id))
  const displayStudents = isClub ? students : houseMembers

  const pct    = g.capacity ? Math.min(100, Math.round(g.studentCount/g.capacity*100)) : 0
  const hasSel = p.selected.size > 0
  const [bulkTgt, setBulkTgt] = useState<string>('')
  const hs = p.allGroups.filter(x=>x.type==='HOUSE')
  const cs = p.allGroups.filter(x=>x.type==='CLUB')

  const memberCount = memberIds.size

  return (
    <div className="acc">
      {p.showAI&&(
        <div className="ai-bar">
          <span style={{fontSize:14,color:'var(--purple)'}}>AI</span>
          <div className="ai-txt"><strong>AI suggestion -</strong> Unassigned students detected. Click Apply to auto-balance across all houses.</div>
          <button className="ai-ap" onClick={p.onAIApply}><Ico.Check/> Apply</button>
          <button className="ai-x" onClick={p.onAIDismiss}><Ico.X/></button>
        </div>
      )}
      {!isClub&&hasSel&&(
        <div className="inline-bulk show">
          <span className="ib-chip">{p.selected.size} selected</span>
          <span style={{fontSize:12,color:'var(--mid)'}}>-&gt; Move to:</span>
          <select className="ib-sel" value={bulkTgt} onChange={e=>setBulkTgt(e.target.value)}>
            <option value="">Choose group...</option>
            {hs.map(h=><option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
          </select>
          <button className="ib-apply" disabled={!bulkTgt||p.bulkSaving}
            onClick={()=>bulkTgt&&p.onBulkAssign(Number(bulkTgt))}>
            {p.bulkSaving?<Ico.Spin/>:<><Ico.Check/> Apply</>}
          </button>
          <button className="ib-clear" onClick={p.onClearSel}><Ico.X/> Clear</button>
        </div>
      )}
      <div className="acc-hd" onClick={p.onToggle}>
        <div className="acc-color-bar" style={{background:g.color}}/>
        <div className="acc-emblem" style={{background:g.bgColor}}>{g.emoji}</div>
        <div className="acc-info">
          <div className="acc-name">{g.name}</div>
          <div className="acc-meta">
            {isClub ? (
              <span className="acc-pending">
                <span style={{fontWeight:600,color:g.color}}>{memberCount}</span> members
                <span style={{color:'var(--hint)',marginLeft:6}}>· capacity {g.capacity}</span>
              </span>
            ) : (
              <>
                <div className="acc-pct-bar"><div className="acc-pct-fill" style={{width:`${pct}%`,background:g.color}}/></div>
                <span className="acc-pct-txt" style={{color:pct>=90?'var(--teal)':pct>=60?'var(--orange)':'var(--red)'}}>{pct}%</span>
                <span className="acc-pending">{g.studentCount} students</span>
              </>
            )}
          </div>
        </div>
        <div className="acc-right">
          {isClub ? (
            <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end',maxWidth:200}}>
              {memberCount===0
                ? <span className="acc-chip" style={{color:'var(--hint)',fontStyle:'italic'}}>No members yet</span>
                : <span className="acc-chip" style={{background:g.bgColor,color:g.color}}>{memberCount} / {g.capacity} members</span>}
            </div>
          ) : (
            <div className="acc-chips">
              {['Nursery','Grade 5','Grade 10'].map(c=><span key={c} className="acc-chip">{c}</span>)}
              <span className="acc-chip">+10</span>
            </div>
          )}
          <div className={`acc-chevron${p.isOpen?' open':''}`}><Ico.ChevD/></div>
        </div>
      </div>

      {p.isOpen&&(
        <div className="acc-body open">
          {isClub && (
            <div style={{padding:'10px 16px',background:'#f8f9fc',borderBottom:'1px solid #eee',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,flex:1}}>
                {memberCount === 0
                  ? <span style={{fontSize:12,color:'var(--hint)',fontStyle:'italic'}}>No members yet — click Manage to add students</span>
                  : students.filter(s=>(s.clubIds||[]).includes(g.id)).slice(0,12).map(s=>(
                    <span key={s.id} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 8px 3px 4px',borderRadius:12,background:g.bgColor,color:g.color,border:`1px solid ${g.color}30`}}>
                      <span style={{width:18,height:18,borderRadius:'50%',background:g.color,color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,flexShrink:0}}>{initials(s.name)}</span>
                      {s.name.split(' ')[0]}
                      <button onClick={()=>p.onAssignOne(s.id,g.id)} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',color:'inherit',opacity:0.7}} title="Remove">
                        <Ico.X/>
                      </button>
                    </span>
                  ))}
                {memberCount > 12 && <span style={{fontSize:11,color:'var(--mid)',padding:'3px 8px',borderRadius:12,background:'#eee'}}>+{memberCount-12} more</span>}
              </div>
              <button
                onClick={()=>p.onOpenClubModal(g)}
                style={{flexShrink:0,fontSize:12,fontWeight:700,padding:'6px 14px',borderRadius:8,border:`1.5px solid ${g.color}`,background:g.bgColor,color:g.color,cursor:'pointer',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap'}}>
                <Ico.Plus s={12}/> Manage Members
              </button>
            </div>
          )}
          {CLASSES.map((cls,ci)=>{
            const ss    = displayStudents.filter(s=>s.class===cls)
            const crKey = `${g.id}-${cls}`
            const crOpen= p.openCRs.has(crKey)
            const empty = ss.length===0
            const secs  = [...new Set(ss.map(s=>s.section))].sort()
            const clsMembers = isClub ? ss.filter(s=>memberIds.has(s.id)).length : ss.length
            return (
              <div key={cls} className="class-row">
                <div className="class-row-hd"
                  style={empty?{cursor:'default',opacity:.55}:{} as React.CSSProperties}
                  onClick={()=>!empty&&p.onToggleCR(crKey)}>
                  <span className="cr-num">{String(ci+1).padStart(2,'0')}</span>
                  <span className="cr-name">{cls}</span>
                  <div className="cr-badges">
                    {isClub ? (
                      <>
                        <span className="cr-badge students">{ss.length} student{ss.length!==1?'s':''}</span>
                        {clsMembers > 0 && <span className="cr-badge" style={{background:g.bgColor,color:g.color,border:`1px solid ${g.color}40`}}>{clsMembers} in club</span>}
                      </>
                    ) : (
                      <>
                        <span className="cr-badge students">{ss.length} student{ss.length!==1?'s':''}</span>
                        {secs.map(s=><span key={s} className="cr-badge secs">Sec {s}</span>)}
                      </>
                    )}
                  </div>
                  <div className="cr-prog">
                    {!empty&&!isClub&&<div className="cr-bar"><div className="cr-fill" style={{width:'100%',background:g.color}}/></div>}
                    {!empty&&isClub&&clsMembers>0&&<div className="cr-bar"><div className="cr-fill" style={{width:`${Math.round(clsMembers/ss.length*100)}%`,background:g.color}}/></div>}
                  </div>
                  {empty
                    ?<span style={{fontSize:10,color:'var(--hint)',marginLeft:'auto',paddingRight:4,fontStyle:'italic'}}>No students</span>
                    :<span className={`cr-chevron${crOpen?' open':''}`}><Ico.ChevR/></span>}
                </div>
                {!empty&&crOpen&&(
                  <div className="cr-students open">
                    {isClub ? (
                      <div style={{padding:'8px 12px',display:'flex',flexWrap:'wrap',gap:6}}>
                        {ss.filter(s=>memberIds.has(s.id)).length === 0
                          ? <span style={{fontSize:12,color:'var(--hint)',fontStyle:'italic',padding:'4px 0'}}>No members in this class — use Manage Members to add</span>
                          : ss.filter(s=>memberIds.has(s.id)).map(s=>(
                            <span key={s.id} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 8px 3px 4px',borderRadius:12,background:g.bgColor,color:g.color,border:`1px solid ${g.color}30`}}>
                              <span style={{width:18,height:18,borderRadius:'50%',background:g.color,color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,flexShrink:0}}>{initials(s.name)}</span>
                              {s.name}
                              <span style={{fontSize:10,color:'var(--light)'}}>· Sec {s.section}</span>
                              <button onClick={()=>p.onAssignOne(s.id,g.id)} disabled={p.savingSid===s.id} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',color:'inherit',opacity:0.7}} title="Remove from club">
                                {p.savingSid===s.id?<Ico.Spin/>:<Ico.X/>}
                              </button>
                            </span>
                          ))}
                      </div>
                    ) : (
                      <table className="stbl">
                        <thead><tr>
                          <th style={{width:32}}>
                            <input type="checkbox" style={{accentColor:'var(--teal)',cursor:'pointer'}}
                              checked={ss.every(s=>p.selected.has(s.id))}
                              onChange={e=>p.onToggleCls(cls,e.target.checked)}/>
                          </th>
                          <th>Student</th><th>Adm No.</th><th>Sec</th><th>Assign Group</th><th>AI Hint</th>
                        </tr></thead>
                        <tbody>
                          {ss.map(s=>(
                            <tr key={s.id} className={p.selected.has(s.id)?'sel':''}>
                              <td><input type="checkbox" style={{accentColor:'var(--teal)',cursor:'pointer'}}
                                checked={p.selected.has(s.id)}
                                onChange={e=>p.onToggleRow(s.id,e.target.checked)}/></td>
                              <td>
                                <div className="s-cell">
                                  <div className="sav" style={{background:avatarColor(s.id)}}>{initials(s.name)}</div>
                                  <div><div className="s-name">{s.name}</div><div className="s-id">{s.admissionNo}</div></div>
                                </div>
                              </td>
                              <td style={{fontSize:11,color:'var(--light)',fontFamily:'var(--font2)'}}>{s.admissionNo}</td>
                              <td><span className="cls-tag">Sec {s.section}</span></td>
                              <td>
                                <div style={{display:'flex',alignItems:'center',gap:5}}>
                                  <select className={`grp-sel${s.currentGroupId?' hv':''}`}
                                    value={s.currentGroupId??''}
                                    disabled={p.savingSid===s.id}
                                    onChange={e=>p.onAssignOne(s.id,e.target.value?Number(e.target.value):null)}>
                                    <option value="">- Unassigned</option>
                                    {p.allGroups.filter(x=>x.type==='HOUSE').map(h=><option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
                                  </select>
                                  {p.savingSid===s.id&&<Ico.Spin/>}
                                </div>
                              </td>
                              <td>{s.aiHint
                                ?<span className="ai-hint"><span className="ai-p"/>{s.aiHint}</span>
                                :<span style={{fontSize:10,color:'var(--hint)'}}>-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function ClubMembersModal({club,allStudents,onAssignOne,onBulkAdd,savingSid,onClose}:{
  club:Group; allStudents:Student[]
  onAssignOne(sid:number,gid:number):void
  onBulkAdd(sids:number[],gid:number):void
  savingSid:number|null; onClose():void
}) {
  const [search,    setSearch]    = useState('')
  const [clsFilter, setClsFilter] = useState<string>('ALL')
  const [pending,   setPending]   = useState<Set<number>>(new Set())
  const [adding,    setAdding]    = useState(false)

  const memberIds  = new Set(allStudents.filter(s=>(s.clubIds||[]).includes(club.id)).map(s=>s.id))
  const members    = allStudents.filter(s=>memberIds.has(s.id))
  const nonMembers = allStudents.filter(s=>!memberIds.has(s.id))

  const classes = [...new Set(allStudents.map(s=>s.class))].sort((a,b)=>{
    const ai=allStudents.find(x=>x.class===a)?.classIndex??99
    const bi=allStudents.find(x=>x.class===b)?.classIndex??99
    return ai-bi
  })

  const filtered = nonMembers.filter(s=>{
    const matchCls = clsFilter==='ALL' || s.class===clsFilter
    const q = search.toLowerCase()
    const matchQ  = !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)
    return matchCls && matchQ
  })

  const byClass: Record<string,Student[]> = {}
  filtered.forEach(s=>{ if(!byClass[s.class]) byClass[s.class]=[]; byClass[s.class].push(s) })

  function togglePending(sid:number) {
    setPending(p=>{ const n=new Set(p); n.has(sid)?n.delete(sid):n.add(sid); return n })
  }
  function selectClassAll(cls:string, checked:boolean) {
    const ids=(byClass[cls]||[]).map(s=>s.id)
    setPending(p=>{ const n=new Set(p); ids.forEach(id=>checked?n.add(id):n.delete(id)); return n })
  }

  async function handleBulkAdd() {
    const ids = Array.from(pending)
    if (!ids.length) return
    setAdding(true)
    onBulkAdd(ids, club.id)
    setPending(new Set())
    setAdding(false)
  }

  const clsTabStyle = (c:string):React.CSSProperties => ({
    padding:'4px 10px',borderRadius:12,fontSize:11,fontWeight:600,border:'none',cursor:'pointer',
    background: clsFilter===c ? club.color : '#eee',
    color: clsFilter===c ? '#fff' : 'var(--mid)',
    flexShrink:0,
  })

  return (
    <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'stretch',justifyContent:'flex-end'}}>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)'}}/>

      {/* Drawer panel */}
      <div style={{position:'relative',width:'min(680px,100vw)',background:'#fff',display:'flex',flexDirection:'column',boxShadow:'-4px 0 32px rgba(0,0,0,0.15)',zIndex:1}}>

        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid #eee',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:club.bgColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{club.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15,color:'var(--dark)'}}>{club.name}</div>
            <div style={{fontSize:12,color:'var(--mid)'}}>{members.length} / {club.capacity} members · Use search or class tabs to find students</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--mid)',borderRadius:6,display:'flex'}}><Ico.X/></button>
        </div>

        {/* Current members strip */}
        {members.length>0&&(
          <div style={{padding:'10px 20px',borderBottom:'1px solid #eee',background:'#fafbfe',flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--mid)',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Current Members ({members.length})</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {members.map(s=>(
                <span key={s.id} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 7px 3px 4px',borderRadius:11,background:club.bgColor,color:club.color,border:`1px solid ${club.color}30`}}>
                  <span style={{width:16,height:16,borderRadius:'50%',background:club.color,color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,flexShrink:0}}>{initials(s.name)}</span>
                  {s.name.split(' ')[0]} <span style={{opacity:.7,fontSize:10}}>· {s.class} {s.section}</span>
                  <button onClick={()=>onAssignOne(s.id,club.id)} disabled={savingSid===s.id} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',color:'inherit',opacity:.7}} title="Remove">
                    {savingSid===s.id?<Ico.Spin/>:<Ico.X/>}
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search + class filter */}
        <div style={{padding:'10px 20px',borderBottom:'1px solid #eee',flexShrink:0,display:'flex',flexDirection:'column',gap:8}}>
          <input
            type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name or admission no…"
            style={{width:'100%',padding:'7px 12px',borderRadius:8,border:'1.5px solid #dde',fontSize:13,outline:'none',boxSizing:'border-box'}}
          />
          <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2}}>
            <button style={clsTabStyle('ALL')} onClick={()=>setClsFilter('ALL')}>All Classes</button>
            {classes.map(c=>(
              <button key={c} style={clsTabStyle(c)} onClick={()=>setClsFilter(c)}>
                {c} <span style={{opacity:.75}}>({(byClass[c]||[]).length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Student list (non-members) */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {filtered.length===0&&(
            <div style={{textAlign:'center',padding:'40px 20px',color:'var(--hint)',fontSize:13}}>
              {search||clsFilter!=='ALL'?'No students match your filter.':'All students are already members!'}
            </div>
          )}
          {Object.entries(byClass).map(([cls,ss])=>(
            <div key={cls}>
              {/* Class group header */}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 20px',background:'#f5f6fa',borderTop:'1px solid #eee',borderBottom:'1px solid #eee',position:'sticky',top:0,zIndex:1}}>
                <input type="checkbox"
                  style={{accentColor:club.color,cursor:'pointer',width:14,height:14}}
                  checked={ss.every(s=>pending.has(s.id))}
                  onChange={e=>selectClassAll(cls,e.target.checked)}/>
                <span style={{fontWeight:700,fontSize:12,color:'var(--dark)'}}>{cls}</span>
                <span style={{fontSize:11,color:'var(--mid)'}}>— {ss.length} student{ss.length!==1?'s':''}</span>
                <span style={{fontSize:11,color:club.color,marginLeft:'auto'}}>
                  {ss.filter(s=>pending.has(s.id)).length>0&&`${ss.filter(s=>pending.has(s.id)).length} selected`}
                </span>
              </div>
              {/* Student rows */}
              {ss.map(s=>(
                <label key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 20px',cursor:'pointer',borderBottom:'1px solid #f3f3f3',background:pending.has(s.id)?`${club.bgColor}70`:'transparent'}}>
                  <input type="checkbox"
                    style={{accentColor:club.color,cursor:'pointer',width:14,height:14,flexShrink:0}}
                    checked={pending.has(s.id)}
                    onChange={()=>togglePending(s.id)}/>
                  <div style={{width:28,height:28,borderRadius:'50%',background:pending.has(s.id)?club.color:avatarColor(s.id),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{initials(s.name)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:'var(--dark)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                    <div style={{fontSize:11,color:'var(--light)'}}>{s.admissionNo} · {s.class} Sec {s.section}</div>
                  </div>
                  {(s.clubIds||[]).length>0&&(
                    <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'flex-end',maxWidth:120}}>
                      {(s.clubIds||[]).slice(0,2).map(cid=>{
                        const oc=allStudents.find(x=>x.id===s.id) // dummy; ideally we'd pass groups
                        void oc; return null
                      })}
                      <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'#eee',color:'var(--mid)'}}>+{(s.clubIds||[]).length} club{(s.clubIds||[]).length!==1?'s':''}</span>
                    </div>
                  )}
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div style={{padding:'12px 20px',borderTop:'1px solid #eee',background:'#fff',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          {pending.size>0&&(
            <>
              <span style={{fontSize:13,fontWeight:600,color:'var(--dark)',flex:1}}>{pending.size} student{pending.size!==1?'s':''} selected</span>
              <button onClick={()=>setPending(new Set())} style={{fontSize:12,padding:'6px 12px',borderRadius:6,border:'1px solid #dde',background:'#fff',cursor:'pointer',color:'var(--mid)'}}>Clear</button>
              <button onClick={()=>{ void handleBulkAdd() }} disabled={adding}
                style={{fontSize:13,fontWeight:700,padding:'8px 20px',borderRadius:8,border:'none',background:club.color,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                {adding?<><Ico.Spin/> Adding…</>:<><Ico.Plus s={13}/> Add {pending.size} to {club.name}</>}
              </button>
            </>
          )}
          {pending.size===0&&(
            <span style={{fontSize:12,color:'var(--hint)',flex:1}}>Select students above to add them to this club, or use the ✕ buttons to remove existing members.</span>
          )}
          <button onClick={onClose} style={{fontSize:12,padding:'6px 14px',borderRadius:6,border:'1px solid #dde',background:'#fff',cursor:'pointer',color:'var(--mid)',marginLeft:'auto'}}>Done</button>
        </div>
      </div>
    </div>
  )
}

function SWModal({method,setMethod,scope,setScope,preview,loading,onApply,onClose}:{
  method:string;setMethod:(m:'random'|'alpha'|'classwise'|'gender')=>void;scope:string;setScope:(s:'unassigned'|'all')=>void;
  preview:PreviewItem[];loading:boolean;onApply():void;onClose():void;
}) {
  const total = preview.reduce((a,p)=>a+p.count,0)
  const base  = preview.length?Math.floor(total/preview.length):0
  const rem   = preview.length?total%preview.length:0
  const desc:Record<string,string>={
    random:   'Students randomly shuffled before distribution.',
    alpha:    'Students sorted A-Z by name, then distributed in order.',
    classwise:'Each class distributed round-robin - equal class representation per house.',
    gender:   'Students interleaved by gender for even distribution across all houses.',
  }
  return (
    <div className="modal-bd open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="mhd">
          <div><div className="mt">Sortwell - Divide School into Houses</div><div className="ms">Distribute all enrolled students equally across the houses in one click</div></div>
          <button className="mx" onClick={onClose}><Ico.X/></button>
        </div>
        <div className="mbody">
          <div className="fg">
            <label className="fl">Distribution method</label>
            <div className="divide-method-pills">
              {[['random','Random shuffle'],['alpha','Alphabetical'],['classwise','Class-wise rotation'],['gender','Gender-balanced']].map(([v,l])=>(
                <div key={v} className={`dmp${method===v?' on':''}`} onClick={()=>setMethod(v as 'random'|'alpha'|'classwise'|'gender')}>{l}</div>
              ))}
            </div>
          </div>
          <div className="fg">
            <label className="fl">Scope</label>
            <div className="divide-method-pills">
              <div className={`dmp${scope==='unassigned'?' on':''}`} onClick={()=>setScope('unassigned')}>Unassigned only</div>
              <div className={`dmp${scope==='all'?' on':''}`} onClick={()=>setScope('all')}>Reassign entire school</div>
            </div>
          </div>
          {scope==='all'&&<div className="divide-warn show">Warning: <strong>Reassign entire school</strong> will clear all existing house assignments and redistribute everyone from scratch.</div>}
          {preview.length>0&&(
            <div className="divide-preview">
              {preview.map(p=>(
                <div key={p.groupId} className="dp-card" style={{borderColor:`${p.color}30`,background:`${p.bgColor}18`}}>
                  <div className="dp-emblem" style={{background:p.bgColor}}>{p.emoji}</div>
                  <div>
                    <div className="dp-name">{p.groupName}</div>
                    <div style={{display:'flex',alignItems:'baseline',gap:4,marginTop:2}}>
                      <span className="dp-count" style={{color:p.color}}>{p.count}</span>
                      <span className="dp-lbl">students</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {preview.length>0&&(
            <div className="divide-info">
              <strong>{total} student{total!==1?'s':''}</strong> &rarr; <strong>{preview.length} houses</strong>.
              Each house gets <strong>~{base}</strong> students{rem>0?` (${rem} house${rem>1?'s':''} get +1)`:' (perfectly even)'}.
              <br/><em style={{color:'var(--light)'}}>{desc[method]}</em>
            </div>
          )}
        </div>
        <div className="mfoot">
          <button className="mbc" onClick={onClose}>Cancel</button>
          <button className="mbs" onClick={onApply} disabled={loading}>
            {loading?<><Ico.Spin/> Working...</>:`Sortwell - Divide ${total} Students`}
          </button>
        </div>
      </div>
    </div>
  )
}

function AGModal({editTarget,onSave,onClose}:{editTarget:Group|null;onSave(d:{name:string;type:string;emoji:string;description:string;capacity:number}):void;onClose():void}) {
  const initial = {
    type: editTarget?.type || 'HOUSE' as GroupType,
    name: editTarget?.name || '',
    desc: editTarget?.description || '',
    cap: String(editTarget?.capacity || 40),
  }
  const [name, setName]   = useState(editTarget?.name||'')
  const [type, setType]   = useState<GroupType>(editTarget?.type||'HOUSE')
  const [emoji,setEmoji]  = useState(editTarget?.emoji||suggestEmojiFromName(editTarget?.name||'', editTarget?.type||'HOUSE'))
  const [desc, setDesc]   = useState(editTarget?.description||'')
  const [cap,  setCap]    = useState(String(editTarget?.capacity||40))
  const [emojiTouched, setEmojiTouched] = useState(Boolean(editTarget))
  const canGenerate = name.trim().length > 0
  useEffect(() => {
    if (emojiTouched) return
    const unchangedEditName = Boolean(editTarget && name.trim() === (editTarget?.name || '').trim())
    if (unchangedEditName) return
    setEmoji(suggestEmojiFromName(name, type))
  }, [name, type, emojiTouched, editTarget])

  const hasEnteredData = () => {
    return (
      name.trim() !== initial.name.trim() ||
      desc.trim() !== initial.desc.trim() ||
      cap.trim() !== initial.cap.trim() ||
      emojiTouched
    )
  }

  const changeType = (nextType: GroupType) => {
    if (nextType === type) return
    if (hasEnteredData()) {
      const ok = window.confirm('You have entered data for this type. Changing group type may require updating emoji/description. Do you want to continue?')
      if (!ok) return
    }
    setType(nextType)
  }

  return (
    <div className="modal-bd open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="mhd">
          <div><div className="mt">{editTarget?'Edit Group':'Add Student Group'}</div><div className="ms">Fill details to {editTarget?'update the':'create a new'} group</div></div>
          <button className="mx" onClick={onClose}><Ico.X/></button>
        </div>
        <div className="mbody">
          <div className="fg"><label className="fl">Group Name *</label><input className="fi" placeholder="e.g. Tagore House, Science Club..." value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="fg">
            <label className="fl">Group Type</label>
            <div className="tps">
              {(['HOUSE','CLUB','CUSTOM'] as GroupType[]).map(t=>(
                <div key={t} className={`tp${type===t?' on':''}`} onClick={()=>changeType(t)}>
                  {t==='HOUSE'?'HOUSE':t==='CLUB'?'CLUB':'CUSTOM'}
                </div>
              ))}
            </div>
          </div>
          <div className="fg">
            <div className="fl-row">
              <label className="fl">Description</label>
              <button className="ai-gen" type="button" disabled={!canGenerate} onClick={()=>setDesc(generateDescriptionFromName(name, type))}>AI Help</button>
            </div>
            <textarea className="fi" placeholder="First line: slogan&#10;Next lines: purpose, activities, mentor or focus..." value={desc} onChange={e=>setDesc(e.target.value)}/>
            <div className="fi-help">Use the first line as the slogan. The AI Help button drafts both lines from the group name.</div>
          </div>
          <div className="two">
            <div className="fg" style={{margin:0}}>
              <label className="fl">Emoji</label>
              <input className="fi" placeholder="📌" maxLength={4} value={emoji} onChange={e=>{setEmojiTouched(true);setEmoji(e.target.value)}}/>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                {GROUP_EMOJI_SUGGESTIONS.map((em) => (
                  <button key={em} type="button" className="tp" onClick={()=>{setEmojiTouched(true);setEmoji(em)}} style={emoji===em?{background:'var(--teal-l)',color:'var(--teal)',borderColor:'var(--teal)'}:{}}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div className="fg" style={{margin:0}}><label className="fl">Capacity</label><input className="fi" type="number" placeholder="40" value={cap} onChange={e=>setCap(e.target.value)}/></div>
          </div>
        </div>
        <div className="mfoot">
          <button className="mbc" onClick={onClose}>Cancel</button>
          <button className="mbs" onClick={()=>onSave({name,type,emoji:emoji||'📌',description:desc,capacity:Number(cap)||40})}>
            <Ico.Check/> {editTarget?'Save Changes':'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ACModal({onSave,onClose}:{onSave(d:{name:string;emoji:string;description:string;capacity:number}):void;onClose():void}) {
  const [name, setName]   = useState('')
  const [emoji,setEmoji]  = useState('🎭')
  const [desc, setDesc]   = useState('')
  const [cap,  setCap]    = useState('30')
  const [emojiTouched, setEmojiTouched] = useState(false)
  const canGenerate = name.trim().length > 0
  useEffect(() => {
    if (emojiTouched) return
    setEmoji(suggestEmojiFromName(name, 'CLUB'))
  }, [name, emojiTouched])
  return (
    <div className="modal-bd open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="mhd">
          <div><div className="mt">Add New Club</div><div className="ms">Create a new school club and start adding members</div></div>
          <button className="mx" onClick={onClose}><Ico.X/></button>
        </div>
        <div className="mbody">
          <div className="fg"><label className="fl">Club Name *</label><input className="fi" placeholder="e.g. Chess Club, Drama Club..." value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="fg">
            <div className="fl-row">
              <label className="fl">Description</label>
              <button className="ai-gen" type="button" disabled={!canGenerate} onClick={()=>setDesc(generateDescriptionFromName(name, 'CLUB'))}>AI Help</button>
            </div>
            <textarea className="fi" placeholder="First line: slogan&#10;Next lines: club purpose, activities, events or mentor..." value={desc} onChange={e=>setDesc(e.target.value)}/>
            <div className="fi-help">Use the first line as the slogan. The AI Help button drafts both lines from the club name.</div>
          </div>
          <div className="two">
            <div className="fg" style={{margin:0}}>
              <label className="fl">Emoji</label>
              <input className="fi" placeholder="🎭" maxLength={4} value={emoji} onChange={e=>{setEmojiTouched(true);setEmoji(e.target.value)}}/>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                {CLUB_EMOJI_SUGGESTIONS.map((em) => (
                  <button key={em} type="button" className="tp" onClick={()=>{setEmojiTouched(true);setEmoji(em)}} style={emoji===em?{background:'var(--teal-l)',color:'var(--teal)',borderColor:'var(--teal)'}:{}}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div className="fg" style={{margin:0}}><label className="fl">Max Capacity</label><input className="fi" type="number" placeholder="30" value={cap} onChange={e=>setCap(e.target.value)}/></div>
          </div>
        </div>
        <div className="mfoot">
          <button className="mbc" onClick={onClose}>Cancel</button>
          <button className="mbs" onClick={()=>onSave({name,emoji:emoji||'🎭',description:desc,capacity:Number(cap)||30})}>
            <Ico.Plus/> Create Club
          </button>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  const p = {background:'linear-gradient(90deg,#e2e6f0 25%,#f0f2f8 50%,#e2e6f0 75%)',backgroundSize:'200% 100%',animation:'sgShimmer 1.4s infinite'}
  return (
    <>
      <style>{`@keyframes sgShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div className="stats">{[...Array(5)].map((_,i)=><div key={i} className="sc"><div style={{...p,width:'100%',height:40,borderRadius:8}}/></div>)}</div>
      <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'var(--rl)',height:46,marginBottom:16}}/>
      <div className="houses-grid">{[...Array(4)].map((_,i)=><div key={i} style={{...p,height:190,borderRadius:'var(--rl)'}}/>)}</div>
    </>
  )
}
