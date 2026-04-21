import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SignInButton } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { isDeveloper } from "@/lib/authUtils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Sparkles,
  History,
  LineChart,
  Briefcase,
  Settings2,
  Calculator,
  Zap,
  Star,
  Bell,
  Newspaper,
  Image,
  Crown,
  User,
  LogIn,
  Home,
  Filter,
  Flame,
  Waves,
  CalendarDays,
  Settings,
  Lock,
} from "lucide-react";

interface User {
  id: string;
  username: string;
  profileImage?: string;
  isPremium?: boolean;
}

type UserRole = "free" | "pro" | "premium";

type NavItem = {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  badgeColor?: string;
  requiredRole?: UserRole;
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

function hasAccess(userRole: UserRole, requiredRole?: UserRole): boolean {
  if (!requiredRole) return true;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

const mainNavItems: NavItem[] = [
  { path: "/app/home", icon: Home, label: "Home" },
  { path: "/app/live", icon: Radio, label: "Live Signals", badge: "LIVE", badgeColor: "bg-muted text-red-400" },
  { path: "/app/generator", icon: Sparkles, label: "Signal Generator" },
  { path: "/app/history", icon: History, label: "Signal History" },
];

const aiToolsNavItems: NavItem[] = [
  { path: "/app/screener", icon: Filter, label: "Options Screener", badge: "NEW", badgeColor: "bg-muted", requiredRole: "pro" },
  { path: "/app/0dte", icon: Flame, label: "0DTE Hub", badge: "HOT", badgeColor: "bg-muted", requiredRole: "pro" },
  { path: "/app/whales", icon: Waves, label: "Whale Tracker", badge: "SOON", badgeColor: "bg-muted", requiredRole: "premium" },
  { path: "/app/earnings", icon: CalendarDays, label: "Earnings Plays", badge: "SOON", badgeColor: "bg-muted", requiredRole: "premium" },
  { path: "/app/chart-analysis", icon: Image, label: "Chart Analysis" },
];

const portfolioNavItems: NavItem[] = [
  { path: "/app/charts", icon: LineChart, label: "Market Charts" },
  { path: "/app/portfolio", icon: Briefcase, label: "Portfolio" },
  { path: "/app/watchlist", icon: Star, label: "Watchlist" },
  { path: "/app/alerts", icon: Bell, label: "Price Alerts", requiredRole: "pro" },
];

const toolsNavItems: NavItem[] = [
  { path: "/app/calculator", icon: Calculator, label: "Options Calculator" },
  { path: "/app/news", icon: Newspaper, label: "Market News" },
  { path: "/app/strategies", icon: Settings2, label: "Strategies", requiredRole: "premium" },
  { path: "/app/settings", icon: Settings, label: "Account Settings" },
];

type AccountSettings = {
  role: UserRole;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user: authUser, isAuthenticated } = useAuth();
  
  const { data: user } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });
  
  const { data: accountSettings } = useQuery<AccountSettings>({
    queryKey: ["/api/account/settings"],
    enabled: isAuthenticated && !isDeveloper(authUser?.id),
  });
  
  const userRole: UserRole = isDeveloper(authUser?.id) ? "premium" : (accountSettings?.role ?? "free");

  const isActive = (path: string) => {
    if (path === "/app/home") return location === "/app" || location === "/app/home";
    if (path === "/app/generator") return location === "/app/generator";
    return location === path || location.startsWith(path + "/");
  };
  
  const renderNavItem = (item: NavItem) => {
    const { path, icon: Icon, label, badge, badgeColor, requiredRole } = item;
    const canAccess = hasAccess(userRole, requiredRole);
    const tierLabel = requiredRole === "premium" ? "PREMIUM" : requiredRole === "pro" ? "PRO" : null;
    
    if (!canAccess) {
      return (
        <SidebarMenuItem key={path}>
          <SidebarMenuButton
            className="text-muted-foreground cursor-not-allowed opacity-60"
            data-testid={`sidebar-link-${label.toLowerCase().replace(/\s+/g, '-')}-locked`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <SidebarMenuBadge>
              <Badge variant="outline" className="border-border text-amber-400 text-[9px] px-1.5 py-0 gap-0.5">
                <Lock className="h-2.5 w-2.5" />
                {tierLabel}
              </Badge>
            </SidebarMenuBadge>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }
    
    return (
      <SidebarMenuItem key={path}>
        <SidebarMenuButton
          asChild
          isActive={isActive(path)}
          className={`${
            isActive(path)
              ? "bg-accent text-accent-foreground border-l-2 border-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          data-testid={`sidebar-link-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Link href={path}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {badge && (
              <SidebarMenuBadge>
                <Badge variant="secondary" className={`${badgeColor || 'bg-muted'} text-foreground text-[10px] px-1.5 py-0`}>
                  {badge}
                </Badge>
              </SidebarMenuBadge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="p-2 bg-muted rounded-lg group-hover:bg-accent transition-colors">
              <Zap className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                Iron<span className="text-primary">Strike</span>
              </span>
              <span className="text-xs text-muted-foreground">Options Trading AI</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            Trading
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            AI Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiToolsNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            Market & Portfolio
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portfolioNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <Link href="/app/settings">
              <Avatar className="h-9 w-9 border border-border cursor-pointer hover:border-foreground transition-colors">
                <AvatarImage src={user.profileImage} alt={user.username} />
                <AvatarFallback className="bg-muted text-foreground">
                  {user.username?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  {user.username}
                </span>
                {user.isPremium && (
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {user.isPremium ? "Premium Member" : "Free Account"}
              </span>
            </div>
            <Link href="/app/settings">
              <div className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer" data-testid="button-settings">
                <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </div>
            </Link>
          </div>
        ) : (
          <SignInButton mode="redirect" forceRedirectUrl="/app">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted hover:bg-accent transition-colors cursor-pointer">
              <div className="p-1.5 bg-background rounded-md">
                <LogIn className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Sign In</span>
                <span className="text-xs text-muted-foreground">Access all features</span>
              </div>
            </div>
          </SignInButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
