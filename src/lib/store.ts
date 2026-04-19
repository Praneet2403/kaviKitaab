import fs from "fs";
import path from "path";

export type PageData =
  | { type: "cover" }
  | { type: "text"; title: string; content: string }
  | { type: "back_cover" };

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "pages.json");
const PAGES_DIR = path.join(DATA_DIR, "pages");

// ─── Ensure directories exist ────────────────────────────────────────────────
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR, { recursive: true });
}

// ─── Read the master index ───────────────────────────────────────────────────
export function readPages(): PageData[] {
  ensureDirs();
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw) as PageData[];
  } catch {
    const fallback: PageData[] = [
      { type: "cover" },
      { type: "text", title: "Untitled", content: "" },
      { type: "back_cover" },
    ];
    writePages(fallback);
    return fallback;
  }
}

// ─── Write the master index + individual HTML files ──────────────────────────
export function writePages(pages: PageData[]): void {
  ensureDirs();

  // 1. Save the JSON index
  fs.writeFileSync(DATA_PATH, JSON.stringify(pages, null, 2), "utf-8");

  // 2. Write each text page as a standalone HTML file
  let pageNum = 0;
  for (const page of pages) {
    if (page.type === "text") {
      pageNum++;
      const safeTitle = page.title
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase() || "untitled";

      const filename = `page_${String(pageNum).padStart(2, "0")}_${safeTitle}.html`;
      const html = generatePageHTML(page.title, page.content, pageNum, pages.length);
      fs.writeFileSync(path.join(PAGES_DIR, filename), html, "utf-8");
    }
  }

  // 3. Clean up old HTML files that no longer correspond to current pages
  cleanupOldFiles(pageNum);
}

// ─── Remove stale HTML files when pages are deleted ──────────────────────────
function cleanupOldFiles(currentTextPageCount: number) {
  try {
    const existing = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith(".html"));
    for (const file of existing) {
      const match = file.match(/^page_(\d+)_/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > currentTextPageCount) {
          fs.unlinkSync(path.join(PAGES_DIR, file));
        }
      }
    }
  } catch {
    /* ignore cleanup errors */
  }
}

// ─── Generate a beautiful standalone HTML file for a page ────────────────────
function generatePageHTML(
  title: string,
  content: string,
  pageNumber: number,
  totalPages: number
): string {
  // Convert plain text to HTML paragraphs
  const contentHTML = content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return "<br/>";
      // Escape HTML entities
      const escaped = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<p>${escaped}</p>`;
    })
    .join("\n        ");

  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const timestamp = new Date().toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapedTitle} — kaviKitaab by Bushi</title>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Newsreader', 'Georgia', serif;
      background: #fbf9f4;
      color: #1b1c19;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 3rem 1.5rem;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      max-width: 700px;
      width: 100%;
      background: #ffffff;
      border-left: 4px solid rgba(0,0,0,0.05);
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.08),
                  inset 10px 0 15px -10px rgba(0,0,0,0.1),
                  inset -10px 0 15px -10px rgba(0,0,0,0.1);
      padding: 4rem 3.5rem;
      position: relative;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      padding-bottom: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .page-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.3em;
      opacity: 0.4;
    }
    .page-brand {
      font-size: 0.6rem;
      letter-spacing: 0.4em;
      opacity: 0.2;
      text-transform: uppercase;
    }
    .content {
      font-size: 1.25rem;
      line-height: 2.2;
      white-space: pre-wrap;
    }
    .content p {
      margin-bottom: 0.5em;
    }
    .page-footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(0,0,0,0.05);
      display: flex;
      justify-content: space-between;
      font-size: 0.6rem;
      opacity: 0.2;
    }
    .meta {
      margin-top: 2rem;
      font-size: 0.55rem;
      opacity: 0.15;
      text-align: center;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="page-header">
      <span class="page-title">${escapedTitle}</span>
      <span class="page-brand">kaviKitaab</span>
    </div>

    <div class="content">
        ${contentHTML}
    </div>

    <div class="page-footer">
      <span>Page ${pageNumber}</span>
      <span>${totalPages} pages in volume</span>
    </div>
  </div>

  <div class="meta">
    kaviKitaab by Bushi · Last saved: ${timestamp}
  </div>
</body>
</html>`;
}
