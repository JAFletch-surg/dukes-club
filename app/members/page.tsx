'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, HelpCircle, Calendar, BarChart3, Play, MapPin, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const MembersDashboard = () => {
  const { profile, loading: authLoading } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [latestVideos, setLatestVideos] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      // Fetch upcoming published events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, slug, starts_at, location, member_price_pence, price_pence')
        .eq('status', 'published')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(3);

      if (events) setUpcomingEvents(events);

      // Fetch latest published videos
      const { data: videos } = await supabase
        .from('videos')
        .select('id, title, speaker, duration_display, category')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(3);

      if (videos) setLatestVideos(videos);

      setLoadingData(false);
    }

    fetchDashboardData();
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] || 'Member';

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
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s new in the Dukes&apos; Club community
        </p>
      </div>

      {/* Stats — placeholder until tracking tables exist */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Videos watched", value: "–", icon: Video, color: "text-navy" },
          { label: "Questions attempted", value: "–", icon: HelpCircle, color: "text-emerald-600" },
          { label: "Events booked", value: "–", icon: Calendar, color: "text-gold" },
          { label: "Exam average", value: "–", icon: BarChart3, color: "text-primary" },
        ].map((stat) => (
          <Card key={stat.label} className="border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">
                    {stat.label}
                  </p>
                </div>
                <stat.icon size={20} className="text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                {latestVideos.map((video) => (
                  <div key={video.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="w-16 h-11 rounded-md bg-navy flex items-center justify-center shrink-0">
                      <Play size={14} className="text-navy-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{video.title}</p>
                      <p className="text-xs text-muted-foreground">{video.speaker}{video.duration_display ? ` · ${video.duration_display}` : ''}</p>
                    </div>
                  </div>
                ))}
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
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-md bg-gold/10 flex items-center justify-center shrink-0">
                      <Calendar size={16} className="text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(event.starts_at)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={10} />
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
    </div>
  );
};

export default MembersDashboard;