
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
  score: number | null;
  published_date: string | null;
};

type ResearchResult = {
  status: string;
  question: string;
  depth: string;
  source_count: number;
  sources: ResearchSource[];
  synthesis_status: "completed" | "not_configured" | "failed" | string;
  report_markdown: string | null;
  message: string;
};

type ResearchHistoryItem = {
  id: string;
  question: string;
  depth: string;
  createdAt: string;
  result: ResearchResult;
};

const HISTORY_STORAGE_KEY = "researchpilot-history-v1";
const MAX_HISTORY_ITEMS = 30;

const examples = [
  {
    icon: "◈",
    title: "Technology & AI",
    description: "Compare emerging AI tools, capabilities, risks, and use cases.",
    prompt: "Compare the most useful AI automation tools for small businesses in 2026. Include capabilities, limitations, pricing sources, and risks.",
  },
  {
    icon: "⌂",
    title: "Business & markets",
    description: "Explore opportunities, competitors, and market evidence.",
    prompt: "Analyze the opportunities and risks of real estate tokenization in Nigeria. Identify regulatory considerations and cite credible sources.",
  },
  {
    icon: "◎",
    title: "Science & policy",
    description: "Organize findings and compare evidence across sources.",
    prompt: "Summarize recent evidence on how urban tree cover affects heat in cities. Distinguish well-supported findings from open questions.",
  },
];

function renderInlineFormatting(text: string, sourceCount: number) {
  const tokenPattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\[\d+(?:\s*,\s*\d+)*\]|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|\x60[^\x60]+\x60)/g;

  return text.split(tokenPattern).map((part, partIndex) => {
    const markdownLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (markdownLinkMatch) {
      return (
        <a href={markdownLinkMatch[2]} target="_blank" rel="noreferrer noopener" key={partIndex}>
          {markdownLinkMatch[1]}
        </a>
      );
    }

    const citationMatch = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (citationMatch) {
      const ids = citationMatch[1].split(",").map((value) => Number(value.trim()));
      if (ids.some((id) => id < 1 || id > sourceCount)) return part;

      return (
        <span className="citation-group" key={partIndex}>
          {ids.map((id, index) => (
            <span key={`${id}-${index}`}>
              {index > 0 ? ", " : ""}
              <a
                className="inline-citation"
                href={`#source-${id}`}
                aria-label={`Jump to source ${id}`}
                title={`Jump to source ${id}`}
              >
                [{id}]
              </a>
            </span>
          ))}
        </span>
      );
    }

    if ((part.startsWith("**") && part.endsWith("**")) ||
        (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={partIndex}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={partIndex}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}

function getRelevanceLevel(score: number): { kind: "strong" | "moderate" | "limited"; label: string } {
  if (score >= 0.7) return { kind: "strong", label: "Strong" };
  if (score >= 0.4) return { kind: "moderate", label: "Moderate" };
  return { kind: "limited", label: "Limited" };
}

function getSourceType(url: string): { kind: "government" | "education" | "news" | "organization" | "website"; label: string } {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { kind: "website", label: "Website" };
  }

  if (hostname.endsWith(".gov") || hostname.includes(".gov.")) return { kind: "government", label: "Government" };
  if (hostname.endsWith(".edu") || hostname.endsWith(".ac.uk") || hostname.endsWith(".edu.ng") || hostname.includes(".edu.")) {
    return { kind: "education", label: "Education" };
  }
  if (/\b(bbc|reuters|apnews|associatedpress|cnn|nytimes|theguardian|aljazeera)\./.test(hostname)) {
    return { kind: "news", label: "News outlet" };
  }
  if (hostname.endsWith(".org")) return { kind: "organization", label: "Organization" };
  return { kind: "website", label: "Website" };
}

function ReportContent({ markdown, sourceCount }: { markdown: string; sourceCount: number }) {
  return (
    <div className="report-content">
      {markdown.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div className="report-space" key={index} />;
        if (/^(---+|___+|\*\*\*+)$/.test(trimmed)) return null;

        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          const title = renderInlineFormatting(heading[2].replace(/\s+#+\s*$/, ""), sourceCount);
          if (level <= 2) return <h2 key={index}>{title}</h2>;
          if (level <= 4) return <h3 key={index}>{title}</h3>;
          return <h4 key={index}>{title}</h4>;
        }

        if (/^>\s?/.test(trimmed)) {
          return <blockquote key={index}>{renderInlineFormatting(trimmed.replace(/^>\s?/, ""), sourceCount)}</blockquote>;
        }
        if (/^[-*+]\s+/.test(trimmed)) {
          return <p className="report-list-item" key={index}>• {renderInlineFormatting(trimmed.replace(/^[-*+]\s+/, ""), sourceCount)}</p>;
        }
        if (/^\d+[.)]\s+/.test(trimmed)) {
          return <p className="report-list-item" key={index}>{renderInlineFormatting(trimmed, sourceCount)}</p>;
        }
        return <p key={index}>{renderInlineFormatting(trimmed, sourceCount)}</p>;
      })}
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ResearchHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = questionInputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [question]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("researchpilot-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    try {
      const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        const parsed: unknown = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          const validItems = parsed.filter((item): item is ResearchHistoryItem =>
            typeof item === "object" &&
            item !== null &&
            typeof item.id === "string" &&
            typeof item.question === "string" &&
            typeof item.depth === "string" &&
            typeof item.createdAt === "string" &&
            typeof item.result === "object" &&
            item.result !== null &&
            typeof item.result.question === "string" &&
            Array.isArray(item.result.sources)
          );
          setHistory(validItems.slice(0, MAX_HISTORY_ITEMS));
        }
      }
    } catch {
      // Ignore malformed or unavailable browser storage; research should still work.
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      setError("Research history could not be saved in this browser. You can still use the current report.");
    }
  }, [history, historyLoaded]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("researchpilot-theme", theme);
  }, [theme]);
  const [depth, setDepth] = useState("standard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!result) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  async function startResearch() {
    const trimmed = question.trim();
    if (trimmed.length < 12) {
      setError("Please enter a research question with a little more detail.");
      return;
    }

    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, depth }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const detail = typeof payload === "object" && payload !== null && "detail" in payload
          ? String(payload.detail)
          : `Research request failed (${response.status}). Please try again.`;
        throw new Error(detail);
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("question" in payload) ||
        typeof payload.question !== "string" ||
        !("sources" in payload) ||
        !Array.isArray(payload.sources) ||
        !("source_count" in payload) ||
        typeof payload.source_count !== "number" ||
        !("synthesis_status" in payload) ||
        typeof payload.synthesis_status !== "string" ||
        !("report_markdown" in payload) ||
        !(typeof payload.report_markdown === "string" || payload.report_markdown === null) ||
        !("message" in payload) ||
        typeof payload.message !== "string"
      ) {
        throw new Error("The research service responded, but its result was incomplete or in an unexpected format. Please try again. If this continues, check the API deployment logs.");
      }

      const completedResult = payload as ResearchResult;
      const historyItem: ResearchHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question: completedResult.question,
        depth: completedResult.depth || depth,
        createdAt: new Date().toISOString(),
        result: completedResult,
      };
      setHistory((current) => [
        historyItem,
        ...current.filter((item) => item.question !== historyItem.question),
      ].slice(0, MAX_HISTORY_ITEMS));
      setActiveHistoryId(historyItem.id);
      setResult(completedResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the API. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  function openHistoryItem(item: ResearchHistoryItem) {
    setActiveHistoryId(item.id);
    setQuestion(item.question);
    setDepth(item.depth);
    setResult(item.result);
    setError("");
  }

  function deleteHistoryItem(id: string) {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (activeHistoryId === id) setActiveHistoryId(null);
  }

  const filteredHistory = history.filter((item) =>
    item.question.toLowerCase().includes(historySearch.trim().toLowerCase())
  );

  function downloadReport() {
    if (!result?.report_markdown) return;
    const file = new Blob([result.report_markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "researchpilot-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyReport() {
    if (!result?.report_markdown) return;
    try {
      await navigator.clipboard.writeText(result.report_markdown);
    } catch {
      setError("Clipboard access was blocked. Use Download Markdown instead.");
    }
  }

  function exportReportPdf() {
    if (!result) return;
    window.print();
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Main navigation">
        <Link className="brand sidebar-brand" href="/" aria-label="ResearchPilot AI home">
          <span className="brand-mark">R</span>
          <span className="sidebar-brand-copy">ResearchPilot <span className="gradient-text">AI</span></span>
        </Link>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="sidebar-nav">
          <a className="sidebar-link is-active" href="#research-label"><span className="nav-icon">⌘</span><span>Research studio</span><span className="nav-active-dot" /></a>
          <a className="sidebar-link" href="#examples-title"><span className="nav-icon">✳</span><span>Explore prompts</span><span className="nav-shortcut">↗</span></a>
          <a className="sidebar-link" href="#research-results"><span className="nav-icon">▤</span><span>Latest report</span></a>
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-caption">YOUR RESEARCH <span className="history-count">{history.length}</span></div>
        <div className="sidebar-history">
          {history.length === 0 ? (
            <div className="sidebar-empty">
              <span className="sidebar-empty-icon">◌</span>
              <p>Your research library</p>
              <span>Completed research will be saved here in this browser.</span>
            </div>
          ) : (
            history.slice(0, 6).map((item) => (
              <div className={`sidebar-history-item ${activeHistoryId === item.id ? "is-current" : ""}`} key={item.id}>
                <button type="button" className="sidebar-history-open" onClick={() => openHistoryItem(item)} title={item.question}>
                  <span>{item.question}</span>
                  <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                </button>
                <button type="button" className="sidebar-history-delete" onClick={() => deleteHistoryItem(item.id)} aria-label={`Delete saved research: ${item.question}`} title="Delete saved research">×</button>
              </div>
            ))
          )}
          {history.length > 6 && <a className="sidebar-history-more" href="#research-history">View all {history.length} reports ↗</a>}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /><span><strong>Research engine</strong><small>Ready for a question</small></span></div>
          <div className="sidebar-version"><span>RESEARCHPILOT</span><span>STUDIO · 01</span></div>
        </div>
      </aside>
      <div className="app-main">
      <header className="topbar">
        <div className="topbar-context"><span className="topbar-context-mark">⌘</span><span><small>WORKSPACE / RESEARCH</small><strong>Research studio</strong></span></div>
        <div className="topbar-actions">
          <span className="topbar-note"><span className="topbar-live-dot" /> Evidence-first AI research</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={theme === "light"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">Your research workspace</span>
          <h1>From complex questions<br />to <span className="gradient-text">clear evidence.</span></h1>
          <p className="hero-copy">
            Turn a question into a structured research report. Explore evidence,
            trace claims to sources, and spend less time searching and more time understanding.
          </p>
          <div className="hero-proof" aria-label="ResearchPilot capabilities">
            <span><i aria-hidden="true">✳</i> Web-grounded research</span>
            <span><i aria-hidden="true">↗</i> Traceable sources</span>
            <span><i aria-hidden="true">◷</i> Reports in minutes</span>
          </div>
        </section>

        <section className="workspace" aria-labelledby="research-label">
          <div className="workspace-label">
            <div className="workspace-prompt-heading">
              <span className="workspace-step">01 <span> / ASK</span></span>
              <label id="research-label" htmlFor="research-question">What do you want to research?</label>
            </div>
            <span className="pill"><span className="status-dot" aria-hidden="true" /> AI research agent</span>
          </div>
          <div className="prompt-editor">
            <div className="prompt-editor-bar" aria-hidden="true">
              <span className="prompt-editor-label"><span className="prompt-editor-glyph">✳</span> YOUR RESEARCH QUESTION</span>
              <span className="prompt-editor-mode">NATURAL LANGUAGE <span>·</span> OPEN INPUT</span>
            </div>
            <textarea
              ref={questionInputRef}
              id="research-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={2000}
              placeholder={"Ask anything worth understanding…\n\nBe specific about the topic, timeframe, region, or evidence you want to compare."}
              aria-describedby="question-help"
            />
            <div className="prompt-editor-bottom" aria-hidden="true">
              <span><span className="prompt-editor-bottom-dot" /> Ready for your question</span>
              <span>SHIFT YOUR THINKING. START HERE <span className="prompt-editor-spark">✧</span></span>
            </div>
          </div>
          <fieldset className="depth-picker" aria-label="Choose research depth">
            <div className="depth-picker-heading">
              <legend>Research depth</legend>
              <span>Choose how far to investigate</span>
            </div>
            <div className="depth-options">
              <button type="button" className={`depth-option ${depth === "quick" ? "is-selected" : ""}`} aria-pressed={depth === "quick"} onClick={() => setDepth("quick")}>
                <span className="depth-option-top"><span className="depth-symbol" aria-hidden="true">⌁</span><span className="depth-check" aria-hidden="true">✓</span></span>
                <span className="depth-option-name">Quick scan</span>
                <span className="depth-option-detail">A focused overview</span>
                <span className="depth-option-time">FASTEST</span>
              </button>
              <button type="button" className={`depth-option ${depth === "standard" ? "is-selected" : ""}`} aria-pressed={depth === "standard"} onClick={() => setDepth("standard")}>
                <span className="depth-option-top"><span className="depth-symbol" aria-hidden="true">◈</span><span className="depth-check" aria-hidden="true">✓</span></span>
                <span className="depth-option-name">Standard</span>
                <span className="depth-option-detail">Balanced source coverage</span>
                <span className="depth-option-time">RECOMMENDED</span>
              </button>
              <button type="button" className={`depth-option ${depth === "deep" ? "is-selected" : ""}`} aria-pressed={depth === "deep"} onClick={() => setDepth("deep")}>
                <span className="depth-option-top"><span className="depth-symbol" aria-hidden="true">◎</span><span className="depth-check" aria-hidden="true">✓</span></span>
                <span className="depth-option-name">Deep research</span>
                <span className="depth-option-detail">More comprehensive exploration</span>
                <span className="depth-option-time">MOST THOROUGH</span>
              </button>
            </div>
          </fieldset>
          <div className="controls controls-after-depth">
            <span className="depth-selected-note"><span className="status-dot" aria-hidden="true" /> {depth === "quick" ? "Quick scan selected" : depth === "deep" ? "Deep research selected" : "Standard research selected"}</span>
            <button className="primary-button" onClick={startResearch} disabled={loading}>
              {loading ? "Researching and writing…" : "Start researching"} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="workspace-foot">
            <p id="question-help" className="status-note">
              <span aria-hidden="true">⌁</span> Research grounded in web sources, with a cited report when an AI provider is configured.
            </p>
            <span className="character-note">{question.length}/2000</span>
          </div>
          {loading && (
            <div className="research-progress" role="status" aria-live="polite" aria-busy="true">
              <div className="research-progress-head">
                <span className="research-progress-spinner" aria-hidden="true" />
                <div>
                  <p className="research-progress-kicker">RESEARCH IN PROGRESS</p>
                  <h3>Searching sources and preparing your report</h3>
                  <p className="research-progress-copy">ResearchPilot is waiting for the search and synthesis service to finish. Keep this page open; this indicator is indeterminate and does not claim to measure exact completion.</p>
                </div>
              </div>
              <div className="research-progress-track" aria-hidden="true"><span /></div>
              <div className="research-progress-steps" aria-label="Typical research workflow">
                <div className="research-progress-step"><span>01</span><div><strong>Discover sources</strong><small>Find relevant material across the web</small></div><span className="research-step-symbol">↗</span></div>
                <div className="research-progress-step"><span>02</span><div><strong>Analyze evidence</strong><small>Review source details and key findings</small></div><span className="research-step-symbol">⌕</span></div>
                <div className="research-progress-step"><span>03</span><div><strong>Prepare your report</strong><small>Organize the findings and source links</small></div><span className="research-step-symbol">▤</span></div>
              </div>
              <p className="research-progress-note">These are the usual workflow stages, not live step-by-step updates. The current research service does not yet stream individual stage events.</p>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <section id="research-history" className="history-panel" aria-labelledby="history-title">
          <div className="section-heading history-section-heading">
            <div>
              <span className="section-overline">Your library</span>
              <h2 id="history-title">Research history</h2>
            </div>
            <span>{history.length} saved {history.length === 1 ? "report" : "reports"}</span>
          </div>
          <p className="history-privacy-note">Saved only in this browser on this device. Clearing browser storage may remove these reports.</p>
          {history.length > 0 && (
            <label className="history-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search saved questions…"
                aria-label="Search research history"
              />
            </label>
          )}
          {history.length === 0 ? (
            <div className="history-empty">
              <span aria-hidden="true">◌</span>
              <strong>Your research library starts here</strong>
              <p>Once a research request finishes, its question, report, and sources will be saved here for quick access.</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <p className="history-no-results">No saved research matches “{historySearch}”.</p>
          ) : (
            <div className="history-list">
              {filteredHistory.map((item) => (
                <article className={`history-card ${activeHistoryId === item.id ? "is-current" : ""}`} key={item.id}>
                  <button type="button" className="history-card-open" onClick={() => openHistoryItem(item)}>
                    <span className="history-card-meta">
                      <span>{item.depth === "deep" ? "Deep research" : item.depth === "quick" ? "Quick scan" : "Standard research"}</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </span>
                    <strong>{item.question}</strong>
                    <span className="history-card-summary">
                      {item.result.source_count} sources · {item.result.report_markdown ? "Report available" : "Sources saved"}
                    </span>
                  </button>
                  <button type="button" className="history-delete-button" onClick={() => deleteHistoryItem(item.id)} aria-label={`Delete saved research: ${item.question}`}>Delete</button>
                </article>
              ))}
            </div>
          )}
        </section>

        {result && (
          <section id="research-results" ref={resultsRef} className="results" aria-live="polite" aria-labelledby="results-title">
            <div className="results-heading">
              <div>
                <span className="eyebrow">Research results</span>
                <h2 id="results-title">Your research brief</h2>
                <p>{result.question}</p>
              </div>
              <span className="source-count">{result.source_count} sources</span>
            </div>

            {result.report_markdown ? (
              <article className="report-card">
                <div className="report-toolbar">
                  <div>
                    <span className="report-kicker">AI-generated synthesis</span>
                    <p>Use the numbered citations to jump to a source. Relevance labels reflect search matching, not a guarantee of credibility.</p>
                  </div>
                  <div className="report-actions">
                    <button type="button" className="secondary-button" onClick={exportReportPdf} title="Open print dialog and choose Save as PDF">Export PDF</button>
                    <button type="button" className="secondary-button" onClick={copyReport}>Copy report</button>
                    <button type="button" className="secondary-button" onClick={downloadReport}>Download .md</button>
                  </div>
                </div>
                <ReportContent markdown={result.report_markdown} sourceCount={result.sources.length} />
              </article>
            ) : (
              <div className="results-notice">
                <strong>{result.synthesis_status === "not_configured" ? "AI synthesis needs setup" : "Report synthesis unavailable"}</strong>
                <p>{result.message}</p>
                {result.synthesis_status === "not_configured" && (
                  <p>Add a compatible model API key as <code>LLM_API_KEY</code> in <code>apps/api/.env</code>, then restart the backend. Your source results are still available below.</p>
                )}
              </div>
            )}

            <div className="sources-heading">
              <div>
                <span className="eyebrow">Evidence library</span>
                <h3>Sources used for this research</h3>
              </div>
              <span>{result.source_count} collected</span>
            </div>
            {result.sources.length > 0 ? (
              <div className="source-list">
                {result.sources.map((source, index) => (
                  <article id={`source-${index + 1}`} className="source-card" key={source.url}>
                    <div className="source-meta">
                      <span>Source [{index + 1}]</span>
                      {source.published_date && <span>{source.published_date}</span>}
                    </div>
                    <div className="source-indicators" aria-label="Source indicators">
                      <span className={`source-type-badge source-type-${getSourceType(source.url).kind}`}>{getSourceType(source.url).label}</span>
                      {typeof source.score === "number" && Number.isFinite(source.score) ? (
                        <span className={`relevance-badge relevance-${getRelevanceLevel(source.score).kind}`} title="Search-provider relevance estimate; this does not guarantee factual accuracy or publisher credibility.">
                          <span aria-hidden="true">●</span> {getRelevanceLevel(source.score).label} match
                        </span>
                      ) : (
                        <span className="relevance-badge relevance-unknown" title="The search provider did not return a relevance score.">Match score unavailable</span>
                      )}
                    </div>
                    <h3><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span aria-hidden="true">↗</span></a></h3>
                    <p>{source.snippet || "No preview was provided by the search provider."}</p>
                    <a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer">{new URL(source.url).hostname}</a>
                  </article>
                ))}
              </div>
            ) : (
              <p className="status-note">No sources were returned for this question. Try a more specific search.</p>
            )}
          </section>
        )}

        <section aria-labelledby="examples-title">
          <div className="section-heading">
            <div>
              <span className="section-overline">A starting point</span>
              <h2 id="examples-title">Good questions lead somewhere.</h2>
            </div>
            <span>Choose a prompt to explore <span aria-hidden="true">↘</span></span>
          </div>
          <div className="example-grid">
            {examples.map((example) => (
              <button
                type="button"
                className="example-card"
                key={example.title}
                onClick={() => { setQuestion(example.prompt); setError(""); setResult(null); }}
              >
                <span className="example-icon" aria-hidden="true">{example.icon}</span>
                <span className="example-title">{example.title}</span>
                <span className="example-desc">{example.description}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="footer">
          <span>ResearchPilot AI · AI synthesis milestone</span>
          <span>Evidence first. Clear reasoning. Traceable sources.</span>
        </footer>
      </main>
      </div>
    </div>
  );
}
