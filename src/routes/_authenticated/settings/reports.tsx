import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getReportsData } from "@/lib/analytics.functions";
import { listUsers } from "@/lib/users.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { User, Clock, FileText, Building2, Laptop, ShieldCheck, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/reports")({
  head: () => ({ meta: [{ title: "Reports — Aetherium" }] }),
  component: ReportsPage,
});

function categoryTone(cat: string) {
  return cat === "productive" ? "success" : cat === "distracted" ? "danger" : "info";
}

function ReportsPage() {
  const fetchReportsData = useServerFn(getReportsData);
  const fetchUsers = useServerFn(listUsers);

  // Defaults: User = All Users ("all"), Period = Last 24 Hours (1)
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [daysRange, setDaysRange] = useState<number>(1);

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const { data: reportData, isLoading: isReportsLoading } = useQuery({
    queryKey: ["reports-data", selectedUserId, daysRange],
    queryFn: () =>
      fetchReportsData({
        data: {
          profile_id: selectedUserId !== "all" ? selectedUserId : undefined,
          days: daysRange,
        },
      }),
  });

  const activeUser = selectedUserId !== "all" ? usersData?.find((u: any) => u.id === selectedUserId) : null;
  const orgName = reportData?.org?.name ?? "Vtab";

  const periodLabel =
    daysRange === 1
      ? "Last 24 Hours"
      : daysRange === 7
        ? "Last 7 Days"
        : daysRange === 14
          ? "Last 14 Days"
          : "Last 30 Days";

  const totals = reportData?.totals ?? {
    productive_seconds: 0,
    distracted_seconds: 0,
    neutral_seconds: 0,
    idle_seconds: 0,
    total_sessions: 0,
  };

  const totalTrackedSec =
    totals.productive_seconds + totals.distracted_seconds + totals.neutral_seconds;
  const focusPercent =
    totalTrackedSec > 0 ? Math.round((totals.productive_seconds / totalTrackedSec) * 100) : 0;

  const generatedTimeStr = new Date().toLocaleString() + " (IST)";

  // Light-Themed Canonical Application PDF Report Generator
  function handleExportPdf() {
    const printWin = window.open("", "_blank", "width=1100,height=900");
    if (!printWin) {
      window.print();
      return;
    }

    const userName = activeUser ? activeUser.full_name : "All Organization Users";
    const userEmail = activeUser ? activeUser.email : `${orgName.toLowerCase()}@org.com`;
    const userDept = activeUser?.departments?.name ?? "General Staff";
    const userRole = activeUser?.job_role ?? "Team Member";

    const topAppsHtml = (reportData?.appUsage ?? []).slice(0, 20).map((app: any) => {
      const isProd = app.category === "productive";
      const isDist = app.category === "distracted";
      const bg = isProd ? "#dcfce7" : isDist ? "#ffe4e6" : "#f1f5f9";
      const text = isProd ? "#15803d" : isDist ? "#be123c" : "#475569";
      const border = isProd ? "#bbf7d0" : isDist ? "#fecdd3" : "#e2e8f0";

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 20px; font-weight: 600; color: #0f172a;">${app.app_name}</td>
          <td style="padding: 12px 20px;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; background-color: ${bg}; color: ${text}; border: 1px solid ${border};">
              ${app.category}
            </span>
          </td>
          <td style="padding: 12px 20px; text-align: right; font-family: monospace; font-size: 12px; color: #0f172a; font-weight: 600;">
            ${(app.total_seconds / 3600).toFixed(1)} hrs (${Math.round(app.total_seconds / 60)} mins)
          </td>
        </tr>
      `;
    }).join("");

    const sessionsHtml = (reportData?.sessions ?? []).slice(0, 60).map((s: any) => {
      const isProd = s.category === "productive";
      const isDist = s.category === "distracted";
      const bg = isProd ? "#dcfce7" : isDist ? "#ffe4e6" : "#f1f5f9";
      const text = isProd ? "#15803d" : isDist ? "#be123c" : "#475569";

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 20px; font-family: monospace; font-size: 11px; color: #64748b;">${new Date(s.started_at).toLocaleString()}</td>
          <td style="padding: 10px 20px; font-weight: 600; color: #0f172a;">
            ${s.profiles?.full_name ?? "User"}
            <div style="font-size: 11px; font-weight: 400; color: #64748b;">${s.devices?.name ?? "Workstation"}</div>
          </td>
          <td style="padding: 10px 20px; font-weight: 600; color: #0f172a;">${s.app_name}</td>
          <td style="padding: 10px 20px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; background-color: ${bg}; color: ${text};">
              ${s.category}
            </span>
          </td>
          <td style="padding: 10px 20px; text-align: right; font-family: monospace; font-size: 11px; color: #475569;">
            ${Math.round(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s
          </td>
        </tr>
      `;
    }).join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Executive_Productivity_Report_${userName.replace(/\s+/g, "_")}.pdf</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              background-color: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 24px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .card {
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 24px;
              margin-bottom: 24px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .header-flex {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .grid-4 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
            }
            .stat-card {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 18px;
            }
            .stat-label {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
            }
            .stat-val {
              font-size: 26px;
              font-weight: 800;
              margin-top: 6px;
            }
            .table-container {
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              overflow: hidden;
              margin-bottom: 24px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .table-header {
              padding: 18px 24px;
              border-bottom: 1px solid #e2e8f0;
              background-color: #f8fafc;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              text-align: left;
            }
            th {
              padding: 12px 20px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #475569;
              background-color: #f1f5f9;
              border-bottom: 1px solid #e2e8f0;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              body {
                background-color: #ffffff !important;
                color: #0f172a !important;
              }
              thead {
                display: table-header-group;
              }
              tr {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          
          <!-- FIRST PAGE EXECUTIVE SUMMARY -->
          <div class="card">
            <div class="header-flex">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 42px; height: 42px; border-radius: 10px; background-color: #eff6ff; border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #2563eb; font-size: 18px;">
                  Æ
                </div>
                <div>
                  <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a;">
                    AETHERIUM <span style="color: #2563eb; font-style: italic; font-weight: 400;">OS</span>
                  </div>
                  <div style="font-size: 13px; color: #64748b; font-weight: 500;">${orgName}</div>
                </div>
              </div>

              <div style="text-align: right;">
                <div style="display: inline-block; padding: 5px 14px; border-radius: 6px; background-color: #eff6ff; border: 1px solid #bfdbfe; font-size: 12px; font-weight: 700; color: #1d4ed8;">
                  Executive Productivity Report
                </div>
                <div style="font-size: 12px; color: #475569; margin-top: 6px;">
                  Reporting Scope: <strong style="color: #0f172a;">${activeUser ? activeUser.full_name : "All Users"}</strong>
                </div>
                <div style="font-size: 12px; color: #475569;">
                  Period: <strong style="color: #0f172a;">${periodLabel}</strong>
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px; font-family: monospace;">
                  Generated: ${generatedTimeStr}
                </div>
              </div>
            </div>

            <!-- TARGET USER METADATA -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
                TARGET USER & PROFILE METADATA
              </div>
              <div class="grid-4">
                <div>
                  <div style="font-size: 11px; color: #64748b;">User Name</div>
                  <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 2px;">${userName}</div>
                </div>
                <div>
                  <div style="font-size: 11px; color: #64748b;">Email Address</div>
                  <div style="font-size: 13px; font-weight: 500; color: #334155; margin-top: 2px;">${userEmail}</div>
                </div>
                <div>
                  <div style="font-size: 11px; color: #64748b;">Department</div>
                  <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px;">${userDept}</div>
                </div>
                <div>
                  <div style="font-size: 11px; color: #64748b;">Job Role</div>
                  <div style="font-size: 13px; font-weight: 500; color: #334155; margin-top: 2px;">${userRole}</div>
                </div>
              </div>
            </div>

            <!-- 4 EXECUTIVE KPI CARDS -->
            <div class="grid-4">
              <div class="stat-card">
                <div class="stat-label">PRODUCTIVE FOCUS</div>
                <div class="stat-val" style="color: #059669;">${(totals.productive_seconds / 3600).toFixed(1)} hrs</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${focusPercent}% focus ratio</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">DISTRACTED TIME</div>
                <div class="stat-val" style="color: #dc2626;">${(totals.distracted_seconds / 3600).toFixed(1)} hrs</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Non-work activity</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">NEUTRAL TIME</div>
                <div class="stat-val" style="color: #2563eb;">${(totals.neutral_seconds / 3600).toFixed(1)} hrs</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Unclassified apps</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">ACTIVITY LOGS</div>
                <div class="stat-val" style="color: #0f172a;">${totals.total_sessions}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Recorded sessions</div>
              </div>
            </div>
          </div>

          <!-- TOP MONITORED APPLICATIONS TABLE -->
          <div class="table-container">
            <div class="table-header">
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">Top Monitored Applications</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Aggregated application usage captured during active shift hours for ${userName}.
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>APPLICATION</th>
                  <th>CLASSIFICATION</th>
                  <th style="text-align: right;">TOTAL DURATION</th>
                </tr>
              </thead>
              <tbody>
                ${topAppsHtml || '<tr><td colspan="3" style="padding: 24px; text-align: center; color: #64748b;">No application activity data found</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- PAGE BREAK FOR DETAILED ACTIVITY TIMELINE LOGS -->
          <div class="table-container page-break">
            <div class="table-header">
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">Activity Timeline Logs</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Application-level activity sessions captured during shift hours.
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>USER / WORKSTATION</th>
                  <th>APPLICATION</th>
                  <th>CLASSIFICATION</th>
                  <th style="text-align: right;">DURATION</th>
                </tr>
              </thead>
              <tbody>
                ${sessionsHtml || '<tr><td colspan="5" style="padding: 24px; text-align: center; color: #64748b;">No activity logs found</td></tr>'}
              </tbody>
            </table>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="print:hidden">
        <PageHeader
          title="Executive & Audit Reports"
          description="Application-level executive productivity reports exportable to PDF."
        />
      </div>

      {/* Filter & Export Control Bar */}
      <Card className="p-4 bg-card/80 border-border/80 backdrop-blur-sm shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* User Selector Dropdown */}
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User:
              </label>
              {isUsersLoading ? (
                <div className="h-8 w-36 animate-pulse rounded bg-muted" />
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Users</option>
                  {usersData?.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Period Selector Dropdown */}
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Period:
              </label>
              <select
                value={daysRange}
                onChange={(e) => setDaysRange(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={1}>Last 24 Hours</option>
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
          >
            <FileText className="size-4" />
            Export Light PDF
          </button>
        </div>
      </Card>

      {/* Screen Preview Report Container */}
      <div id="report-screen-preview" className="space-y-6">
        
        {/* EXECUTIVE HEADER CARD */}
        <Card className="p-6 bg-card border-border border shadow-sm">
          <div className="flex flex-wrap items-start justify-between border-b border-border/80 pb-5 mb-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center font-bold text-primary text-base">
                Æ
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-1.5">
                  AETHERIUM <span className="text-primary font-light italic">OS</span>
                </h1>
                <p className="text-xs text-muted-foreground">{orgName}</p>
              </div>
            </div>

            <div className="text-right text-xs space-y-1">
              <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-1 text-primary font-bold">
                <Building2 className="size-3.5" />
                <span>Executive Productivity Report</span>
              </div>
              <p className="text-muted-foreground pt-1">
                Reporting Scope: <strong className="text-foreground">{activeUser ? activeUser.full_name : "All Users"}</strong>
              </p>
              <p className="text-muted-foreground">
                Period: <strong className="text-foreground">{periodLabel}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Generated: {generatedTimeStr}
              </p>
            </div>
          </div>

          {/* TARGET USER & PROFILE METADATA */}
          <div className="mb-6 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
              TARGET USER & PROFILE METADATA
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">User Name</span>
                <span className="font-bold text-foreground text-sm">
                  {activeUser ? activeUser.full_name : "All Organization Users"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Email Address</span>
                <span className="font-medium text-foreground">
                  {activeUser ? activeUser.email : `${orgName.toLowerCase()}@org.com`}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Department</span>
                <span className="font-semibold text-foreground">
                  {activeUser?.departments?.name ?? "General Staff"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Job Role</span>
                <span className="font-medium text-foreground">
                  {activeUser?.job_role || "Team Member"}
                </span>
              </div>
            </div>
          </div>

          {/* 4 KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border/80 bg-card/60 p-4">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">
                PRODUCTIVE FOCUS
              </span>
              <span className="text-2xl font-extrabold text-success mt-1 block">
                {(totals.productive_seconds / 3600).toFixed(1)} hrs
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                {focusPercent}% focus ratio
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/60 p-4">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">
                DISTRACTED TIME
              </span>
              <span className="text-2xl font-extrabold text-danger mt-1 block">
                {(totals.distracted_seconds / 3600).toFixed(1)} hrs
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                Non-work activity
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/60 p-4">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">
                NEUTRAL TIME
              </span>
              <span className="text-2xl font-extrabold text-info mt-1 block">
                {(totals.neutral_seconds / 3600).toFixed(1)} hrs
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                Unclassified apps
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/60 p-4">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">
                ACTIVITY LOGS
              </span>
              <span className="text-2xl font-extrabold text-foreground mt-1 block">
                {totals.total_sessions}
              </span>
              <span className="text-[11px] text-muted-foreground block mt-1">
                Recorded sessions
              </span>
            </div>
          </div>
        </Card>

        {/* TOP MONITORED APPLICATIONS */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border/80 bg-muted/30">
            <h3 className="text-sm font-bold text-foreground">Top Monitored Applications</h3>
            <p className="text-xs text-muted-foreground">
              Aggregated usage captured during active shift hours for {activeUser ? activeUser.full_name : "All Users"}.
            </p>
          </div>
          {isReportsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading report data…</div>
          ) : !reportData?.appUsage?.length ? (
            <EmptyState title={`No application usage data in ${periodLabel}`} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                  <th className="px-6 py-3">APPLICATION</th>
                  <th className="px-6 py-3">CLASSIFICATION</th>
                  <th className="px-6 py-3 text-right">TOTAL DURATION</th>
                </tr>
              </thead>
              <tbody>
                {reportData.appUsage.slice(0, 15).map((app: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-6 py-3 font-semibold text-foreground">{app.app_name}</td>
                    <td className="px-6 py-3">
                      <Badge tone={categoryTone(app.category)}>{app.category}</Badge>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs font-medium text-foreground">
                      {(app.total_seconds / 3600).toFixed(1)} hrs ({Math.round(app.total_seconds / 60)} mins)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* DETAILED ACTIVITY TIMELINE LOGS */}
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border/80 bg-muted/30">
            <h3 className="text-sm font-bold text-foreground">Activity Timeline Logs</h3>
            <p className="text-xs text-muted-foreground">
              Time-ordered activity sessions captured during shift hours for {activeUser ? activeUser.full_name : "All Users"}.
            </p>
          </div>
          {isReportsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading sessions…</div>
          ) : !reportData?.sessions?.length ? (
            <EmptyState title={`No activity logs in ${periodLabel}`} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                  <th className="px-6 py-3">TIMESTAMP</th>
                  <th className="px-6 py-3">USER / WORKSTATION</th>
                  <th className="px-6 py-3">APPLICATION</th>
                  <th className="px-6 py-3">CLASSIFICATION</th>
                  <th className="px-6 py-3 text-right">DURATION</th>
                </tr>
              </thead>
              <tbody>
                {reportData.sessions.slice(0, 50).map((s: any) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-6 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-medium text-foreground">
                      {s.profiles?.full_name ?? "User"}
                      <p className="text-xs text-muted-foreground">{s.devices?.name ?? "Workstation"}</p>
                    </td>
                    <td className="px-6 py-3 font-semibold text-foreground">{s.app_name}</td>
                    <td className="px-6 py-3">
                      <Badge tone={categoryTone(s.category)}>{s.category}</Badge>
                    </td>
                    <td className="px-6 py-3 text-right text-xs font-mono text-muted-foreground">
                      {Math.round(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
