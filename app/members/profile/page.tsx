'use client'
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, Shield, Trash2, Bell, AlertTriangle } from "lucide-react";
import { mockUser } from "@/data/mockMembersData";

const regions = [
  "London", "South East", "South West", "East of England", "West Midlands",
  "East Midlands", "North West", "North East", "Yorkshire & Humber", "Wales",
  "Scotland", "Northern Ireland", "International",
];

const trainingStages = [
  "Medical Student", "Foundation Year", "Core Surgical Training", "ST3", "ST4", "ST5", "ST6", "ST7", "ST8",
  "Post-CCT Fellow", "SAS Doctor", "Consultant", "Other",
];

const subspecialtyOptions = [
  "Cancer", "Rectal Cancer", "IBD", "Pelvic Floor", "Robotic", "Laparoscopic",
  "TAMIS", "Proctology", "Fistula", "Emergency", "Endoscopy",
];

const MemberProfile = () => {
  const [directoryVisible, setDirectoryVisible] = useState(mockUser.directorySettings.visible);
  const [settings, setSettings] = useState(mockUser.directorySettings);
  const [notifications, setNotifications] = useState(mockUser.notifications);
  const [selectedSubspecialties, setSelectedSubspecialties] = useState<string[]>(mockUser.subspecialties);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleSubspecialty = (s: string) => {
    setSelectedSubspecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and privacy settings</p>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="privacy">Privacy Settings</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal" className="space-y-6 mt-6">
          {/* Profile Photo */}
          <Card className="border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-navy flex items-center justify-center text-navy-foreground text-xl font-bold">
                    {mockUser.firstName[0]}{mockUser.lastName[0]}
                  </div>
                  <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                    <Camera size={14} />
                  </button>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{mockUser.firstName} {mockUser.lastName}</p>
                  <p className="text-sm text-muted-foreground">{mockUser.email}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input defaultValue={mockUser.firstName} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input defaultValue={mockUser.lastName} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2">
                    <Input defaultValue={mockUser.email} disabled className="flex-1" />
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600 text-[10px] shrink-0">Verified</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hospital / Place of Work</Label>
                  <Input defaultValue={mockUser.hospital} />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <select className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm" defaultValue={mockUser.region}>
                    {regions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Training Stage</Label>
                  <select className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm" defaultValue={mockUser.trainingStage}>
                    {trainingStages.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Subspecialty Interests */}
              <div className="mt-4 space-y-2">
                <Label>Subspecialty Interests</Label>
                <div className="flex gap-2 flex-wrap">
                  {subspecialtyOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSubspecialty(s)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        selectedSubspecialties.includes(s)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Twitter / X</Label>
                  <Input defaultValue={mockUser.twitter} placeholder="@username" />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input defaultValue={mockUser.linkedin} placeholder="https://linkedin.com/in/..." />
                </div>
              </div>

              <Separator className="my-4" />

              {/* ACPGBI */}
              <div className="space-y-2">
                <Label>ACPGBI Membership Number</Label>
                <div className="flex items-center gap-3">
                  <Input defaultValue={mockUser.acpgbiNumber} className="max-w-xs" />
                  <Badge className="bg-emerald-600 text-emerald-50 text-[10px]">Active ACPGBI Member</Badge>
                </div>
              </div>

              <Button variant="default" size="sm" className="mt-4">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Settings */}
        <TabsContent value="privacy" className="space-y-6 mt-6">
          <Card className="border">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={18} className="text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Directory Privacy</h2>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Show me in the members directory</p>
                  <p className="text-xs text-muted-foreground">Other members can find and connect with you</p>
                </div>
                <Switch checked={directoryVisible} onCheckedChange={setDirectoryVisible} />
              </div>
              {directoryVisible && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {[
                      { key: "showEmail", label: "Show email address", desc: "Other members can see your email" },
                      { key: "showHospital", label: "Show hospital", desc: "Display your hospital in your directory listing" },
                      { key: "showRegion", label: "Show region", desc: "Display your region" },
                      { key: "showTrainingStage", label: "Show training stage", desc: "Display your current training level" },
                      { key: "showSubspecialties", label: "Show subspecialty interests", desc: "Display your areas of interest" },
                      { key: "showSocial", label: "Show social links", desc: "Display your Twitter/X and LinkedIn" },
                    ].map((toggle) => (
                      <div key={toggle.key} className="flex items-center justify-between">
                        <div>
                          <Label className="font-normal">{toggle.label}</Label>
                          <p className="text-[11px] text-muted-foreground">{toggle.desc}</p>
                        </div>
                        <Switch
                          checked={(settings as any)[toggle.key]}
                          onCheckedChange={(checked) => setSettings({ ...settings, [toggle.key]: checked })}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button variant="default" size="sm" className="mt-2">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account */}
        <TabsContent value="account" className="space-y-6 mt-6">
          {/* Membership Tier */}
          <Card className="border">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">Membership</h2>
              <div className="flex items-center gap-3">
                <Badge className="bg-navy text-navy-foreground">Member</Badge>
                <p className="text-sm text-muted-foreground">Full access to all features and content</p>
              </div>
            </CardContent>
          </Card>

          {/* Password */}
          <Card className="border">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Security</h2>
              <Button variant="outline" size="sm">Change Password</Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Email Notifications</h2>
              </div>
              {[
                { key: "newEvents", label: "New events announced", desc: "Get notified about upcoming events and courses" },
                { key: "newsletter", label: "Weekly newsletter", desc: "Receive our weekly digest of news and updates" },
                { key: "questionBank", label: "Question bank updates", desc: "New questions and features added to the question bank" },
                { key: "fellowships", label: "Fellowship opportunities", desc: "New fellowship positions and application deadlines" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={(notifications as any)[item.key]}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Delete Account */}
          <Card className="border border-destructive/20">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Danger Zone</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} className="mr-2" /> Delete Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" /> Delete Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete your account? This will remove all your data, progress, and membership. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive">Delete My Account</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberProfile;
