# Flow Focus

Build an AI-powered employee productivity monitoring platform with an ADMIN-FIRST architecture.

CORE CONCEPT:

The admin creates an organization and adds users by email. The admin configures each user's monitoring shift. The user receives an email containing the Windows EXE. The user only needs to install the EXE; the future Electron agent will automatically handle device registration/onboarding. The user should have almost zero UI/interactions. Only admins get the full web dashboard.

ADMIN FLOW:

Create Organization

→ Add User (name, email, department, role)

→ Configure monitoring schedule

→ Send invitation/download email

→ User installs EXE

→ Electron automatically registers device

→ Device receives configuration

→ Monitoring starts only during the configured shift.

MONITORING:

Agent can remain online outside the shift for heartbeat/configuration, but activity monitoring must be OFF outside the configured schedule.

Support per-day schedules:

Mon-Fri 09:00-18:00, Sat/Sun OFF.

Support timezones and future overnight shifts.

ADMIN DASHBOARD:

Create a polished enterprise dashboard with:

- Organization productivity score

- Active users

- Registered/online devices

- Productive time

- Focus score

- Distracted/idle time

- Productivity trends

- User performance

- Application usage

- Activity timeline

- AI insights

- Daily/weekly/monthly reports

PAGES:

Dashboard

Users

Devices

Activity

Applications

Focus

AI Insights

Reports

Organization

Settings

Audit Logs

USER MANAGEMENT:

Admin can:

- Add/edit/disable users

- Configure shifts

- Resend invitations

- View user activity/productivity

- Manage assigned devices

DEVICE MANAGEMENT:

Show device name, user, OS, agent version, online/offline, last heartbeat, last sync, monitoring state.

Allow pause/resume/revoke/force re-registration.

STORAGE:

Use PostgreSQL as the central source of truth.

The future Electron agent will use SQLite locally for offline activity storage and sync it to PostgreSQL through the backend API.

DATA MODELS:

Organization

User

Department

Device

MonitoringSchedule

ActivitySession

DailySummary

AIReport

Invitation

AuditLog

Goal

ACTIVITY:

The future Electron agent will collect active application, process, window title, duration and idle state only during monitoring hours.

Do not design screenshot, keystroke, password or clipboard tracking.

ANALYTICS:

Create deterministic productivity metrics:

- Productive time

- Neutral time

- Distracted time

- Idle time

- Focus time

- Focus score

- Context switches

- Productivity score

Do NOT let AI arbitrarily calculate the base productivity score.

GEMINI:

Use Gemini to interpret aggregated daily summaries and generate:

- Summary

- Strengths

- Concerns

- Behavioral patterns

- Recommendations

- Confidence

Do not send unnecessary raw activity data to Gemini.

REPORTING:

Generate daily, weekly and monthly reports and provide email-ready report data.

BACKEND/API:

Prepare clean APIs for the future Electron agent:

- device onboarding/registration

- device heartbeat

- device configuration

- monitoring schedule

- activity synchronization

- device revocation

The backend must validate organization → user → device relationships and never trust IDs supplied by the desktop client.

SECURITY:

Use authentication, RBAC, organization isolation, secure device credentials, server-side Gemini secrets, audit logs and retention controls.

ROLES:

ADMIN = full dashboard access.

USER = no admin dashboard; desktop agent only.

DESIGN:

Create a modern, premium, minimal enterprise analytics UI using React/TypeScript, Tailwind and shadcn-style components. Use charts for productivity/focus trends. Make the dashboard responsive and polished.

IMPORTANT:

Build the ADMIN WEB APP + BACKEND + DATABASE + API CONTRACTS now.

Do NOT attempt to build the Windows Electron activity tracker yet. That will be developed separately and integrated later.

Use realistic mock activity/device data so the dashboard looks functional immediately.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/23990686-98da-46f3-a661-e5b1a55c2136).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
