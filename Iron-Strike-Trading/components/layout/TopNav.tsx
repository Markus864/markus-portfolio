import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SignInButton, SignOutButton } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { isDeveloper } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Radio,
  Sparkles,
  LineChart,
  Bell,
  Wrench,
  Star,
  Filter,
  Briefcase,
  BarChart3,
  Target,
  Users,
  History,
  Brain,
  TrendingUp,
  Settings,
  CreditCard,
  LifeBuoy,
  LogOut,
  LogIn,
  Flame,
  Waves,
  CalendarDays,
  Calculator,
  Newspaper,
  Image,
  Lock,
  Menu,
  X,
  ChevronDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, forwardRef } from "react";

interface User {
  id: string;
  username: string;
  profileImage?: string;
  isPremium?: boolean;
}

type UserRole = "free" | "pro" | "premium";

type AccountSettings = {
  role: UserRole;
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

const ListItem = forwardRef<
  HTMLAnchorElement,
  { className?: string; title: string; children?: React.ReactNode; href: string; icon?: React.ComponentType<{ className?: string }>; badge?: string; locked?: boolean; requiredRole?: string }
>(({ className, title, children, href, icon: Icon, badge, locked, requiredRole, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          ref={ref}
          className={cn(
            "flex items-center gap-3 select-none rounded-md p-3 text-sm leading-none no-underline outline-none transition-colors hover-elevate focus:bg-accent focus:text-accent-foreground",
            locked && "opacity-60",
            className
          )}
          {...props}
        >
          {Icon && (locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Icon className="h-4 w-4 text-muted-foreground" />)}
          <span className="flex-1 truncate">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-[10px] text-red-400">
              {badge}
            </Badge>
          )}
          {locked && requiredRole && (
            <Badge variant="secondary" className="text-[10px]">
              {requiredRole.toUpperCase()}
            </Badge>
          )}
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export function TopNav() {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    if (path === "/app") return location === "/app" || location === "/app/home";
    return location === path || location.startsWith(path + "/");
  };

  const tier1Items = [
    { path: "/app", icon: LayoutDashboard, label: "Dashboard" },
  ];

  const signalsDropdown = {
    label: "Signals",
    icon: Radio,
    items: [
      { path: "/app/live", icon: Radio, label: "Live Signals", badge: "LIVE" },
      { path: "/app/generator", icon: Sparkles, label: "Signal Generator" },
    ],
  };

  const tier2Tools = [
    { path: "/app/watchlist", icon: Star, label: "Watchlist" },
    { path: "/app/screener", icon: Filter, label: "Options Screener", requiredRole: "pro" as UserRole },
    { path: "/app/portfolio", icon: Briefcase, label: "Portfolio & Journal" },
    { path: "/app/strategy-performance", icon: BarChart3, label: "Strategy Performance", requiredRole: "pro" as UserRole },
    { path: "/app/confidence-calibration", icon: Target, label: "Confidence Calibration", requiredRole: "pro" as UserRole },
    { path: "/app/user-vs-ai", icon: Users, label: "User vs AI", requiredRole: "premium" as UserRole },
    { path: "/app/history", icon: History, label: "Signal History" },
    { path: "/app/analytics-kpis", icon: TrendingUp, label: "Analytics KPIs", requiredRole: "pro" as UserRole },
    { path: "/app/0dte", icon: Flame, label: "0DTE Hub", requiredRole: "pro" as UserRole },
    { path: "/app/whales", icon: Waves, label: "Whale Tracker", requiredRole: "premium" as UserRole },
    { path: "/app/earnings", icon: CalendarDays, label: "Earnings Plays", requiredRole: "premium" as UserRole },
    { path: "/app/chart-analysis", icon: Image, label: "Chart Analysis" },
    { path: "/app/calculator", icon: Calculator, label: "Options Calculator" },
    { path: "/app/news", icon: Newspaper, label: "Market News" },
    { path: "/app/strategies", icon: Brain, label: "Strategies", requiredRole: "premium" as UserRole },
  ];

  const tier3Account = [
    { path: "/app/settings", icon: Settings, label: "Account Settings" },
    { path: "/pricing", icon: CreditCard, label: "Plan & Billing" },
    { path: "/app/support-tickets", icon: LifeBuoy, label: "Support" },
  ];

  const initials = user?.username?.slice(0, 2).toUpperCase() || authUser?.email?.slice(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 lg:px-6">
        <Link href="/app" className="mr-6 flex items-center gap-2" data-testid="link-logo">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-sm">
            IS
          </div>
          <span className="hidden font-semibold sm:inline-block text-foreground">Iron Strike</span>
        </Link>

        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList>
            {tier1Items.map((item) => (
              <NavigationMenuItem key={item.path}>
                <NavigationMenuLink asChild>
                  <Link
                    href={item.path}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "gap-2",
                      isActive(item.path) && "bg-muted text-foreground"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}

            <NavigationMenuItem>
              <NavigationMenuTrigger 
                className={cn(
                  "gap-2",
                  (isActive("/app/live") || isActive("/app/generator")) && "bg-muted text-foreground"
                )}
                data-testid="nav-signals-trigger"
              >
                <signalsDropdown.icon className="h-4 w-4" />
                {signalsDropdown.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[280px] gap-1 p-2">
                  {signalsDropdown.items.map((item) => (
                    <ListItem
                      key={item.path}
                      href={item.path}
                      title={item.label}
                      icon={item.icon}
                      badge={item.badge}
                      className={isActive(item.path) ? "bg-muted" : ""}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/app/charts"
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "gap-2",
                    isActive("/app/charts") && "bg-muted text-foreground"
                  )}
                  data-testid="nav-charts"
                >
                  <LineChart className="h-4 w-4" />
                  Charts
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/app/alerts"
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "gap-2",
                    isActive("/app/alerts") && "bg-muted text-foreground"
                  )}
                  data-testid="nav-alerts"
                >
                  <Bell className="h-4 w-4" />
                  Alerts
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger 
                className="gap-2"
                data-testid="nav-tools-trigger"
              >
                <Wrench className="h-4 w-4" />
                Tools
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-1 p-2 md:grid-cols-2">
                  {tier2Tools.map((item) => {
                    const locked = item.requiredRole && !hasAccess(userRole, item.requiredRole);
                    return (
                      <ListItem
                        key={item.path}
                        href={locked ? "/pricing" : item.path}
                        title={item.label}
                        icon={item.icon}
                        locked={locked}
                        requiredRole={item.requiredRole}
                        className={isActive(item.path) ? "bg-muted" : ""}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImage || authUser?.profileImageUrl} alt={user.username} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.username || authUser?.email}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {userRole} Plan
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tier3Account.map((item) => (
                  <DropdownMenuItem 
                    key={item.path} 
                    onClick={() => setLocation(item.path)}
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid={`menu-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <SignOutButton>
                    <button className="flex w-full items-center gap-2 cursor-pointer" data-testid="button-sign-out">
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </SignOutButton>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              {/* Dev login bypass - only in development */}
              {import.meta.env.DEV && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                  onClick={async () => {
                    try {
                      // No credentials sent - server handles auth from its own env vars
                      const res = await fetch('/api/dev/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: '{}'
                      });
                      const data = await res.json();
                      if (data.success) {
                        localStorage.setItem('devAuthToken', data.devToken);
                        window.location.reload();
                      } else {
                        console.error('Dev login failed:', data.error);
                      }
                    } catch (err) {
                      console.error('Dev login error:', err);
                    }
                  }}
                  data-testid="button-dev-login"
                >
                  <LogIn className="h-4 w-4" />
                  Dev Login
                </Button>
              )}
              <SignInButton mode="modal">
                <Button size="sm" className="gap-2" data-testid="button-sign-in">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </SignInButton>
            </div>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="flex flex-col p-4 space-y-2">
            {tier1Items.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md p-3 text-sm hover-elevate",
                  isActive(item.path) && "bg-muted"
                )}
                data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </Link>
            ))}

            <div className="pt-2 border-t border-border">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Signals</p>
              {signalsDropdown.items.map((item) => (
                <Link 
                  key={item.path} 
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md p-3 text-sm hover-elevate",
                    isActive(item.path) && "bg-muted"
                  )}
                  data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="text-[10px] text-red-400">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>

            <Link 
              href="/app/charts" 
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md p-3 text-sm hover-elevate",
                isActive("/app/charts") && "bg-muted"
              )}
              data-testid="mobile-nav-charts"
            >
              <LineChart className="h-4 w-4 text-muted-foreground" />
              Charts
            </Link>

            <Link 
              href="/app/alerts" 
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md p-3 text-sm hover-elevate",
                isActive("/app/alerts") && "bg-muted"
              )}
              data-testid="mobile-nav-alerts"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              Alerts
            </Link>

            <div className="pt-2 border-t border-border">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tools</p>
              {tier2Tools.slice(0, 8).map((item) => {
                const locked = item.requiredRole && !hasAccess(userRole, item.requiredRole);
                return (
                  <Link 
                    key={item.path} 
                    href={locked ? "/pricing" : item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md p-3 text-sm hover-elevate",
                      isActive(item.path) && "bg-muted",
                      locked && "opacity-60"
                    )}
                    data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {locked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1">{item.label}</span>
                    {locked && (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.requiredRole?.toUpperCase()}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>

            {isAuthenticated && (
              <div className="pt-2 border-t border-border">
                <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Account</p>
                {tier3Account.map((item) => (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md p-3 text-sm hover-elevate",
                      isActive(item.path) && "bg-muted"
                    )}
                    data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
