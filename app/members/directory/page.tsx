'use client'
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, X, Loader2, MapPin, Mail, Linkedin, Twitter, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRouter } from "next/navigation";

interface DirectoryMember {
  id: string;
  full_name: string;
  email: string;
  region: string | null;
  training_stage: string | null;
  hospital: string | null;
  avatar_url: string | null;
  subspecialty_interests: string[] | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  directory_settings: {
    visible: boolean;
    show_email: boolean;
    show_hospital: boolean;
    show_region: boolean;
    show_training_stage: boolean;
    show_subspecialty_interests: boolean;
    show_social_links: boolean;
    allow_messages?: boolean;
  } | null;
}

const regions = [
  "All", "North East", "North West (Mersey)", "North West (North Western)",
  "Yorkshire and the Humber", "East Midlands", "West Midlands",
  "East of England", "London", "Kent, Surrey and Sussex", "Thames Valley",
  "Wessex", "South West (Peninsula)", "South West (Severn)",
  "Scotland", "Wales", "Northern Ireland", "Republic of Ireland",
];

const trainingStages = [
  "All", "FY1", "FY2", "CT1", "CT2", "ST3", "ST4", "ST5", "ST6", "ST7", "ST8",
  "Post-CCT", "Consultant", "SAS", "Academic", "Other",
];

const MemberDirectory = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All");
  const [stage, setStage] = useState("All");
  const [startingDM, setStartingDM] = useState<string | null>(null);

  const handleMessage = async (memberId: string) => {
    if (!user) return;
    setStartingDM(memberId);
    const supabase = createClient();
    const { data: convId } = await supabase.rpc('find_or_create_dm', {
      user_a: user.id,
      user_b: memberId,
    });
    setStartingDM(null);
    if (convId) {
      router.push(`/members/messages?conv=${convId}`);
    }
  };

  useEffect(() => {
    async function loadMembers() {
      setLoading(true);
      const supabase = createClient();

      // Fetch all approved members
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, region, training_stage, hospital, avatar_url, subspecialty_interests, social_twitter, social_linkedin, directory_settings')
        .eq('approval_status', 'approved')
        .order('full_name');

      if (error) {
        console.error('[Directory] Load failed:', error.message);
      } else {
        // Show members by default — only hide if they explicitly opted out
        const visible = (data || []).filter((m: any) =>
          m.directory_settings?.visible !== false
        );
        setMembers(visible);
      }
      setLoading(false);
    }

    loadMembers();
  }, []);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const searchLower = search.toLowerCase();
      const matchesSearch = !search ||
        m.full_name?.toLowerCase().includes(searchLower) ||
        (m.region || "").toLowerCase().includes(searchLower) ||
        (m.hospital || "").toLowerCase().includes(searchLower) ||
        (m.subspecialty_interests || []).some(s => s.toLowerCase().includes(searchLower));
      const matchesRegion = region === "All" || m.region === region;
      const matchesStage = stage === "All" || m.training_stage === stage;
      return matchesSearch && matchesRegion && matchesStage;
    });
  }, [members, search, region, stage]);

  const getInitials = (name: string) => {
    const cleaned = name.replace(/^(Dr|Mr|Mrs|Ms|Prof|Miss)\s+/i, "");
    const parts = cleaned.split(" ").filter(Boolean);
    return parts.map(p => p[0]).join("").slice(0, 2).toUpperCase();
  };

  const activeFilterCount = (region !== "All" ? 1 : 0) + (stage !== "All" ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Member Directory</h1>
        <p className="text-muted-foreground mt-1">
          {members.length} member{members.length !== 1 ? "s" : ""} in the directory
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, region, hospital, or interest..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          {regions.map((r) => <option key={r} value={r}>{r === "All" ? "All Regions" : r}</option>)}
        </select>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          {trainingStages.map((s) => <option key={s} value={s}>{s === "All" ? "All Stages" : s}</option>)}
        </select>
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setRegion("All"); setStage("All"); }}
            className="text-xs text-primary hover:underline flex items-center gap-1 self-center"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Results count when filtered */}
      {(search || activeFilterCount > 0) && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {members.length} members
        </p>
      )}

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
        {filtered.map((member) => {
          const ds = member.directory_settings;
          const isMe = user?.id === member.id;

          return (
            <div key={member.id}>
              {/* Mobile: compact horizontal card */}
              <Card className={`sm:hidden border hover:shadow-md transition-shadow ${isMe ? 'ring-2 ring-gold/30' : ''}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="bg-navy text-navy-foreground text-xs font-semibold">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-foreground truncate">{member.full_name}</h3>
                      {isMe && <span className="text-[9px] text-gold font-medium shrink-0">You</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {ds?.show_training_stage !== false && member.training_stage && member.training_stage}
                      {ds?.show_training_stage !== false && member.training_stage && ds?.show_region !== false && member.region && ' · '}
                      {ds?.show_region !== false && member.region && member.region}
                    </p>
                    {ds?.show_hospital !== false && member.hospital && (
                      <p className="text-[11px] text-muted-foreground/70 truncate">{member.hospital}</p>
                    )}
                  </div>
                  {!isMe && user && (ds?.allow_messages !== false) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-8 w-8 p-0"
                      onClick={() => handleMessage(member.id)}
                      disabled={startingDM === member.id}
                    >
                      {startingDM === member.id ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <MessageSquare size={14} />
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Desktop: vertical centered card */}
              <Card className={`hidden sm:block border hover:shadow-md transition-shadow ${isMe ? 'ring-2 ring-gold/30' : ''}`}>
                <CardContent className="p-5 text-center">
                  <Avatar className="h-14 w-14 mx-auto mb-3">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="bg-navy text-navy-foreground text-sm font-semibold">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <h3 className="text-sm font-semibold text-foreground">{member.full_name}</h3>

                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {/* Training stage & region */}
                    <p>
                      {ds?.show_training_stage !== false && member.training_stage && (
                        <span>{member.training_stage}</span>
                      )}
                      {ds?.show_training_stage !== false && member.training_stage && ds?.show_region !== false && member.region && (
                        <span> · </span>
                      )}
                      {ds?.show_region !== false && member.region && (
                        <span>{member.region}</span>
                      )}
                    </p>

                    {/* Hospital */}
                    {ds?.show_hospital !== false && member.hospital && (
                      <p className="truncate">{member.hospital}</p>
                    )}
                  </div>

                  {/* Subspecialties */}
                  {ds?.show_subspecialty_interests !== false && member.subspecialty_interests && member.subspecialty_interests.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-center mt-2.5">
                      {member.subspecialty_interests.slice(0, 3).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                          {s}
                        </span>
                      ))}
                      {member.subspecialty_interests.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                          +{member.subspecialty_interests.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contact / social links */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {ds?.show_email && member.email && (
                      <a
                        href={`mailto:${member.email}`}
                        className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title={member.email}
                      >
                        <Mail size={14} />
                      </a>
                    )}
                    {ds?.show_social_links && member.social_twitter && (
                      <a
                        href={member.social_twitter.startsWith('http') ? member.social_twitter : `https://twitter.com/${member.social_twitter.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Twitter / X"
                      >
                        <Twitter size={14} />
                      </a>
                    )}
                    {ds?.show_social_links && member.social_linkedin && (
                      <a
                        href={member.social_linkedin.startsWith('http') ? member.social_linkedin : `https://linkedin.com/in/${member.social_linkedin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="LinkedIn"
                      >
                        <Linkedin size={14} />
                      </a>
                    )}
                  </div>

                  {/* Message button */}
                  {!isMe && user && (ds?.allow_messages !== false) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full text-xs"
                      onClick={() => handleMessage(member.id)}
                      disabled={startingDM === member.id}
                    >
                      {startingDM === member.id ? (
                        <Loader2 className="animate-spin mr-1.5" size={12} />
                      ) : (
                        <MessageSquare size={12} className="mr-1.5" />
                      )}
                      Message
                    </Button>
                  )}

                  {isMe && (
                    <p className="text-[10px] text-gold font-medium mt-2">This is you</p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No members found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {members.length === 0
              ? "No members have opted into the directory yet"
              : "Try adjusting your search or filters"}
          </p>
          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setRegion("All"); setStage("All"); }}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberDirectory;