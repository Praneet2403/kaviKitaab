import { NextResponse } from "next/server";
import { readPages, writePages, type PageData } from "@/lib/store";

// GET /api/pages — return the current book state
export async function GET() {
  const pages = readPages();
  return NextResponse.json({ pages, updatedAt: Date.now() });
}

// PUT /api/pages — overwrite the entire book
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const pages: PageData[] = body.pages;

    if (!Array.isArray(pages) || pages.length < 2) {
      return NextResponse.json(
        { error: "Invalid pages data" },
        { status: 400 }
      );
    }

    // Basic validation: first must be cover, last must be back_cover
    if (pages[0].type !== "cover" || pages[pages.length - 1].type !== "back_cover") {
      return NextResponse.json(
        { error: "Book must begin with a cover and end with a back cover" },
        { status: 400 }
      );
    }

    writePages(pages);
    return NextResponse.json({ ok: true, updatedAt: Date.now() });
  } catch {
    return NextResponse.json(
      { error: "Failed to save pages" },
      { status: 500 }
    );
  }
}
