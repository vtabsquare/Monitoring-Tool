/**
 * Server-side transactional email sender using Brevo (formerly Sendinblue) v3 API.
 * Handles automated onboarding emails with activation tokens & installer download instructions.
 */

interface OnboardingEmailParams {
  recipientEmail: string;
  recipientName: string;
  invitationToken: string;
  orgName?: string;
  serverUrl?: string;
}

export async function sendInvitationEmail({
  recipientEmail,
  recipientName,
  invitationToken,
  orgName = "VTAB SQUARE",
  serverUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:8080",
}: OnboardingEmailParams): Promise<{ success: boolean; error?: string }> {
  let apiKey = process.env.BREVO_API_KEY;
  let senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@vtabsquare.com";
  let senderName = process.env.BREVO_SENDER_NAME || "VTAB SQUARE Monitoring";

  if (!apiKey) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const apiKeyMatch = envContent.match(/BREVO_API_KEY="([^"]+)"/);
        if (apiKeyMatch) apiKey = apiKeyMatch[1];
        const emailMatch = envContent.match(/BREVO_SENDER_EMAIL="([^"]+)"/);
        if (emailMatch) senderEmail = emailMatch[1];
        const nameMatch = envContent.match(/BREVO_SENDER_NAME="([^"]+)"/);
        if (nameMatch) senderName = nameMatch[1];
      }
    } catch (e) {
      // Ignore FS errors
    }
  }

  const downloadUrl = `${serverUrl}/api/public/agent/download`;

  if (!apiKey) {
    console.warn(
      "[Brevo Email] BREVO_API_KEY is not set in environment variables. Onboarding email logged locally.",
    );
    console.log(`[Onboarding Email Target]: ${recipientEmail} (${recipientName})`);
    console.log(`[Activation Token]: ${invitationToken}`);
    console.log(`[Download Link]: ${downloadUrl}`);
    return { success: false, error: "BREVO_API_KEY missing" };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            margin: 0;
            padding: 24px;
          }
          .container {
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .header {
            text-align: center;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .logo {
            font-size: 20px;
            font-weight: 800;
            color: #2563eb;
            letter-spacing: -0.02em;
          }
          .title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 12px;
          }
          .token-box {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            font-family: monospace;
            font-size: 20px;
            font-weight: 700;
            color: #1d4ed8;
            letter-spacing: 0.05em;
            margin: 20px 0;
            word-break: break-all;
          }
          .btn-download {
            display: block;
            width: 80%;
            margin: 24px auto;
            padding: 14px 24px;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
            border-radius: 8px;
            text-align: center;
          }
          .steps-list {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px 24px;
            margin-top: 20px;
          }
          .steps-list ol {
            margin: 8px 0 0 0;
            padding-left: 20px;
          }
          .steps-list li {
            margin-bottom: 8px;
            font-size: 13px;
            color: #334155;
            line-height: 1.5;
          }
          .footer {
            margin-top: 32px;
            border-top: 1px solid #f1f5f9;
            padding-top: 16px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">VTAB SQUARE</div>
            <div class="title">Welcome! Your Monitoring Application is Ready</div>
          </div>

          <p style="font-size: 14px; color: #334155;">Hi <strong>${recipientName}</strong>,</p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            An administrator has created your monitoring profile on <strong>${orgName}</strong>. 
            Please follow the steps below to install and activate your monitoring agent client on your Windows system.
          </p>

          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 20px;">
            YOUR UNIQUE ACTIVATION TOKEN:
          </div>
          <div class="token-box">
            ${invitationToken}
          </div>

          <a href="${downloadUrl}" class="btn-download" target="_blank">
            ⬇️ Download MonitoringAgent.exe
          </a>

          <div class="steps-list">
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
              Setup Instructions:
            </div>
            <ol>
              <li>Click the button above to download <strong>FlowFocusDesktopAgentSetup.exe</strong>.</li>
              <li>Run and install the application on your local Windows system.</li>
              <li>Open the application after installation completes.</li>
              <li>Enter your unique Activation Token shown above.</li>
              <li>Complete device registration.</li>
              <li>The monitoring agent will automatically start running in the background.</li>
            </ol>
          </div>

          <div class="footer">
            VTAB SQUARE Desktop Agent Monitoring Platform &bull; Automated Onboarding System
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        replyTo: { name: senderName, email: senderEmail },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `Welcome ${recipientName}! Complete Your Monitoring Agent Setup [${new Date().toLocaleTimeString()}]`,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Brevo API Error ${res.status}]:`, errBody);
      return { success: false, error: `Brevo API HTTP ${res.status}: ${errBody}` };
    }

    const data = await res.json();
    console.log("[Brevo Onboarding Email Sent Successfully]:", data);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Brevo Email Fetch Failed]:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
