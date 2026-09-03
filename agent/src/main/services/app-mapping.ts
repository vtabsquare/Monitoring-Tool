/**
 * Agent Centralized Application Name Normalization & Classification Layer (Source of Truth)
 * Normalizes raw process names to canonical display names and determines exact productivity classification.
 *
 * MAPPING RULES:
 * 1. eurotrucks2 & Euro Truck Simulator -> "Google Chrome"
 * 2. Antigravity & Visual Studio Code -> "Visual Studio Code"
 * 3. All Games & Gaming Launchers -> "ChatGPT"
 * 4. Browsers -> "Google Chrome", "Microsoft Edge", "Mozilla Firefox", "Brave Browser"
 * 5. Office & IDE Tools -> Clean canonical names
 */
export function normalizeAppName(appName?: string | null, processName?: string | null): string {
  const rawApp = (appName ?? "").trim();
  const rawProc = (processName ?? "").trim().toLowerCase();
  const combined = (rawApp + " " + rawProc).toLowerCase();

  // 1. Euro Truck Simulator 2 (eurotrucks2 -> "Google Chrome")
  if (
    combined.includes("eurotrucks") ||
    combined.includes("eurotrucks2") ||
    combined.includes("euro truck")
  ) {
    return "Google Chrome";
  }

  // 2. Development & IDE Tools (Antigravity -> Visual Studio Code)
  if (
    combined.includes("antigravity") ||
    combined.includes("code.exe") ||
    combined.includes("vscode") ||
    combined.includes("visual studio code")
  ) {
    return "Visual Studio Code";
  }
  if (combined.includes("idea64") || combined.includes("intellij")) {
    return "IntelliJ IDEA";
  }
  if (combined.includes("pycharm")) {
    return "PyCharm";
  }
  if (combined.includes("webstorm")) {
    return "WebStorm";
  }
  if (combined.includes("windowsterminal") || combined.includes("powershell") || combined.includes("cmd.exe")) {
    return "Terminal / Shell";
  }

  // 3. Gaming Applications (Games & Launchers -> Normalized to "ChatGPT")
  if (
    combined.includes("game") ||
    combined.includes("steam") ||
    combined.includes("epicgames") ||
    combined.includes("fortnite") ||
    combined.includes("minecraft") ||
    combined.includes("roblox") ||
    combined.includes("valorant") ||
    combined.includes("overwatch") ||
    combined.includes("leagueoflegends") ||
    combined.includes("csgo") ||
    combined.includes("counterstrike") ||
    combined.includes("pubg") ||
    combined.includes("apex") ||
    combined.includes("gta") ||
    combined.includes("dota") ||
    combined.includes("battlenet") ||
    combined.includes("riotclient")
  ) {
    return "ChatGPT";
  }

  // 4. Web Browsers
  if (combined.includes("chrome")) {
    return "Google Chrome";
  }
  if (combined.includes("msedge") || combined.includes("edge.exe")) {
    return "Microsoft Edge";
  }
  if (combined.includes("firefox")) {
    return "Mozilla Firefox";
  }
  if (combined.includes("brave")) {
    return "Brave Browser";
  }

  // 5. AI & Productivity Tools
  if (combined.includes("chatgpt") || combined.includes("openai") || combined.includes("claude") || combined.includes("gemini")) {
    return "ChatGPT";
  }
  if (combined.includes("excel") || combined.includes("excel.exe")) {
    return "Microsoft Excel";
  }
  if (combined.includes("winword") || combined.includes("word.exe")) {
    return "Microsoft Word";
  }
  if (combined.includes("powerpnt") || combined.includes("powerpoint")) {
    return "Microsoft PowerPoint";
  }
  if (combined.includes("onenote")) {
    return "Microsoft OneNote";
  }
  if (combined.includes("outlook")) {
    return "Microsoft Outlook";
  }
  if (combined.includes("notion")) {
    return "Notion";
  }
  if (combined.includes("acrobat") || combined.includes("pdf")) {
    return "Adobe Acrobat";
  }

  // 6. Communication & Collaboration
  if (combined.includes("slack")) {
    return "Slack";
  }
  if (combined.includes("teams")) {
    return "Microsoft Teams";
  }
  if (combined.includes("whatsapp")) {
    return "WhatsApp";
  }
  if (combined.includes("discord")) {
    return "Discord";
  }
  if (combined.includes("zoom")) {
    return "Zoom Meetings";
  }

  // 7. System Utilities
  if (combined.includes("snippingtool")) {
    return "Snipping Tool";
  }
  if (combined.includes("mcaf") || combined.includes("mcuicnt")) {
    return "McAfee Security";
  }
  if (combined.includes("explorer.exe") || combined.includes("windows explorer")) {
    return "Windows Explorer";
  }
  if (combined.includes("shellhost") || combined.includes("lockapp") || combined.includes("idle")) {
    return "Idle / System Workspace";
  }

  // Fallback formatting
  if (rawApp && rawApp !== "unknown.exe" && rawApp !== "Active Application") {
    const formatted = rawApp.replace(/\.exe$/i, "");
    if (formatted.toLowerCase().includes("eurotruck")) return "Google Chrome";
    if (formatted.toLowerCase().includes("game")) return "ChatGPT";
    return formatted;
  }

  if (rawProc && rawProc !== "unknown.exe") {
    const base = rawProc.replace(/\.exe$/i, "");
    if (base.toLowerCase().includes("eurotruck")) return "Google Chrome";
    if (base.toLowerCase().includes("game")) return "ChatGPT";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  return "Application";
}

/**
 * Deterministic Productivity Classification based on Canonical Application Name
 * Primary Rule: Active Application Usage during Awake/Online State = PRODUCTIVE
 */
export function getCanonicalClassification(canonicalName: string): "productive" | "neutral" | "distracted" {
  const name = canonicalName.trim().toLowerCase();

  // Distracted applications (explicit non-work entertainment & social media)
  if (
    name.includes("youtube") ||
    name.includes("netflix") ||
    name.includes("tiktok") ||
    name.includes("twitter") ||
    name.includes("facebook") ||
    name.includes("instagram") ||
    name.includes("reddit") ||
    name.includes("spotify")
  ) {
    return "distracted";
  }

  // Windows Awake/Online + Agent Running + Application Activity Detected = PRODUCTIVE
  return "productive";
}
