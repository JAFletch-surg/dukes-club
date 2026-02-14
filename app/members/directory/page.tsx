'use client'
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, X } from "lucide-react";
import { mockDirectoryMembers } from "@/data/mockMembersData";

const regions = [
  "All", "London", "North West", "North East", "West Midlands", "East Midlands",
  "South East", "South West", "Yorkshire", "East of England", "Wales",
  "Scotland", "Northern Ireland", "International",
];
const trainingStages = [
  "All", "Medical Student", "Foundation", "Core", "ST3", "ST4", "ST5", "ST6", "ST7", "ST8",
  "Post-CCT", "SAS Doctor", "Consultant",
];

const MemberDirectory = () => {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All");
  const [stage, setStage] = useState("All");

  const filtered = useMemo(() => {
    return mockDirectoryMembers.filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.region.toLowerCase().includes(search.toLowerCase()) ||
        m.hospital.toLowerCase().includes(search.toLowerCase());
      const matchesRegion = region === "All" || m.region === region;
      const matchesStage = stage === "All" || m.trainingStage === stage;
      return matchesSearch && matchesRegion && matchesStage;
    });
  }, [search, region, stage]);

  const getInitials = (name: string) => {
    const parts = name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\s+/i, "").split(" ");
    return parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  };

  const activeFilterCount = (region !== "All" ? 1 : 0) + (stage !== "All" ? 1 : 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Member Directory</h1>
        <p className="text-muted-foreground mt-1">Connect with fellow colorectal surgery trainees</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, region, or hospital..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((member) => (
          <Card key={member.id} className="border">
            <CardContent className="p-5 text-center">
              <Avatar className="h-14 w-14 mx-auto mb-3">
                <AvatarFallback className="bg-navy text-navy-foreground text-sm font-semibold">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-sm font-semibold text-foreground">{member.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {member.trainingStage} · {member.region}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{member.hospital}</p>
              {member.subspecialties.length > 0 && (
                <div className="flex gap-1 flex-wrap justify-center mt-2">
                  {member.subspecialties.map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{s}</span>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="mt-3 w-full text-xs">
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No members found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setRegion("All"); setStage("All"); }}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

export default MemberDirectory;
