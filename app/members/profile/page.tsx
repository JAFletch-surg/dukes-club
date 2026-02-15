'use client'
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, Shield, Trash2, Bell, AlertTriangle, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const regions = [
  "Mersey", "Wessex", "North East Thames", "North West", "Yorkshire",
  "South West", "South Wales", "Scotland", "Republic of Ireland",
  "East Anglia", "SE Thames", "Oxford", "Northern", "North West Thames",
  "West Midlands", "North Wales", "East Midlands", "Northern Ireland",
];

const trainingStages = [
  "FY1", "FY2", "CT1", "CT2", "ST3", "ST4", "ST5", "ST6", "ST7", "ST8",
  "Post-CCT", "Consultant", "SAS", "Academic", "Other",
];

const subspecialtyOptions = [
  "Cancer", "Rectal Cancer", "IBD", "Pelvic Floor", "Robotic", "Laparoscopic",
  "TAMIS", "Proctology", "Fistula", "Emergency", "Endoscopy",
];

const MemberProfile = () => {
  const { profile, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [hospital, setHospital] = useState('');
  const [region, setRegion] = useState('');
  const [trainingStage, setTrainingStage] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [acpgbiNumber, setAcpgbiNumber] = useState('');
  const [subspecialties, setSubspecialties] = useState<string[]>([]);
  const [directorySettings, setDirectorySettings] = useState({
    visible: false,
    show_email: false,
    show_hospital: true,
    show_region: true,
    show_training_stage: true,
    show_subspecialty_interests: true,
    show_social_links: false,
  });

  // Load profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setHospital((profile as any).hospital || '');
      setRegion((profile as any).region || '');
      setTrainingStage((profile as any).training_stage || '');
      setTwitter((profile as any).social_twitter || '');
      setLinkedin((profile as any).social_linkedin || '');
      setAcpgbiNumber((profile as any).acpgbi_number || '');
      setSubspecialties((profile as any).subspecialty_interests || []);
      if ((profile as any).directory_settings) {
        setDirectorySettings((profile as any).directory_settings);
      }
    }
  }, [profile]);

  const toggleSubspecialty = (s: string) => {
    setSubspecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    const nameParts = fullName.trim().split(' ');

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        hospital,
        region: region || null,
        training_stage: trainingStage || null,
        social_twitter: twitter,
        social_linkedin: linkedin,
        acpgbi_number: acpgbiNumber,
        subspecialty_interests: subspecialties,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleSavePrivacy = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('profiles')
      .update({
        directory_settings: directorySettings,
        is_directory_visible: directorySettings.visible,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleChangePassword = async () => {
    if (!profile?.email) return;
    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    alert('Password reset link sent to your email.');
  };

  const initials = fullName.split(' ').map((n: string) => n[0]).join('') || '?';

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <Card className="border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-navy flex items-center justify-center text-navy-foreground text-xl font-bold">
                    {initials}
                  </div>
                  <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                    <Camera size={14} />
                  </button>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{fullName}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2">
                    <Input value={profile.email || ''} disabled className="flex-1" />
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600 text-[10px] shrink-0">Verified</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hospital / Place of Work</Label>
                  <Input value={hospital} onChange={(e) => setHospital(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <select
                    className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="">Select region...</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Training Stage</Label>
                  <select
                    className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                    value={trainingStage}
                    onChange={(e) => setTrainingStage(e.target.value)}
                  >
                    <option value="">Select stage...</option>
                    {trainingStages.map((s) => <option key={s} value={s}>{s}</option>)}
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
                        subspecialties.includes(s)
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
                  <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@username" />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
              </div>

              <Separator className="my-4" />

              {/* ACPGBI */}
              <div className="space-y-2">
                <Label>ACPGBI Membership Number</Label>
                <div className="flex items-center gap-3">
                  <Input value={acpgbiNumber} onChange={(e) => setAcpgbiNumber(e.target.value)} className="max-w-xs" />
                  {acpgbiNumber && (
                    <Badge className="bg-emerald-600 text-emerald-50 text-[10px]">ACPGBI Member</Badge>
                  )}
                </div>
              </div>

              <Button variant="default" size="sm" className="mt-4" onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <><Loader2 size={14} className="mr-2 animate-spin" /> Saving...</>
                ) : saved ? (
                  <><Check size={14} className="mr-2" /> Saved</>
                ) : (
                  'Save Changes'
                )}
              </Button>
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
                <Switch
                  checked={directorySettings.visible}
                  onCheckedChange={(checked) => setDirectorySettings({ ...directorySettings, visible: checked })}
                />
              </div>
              {directorySettings.visible && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {[
                      { key: "show_email", label: "Show email address", desc: "Other members can see your email" },
                      { key: "show_hospital", label: "Show hospital", desc: "Display your hospital in your directory listing" },
                      { key: "show_region", label: "Show region", desc: "Display your region" },
                      { key: "show_training_stage", label: "Show training stage", desc: "Display your current training level" },
                      { key: "show_subspecialty_interests", label: "Show subspecialty interests", desc: "Display your areas of interest" },
                      { key: "show_social_links", label: "Show social links", desc: "Display your Twitter/X and LinkedIn" },
                    ].map((toggle) => (
                      <div key={toggle.key} className="flex items-center justify-between">
                        <div>
                          <Label className="font-normal">{toggle.label}</Label>
                          <p className="text-[11px] text-muted-foreground">{toggle.desc}</p>
                        </div>
                        <Switch
                          checked={(directorySettings as any)[toggle.key]}
                          onCheckedChange={(checked) => setDirectorySettings({ ...directorySettings, [toggle.key]: checked })}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button variant="default" size="sm" className="mt-2" onClick={handleSavePrivacy} disabled={saving}>
                {saving ? (
                  <><Loader2 size={14} className="mr-2 animate-spin" /> Saving...</>
                ) : saved ? (
                  <><Check size={14} className="mr-2" /> Saved</>
                ) : (
                  'Save Settings'
                )}
              </Button>
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
                <Badge className="bg-navy text-navy-foreground capitalize">{profile.role}</Badge>
                <p className="text-sm text-muted-foreground">
                  {profile.approval_status === 'approved' ? 'Full access to all features and content' : `Status: ${profile.approval_status}`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Password */}
          <Card className="border">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Security</h2>
              <Button variant="outline" size="sm" onClick={handleChangePassword}>
                Change Password
              </Button>
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