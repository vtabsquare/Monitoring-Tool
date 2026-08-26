import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aetherium — Employee Productivity Intelligence" },
      {
        name: "description",
        content:
          "Admin-first productivity monitoring: deterministic focus and productivity metrics, device fleet telemetry, and AI-generated organizational insights.",
      },
      { property: "og:title", content: "Aetherium — Employee Productivity Intelligence" },
      {
        property: "og:description",
        content:
          "Admin-first productivity monitoring: deterministic focus and productivity metrics, device fleet telemetry, and AI-generated organizational insights.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
