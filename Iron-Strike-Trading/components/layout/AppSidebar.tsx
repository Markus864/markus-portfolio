import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";

import {
  Bell,
  Compass,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Settings,
  Sparkles,
  TrendingUp,
  CreditCard,
  Zap,
  Radio,
  History,
  BarChart3,
  Image,
  PieChart,
  Calculator,
  BookOpen,
  Newspaper,
  Anchor,
  Menu,
  Target,
  Scale,
  Users,
  Layers,
} from "lucide-react";

type AccountSettingsResponse = {
  role: "free" | "pro" | "premium" | string;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  section: "main" | "tools" | "account";
  proOnly?: boolean;
  premiumOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  // MAIN
  {
    label: "Dashboard",
    href: "/app",
    icon: LayoutDashboard,
    section: "main",
  },
  {
    label: "Signal Generator",
    href: "/app/generator",
    icon: Sparkles,
    section: "main",
  },
  {
    label: "Live Signals",
    href: "/app/live",
    icon: Radio,
    section: "main",
  },
  {
    label: "Signal History",
    href: "/app/history",
    icon: History,
    section: "main",
  },
  {
    label: "Control Center",
    href: "/app/control-center",
    icon: Compass,
    section: "main",
  },
  {
    label: "Watchlist",
    href: "/app/watchlist",
    icon: ListChecks,
    section: "main",
  },
  {
    label: "Alerts",
    href: "/app/alerts",
    icon: Bell,
    section: "main",
  },

  // TOOLS
  {
    label: "Options Screener",
    href: "/app/screener",
    icon: TrendingUp,
    section: "tools",
    proOnly: true,
  },
  {
    label: "0DTE Hub",
    href: "/app/0dte",
    icon: Zap,
    section: "tools",
    proOnly: true,
  },
  {
    label: "Earnings Plays",
    href: "/app/earnings",
    icon: LineChart,
    section: "tools",
    proOnly: true,
  },
  {
    label: "Whale Tracker",
    href: "/app/whales",
    icon: Anchor,
    section: "tools",
  },
  {
    label: "Charts",
    href: "/app/charts",
    icon: BarChart3,
    section: "tools",
  },
  {
    label: "Chart Analysis",
    href: "/app/chart-analysis",
    icon: Image,
    section: "tools",
  },
  {
    label: "Portfolio Analytics",
    href: "/app/portfolio",
    icon: PieChart,
    section: "tools",
  },
  {
    label: "Performance KPIs",
    href: "/app/analytics-kpis",
    icon: Target,
    section: "tools",
  },
  {
    label: "Strategy Performance",
    href: "/app/strategy-performance",
    icon: Layers,
    section: "tools",
    proOnly: true,
  },
  {
    label: "Confidence Calibration",
    href: "/app/confidence-calibration",
    icon: Scale,
    section: "tools",
    proOnly: true,
  },
  {
    label: "You vs AI",
    href: "/app/user-vs-ai",
    icon: Users,
    section: "tools",
    proOnly: true,
  },
  {
    label: "Options Calculator",
    href: "/app/calculator",
    icon: Calculator,
    section: "tools",
  },
  {
    label: "Strategies",
    href: "/app/strategies",
    icon: BookOpen,
    section: "tools",
  },
  {
    label: "Market News",
    href: "/app/news",
    icon: Newspaper,
    section: "tools",
  },

  // ACCOUNT
  {
    label: "Account Settings",
    href: "/app/settings",
    icon: Settings,
    section: "account",
  },
  {
    label: "Pricing & Plans",
    href: "/pricing",
    icon: CreditCard,
    section: "account",
  },
];

function SidebarContent({ 
  role, 
  roleLabel, 
  roleVariant, 
  location, 
  onNavClick 
}: { 
  role: string; 
  roleLabel: string; 
  roleVariant: "default" | "secondary" | "outline"; 
  location: string;
  onNavClick?: () => void;
}) {
  const mainNav = NAV_ITEMS.filter((item) => item.section === "main");
  const toolsNav = NAV_ITEMS.filter((item) => item.section === "tools");
  const accountNav = NAV_ITEMS.filter((item) => item.section === "account");

  return (
    <div className="flex h-full flex-col bg-card text-foreground">
      {/* Brand / top */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold tracking-wide">
                Iron Strike Trading
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              AI trading assistant for options traders.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={roleVariant} className="text-[10px]">
              {roleLabel} plan
            </Badge>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2"
          >
            <Link href="/pricing" onClick={onNavClick}>
              <span className="flex items-center gap-1">
                <Compass className="h-3 w-3" />
                Plans
              </span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Main */}
        <div className="space-y-1">
          <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            Main
          </p>
          {mainNav.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              location={location}
              role={role}
              onNavClick={onNavClick}
            />
          ))}
        </div>

        {/* Tools */}
        <div className="space-y-1">
          <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            Tools
          </p>
          {toolsNav.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              location={location}
              role={role}
              onNavClick={onNavClick}
            />
          ))}
          <p className="px-2 pt-1 text-[10px] text-muted-foreground/80">
            Some tools require Pro or Premium. Locked items will prompt you to
            upgrade.
          </p>
        </div>

        {/* Account */}
        <div className="space-y-1">
          <Separator className="bg-border my-1" />
          <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            Account
          </p>
          {accountNav.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              location={location}
              role={role}
              onNavClick={onNavClick}
            />
          ))}
        </div>
      </nav>

      {/* Bottom footer */}
      <div className="mt-auto border-t border-border px-3 py-3 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-foreground" />
          <span>Session</span>
        </span>
        <span className="text-foreground">Iron Strike v1.0</span>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Get account / role for plan badge & gating hints
  const accountQuery = useQuery({
    queryKey: ["sidebar-account"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/settings");
      if (!res.ok) throw new Error("Failed to load account settings");
      return (await res.json()) as AccountSettingsResponse;
    },
  });

  const role = accountQuery.data?.role ?? "free";

  const roleLabel = useMemo(() => {
    switch (role) {
      case "premium":
        return "Premium";
      case "pro":
        return "Pro";
      default:
        return "Free";
    }
  }, [role]);

  const roleVariant = useMemo<"default" | "secondary" | "outline">(() => {
    switch (role) {
      case "premium":
        return "default";
      case "pro":
        return "secondary";
      default:
        return "outline";
    }
  }, [role]);

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden lg:flex h-full w-64 flex-col border-r border-border shrink-0">
        <SidebarContent 
          role={role} 
          roleLabel={roleLabel} 
          roleVariant={roleVariant} 
          location={location} 
        />
      </aside>

      {/* Mobile menu button - shown only on mobile */}
      <div className="lg:hidden fixed top-0 left-0 z-40 p-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button 
              size="icon" 
              variant="outline" 
              className="bg-card border-border"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 border-border">
            <SidebarContent 
              role={role} 
              roleLabel={roleLabel} 
              roleVariant={roleVariant} 
              location={location}
              onNavClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

type NavButtonProps = {
  item: NavItem;
  location: string;
  role: string;
  onNavClick?: () => void;
};

function NavButton({ item, location, role, onNavClick }: NavButtonProps) {
  const Icon = item.icon;

  const isActive = useMemo(() => {
    if (item.href === "/app") {
      return location === "/app";
    }
    return location === item.href || (item.href !== "/pricing" && location.startsWith(item.href + "/"));
  }, [item.href, location]);

  const locked =
    (item.premiumOnly && role !== "premium") ||
    (item.proOnly && !["pro", "premium"].includes(role));

  const baseClasses =
    "w-full justify-start gap-2 px-2 py-2 h-9 text-xs font-medium";

  return (
    <Button
      asChild
      variant={isActive ? "default" : "ghost"}
      className={[
        baseClasses,
        isActive
          ? ""
          : "text-muted-foreground",
        locked ? "opacity-80" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Link href={item.href} onClick={onNavClick}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
          {locked && (
            <Badge
              variant="secondary"
              className="ml-auto text-[9px] uppercase tracking-wide"
            >
              {item.proOnly && !item.premiumOnly ? "Pro" : "Premium"}
            </Badge>
          )}
        </span>
      </Link>
    </Button>
  );
}
