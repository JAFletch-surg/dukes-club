'use client'

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Home, Video, Play, Mic, BookOpen, FileText, Globe, Users,
  Settings, Search, ShieldCheck, Award, MessageSquare,
} from "lucide-react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { createClient } from "@/lib/supabase/client"

type NavPage = {
  title: string
  path: string
  icon: React.ElementType
  section: string
}

const pages: NavPage[] = [
  { title: "Dashboard", path: "/members", icon: Home, section: "Learn" },
  { title: "Video Archive", path: "/members/videos", icon: Video, section: "Learn" },
  { title: "Live Webinars", path: "/members/webinars", icon: Play, section: "Learn" },
  { title: "Podcasts", path: "/members/podcasts", icon: Mic, section: "Learn" },
  { title: "FRCS Resources", path: "/members/frcs", icon: BookOpen, section: "Exams" },
  { title: "Question Bank", path: "/members/questions", icon: FileText, section: "Exams" },
  { title: "Fellowships", path: "/members/fellowships", icon: Globe, section: "Network" },
  { title: "Member Directory", path: "/members/directory", icon: Users, section: "Network" },
  { title: "Messages", path: "/members/messages", icon: MessageSquare, section: "Network" },
  { title: "My Certificates", path: "/members/certificates", icon: Award, section: "Account" },
  { title: "My Profile", path: "/members/profile", icon: Settings, section: "Account" },
  { title: "CMS / Admin Panel", path: "/admin", icon: ShieldCheck, section: "Admin" },
]

type VideoResult = {
  id: string
  title: string
  slug: string
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [videos, setVideos] = useState<VideoResult[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const router = useRouter()

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Debounced video search
  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setVideos([])
      return
    }

    setLoadingVideos(true)
    const timeout = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("videos")
          .select("id, title, slug")
          .eq("status", "published")
          .ilike("title", `%${trimmed}%`)
          .limit(8)
        setVideos(data || [])
      } catch {
        setVideos([])
      } finally {
        setLoadingVideos(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [query, open])

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false)
      setQuery("")
      router.push(path)
    },
    [router]
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-2 rounded-md border border-input bg-background px-3 h-9 w-64 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        <Search size={16} />
        <span>Search...</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search pages and videos..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loadingVideos ? "Searching..." : "No results found."}
          </CommandEmpty>

          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.path}
                value={page.title}
                onSelect={() => handleSelect(page.path)}
              >
                <page.icon className="mr-2 h-4 w-4" />
                <span>{page.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {page.section}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          {videos.length > 0 && (
            <CommandGroup heading="Videos">
              {videos.map((video) => (
                <CommandItem
                  key={video.id}
                  value={video.title}
                  onSelect={() =>
                    handleSelect(`/members/videos/${video.slug}`)
                  }
                >
                  <Video className="mr-2 h-4 w-4" />
                  <span className="truncate">{video.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
