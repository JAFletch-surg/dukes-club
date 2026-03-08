'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  MessageSquare, Send, Search, Hash, Users, Plus, ArrowLeft,
  Loader2, Check, CheckCheck, Smile, X, Settings, UserPlus,
  ChevronDown, Circle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/use-auth'

// ─── Types ───────────────────────────────────────────

interface Conversation {
  id: string
  type: 'dm' | 'channel'
  name: string | null
  description: string | null
  slug: string | null
  icon: string | null
  last_message_at: string | null
  created_at: string
}

interface ConversationWithMeta extends Conversation {
  other_user?: { id: string; full_name: string; avatar_url: string | null } | null
  last_message?: { content: string; sender_name: string } | null
  unread_count: number
  participant_count: number
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_deleted: boolean
  created_at: string
  sender?: { full_name: string; avatar_url: string | null }
}

interface MemberProfile {
  id: string
  full_name: string
  avatar_url: string | null
  training_stage: string | null
  hospital: string | null
}

// ─── Helpers ─────────────────────────────────────────

const supabase = createClient()

const getInitials = (name: string) => {
  const cleaned = name.replace(/^(Dr|Mr|Mrs|Ms|Prof|Miss)\s+/i, '')
  return cleaned.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

const formatTime = (date: string) => {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (hours < 48) return 'Yesterday'
  if (hours < 168) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const formatMessageTime = (date: string) => {
  return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const formatDateDivider = (date: string) => {
  const d = new Date(date)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const isSameDay = (a: string, b: string) => {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// ─── New Channel Dialog ──────────────────────────────

function NewChannelDialog({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (name: string, description: string) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate(name.trim(), desc.trim())
    setName('')
    setDesc('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hash size={18} /> Create Channel</DialogTitle>
          <DialogDescription>Create a group channel for topic-based discussion.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Channel Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. fellowship-advice" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this channel about?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim()} className="bg-navy text-navy-foreground hover:bg-navy/90">Create Channel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── New DM Dialog ───────────────────────────────────

function NewDMDialog({ open, onClose, onSelect, currentUserId }: {
  open: boolean; onClose: () => void; onSelect: (userId: string) => void; currentUserId: string
}) {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, training_stage, hospital')
      .eq('approval_status', 'approved')
      .neq('id', currentUserId)
      .order('full_name')
      .then(({ data }: { data: any }) => {
        setMembers(data || [])
        setLoading(false)
      })
  }, [open, currentUserId])

  const filtered = members.filter(m =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    (m.hospital || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus size={18} /> New Message</DialogTitle>
          <DialogDescription>Start a conversation with a fellow trainee.</DialogDescription>
        </DialogHeader>
        <div className="relative mt-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-9 h-9" />
        </div>
        <div className="flex-1 overflow-y-auto mt-2 -mx-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members found</p>
          ) : (
            filtered.map(m => (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 rounded-lg transition-colors text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-navy text-navy-foreground text-[11px] font-semibold">{getInitials(m.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[m.training_stage, m.hospital].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═════════════════════════════════════════════════════
// MAIN MESSAGES PAGE
// ═════════════════════════════════════════════════════

export default function MessagesPage() {
  const { user, profile, isAdmin } = useAuth()

  // State
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [convSearch, setConvSearch] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load conversations ─────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!user) return

    // Get all conversations the user is part of
    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (!participations?.length) { setLoading(false); return }

    const convIds = participations.map((p: any) => p.conversation_id)

    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (!convs) { setLoading(false); return }

    // Get participant info for DMs
    const enriched: ConversationWithMeta[] = await Promise.all(
      convs.map(async (conv: any) => {
        let other_user = null
        let participant_count = 0

        // Get participants
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('user_id, profile:profiles(full_name, avatar_url)')
          .eq('conversation_id', conv.id)

        participant_count = parts?.length || 0

        if (conv.type === 'dm' && parts) {
          const other = parts.find((p: any) => p.user_id !== user.id)
          if (other?.profile) {
            other_user = { id: other.user_id, ...(other.profile as any) }
          }
        }

        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, sender_id, profile:profiles!messages_sender_id_profiles_fkey(full_name)')
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const last_message = lastMsg ? {
          content: lastMsg.content,
          sender_name: (lastMsg.profile as any)?.full_name || 'Unknown',
        } : null

        // Get unread count
        const { data: readData } = await supabase
          .from('message_reads')
          .select('last_read_at')
          .eq('conversation_id', conv.id)
          .eq('user_id', user.id)
          .single()

        const lastReadAt = readData?.last_read_at || '1970-01-01'

        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt)

        return {
          ...conv,
          other_user,
          last_message,
          unread_count: count || 0,
          participant_count,
        }
      })
    )

    setConversations(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Handle ?conv= deep link from directory
  const searchParams = useSearchParams()
  useEffect(() => {
    const convParam = searchParams.get('conv')
    if (convParam && !loading && conversations.length > 0) {
      const exists = conversations.find(c => c.id === convParam)
      if (exists) {
        selectConversation(convParam)
      } else {
        // Conversation exists but user isn't in the list yet — reload and try again
        loadConversations().then(() => selectConversation(convParam))
      }
    }
  }, [searchParams, loading, conversations.length])

  // ── Load messages for active conversation ──────────

  const loadMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_profiles_fkey(full_name, avatar_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)

    setMessages(data || [])
    setMessagesLoading(false)

    // Mark as read
    if (user) {
      const lastMsg = data?.[data.length - 1]
      if (lastMsg) {
        await supabase.from('message_reads').upsert({
          conversation_id: convId,
          user_id: user.id,
          last_read_message_id: lastMsg.id,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,user_id' })
      }
    }

    // Scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [user])

  // ── Select conversation ────────────────────────────

  const selectConversation = useCallback((convId: string) => {
    setActiveConvId(convId)
    setShowMobileSidebar(false)
    loadMessages(convId)
    inputRef.current?.focus()

    // Update unread in local state
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, unread_count: 0 } : c
    ))
  }, [loadMessages])

  // ── Realtime subscription ──────────────────────────

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload: any) => {
        const newMsg = payload.new as any

        // If it's in the active conversation, add to messages
        if (newMsg.conversation_id === activeConvId) {
          // Fetch sender profile
          supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single()
            .then(({ data: senderProfile }: { data: any }) => {
              setMessages(prev => [...prev, { ...newMsg, sender: senderProfile }])
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

              // Mark as read if we're viewing this conversation
              if (newMsg.sender_id !== user.id) {
                supabase.from('message_reads').upsert({
                  conversation_id: newMsg.conversation_id,
                  user_id: user.id,
                  last_read_message_id: newMsg.id,
                  last_read_at: new Date().toISOString(),
                }, { onConflict: 'conversation_id,user_id' })
              }
            })
        } else {
          // Increment unread for another conversation
          setConversations(prev => prev.map(c =>
            c.id === newMsg.conversation_id
              ? { ...c, unread_count: c.unread_count + 1, last_message_at: newMsg.created_at }
              : c
          ))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, activeConvId])

  // ── Send message ───────────────────────────────────

  const handleSend = async () => {
    if (!user || !activeConvId || !newMessage.trim() || sending) return
    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')

    await supabase.from('messages').insert({
      conversation_id: activeConvId,
      sender_id: user.id,
      content,
    })

    // Update conversation last_message_at
    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', activeConvId)

    setSending(false)
    inputRef.current?.focus()
  }

  // ── Create channel ─────────────────────────────────

  const handleCreateChannel = async (name: string, description: string) => {
    if (!user) return
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const { data: conv } = await supabase.from('conversations').insert({
      type: 'channel',
      name,
      description: description || null,
      slug,
      created_by: user.id,
    }).select().single()

    if (conv) {
      await supabase.from('conversation_participants').insert({
        conversation_id: conv.id,
        user_id: user.id,
        role: 'owner',
      })
      await loadConversations()
      selectConversation(conv.id)
    }
  }

  // ── Start DM ───────────────────────────────────────

  const handleStartDM = async (otherUserId: string) => {
    if (!user) return

    const { data } = await supabase.rpc('find_or_create_dm', {
      user_a: user.id,
      user_b: otherUserId,
    })

    if (data) {
      await loadConversations()
      selectConversation(data)
    }
  }

  // ── Join channel ───────────────────────────────────

  const handleJoinChannel = async (convId: string) => {
    if (!user) return
    await supabase.from('conversation_participants').insert({
      conversation_id: convId,
      user_id: user.id,
    })
    await loadConversations()
    selectConversation(convId)
  }

  // ── Filter conversations ───────────────────────────

  const filteredConvs = useMemo(() => {
    if (!convSearch) return conversations
    const s = convSearch.toLowerCase()
    return conversations.filter(c => {
      if (c.type === 'channel') return c.name?.toLowerCase().includes(s)
      return c.other_user?.full_name?.toLowerCase().includes(s)
    })
  }, [conversations, convSearch])

  const channels = filteredConvs.filter(c => c.type === 'channel')
  const dms = filteredConvs.filter(c => c.type === 'dm')
  const activeConv = conversations.find(c => c.id === activeConvId)
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  // ── Loading state ──────────────────────────────────

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="flex h-[calc(100vh-7.5rem)] -m-4 lg:-m-6 bg-background">

      {/* ── SIDEBAR ─────────────────────────────── */}
      <div className={`${showMobileSidebar ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 border-r border-border bg-card shrink-0`}>

        {/* Sidebar header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">Messages</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowNewDM(true)}
                className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="New message"
              >
                <UserPlus size={18} />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowNewChannel(true)}
                  className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Create channel"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {/* Channels */}
          {channels.length > 0 && (
            <div className="pt-3">
              <p className="px-4 text-[10px] font-bold text-muted-foreground tracking-[0.15em] uppercase mb-1">Channels</p>
              {channels.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                    activeConvId === conv.id ? 'bg-navy/5 border-l-2 border-gold' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                    <Hash size={16} className="text-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                        {conv.name}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        <span className="font-medium">{conv.last_message.sender_name.split(' ')[0]}:</span> {conv.last_message.content}
                      </p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-gold text-gold-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* DMs */}
          {dms.length > 0 && (
            <div className="pt-3">
              <p className="px-4 text-[10px] font-bold text-muted-foreground tracking-[0.15em] uppercase mb-1">Direct Messages</p>
              {dms.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                    activeConvId === conv.id ? 'bg-navy/5 border-l-2 border-gold' : 'hover:bg-muted/30'
                  }`}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-navy text-navy-foreground text-[11px] font-semibold">
                      {conv.other_user ? getInitials(conv.other_user.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                        {conv.other_user?.full_name || 'Unknown'}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {conv.last_message.content}
                      </p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-gold text-gold-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {conversations.length === 0 && (
            <div className="text-center py-12 px-4">
              <MessageSquare size={32} className="mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Start a new message or join a channel</p>
              <div className="flex flex-col gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setShowNewDM(true)} className="mx-auto">
                  <UserPlus size={14} className="mr-1.5" /> New Message
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setShowNewChannel(true)} className="mx-auto">
                    <Hash size={14} className="mr-1.5" /> Create Channel
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CHAT AREA ───────────────────────────── */}
      <div className={`${!showMobileSidebar ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-w-0`}>

        {activeConv ? (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileSidebar(true)}
                  className="lg:hidden text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={20} />
                </button>
                {activeConv.type === 'channel' ? (
                  <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                    <Hash size={16} className="text-navy" />
                  </div>
                ) : (
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-navy text-navy-foreground text-[11px] font-semibold">
                      {activeConv.other_user ? getInitials(activeConv.other_user.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {activeConv.type === 'channel' ? activeConv.name : activeConv.other_user?.full_name || 'Unknown'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {activeConv.type === 'channel'
                      ? `${activeConv.participant_count} member${activeConv.participant_count !== 1 ? 's' : ''}`
                      : activeConv.description || 'Direct message'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messagesLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare size={32} className="mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {activeConv.type === 'channel'
                      ? `Welcome to #${activeConv.name}! Start the conversation.`
                      : `Start your conversation with ${activeConv.other_user?.full_name || 'this member'}.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === user.id
                    const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id || !isSameDay(messages[i - 1].created_at, msg.created_at)
                    const showDateDivider = i === 0 || !isSameDay(messages[i - 1].created_at, msg.created_at)

                    return (
                      <div key={msg.id}>
                        {showDateDivider && (
                          <div className="flex items-center gap-3 py-3">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[11px] font-medium text-muted-foreground">{formatDateDivider(msg.created_at)}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}

                        {msg.is_deleted ? (
                          <div className="py-1 px-3 text-xs text-muted-foreground italic">Message deleted</div>
                        ) : (
                          <div className={`flex gap-2.5 ${showAvatar ? 'mt-3' : 'mt-0.5'} ${isMe ? 'flex-row-reverse' : ''}`}>
                            {/* Avatar */}
                            <div className="w-8 shrink-0">
                              {showAvatar && !isMe && (
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-navy text-navy-foreground text-[10px] font-semibold">
                                    {msg.sender ? getInitials(msg.sender.full_name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>

                            {/* Bubble */}
                            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                              {showAvatar && (
                                <div className={`flex items-center gap-2 mb-0.5 ${isMe ? 'justify-end' : ''}`}>
                                  <span className="text-[11px] font-semibold text-foreground">
                                    {isMe ? 'You' : msg.sender?.full_name || 'Unknown'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">{formatMessageTime(msg.created_at)}</span>
                                </div>
                              )}
                              <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? 'bg-navy text-navy-foreground rounded-tr-md'
                                  : 'bg-muted/50 text-foreground rounded-tl-md'
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                    }}
                    placeholder={
                      activeConv.type === 'channel'
                        ? `Message #${activeConv.name}`
                        : `Message ${activeConv.other_user?.full_name || ''}`
                    }
                    className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy pr-12"
                  />
                </div>
                <Button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                  className="bg-navy text-navy-foreground hover:bg-navy/90 rounded-xl h-10 w-10 p-0"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={28} className="text-navy/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Your Messages</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Connect with fellow trainees across the UK. Start a conversation or join a channel.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button size="sm" onClick={() => setShowNewDM(true)} className="bg-navy text-navy-foreground hover:bg-navy/90">
                  <UserPlus size={14} className="mr-1.5" /> New Message
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────── */}
      <NewChannelDialog open={showNewChannel} onClose={() => setShowNewChannel(false)} onCreate={handleCreateChannel} />
      <NewDMDialog open={showNewDM} onClose={() => setShowNewDM(false)} onSelect={handleStartDM} currentUserId={user.id} />
    </div>
  )
}