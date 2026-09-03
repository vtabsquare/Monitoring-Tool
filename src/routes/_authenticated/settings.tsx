import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Settings, Users, FileBarChart, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

const tabs = [
  { name: "General", path: "/settings", icon: Settings },
  { name: "Users", path: "/settings/users", icon: Users },
  { name: "Reports", path: "/settings/reports", icon: FileBarChart },
  { name: "Audit Logs", path: "/settings/audit-logs", icon: ScrollText },
];

function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            // General settings tab should only match exactly "/settings" or "/settings/"
            const isActive =
              tab.path === "/settings"
                ? location.pathname === "/settings" || location.pathname === "/settings/"
                : location.pathname.startsWith(tab.path);
                
            return (
              <Link
                key={tab.name}
                to={tab.path}
                className={cn(
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                  "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2 transition-colors"
                )}
              >
                <tab.icon className="size-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-2">
        <Outlet />
      </div>
    </div>
  );
}
