import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Monitor,
  Activity,
  AppWindow,
  Crosshair,
  Sparkles,
  FileBarChart,
  Building2,
  Settings,
  ScrollText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { group: string; items: { to: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    group: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/users", label: "Users", icon: Users },
      { to: "/devices", label: "Devices", icon: Monitor },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/applications", label: "Applications", icon: AppWindow },
      { to: "/focus", label: "Focus", icon: Crosshair },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { to: "/insights", label: "AI Insights", icon: Sparkles },
      { to: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    group: "Administration",
    items: [
      { to: "/organization", label: "Organization", icon: Building2 },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
    ],
  },
];

export function AppShell({ orgName }: { orgName?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = email ? email.slice(0, 2).toUpperCase() : "··";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed left-0 top-0 z-20 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="border-b border-sidebar-border p-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded bg-primary font-bold text-primary-foreground">
              Æ
            </div>
            <span className="text-lg font-semibold tracking-tight">
              AETHERIUM<span className="italic text-primary">OS</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-widest text-foreground/20">
                {section.group}
              </div>
              {section.items.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-full border border-border bg-muted text-[10px] font-bold text-muted-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{email || "Admin"}</p>
              <p className="truncate text-[10px] text-muted-foreground">{orgName ?? "Organization"}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen p-8">
        <Outlet />
      </main>
    </div>
  );
}
