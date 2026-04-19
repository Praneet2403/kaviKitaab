import fs from "fs";
import path from "path";

export type PageData =
  | { type: "cover" }
  | { type: "text"; title: string; content: string }
  | { type: "back_cover" };

const DATA_PATH = path.join(process.cwd(), "data", "pages.json");

export function readPages(): PageData[] {
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

export function writePages(pages: PageData[]): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(pages, null, 2), "utf-8");
}
