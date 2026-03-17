'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, HelpCircle, Calendar, BarChart3, Play, MapPin, ArrowRight, Clock, Check, X as XIcon, Loader2, AlertCircle, Award, MessageSquare, ExternalLink, ShieldCheck, Newspaper } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EventsCalendar from "@/components/EventsCalendar";

const VIDEO_BADGE_THRESHOLDS = [
  { min: 50, label: 'Gold', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', icon: '🥇' },
  { min: 25, label: 'Silver', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', icon: '🥈' },
  { min: 10, label: 'Bronze', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', icon: '🥉' },
];

const MembersDashboard = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [calendarDates, setCalendarDates] = useState<any[]>([]);
  const [latestVideos, setLatestVideos] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [questionStats, setQuestionStats] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [videoStats, setVideoStats] = useState<{ completedCount: number; minutesWatched: number } | null>(null);
  const [latestNews, setLatestNews] = useState<any[]>([]);

  useEffect(() => {
    // Don't fetch until auth has resolved on the client
    if (authLoading) return;

    async function fetchDashboardData() {
      try {
        // Check client-side auth state
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Dashboard] Session exists:', !!session, 'User from context:', !!user);

        // Fetch upcoming published events
        const { data: events, error: eventsErr } = await supabase
          .from('events')
          .select('id, title, slug, starts_at, location, member_price_pence, price_pence')
          .eq('status', 'published')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(3);

        if (eventsErr) console.error('[Dashboard] Events error:', eventsErr.message);
        if (events) setUpcomingEvents(events);

        // Fetch ALL published events (for calendar)
        const { data: allEventsData, error: allEventsErr } = await supabase
          .from('events')
          .select('id, title, slug, starts_at, ends_at, location, event_type, price_pence')
          .eq('status', 'published')
          .order('starts_at', { ascending: true });
        if (allEventsErr) console.error('[Dashboard] All events error:', allEventsErr.message);
        if (allEventsData) setAllEvents(allEventsData);

        // Fetch external calendar dates
        const { data: calDates, error: calErr } = await supabase
          .from('calendar_dates')
          .select('*')
          .order('start_date', { ascending: true });
        if (calErr) console.error('[Dashboard] Calendar error:', calErr.message);
        if (calDates) setCalendarDates(calDates);

        // Fetch latest published videos
        const { data: videos, error: videosErr } = await supabase
          .from('videos')
          .select('id, title, speaker, duration_seconds, category, thumbnail_url')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(3);

        if (videosErr) console.error('[Dashboard] Videos error:', videosErr.message);
        if (videos) setLatestVideos(videos);

        // Fetch latest published news posts
        const { data: news, error: newsErr } = await supabase
          .from('posts')
          .select('id, title, slug, excerpt, category, featured_image_url, author_name, published_at, is_featured')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(4);

        if (newsErr) console.error('[Dashboard] News error:', newsErr.message);
        if (news) setLatestNews(news);

        // Fetch user's event bookings and question stats
        if (user) {
          const { data: bookings, error: bookingsErr } = await supabase
            .from('event_bookings')
            .select('*, events!event_bookings_event_id_fkey(title, slug, starts_at, ends_at, location, event_type, zoom_url)')
            .eq('user_id', user.id)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

          if (bookingsErr) console.error('[Dashboard] Bookings error:', bookingsErr.message);
          if (bookings) setMyBookings(bookings);

          // Fetch question stats - use maybeSingle() since user may not have stats yet
          const { data: qStats, error: qStatsErr } = await supabase
            .from('user_question_stats')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (qStatsErr) console.error('[Dashboard] Question stats error:', qStatsErr.message);
          if (qStats) setQuestionStats(qStats);

          // Fetch video watch progress for stats and badges
          const { data: watchProgress, error: watchErr } = await supabase
            .from('video_watch_progress')
            .select('completed, watched_seconds, duration_seconds')
            .eq('user_id', user.id);

          if (watchErr) console.error('[Dashboard] Watch progress error:', watchErr.message);
          if (watchProgress && watchProgress.length > 0) {
            const completedCount = watchProgress.filter((r: any) => r.completed).length;
            const totalSeconds = watchProgress.reduce((sum: number, r: any) => {
              // completed → full video duration, in-progress → position reached
              return sum + (r.completed ? (r.duration_seconds || 0) : (r.watched_seconds || 0));
            }, 0);
            setVideoStats({ completedCount, minutesWatched: Math.floor(totalSeconds / 60) });
          } else if (watchProgress) {
            setVideoStats({ completedCount: 0, minutesWatched: 0 });
          }

          // Fetch unread message count across all conversations
          const { data: myConvs } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', user.id);

          if (myConvs && myConvs.length > 0) {
            let totalUnread = 0;
            for (const conv of myConvs) {
              const { data: readData } = await supabase
                .from('message_reads')
                .select('last_read_at')
                .eq('conversation_id', conv.conversation_id)
                .eq('user_id', user.id)
                .single();

              const lastReadAt = readData?.last_read_at || '1970-01-01';

              const { count } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conv.conversation_id)
                .neq('sender_id', user.id)
                .gt('created_at', lastReadAt);

              totalUnread += count || 0;
            }
            setUnreadCount(totalUnread);
          }
        }
      } catch (err) {
        console.error('[Dashboard] Failed to load data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchDashboardData();
  }, [user, authLoading]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this application? This cannot be undone.')) return;
    setCancellingId(bookingId);
    const { error } = await supabase
      .from('event_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (!error) {
      setMyBookings(prev => prev.filter(b => b.id !== bookingId));
    }
    setCancellingId(null);
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Member';
  const currentBadge = videoStats
    ? VIDEO_BADGE_THRESHOLDS.find(b => videoStats.completedCount >= b.min) || null
    : null;

  const formatPrice = (pence: number | null) => {
    if (!pence || pence === 0) return 'Free';
    return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl w-full overflow-hidden">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s new in the Dukes&apos; Club community
        </p>
      </div>

      {/* Membership upgrade prompt for trainees */}
      {profile?.role === 'trainee' && (
        <Card className="border border-gold/30 bg-gold/5">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              {!profile.acpgbi_number ? (
                <>
                  <h3 className="text-sm font-semibold text-foreground">Upgrade to Full Membership</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submit your ACPGBI membership number to unlock full access to in-person courses, unlimited question bank, and more.
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <Link href="/members/profile">
                      <Button variant="gold" size="sm">
                        Add Membership Number
                      </Button>
                    </Link>
                    <a
                      href="https://www.acpgbi.org.uk/membership/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      Learn about ACPGBI membership
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-foreground">Membership Verification Pending</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your ACPGBI membership number has been submitted and is being verified. You&apos;ll receive full Member access once confirmed.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Videos watched", value: videoStats?.completedCount ?? "–", icon: Video, color: "text-navy", subtitle: videoStats ? (videoStats.minutesWatched >= 60 ? `${(videoStats.minutesWatched / 60).toFixed(1)} hrs watched` : `${videoStats.minutesWatched} min watched`) : undefined, badge: currentBadge },
          { label: "Questions attempted", value: questionStats?.total_attempted || 0, icon: HelpCircle, color: "text-emerald-600" },
          { label: "Events booked", value: myBookings.length, icon: Calendar, color: "text-gold" },
          { label: "Exam average", value: questionStats?.overall_percentage ? `${questionStats.overall_percentage}%` : "–", icon: BarChart3, color: "text-primary" },
        ].map((stat) => (
          <Card key={stat.label} className="border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">
                    {stat.label}
                  </p>
                  {'subtitle' in stat && stat.subtitle && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.subtitle as string}</p>
                  )}
                  {'badge' in stat && stat.badge && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Award size={12} className={(stat.badge as any).text} />
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${(stat.badge as any).bg} ${(stat.badge as any).text} ${(stat.badge as any).border}`}>
                        {(stat.badge as any).label}
                      </Badge>
                    </div>
                  )}
                </div>
                <stat.icon size={20} className="text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Video Badge Progress */}
      {videoStats && (
        <Card className="border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Award size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Video Badges</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[...VIDEO_BADGE_THRESHOLDS].reverse().map((tier) => {
                const earned = videoStats.completedCount >= tier.min;
                const isNext = !earned && (
                  tier === [...VIDEO_BADGE_THRESHOLDS].reverse().find(t => videoStats.completedCount < t.min)
                );
                const progress = isNext
                  ? Math.min(100, Math.round((videoStats.completedCount / tier.min) * 100))
                  : earned ? 100 : 0;

                return (
                  <div
                    key={tier.label}
                    className={`relative rounded-lg border p-4 text-center transition-all ${
                      earned
                        ? `${tier.bg} ${tier.border}`
                        : isNext
                        ? 'border-border bg-muted/20'
                        : 'border-border/50 bg-muted/10 opacity-50'
                    }`}
                  >
                    <div className={`text-2xl mb-1 ${earned ? '' : 'grayscale opacity-40'}`}>
                      {tier.icon}
                    </div>
                    <p className={`text-sm font-bold ${earned ? tier.text : 'text-muted-foreground'}`}>
                      {tier.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tier.min} videos
                    </p>
                    {earned && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <Check size={12} className={tier.text} />
                        <span className={`text-[10px] font-semibold ${tier.text}`}>Earned</span>
                      </div>
                    )}
                    {isNext && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {videoStats.completedCount}/{tier.min} watched
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unread messages banner */}
      {unreadCount > 0 && (
        <Link href="/members/messages" className="block">
          <Card className="border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                  <MessageSquare size={18} className="text-gold" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    You have {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Tap to view your conversations</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gold shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Two-column grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Latest Videos */}
        <Card className="border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Video size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Latest Videos</h2>
            </div>
            {loadingData ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : latestVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No videos published yet</p>
            ) : (
              <div className="space-y-3">
                {latestVideos.map((video) => {
                  const dur = video.duration_seconds;
                  const durStr = dur
                    ? dur >= 3600
                      ? `${Math.floor(dur / 3600)}:${String(Math.floor((dur % 3600) / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`
                      : `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`
                    : '';
                  return (
                    <Link
                      key={video.id}
                      href="/members/videos"
                      className="group flex rounded-xl border border-border overflow-hidden hover:shadow-md transition-all"
                    >
                      <div className="w-20 h-20 shrink-0 bg-navy flex items-center justify-center overflow-hidden">
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <Play size={18} className="text-navy-foreground" />
                        )}
                      </div>
                      <div className="p-3 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-gold transition-colors">{video.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {video.speaker}{durStr ? ` · ${durStr}` : ''}{video.category ? ` · ${video.category}` : ''}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <Link href="/members/videos">
              <Button variant="ghost" size="sm" className="mt-3 w-full">
                View All <ArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Upcoming Events</h2>
            </div>
            {loadingData ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="group flex rounded-xl border border-border overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="w-20 h-20 shrink-0 bg-gold/10 flex items-center justify-center">
                      <Calendar size={22} className="text-gold" />
                    </div>
                    <div className="p-3 flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-gold transition-colors">{event.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 overflow-hidden">
                        <span className="shrink-0">{formatDate(event.starts_at)}</span>
                        <span className="shrink-0">·</span>
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={10} className="shrink-0" />
                          {event.location?.split(",")[0]}
                        </span>
                      </div>
                      {event.member_price_pence !== null && (
                        <Badge variant="outline" className="mt-1 text-[10px] text-emerald-600 border-emerald-600/30">
                          Member price: {formatPrice(event.member_price_pence)}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/events">
              <Button variant="ghost" size="sm" className="mt-3 w-full">
                View All Events <ArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Latest News */}
      <Card className="border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={18} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Latest News</h2>
          </div>
          {loadingData ? (
            <p className="text-sm text-muted-foreground py-4">Loading...</p>
          ) : latestNews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No news articles yet</p>
          ) : (
            <div className="space-y-3 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:space-y-0">
              {latestNews.map((post) => (
                <Link
                  key={post.id}
                  href={`/news/${post.slug}`}
                  className="group flex sm:block rounded-xl border border-border overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="w-20 h-20 shrink-0 sm:w-full sm:h-auto sm:aspect-[16/9] bg-muted relative overflow-hidden">
                    {post.featured_image_url ? (
                      <img src={post.featured_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-navy/5">
                        <Newspaper size={24} className="text-muted-foreground/40" />
                      </div>
                    )}
                    {post.is_featured && (
                      <span className="absolute top-2 left-2 bg-gold text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex-1 min-w-0">
                    {post.category && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gold">{post.category}</span>
                    )}
                    <p className="text-sm font-semibold text-foreground mt-0.5 line-clamp-2 group-hover:text-gold transition-colors">{post.title}</p>
                    {post.excerpt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 hidden sm:block">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      {post.author_name && <span>{post.author_name}</span>}
                      {post.author_name && post.published_at && <span>·</span>}
                      {post.published_at && (
                        <span>{new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link href="/news">
            <Button variant="ghost" size="sm" className="mt-3 w-full">
              View All News <ArrowRight size={14} className="ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Calendar */}
      {!loadingData && (allEvents.length > 0 || calendarDates.length > 0) && (
        <Card className="border">
          <CardContent className="p-5">
            <EventsCalendar
              events={allEvents.map(e => ({
                id: e.id,
                title: e.title,
                slug: e.slug,
                starts_at: e.starts_at,
                ends_at: e.ends_at,
                location: e.location || '',
                event_type: e.event_type || '',
                price_pence: e.price_pence,
              }))}
              calendarDates={calendarDates}
              isLoggedIn={true}
              theme="light"
            />
          </CardContent>
        </Card>
      )}

      {/* My Events */}
      {myBookings.length > 0 && (() => {
        const now = new Date();
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

        // Split into upcoming vs past
        const upcoming = myBookings.filter(b => {
          const ev = b.events;
          if (!ev?.starts_at) return true;
          return new Date(ev.starts_at) >= now;
        });

        const past = myBookings.filter(b => {
          const ev = b.events;
          if (!ev?.starts_at) return false;
          const eventDate = new Date(ev.starts_at);
          if (eventDate >= now) return false;

          // Hide rejected bookings after 30 days
          if (b.status === 'rejected') {
            return (now.getTime() - eventDate.getTime()) < THIRTY_DAYS;
          }
          // Hide completed bookings (feedback done) after 90 days
          if (b.feedback_completed_at) {
            return (now.getTime() - eventDate.getTime()) < NINETY_DAYS;
          }
          // Always show past events needing feedback
          return ['approved', 'confirmed'].includes(b.status);
        });

        const visibleBookings = [...upcoming, ...past];
        if (visibleBookings.length === 0) return null;

        return (
          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">My Events</h2>
              </div>
              <div className="space-y-3">
                {visibleBookings.map((booking) => {
                  const ev = booking.events;
                  const eventDate = ev?.starts_at ? new Date(ev.starts_at) : null;
                  const isPast = eventDate ? eventDate < now : false;
                  const needsFeedback = isPast && ['approved', 'confirmed'].includes(booking.status) && !booking.feedback_completed_at;
                  const hasCertificate = isPast && booking.feedback_completed_at;

                  const statusConfig: Record<string, { bg: string; text: string; label: string; icon: any }> = {
                    pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending Review', icon: Clock },
                    approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: isPast ? 'Attended' : 'Approved', icon: Check },
                    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', label: isPast ? 'Attended' : 'Confirmed', icon: Check },
                    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Not Successful', icon: XIcon },
                    waitlisted: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Waitlisted', icon: Clock },
                  };
                  const sc = statusConfig[booking.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;

                  return (
                    <div key={booking.id} className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-start gap-3 p-4">
                        <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${sc.bg}`}>
                          <StatusIcon size={16} className={sc.text} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <Link href={`/events/${ev?.slug}`} className="text-sm font-medium text-foreground hover:text-gold transition-colors">
                              {ev?.title || 'Unknown Event'}
                            </Link>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${sc.bg} ${sc.text} border-0`}>
                              {sc.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {ev?.starts_at && <span>{formatDate(ev.starts_at)}</span>}
                            {ev?.location && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} />
                                  {ev.location.split(",")[0]}
                                </span>
                              </>
                            )}
                            {ev?.event_type && (
                              <>
                                <span>·</span>
                                <span>{ev.event_type}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* UPCOMING: show status message + cancel button */}
                      {!isPast && ['pending', 'approved', 'waitlisted'].includes(booking.status) && (
                        <div className="border-t border-border px-4 py-2.5 bg-muted/20 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {booking.status === 'pending' ? 'Your application is being reviewed' : booking.status === 'approved' ? 'You are confirmed to attend' : 'You are on the waitlist'}
                          </span>
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancellingId === booking.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors px-3 py-1.5 rounded-md border border-destructive/20 hover:bg-destructive/5"
                          >
                            {cancellingId === booking.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <XIcon size={12} />
                            )}
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* UPCOMING + APPROVED: Zoom join link */}
                      {!isPast && ['approved', 'confirmed'].includes(booking.status) && ev?.zoom_url && (
                        <a
                          href={ev.zoom_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-t border-primary/20 px-4 py-3 bg-primary/5 flex items-center justify-between hover:bg-primary/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <ExternalLink size={14} className="text-primary" />
                            </div>
                            <span className="text-xs font-semibold text-foreground">Join Webinar</span>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-gold text-gold-foreground shrink-0">
                            <ExternalLink size={13} /> Join Now
                          </span>
                        </a>
                      )}

                      {/* PAST: needs feedback → gold CTA */}
                      {needsFeedback && (
                        <Link
                          href={`/members/events/${booking.event_id}/feedback`}
                          className="border-t border-gold/30 px-4 py-3 bg-gold/10 flex items-center justify-between hover:bg-gold/15 transition-colors group block"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center">
                              <MessageSquare size={14} className="text-gold-foreground" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-gold-foreground block">Give Feedback &amp; Get Your Certificate</span>
                              <span className="text-[10px] text-gold-foreground/60">Takes less than 2 minutes</span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-gold text-gold-foreground group-hover:bg-gold/90 transition-colors shrink-0">
                            <MessageSquare size={13} /> Give Feedback
                          </span>
                        </Link>
                      )}

                      {/* PAST: feedback done → certificate link */}
                      {hasCertificate && (
                        <div className="border-t border-border px-4 py-3 bg-navy/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center">
                              <Award size={14} className="text-navy" />
                            </div>
                            <span className="text-xs font-medium text-foreground">Certificate of attendance available</span>
                          </div>
                          <Link
                            href="/members/certificates"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-navy text-navy-foreground hover:bg-navy/90 transition-colors"
                          >
                            <Award size={13} /> View Certificate
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
};

export default MembersDashboard;