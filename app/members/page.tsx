'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Video, HelpCircle, Calendar, BarChart3, Play, MapPin, ArrowRight, TrendingUp } from "lucide-react";
import { mockUser, mockStats, mockVideos, mockUpcomingEvents, mockWeakTopics } from "@/data/mockMembersData";

const statCards = [
  { label: "Videos watched", value: mockStats.videosWatched, icon: Video, color: "text-navy" },
  { label: "Questions attempted", value: `${mockStats.questionsAttempted}/${mockStats.totalQuestions}`, icon: HelpCircle, color: "text-emerald-600" },
  { label: "Events booked", value: mockStats.eventsBooked, icon: Calendar, color: "text-gold" },
  { label: "Exam average", value: `${mockStats.examAverage}%`, icon: BarChart3, color: "text-primary" },
];

const MembersDashboard = () => {
  const latestVideos = mockVideos.slice(0, 3);
  const upcomingEvents = mockUpcomingEvents.slice(0, 3);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {mockUser.firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's new in the Dukes' Club community
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Latest Videos</h2>
              </div>
            </div>
            <div className="space-y-3">
              {latestVideos.map((video) => (
                <div key={video.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="w-16 h-11 rounded-md bg-navy flex items-center justify-center shrink-0">
                    <Play size={14} className="text-navy-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{video.title}</p>
                    <p className="text-xs text-muted-foreground">{video.speaker} · {video.duration}</p>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Upcoming Events</h2>
              </div>
            </div>
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
                      <span>{new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {event.location.split(",")[0]}
                      </span>
                    </div>
                    {event.memberPrice && (
                      <Badge variant="outline" className="mt-1 text-[10px] text-emerald-600 border-emerald-600/30">
                        Member price: {event.memberPrice}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/events">
              <Button variant="ghost" size="sm" className="mt-3 w-full">
                View All Events <ArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Weak Topics */}
      <Card className="border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Your Weak Topics</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {mockWeakTopics.map((item) => (
              <div key={item.topic} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{item.topic}</span>
                  <span className={`text-sm font-bold ${item.percentage < 50 ? "text-destructive" : "text-gold"}`}>
                    {item.percentage}%
                  </span>
                </div>
                <Progress
                  value={item.percentage}
                  className={`h-2 ${item.percentage < 50 ? "[&>div]:bg-destructive" : "[&>div]:bg-gold"}`}
                />
                <Link
                  href="/members/questions"
                  className="text-xs text-primary font-medium hover:underline inline-block"
                >
                  Practice Now →
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MembersDashboard;
