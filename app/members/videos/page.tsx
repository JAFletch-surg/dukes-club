'use client'
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Play, Search, Eye, Video, X, Clock, ArrowLeft, Loader2,
  MessageSquare, ThumbsUp, Pin, Trash2, Reply, Send, CornerDownRight,
  ChevronDown, ChevronUp, User, SlidersHorizontal, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import VimeoPlayer from "@/components/members/VimeoPlayer";

const defaultCategories = ["All", "Operative", "Complications", "Webinar", "Education", "Lecture"];
const sortOptions = ["Newest", "Most Viewed", "Duration"] as const;
const defaultTags = ["Cancer", "Rectal Cancer", "IBD", "Pelvic Floor", "Robotic", "Laparoscopic", "TAMIS", "Emergency", "Fistula", "Proctology", "Peritoneal Malignancy"];

interface VideoRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  vimeo_id: string | null;
  vimeo_embed_hash: string | null;
  duration_seconds: number;
  thumbnail_url: string | null;
  tags: string[] | null;
  vimeo_plays: number;
  vimeo_created_at: string | null;
  speaker: string | null;
  category: string | null;
  video_faculty: Array<{
    faculty: { id: string; full_name: string; photo_url: string | null; position_title: string | null; hospital: string | null }
  }> | null;
  is_members_only: boolean;
  status: string;
  published_at: string | null;
}

interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_pinned: boolean;
  is_deleted: boolean;
  likes_count: number;
  created_at: string;
  profile: { full_name: string; avatar_url: string | null } | null;
  liked_by_me: boolean;
  replies?: Comment[];
}

const fmtDuration = (seconds: number) => {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const timeAgo = (date: string) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/* ═══════════════════════════════════════════════════════
   COMMENT COMPONENT
   ═══════════════════════════════════════════════════════ */
function CommentItem({
  comment, userId, isAdmin, onLike, onReply, onDelete, onPin, depth = 0,
}: {
  comment: Comment; userId: string | null; isAdmin: boolean;
  onLike: (id: string) => void; onReply: (id: string, content: string) => void;
  onDelete: (id: string) => void; onPin: (id: string) => void; depth?: number;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState(true);

  const initials = comment.profile?.full_name
    ? comment.profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
    setReplying(false);
  };

  if (comment.is_deleted) {
    return (
      <div className={`${depth > 0 ? "ml-10" : ""} py-3 text-sm text-muted-foreground italic`}>
        This comment has been removed.
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(r => (
              <CommentItem key={r.id} comment={r} userId={userId} isAdmin={isAdmin}
                onLike={onLike} onReply={onReply} onDelete={onDelete} onPin={onPin} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? "ml-6 sm:ml-10" : ""}`}>
      <div className={`py-4 ${depth === 0 ? "border-b border-border" : ""} ${comment.is_pinned ? "bg-gold/5 -mx-4 px-4 rounded-lg border border-gold/20" : ""}`}>
        {comment.is_pinned && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gold mb-2">
            <Pin size={12} /> Pinned
          </div>
        )}

        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-navy-foreground text-[11px] font-bold shrink-0 mt-0.5">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {comment.profile?.full_name || "Member"}
              </span>
              <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
            </div>

            {/* Content */}
            <p className="text-sm text-foreground/80 mt-1 leading-relaxed whitespace-pre-line">
              {comment.content}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
              <button
                onClick={() => onLike(comment.id)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  comment.liked_by_me
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ThumbsUp size={13} /> {comment.likes_count > 0 ? comment.likes_count : ""}
              </button>

              {userId && depth < 2 && (
                <button
                  onClick={() => setReplying(!replying)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Reply size={13} /> Reply
                </button>
              )}

              {isAdmin && (
                <>
                  <button
                    onClick={() => onPin(comment.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      comment.is_pinned ? "text-gold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Pin size={12} /> {comment.is_pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </>
              )}

              {/* Own comment delete */}
              {userId === comment.user_id && !isAdmin && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>

            {/* Reply input */}
            {replying && (
              <div className="flex gap-2 mt-3">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmitReply()}
                  placeholder="Write a reply..."
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                />
                <Button size="sm" onClick={handleSubmitReply} disabled={!replyText.trim()}>
                  <Send size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setReplying(false); setReplyText(""); }}>
                  <X size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {depth === 0 && comment.replies.length > 2 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1.5 ml-7 sm:ml-11 text-xs font-medium text-primary hover:underline py-1"
            >
              <CornerDownRight size={12} />
              {showReplies ? "Hide" : "Show"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
              {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          {showReplies && comment.replies.map(r => (
            <CommentItem key={r.id} comment={r} userId={userId} isAdmin={isAdmin}
              onLike={onLike} onReply={onReply} onDelete={onDelete} onPin={onPin} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMMENTS SECTION
   ═══════════════════════════════════════════════════════ */
function CommentsSection({ videoId }: { videoId: string }) {
  const { user, isAdmin } = useAuth();
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("video_comments")
      .select("*, profile:profiles(full_name, avatar_url)")
      .eq("video_id", videoId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Comments] Load failed:", error.message);
      setLoading(false);
      return;
    }

    // Get user's likes
    let likedIds = new Set<string>();
    if (user) {
      const { data: likes } = await supabase
        .from("video_comment_likes")
        .select("comment_id")
        .eq("user_id", user.id);
      likedIds = new Set((likes || []).map((l: any) => l.comment_id));
    }

    // Build tree
    const allComments = (data || []).map((c: any) => ({
      ...c,
      liked_by_me: likedIds.has(c.id),
      replies: [] as Comment[],
    }));

    const map = new Map<string, Comment>();
    const roots: Comment[] = [];

    allComments.forEach((c: Comment) => map.set(c.id, c));
    allComments.forEach((c: Comment) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies!.push(c);
      } else if (!c.parent_id) {
        roots.push(c);
      }
    });

    // Sort: pinned first, then newest first
    roots.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setComments(roots);
    setLoading(false);
  }, [videoId, user]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handlePost = async () => {
    if (!user || !newComment.trim()) return;
    setPosting(true);
    await supabase.from("video_comments").insert({
      video_id: videoId,
      user_id: user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    setPosting(false);
    loadComments();
  };

  const handleReply = async (parentId: string, content: string) => {
    if (!user) return;
    await supabase.from("video_comments").insert({
      video_id: videoId,
      user_id: user.id,
      parent_id: parentId,
      content,
    });
    loadComments();
  };

  const handleLike = async (commentId: string) => {
    if (!user) return;
    await supabase.rpc("toggle_comment_like", { p_comment_id: commentId, p_user_id: user.id });
    loadComments();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Remove this comment?")) return;
    if (isAdmin) {
      await supabase.from("video_comments").update({ is_deleted: true }).eq("id", commentId);
    } else {
      await supabase.from("video_comments").delete().eq("id", commentId).eq("user_id", user!.id);
    }
    loadComments();
  };

  const handlePin = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    await supabase.from("video_comments").update({ is_pinned: !comment.is_pinned }).eq("id", commentId);
    loadComments();
  };

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={18} className="text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">
          Discussion {totalCount > 0 && <span className="text-muted-foreground font-normal">({totalCount})</span>}
        </h3>
      </div>

      {/* Post comment */}
      {user ? (
        <div className="flex gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-navy-foreground text-[11px] font-bold shrink-0">
            {user.email?.slice(0, 2).toUpperCase() || "?"}
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Share your thoughts on this video..."
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background min-h-[72px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={2}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handlePost} disabled={posting || !newComment.trim()} className="bg-navy text-navy-foreground hover:bg-navy/90">
                {posting ? <Loader2 className="animate-spin mr-1" size={14} /> : <Send size={14} className="mr-1" />}
                Comment
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">Log in to join the discussion.</p>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={20} />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare size={32} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">No comments yet — be the first to share your thoughts.</p>
        </div>
      ) : (
        <div>
          {comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              userId={user?.id || null}
              isAdmin={isAdmin}
              onLike={handleLike}
              onReply={handleReply}
              onDelete={handleDelete}
              onPin={handlePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN VIDEO ARCHIVE COMPONENT
   ═══════════════════════════════════════════════════════ */
const VideoArchive = () => {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<typeof sortOptions[number]>("Newest");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [watchProgress, setWatchProgress] = useState<Record<string, { watched_seconds: number; last_position: number; duration_seconds: number; completed: boolean }>>({});

  useEffect(() => {
    async function loadVideos() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("videos")
        .select("*, video_faculty(faculty(id, full_name, photo_url, position_title, hospital))")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) console.error("[Videos] Failed to load:", error.message);
      else setVideos((data || []).map((v: any) => ({ ...v, tags: Array.isArray(v.tags) ? v.tags : [] })));
      setLoading(false);
    }
    loadVideos();

    // Fetch watch progress for all videos
    fetch('/api/videos/progress')
      .then(r => r.json())
      .then((rows: Array<{ video_id: string; watched_seconds: number; last_position: number; duration_seconds: number; completed: boolean }>) => {
        if (Array.isArray(rows)) {
          const map: Record<string, { watched_seconds: number; last_position: number; duration_seconds: number; completed: boolean }> = {};
          for (const r of rows) map[r.video_id] = r;
          setWatchProgress(map);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const filtered = useMemo(() => {
    let result = videos.filter(v => {
      const matchesSearch =
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        (v.video_faculty || []).some(vf => vf.faculty.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (v.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = category === "All" || v.category === category;
      const matchesTags = selectedTags.length === 0 || selectedTags.some(t => (v.tags || []).includes(t));
      return matchesSearch && matchesCategory && matchesTags;
    });

    if (sort === "Most Viewed") result.sort((a, b) => (b.vimeo_plays || 0) - (a.vimeo_plays || 0));
    else if (sort === "Duration") result.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
    else result.sort((a, b) => new Date(b.published_at || b.vimeo_created_at || 0).getTime() - new Date(a.published_at || a.vimeo_created_at || 0).getTime());

    return result;
  }, [videos, search, category, sort, selectedTags]);

  const activeFilterCount = (category !== "All" ? 1 : 0) + selectedTags.length;

  const availableCategories = useMemo(() => {
    const cats = new Set(videos.map(v => v.category).filter(Boolean));
    return cats.size > 0 ? ["All", ...Array.from(cats)] as string[] : defaultCategories;
  }, [videos]);

  const availableTags = useMemo(() => {
    const tags = new Set(videos.flatMap(v => v.tags || []));
    return tags.size > 0 ? Array.from(tags).sort() : defaultTags;
  }, [videos]);

  // Up-next suggestions (same category, excluding current)
  const upNext = useMemo(() => {
    if (!activeVideo) return [];
    return videos
      .filter(v => v.id !== activeVideo.id && (v.category === activeVideo.category || !activeVideo.category))
      .slice(0, 5);
  }, [activeVideo, videos]);

  /* ═══ VIDEO PLAYER VIEW ═══════════════════════════════ */
  if (activeVideo) {
    return (
      <div className="max-w-6xl space-y-6">
        {/* Back */}
        <button
          onClick={() => setActiveVideo(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Back to library
        </button>

        {/* Player */}
        {activeVideo.vimeo_id ? (
          <VimeoPlayer vimeoId={activeVideo.vimeo_id} videoId={activeVideo.id} embedHash={activeVideo.vimeo_embed_hash} />
        ) : (
          <div className="w-full aspect-video bg-navy rounded-xl flex items-center justify-center">
            <p className="text-navy-foreground/60 text-sm">No video source available</p>
          </div>
        )}

        {/* Two-column layout: info + sidebar */}
        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Left: Video info + Comments */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Title & metadata */}
            <div>
              <h1 className="text-xl font-bold text-foreground leading-snug">{activeVideo.title}</h1>
              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                {activeVideo.category && (
                  <Badge variant="secondary" className="text-[10px]">{activeVideo.category}</Badge>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={12} /> {fmtDuration(activeVideo.duration_seconds)}
                </span>
                {activeVideo.vimeo_plays > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye size={12} /> {activeVideo.vimeo_plays.toLocaleString()} views
                  </span>
                )}
                {activeVideo.published_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(activeVideo.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>

            {/* Faculty / Speakers */}
            {activeVideo.video_faculty && activeVideo.video_faculty.length > 0 && (
              <div className="space-y-3">
                {activeVideo.video_faculty.map(({ faculty: member }) => (
                  <div key={member.id} className="flex items-center gap-3">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.full_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="text-muted-foreground" size={18} />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.position_title}{member.hospital && ` · ${member.hospital}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {activeVideo.description && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {activeVideo.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {activeVideo.tags && activeVideo.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {activeVideo.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setActiveVideo(null); setSelectedTags([tag]); }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Comments */}
            <div className="pt-4 border-t border-border">
              <CommentsSection videoId={activeVideo.id} />
            </div>
          </div>

          {/* Right: Up Next sidebar */}
          {upNext.length > 0 && (
            <div className="lg:w-72 xl:w-80 shrink-0">
              <h3 className="text-sm font-semibold text-foreground mb-3">Up Next</h3>
              <div className="space-y-2">
                {upNext.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setActiveVideo(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="w-full flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="w-28 h-16 rounded-md bg-navy shrink-0 overflow-hidden relative">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video size={16} className="text-navy-foreground/30" />
                        </div>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-mono px-1 rounded">
                        {fmtDuration(v.duration_seconds)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {v.title}
                      </p>
                      {(v.video_faculty?.length ?? 0) > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {v.video_faculty!.map(vf => vf.faculty.full_name).join(", ")}
                        </p>
                      )}
                      {v.vimeo_plays > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{v.vimeo_plays.toLocaleString()} views</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══ LOADING ═════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  /* ═══ LIBRARY GRID VIEW ══════════════════════════════ */
  return (
    <div className="space-y-6 max-w-6xl w-full overflow-hidden">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Video Library</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {videos.length} video{videos.length !== 1 ? "s" : ""} — educational recordings, operative footage, and lectures
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search + sort + mobile filter toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, speaker, or tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden h-10 px-3 rounded-md border border-input bg-background text-sm font-medium flex items-center gap-2"
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as typeof sortOptions[number])}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {sortOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Collapsible filters: always visible on sm+, toggled on mobile */}
        <div className={`space-y-3 ${showFilters ? "" : "hidden sm:block"}`}>
          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  category === cat
                    ? "bg-navy text-navy-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tag pills */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground font-medium">Tags:</span>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                  selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {tag}
              </button>
            ))}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setCategory("All"); setSelectedTags([]); }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video count */}
      {(search || activeFilterCount > 0) && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {videos.length} videos
        </p>
      )}

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {filtered.map(video => {
          const dateStr = video.published_at
            ? new Date(video.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : video.vimeo_created_at
            ? new Date(video.vimeo_created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : "";

          return (
            <div
              key={video.id}
              className="cursor-pointer group min-w-0 overflow-hidden h-full"
              onClick={() => { setActiveVideo(video); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              {/* Mobile: horizontal card */}
              <div className="sm:hidden flex rounded-lg border overflow-hidden bg-card hover:shadow-md transition-shadow">
                <div className="w-32 shrink-0 relative bg-navy">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video size={18} className="text-navy-foreground/30" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-mono px-1 py-0.5 rounded">
                    {fmtDuration(video.duration_seconds)}
                  </span>
                  {watchProgress[video.id]?.completed && (
                    <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5 shadow">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                  {watchProgress[video.id] && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                      <div
                        className={`h-full ${watchProgress[video.id].completed ? 'bg-emerald-400' : 'bg-primary'}`}
                        style={{ width: `${watchProgress[video.id].completed ? 100 : Math.min(100, Math.round((watchProgress[video.id].last_position / Math.max(1, watchProgress[video.id].duration_seconds)) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center gap-0.5">
                  {video.category && (
                    <span className="text-[10px] font-medium text-muted-foreground">{video.category}</span>
                  )}
                  <h3 className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{video.title}</h3>
                  {(video.video_faculty?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground truncate">{video.video_faculty!.map(vf => vf.faculty.full_name).join(", ")}</p>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{dateStr}</span>
                    {video.vimeo_plays > 0 && (
                      <span className="flex items-center gap-0.5"><Eye size={10} /> {video.vimeo_plays.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop: vertical card */}
              <Card className="hidden sm:flex sm:flex-col border overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 h-full">
                <div className="relative aspect-video bg-navy">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video size={32} className="text-navy-foreground/30" />
                    </div>
                  )}
                  {/* Play hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100 shadow-xl">
                      <Play size={22} className="text-navy ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  {video.category && (
                    <Badge className="absolute top-2.5 left-2.5 text-[10px] shadow-sm" variant="secondary">
                      {video.category}
                    </Badge>
                  )}
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm">
                    {fmtDuration(video.duration_seconds)}
                  </span>
                  {watchProgress[video.id]?.completed && (
                    <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-0.5 shadow">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  {watchProgress[video.id] && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className={`h-full ${watchProgress[video.id].completed ? 'bg-emerald-400' : 'bg-primary'}`}
                        style={{ width: `${watchProgress[video.id].completed ? 100 : Math.min(100, Math.round((watchProgress[video.id].last_position / Math.max(1, watchProgress[video.id].duration_seconds)) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex-1 flex flex-col">
                  {video.tags && video.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {video.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                      {video.tags.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                          +{video.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {video.title}
                  </h3>
                  {(video.video_faculty?.length ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">{video.video_faculty!.map(vf => vf.faculty.full_name).join(", ")}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-2.5 text-xs text-muted-foreground">
                    <span>{dateStr}</span>
                    {video.vimeo_plays > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye size={12} /> {video.vimeo_plays.toLocaleString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Video size={48} className="mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No videos found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => { setSearch(""); setCategory("All"); setSelectedTags([]); }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

export default VideoArchive;