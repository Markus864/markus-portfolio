import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, MessageCircle, Settings as SettingsIcon, ShieldCheck, CreditCard, Globe, Link, Download, Wrench } from "lucide-react";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { isDeveloper } from "@/lib/authUtils";
import { useAuth } from "@clerk/clerk-react";

type AccountSettingsResponse = {
  email: string | null;
  timezone: string | null;
  telegramChatId: string | null;
  discordUserId: string | null;
  discordWebhookUrl: string | null;
  defaultNotifyEmail: boolean;
  defaultNotifyTelegram: boolean;
  defaultNotifyDiscord: boolean;
  role: "free" | "pro" | "premium" | string;
  firstName: string | null;
  lastName: string | null;
};

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "UTC", label: "UTC" },
];

export default function AccountSettings() {
  const { toast } = useToast();
  const { userId } = useAuth();
  const showDevTools = isDeveloper(userId);
  const [exportingCodebase, setExportingCodebase] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [role, setRole] = useState<AccountSettingsResponse["role"]>("free");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [discordLinkedFromBot, setDiscordLinkedFromBot] = useState(false);

  const [defaultNotifyEmail, setDefaultNotifyEmail] = useState(true);
  const [defaultNotifyTelegram, setDefaultNotifyTelegram] = useState(false);
  const [defaultNotifyDiscord, setDefaultNotifyDiscord] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/account/settings");
        const data: AccountSettingsResponse = await res.json();

        setEmail(data.email ?? "");
        setTimezone(data.timezone ?? "America/New_York");
        setTelegramChatId(data.telegramChatId ?? "");
        setDiscordUserId(data.discordUserId ?? "");
        setDiscordWebhookUrl(data.discordWebhookUrl ?? "");
        setRole(data.role ?? "free");
        setFirstName(data.firstName ?? "");
        setLastName(data.lastName ?? "");
        setDefaultNotifyEmail(data.defaultNotifyEmail ?? true);
        setDefaultNotifyTelegram(data.defaultNotifyTelegram ?? false);
        setDefaultNotifyDiscord(data.defaultNotifyDiscord ?? false);
        
        // Check URL params for Discord linking from bot
        // Supports both 'discordId' (new) and 'discord_user_id' (legacy) for backwards compatibility
        const urlParams = new URLSearchParams(window.location.search);
        const discordIdFromUrl = urlParams.get("discordId") || urlParams.get("discord_user_id");
        
        if (discordIdFromUrl && !data.discordUserId) {
          setDiscordUserId(discordIdFromUrl);
          setDiscordLinkedFromBot(true);
          setDefaultNotifyDiscord(true);
          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
          
          // Show confirmation prompt - user must explicitly click Save to complete linking
          // This prevents CSRF-style attacks where malicious links could bind arbitrary Discord IDs
          toast({
            title: "Discord ID detected!",
            description: "Click 'Save Settings' below to link your Discord account and receive alerts.",
            duration: 10000,
          });
        }
        
        // Also check for Telegram linking from bot
        const telegramIdFromUrl = urlParams.get("telegram_chat_id");
        if (telegramIdFromUrl && !data.telegramChatId) {
          setTelegramChatId(telegramIdFromUrl);
          setDefaultNotifyTelegram(true);
          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Unable to load settings",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  async function handleSave() {
    try {
      setSaving(true);
      const res = await apiRequest("PUT", "/api/account/settings", {
        email: email.trim(),
        timezone,
        telegramChatId: telegramChatId.trim(),
        discordUserId: discordUserId.trim(),
        discordWebhookUrl: discordWebhookUrl.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        defaultNotifyEmail,
        defaultNotifyTelegram,
        defaultNotifyDiscord,
      });
      setDiscordLinkedFromBot(false);
      await res.json();

      toast({
        title: "Settings saved",
        description: "Your account preferences have been updated.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error saving settings",
        description: err?.message ?? "Something went wrong while saving.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleManageSubscription() {
    if (role === "free") {
      window.location.href = "/pricing";
      return;
    }
    
    try {
      setManagingSubscription(true);
      const res = await apiRequest("POST", "/api/billing/portal");
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        window.location.href = "/pricing";
      }
    } catch (err: any) {
      toast({
        title: "Unable to open billing portal",
        description: "Redirecting to pricing page instead.",
        variant: "destructive",
      });
      window.location.href = "/pricing";
    } finally {
      setManagingSubscription(false);
    }
  }

  async function handleExportCodebase() {
    try {
      setExportingCodebase(true);
      const response = await fetch("/api/export/codebase-zip", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ironstrike-full-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export complete",
        description: "Full project zip has been downloaded.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Export failed",
        description: "Unable to generate project zip.",
        variant: "destructive",
      });
    } finally {
      setExportingCodebase(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading account settings…</p>
      </div>
    );
  }

  const roleLabel =
    role === "premium" ? "Premium" : role === "pro" ? "Pro" : "Free";

  const roleVariant =
    role === "premium" ? "default" : role === "pro" ? "secondary" : "outline";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 lg:px-0 py-10 space-y-8">
        {/* Page header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SettingsIcon className="h-4 w-4 text-foreground" />
              <span>Account</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              Account Settings
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Manage your profile, alert preferences, and subscription for Iron Strike Trading.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Current Plan
              </span>
            </div>
            <Badge variant={roleVariant} className="text-xs">
              {roleLabel}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              type="button"
              onClick={handleManageSubscription}
              disabled={managingSubscription}
              data-testid="button-manage-subscription"
            >
              <CreditCard className="h-3 w-3 mr-2" />
              {managingSubscription ? "Loading..." : (role === "free" ? "Upgrade plan" : "Manage subscription")}
            </Button>
          </div>
        </header>

        {/* Onboarding checklist */}
        <OnboardingChecklist />

        {/* Top grid: profile + plan summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Profile</span>
                <Badge variant={roleVariant} className="text-[10px] uppercase">
                  {roleLabel}
                </Badge>
              </CardTitle>
              <CardDescription>
                Your account details are used for security, billing, and communication.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="firstName"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    First Name
                  </label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-background"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="lastName"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Last Name
                  </label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-background"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  This email will be used for account recovery and optional alert delivery.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label
                  htmlFor="timezone"
                  className="text-sm font-medium text-muted-foreground flex items-center gap-2"
                >
                  <Globe className="h-4 w-4 text-foreground" />
                  Timezone
                </label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger 
                    className="bg-background"
                    data-testid="select-timezone"
                  >
                    <SelectValue placeholder="Select your timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem 
                        key={tz.value} 
                        value={tz.value}
                        data-testid={`option-timezone-${tz.value.replace(/\//g, '-').toLowerCase()}`}
                      >
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  All alert times and market data will be displayed in this timezone.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label
                  htmlFor="telegramChatId"
                  className="text-sm font-medium text-muted-foreground flex items-center gap-2"
                >
                  <Send className="h-4 w-4 text-sky-400" />
                  Telegram Chat ID
                </label>
                <Input
                  id="telegramChatId"
                  type="text"
                  placeholder="123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="bg-background"
                  data-testid="input-telegram-chat-id"
                />
                <p className="text-xs text-muted-foreground">
                  Your Telegram Chat ID for receiving alerts. Message our bot to get your ID.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="discordUserId"
                  className="text-sm font-medium text-muted-foreground flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4 text-indigo-400" />
                  Discord DM Alerts
                  {discordUserId && (
                    <Badge variant="secondary" className="ml-2 text-green-500 text-[10px]">
                      Linked
                    </Badge>
                  )}
                  {discordLinkedFromBot && (
                    <Badge variant="secondary" className="ml-1 text-green-500 text-[10px]">
                      Just Connected!
                    </Badge>
                  )}
                </label>
                {discordUserId ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id="discordUserId"
                      type="text"
                      value={discordUserId}
                      readOnly
                      className="bg-background/50 text-muted-foreground font-mono"
                      data-testid="input-discord-user-id"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          await apiRequest("PUT", "/api/account/settings", {
                            email: email.trim(),
                            timezone,
                            telegramChatId: telegramChatId.trim(),
                            discordUserId: "",
                            discordWebhookUrl: discordWebhookUrl.trim(),
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                            defaultNotifyEmail,
                            defaultNotifyTelegram,
                            defaultNotifyDiscord: false,
                          });
                          setDiscordUserId("");
                          setDefaultNotifyDiscord(false);
                          toast({
                            title: "Discord unlinked",
                            description: "You will no longer receive DM alerts.",
                          });
                        } catch (err: any) {
                          toast({
                            title: "Error unlinking Discord",
                            description: err?.message ?? "Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      data-testid="button-unlink-discord"
                    >
                      {saving ? "..." : "Unlink"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-sm text-indigo-300 mb-2">
                      Link your Discord to receive price alerts via DM
                    </p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Message our Discord bot or use it in any server</li>
                      <li>Run the <code className="bg-background/50 px-1 rounded">/connect</code> command</li>
                      <li>Click the link to complete setup</li>
                    </ol>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {discordUserId 
                    ? "You'll receive price alerts directly via Discord DM." 
                    : "Use /connect in Discord to link your account for personalized DM alerts."}
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="discordWebhookUrl"
                  className="text-sm font-medium text-muted-foreground flex items-center gap-2"
                >
                  <Link className="h-4 w-4 text-indigo-400/60" />
                  Discord Webhook (Optional)
                </label>
                <Input
                  id="discordWebhookUrl"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  className="bg-background"
                  data-testid="input-discord-webhook"
                />
                <p className="text-xs text-muted-foreground">
                  Alternatively, use a webhook to post alerts to a Discord channel.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Plan overview card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-foreground" />
                <span>Plan Overview</span>
              </CardTitle>
              <CardDescription>
                See what is included with your current plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                Priority access to new AI tools
              </p>
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                Multi-channel price alerts
              </p>
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                Secure Stripe billing and account protection
              </p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Upgrade to Pro or Premium on the pricing page to unlock more tools and higher alert limits.
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Alert channel preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Default Alert Channels</CardTitle>
            <CardDescription>
              Choose how you want to be notified when creating new price alerts. You can override these per alert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground">Email</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-md">
                  Receive alert notifications directly in your inbox using the email address above.
                </p>
              </div>
              <Switch
                checked={defaultNotifyEmail}
                onCheckedChange={setDefaultNotifyEmail}
                className="mt-1"
                data-testid="switch-notify-email"
              />
            </div>

            <Separator />

            {/* Telegram */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-sky-400" />
                  <span className="text-sm font-medium text-foreground">Telegram</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-md">
                  Get instant push-style alerts through your Iron Strike Telegram bot.
                </p>
              </div>
              <Switch
                checked={defaultNotifyTelegram}
                onCheckedChange={setDefaultNotifyTelegram}
                className="mt-1"
                data-testid="switch-notify-telegram"
              />
            </div>

            <Separator />

            {/* Discord */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-medium text-foreground">Discord</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-md">
                  Send alerts into a dedicated channel in your Iron Strike Discord server.
                </p>
              </div>
              <Switch
                checked={defaultNotifyDiscord}
                onCheckedChange={setDefaultNotifyDiscord}
                className="mt-1"
                data-testid="switch-notify-discord"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="min-w-[150px]"
              data-testid="button-save-settings"
            >
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>

        {/* Developer Tools - Only visible to developers */}
        {showDevTools && (
          <Card className="border-amber-500/30 bg-card/50 backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-lg text-foreground">Developer Tools</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Advanced tools for development and debugging. Only visible to developers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-foreground">Download Project ZIP</span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Download the complete project as a ZIP file including everything:
                    source code, node_modules, .git, configs, migrations, and all assets.
                  </p>
                </div>
                <Button
                  onClick={handleExportCodebase}
                  disabled={exportingCodebase}
                  variant="outline"
                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  data-testid="button-export-codebase"
                >
                  {exportingCodebase ? "Creating ZIP…" : "Download ZIP"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
