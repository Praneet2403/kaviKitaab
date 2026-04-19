"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type PageData =
  | { type: "cover" }
  | { type: "text"; content: string; title: string }
  | { type: "back_cover" };

const POLL_INTERVAL = 3000; // poll server every 3 seconds for live updates

// ─── API helpers ─────────────────────────────────────────────────────────────
async function fetchPages(): Promise<PageData[]> {
  const res = await fetch("/api/pages", { cache: "no-store" });
  const data = await res.json();
  return data.pages;
}

async function savePagesToDB(pages: PageData[]): Promise<boolean> {
  try {
    const res = await fetch("/api/pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Home() {
  const [pages, setPages] = useState<PageData[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animClass, setAnimClass] = useState("page-enter");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isEditing, setIsEditing] = useState(false);
  const [liveIndicator, setLiveIndicator] = useState(true);

  const animTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVersionRef = useRef(0); // tracks local edits to avoid overwrite during typing
  const serverVersionRef = useRef(0);

  // ─── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPages().then((p) => {
      setPages(p);
      serverVersionRef.current = Date.now();
    });
  }, []);

  // ─── Live polling for updates from server ────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      // Don't overwrite while user is actively typing
      if (isEditing) return;

      try {
        const serverPages = await fetchPages();
        // Only update if we haven't made local edits recently
        if (localVersionRef.current <= serverVersionRef.current) {
          setPages(serverPages);
          setLiveIndicator(true);
        }
        serverVersionRef.current = Date.now();
      } catch {
        setLiveIndicator(false);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isEditing]);

  // ─── Navigation ──────────────────────────────────────────────────────────
  const flipTo = useCallback(
    (newIndex: number, direction: "left" | "right") => {
      if (animTimeout.current) clearTimeout(animTimeout.current);
      setAnimClass(direction === "left" ? "page-exit-left" : "page-exit-right");
      animTimeout.current = setTimeout(() => {
        setCurrentIndex(newIndex);
        setAnimClass("page-enter");
        setIsEditing(false);
      }, 280);
    },
    []
  );

  const prevPage = useCallback(() => {
    if (pages && currentIndex > 0) flipTo(currentIndex - 1, "right");
  }, [pages, currentIndex, flipTo]);

  const nextPage = useCallback(() => {
    if (pages && currentIndex < pages.length - 1) flipTo(currentIndex + 1, "left");
  }, [pages, currentIndex, flipTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isEditing) return;
      if (e.key === "ArrowLeft") prevPage();
      if (e.key === "ArrowRight") nextPage();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prevPage, nextPage, isEditing]);

  // ─── Page mutations ──────────────────────────────────────────────────────
  const debouncedSave = useCallback(
    (newPages: PageData[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      setSaveStatus("saving");
      saveTimeout.current = setTimeout(async () => {
        const ok = await savePagesToDB(newPages);
        setSaveStatus(ok ? "saved" : "error");
        if (ok) {
          serverVersionRef.current = Date.now();
        }
        setTimeout(() => setSaveStatus("idle"), 1500);
      }, 800);
    },
    []
  );

  const updatePage = (updated: PageData) => {
    if (!pages) return;
    const newPages = [...pages];
    newPages[currentIndex] = updated;
    setPages(newPages);
    localVersionRef.current = Date.now();
    debouncedSave(newPages);
  };

  const addPage = () => {
    if (!pages) return;
    const newPages = [...pages];
    newPages.splice(currentIndex + 1, 0, { type: "text", title: "Untitled", content: "" });
    setPages(newPages);
    localVersionRef.current = Date.now();
    savePagesToDB(newPages).then(() => {
      serverVersionRef.current = Date.now();
    });
    flipTo(currentIndex + 1, "left");
  };

  const deletePage = () => {
    if (!pages) return;
    if (pages[currentIndex].type !== "text") return;
    const textPages = pages.filter((p) => p.type === "text");
    if (textPages.length <= 1) return;
    const newPages = pages.filter((_, i) => i !== currentIndex);
    const newIndex = Math.min(currentIndex, newPages.length - 1);
    setPages(newPages);
    setCurrentIndex(newIndex);
    setAnimClass("page-enter");
    localVersionRef.current = Date.now();
    savePagesToDB(newPages).then(() => {
      serverVersionRef.current = Date.now();
    });
  };

  // ─── Derived ─────────────────────────────────────────────────────────────
  if (!pages) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface-container-low">
        <p className="font-['Newsreader'] italic text-lg opacity-40 animate-pulse">
          Opening kaviKitaab…
        </p>
      </div>
    );
  }

  const currentPage = pages[currentIndex];
  const totalTextPages = pages.filter((p) => p.type === "text").length;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-surface-container-low text-on-surface select-none">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-surface relative z-50 shrink-0 border-b border-black/5">
        <div className="flex justify-between items-center px-4 sm:px-6 md:px-12 py-2 sm:py-3 max-w-full mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="font-['Newsreader'] font-bold text-base sm:text-lg tracking-tighter">
              KAVIKITAAB
            </h1>
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-30 font-['Newsreader'] hidden sm:inline">
              by Bushi
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-5">
            {/* Live indicator */}
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-['Newsreader']">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  liveIndicator ? "bg-green-500 animate-pulse" : "bg-red-400"
                }`}
              />
              <span className="opacity-40 hidden sm:inline">Live</span>
            </span>

            {/* Save status */}
            <span
              className={`text-[10px] uppercase tracking-[0.2em] font-['Newsreader'] transition-opacity ${
                saveStatus === "saved"
                  ? "save-pulse opacity-70"
                  : saveStatus === "saving"
                  ? "opacity-40"
                  : saveStatus === "error"
                  ? "opacity-80 text-error"
                  : "opacity-0"
              }`}
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                ? "✓ Saved"
                : saveStatus === "error"
                ? "✗ Error"
                : ""}
            </span>

            {/* Page counter */}
            <span className="font-['Newsreader'] text-xs opacity-50 tracking-widest">
              {currentIndex + 1} / {pages.length}
            </span>

            <span className="material-symbols-outlined cursor-pointer opacity-40 hover:opacity-100 transition-opacity text-xl">
              bookmark
            </span>
          </div>
        </div>
      </header>

      {/* ─── Book Area ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-8 page-wrapper overflow-hidden">
        <div className={`w-full max-w-3xl h-full flex items-center justify-center ${animClass}`}>
          {/* ── Cover ─────────────────────────────────────────────────── */}
          {currentPage.type === "cover" && (
            <div className="relative w-full max-w-lg h-full max-h-[85vh] sm:max-h-none sm:aspect-[3/4] bg-surface-container paper-depth border-l-[8px] sm:border-l-[12px] border-primary-container flex flex-col items-center justify-center p-6 sm:p-12 text-center transition-shadow hover:shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent pointer-events-none rounded-sm" />
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 w-4 h-4 sm:w-6 sm:h-6 border-t border-l border-black/10" />
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 w-4 h-4 sm:w-6 sm:h-6 border-t border-r border-black/10" />
              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 w-4 h-4 sm:w-6 sm:h-6 border-b border-l border-black/10" />
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-4 h-4 sm:w-6 sm:h-6 border-b border-r border-black/10" />

              <p className="font-['Newsreader'] italic text-sm sm:text-base tracking-widest opacity-40 mb-6 sm:mb-10">
                A Collection
              </p>
              <h2 className="text-4xl sm:text-5xl md:text-7xl font-['Newsreader'] font-light leading-tight tracking-tighter text-primary mb-5 sm:mb-8">
                kaviKitaab
              </h2>
              <div className="w-12 sm:w-16 h-[1px] bg-primary/15 mb-5 sm:mb-8" />
              <p className="font-['Newsreader'] uppercase tracking-[0.4em] sm:tracking-[0.5em] text-[10px] sm:text-[11px] opacity-50">
                By Bushi
              </p>
              <p className="font-['Newsreader'] italic text-[10px] sm:text-xs opacity-20 mt-8 sm:mt-16">
                Use ← → or buttons below to turn pages
              </p>
            </div>
          )}

          {/* ── Text Page ─────────────────────────────────────────────── */}
          {currentPage.type === "text" && (
            <div className="relative w-full h-full max-h-[85vh] bg-surface-container-lowest paper-depth border-l-[4px] border-black/5 spine-shadow flex flex-col transition-shadow hover:shadow-xl">
              {/* Page header */}
              <div className="flex items-center justify-between px-4 sm:px-8 md:px-14 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-black/5 shrink-0">
                <input
                  type="text"
                  value={currentPage.title}
                  onChange={(e) =>
                    updatePage({ ...currentPage, title: e.target.value })
                  }
                  onFocus={() => setIsEditing(true)}
                  onBlur={() => setIsEditing(false)}
                  className="bg-transparent border-none p-0 font-['Newsreader'] text-xs uppercase tracking-[0.3em] opacity-40 focus:opacity-80 transition-opacity outline-none w-full max-w-[200px] select-text"
                  placeholder="Page title..."
                />
                <span className="opacity-20 text-[10px] font-['Newsreader'] tracking-widest shrink-0">
                  KAVIKITAAB
                </span>
              </div>

              {/* Editable content area */}
              <div className="flex-1 px-4 sm:px-8 md:px-14 py-4 sm:py-6 overflow-hidden">
                <textarea
                  value={currentPage.content}
                  onChange={(e) =>
                    updatePage({ ...currentPage, content: e.target.value })
                  }
                  onFocus={() => setIsEditing(true)}
                  onBlur={() => setIsEditing(false)}
                  className="w-full h-full bg-transparent border-none p-0 font-['Newsreader'] text-base sm:text-lg md:text-xl leading-[1.8] sm:leading-[2] resize-none outline-none select-text"
                  placeholder="Begin writing here...&#10;&#10;Every great poem starts with a single word."
                />
              </div>

              {/* Page footer */}
              <div className="flex items-center justify-between px-4 sm:px-8 md:px-14 py-3 sm:py-4 border-t border-black/5 shrink-0">
                <span className="opacity-15 text-[10px] font-['Newsreader']">
                  {currentPage.content.length} characters
                </span>
                <span className="opacity-15 text-[10px] font-['Newsreader']">
                  Page {currentIndex}
                </span>
              </div>
            </div>
          )}

          {/* ── Back Cover ────────────────────────────────────────────── */}
          {currentPage.type === "back_cover" && (
            <div className="relative w-full max-w-lg h-full max-h-[85vh] sm:max-h-none sm:aspect-[3/4] bg-surface-container-high border-r-[8px] sm:border-r-[12px] border-primary-container paper-depth flex flex-col items-center justify-center text-center transition-shadow hover:shadow-2xl p-6 sm:p-0">
              <div className="absolute top-4 left-4 sm:top-6 sm:left-6 w-4 h-4 sm:w-6 sm:h-6 border-t border-l border-black/10" />
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 w-4 h-4 sm:w-6 sm:h-6 border-t border-r border-black/10" />
              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 w-4 h-4 sm:w-6 sm:h-6 border-b border-l border-black/10" />
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-4 h-4 sm:w-6 sm:h-6 border-b border-r border-black/10" />

              <div className="space-y-4 sm:space-y-6 opacity-20 flex flex-col items-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-primary flex items-center justify-center font-bold text-lg sm:text-xl tracking-tighter">
                  KB
                </div>
                <div className="w-8 h-[1px] bg-primary/30" />
                <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.4em] sm:tracking-[0.5em] leading-loose">
                  Published by Bushi
                  <br />
                  All Rights Reserved © {new Date().getFullYear()}
                </p>
                <p className="text-[9px] sm:text-[10px] italic font-['Newsreader'] tracking-wider">
                  {totalTextPages} {totalTextPages === 1 ? "page" : "pages"} in this volume
                </p>
              </div>
              <div className="absolute bottom-16 sm:bottom-24 w-32 sm:w-48 h-[1px] bg-primary/10" />
              <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 opacity-40 text-[10px] sm:text-xs italic font-['Newsreader']">
                Finis
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── Bottom Navigation ──────────────────────────────────────────── */}
      <footer className="h-12 sm:h-16 shrink-0 bg-surface border-t border-black/5 flex items-center justify-between px-3 sm:px-4 md:px-16">
        <button
          onClick={prevPage}
          disabled={currentIndex === 0}
          className={`flex items-center gap-1 sm:gap-2 font-['Newsreader'] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-xs transition-all min-h-[44px] min-w-[44px] justify-center ${
            currentIndex === 0
              ? "opacity-15 cursor-not-allowed"
              : "opacity-60 hover:opacity-100 hover:-translate-x-1"
          }`}
        >
          <span className="material-symbols-outlined text-base">arrow_back_ios</span>
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-3 sm:gap-4">
          {currentPage.type === "text" && (
            <>
              <button
                onClick={addPage}
                className="tooltip-wrapper flex items-center gap-1 text-xs opacity-30 hover:opacity-80 transition-opacity font-['Newsreader'] uppercase tracking-[0.1em] min-h-[44px] min-w-[44px] justify-center"
                data-tooltip="Insert page after"
              >
                <span className="material-symbols-outlined text-base">add</span>
              </button>
              <button
                onClick={deletePage}
                disabled={totalTextPages <= 1}
                className={`tooltip-wrapper flex items-center gap-1 text-xs transition-opacity font-['Newsreader'] uppercase tracking-[0.1em] min-h-[44px] min-w-[44px] justify-center ${
                  totalTextPages <= 1
                    ? "opacity-10 cursor-not-allowed"
                    : "opacity-30 hover:opacity-80"
                }`}
                data-tooltip="Delete this page"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </>
          )}
        </div>

        <button
          onClick={nextPage}
          disabled={currentIndex === pages.length - 1}
          className={`flex items-center gap-1 sm:gap-2 font-['Newsreader'] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-xs transition-all min-h-[44px] min-w-[44px] justify-center ${
            currentIndex === pages.length - 1
              ? "opacity-15 cursor-not-allowed"
              : "opacity-60 hover:opacity-100 hover:translate-x-1"
          }`}
        >
          <span className="hidden sm:inline">Next</span>
          <span className="material-symbols-outlined text-base">arrow_forward_ios</span>
        </button>
      </footer>
    </div>
  );
}
