"use client";

import { useState } from "react";

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

function ReportContent({ markdown }: { markdown: string }) {
  return (
    <div className="report-content">
      {markdown.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div className="report-space" key={index} />;
        if (trimmed.startsWith("### ")) return <h4 key={index}>{trimmed.slice(4)}</h4>;
        if (trimmed.startsWith("## ")) return <h3 key={index}>{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith("# ")) return <h2 key={index}>{trimmed.slice(2)}</h2>;
        if (/^[-*] /.test(trimmed)) return <p className="report-list-item" key={index}>• {trimmed.slice(2)}</p>;
        if (/^\d+\. /.test(trimmed)) return <p className="report-list-item" key={index}>{trimmed}</p>;
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState("standard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);

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
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/v1/research`, {
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
      setResult(payload as ResearchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the API. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ResearchPilot AI home">
          <span className="brand-mark">R</span>
          <span>ResearchPilot <span className="gradient-text">AI</span></span>
        </a>
        <span className="topbar-note">Research grounded in sources, not guesses.</span>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">Your research workspace</span>
          <h1>From complex questions<br />to <span className="gradient-text">clear evidence.</span></h1>
          <p className="hero-copy">
            Turn a question into a structured research report. Explore evidence,
            trace claims to sources, and spend less time searching and more time understanding.
          </p>
        </section>

        <section className="workspace" aria-labelledby="research-label">
          <div className="workspace-label">
            <label id="research-label" htmlFor="research-question">What do you want to research?</label>
            <span className="pill">AI research agent</span>
          </div>
          <textarea
            id="research-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={2000}
            placeholder="Example: What are the biggest opportunities and risks for AI adoption in African fintech?"
            aria-describedby="question-help"
          />
          <div className="controls">
            <label className="select-wrap">
              Research depth
              <select value={depth} onChange={(event) => setDepth(event.target.value)}>
                <option value="quick">Quick scan</option>
                <option value="standard">Standard research</option>
                <option value="deep">Deep research</option>
              </select>
            </label>
            <button className="primary-button" onClick={startResearch} disabled={loading}>
              {loading ? "Researching and writing…" : "Start researching"} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p id="question-help" className="status-note">
            ResearchPilot gathers web sources and writes a cited report when an AI provider is configured.
          </p>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        {result && (
          <section className="results" aria-live="polite" aria-labelledby="results-title">
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
                    <p>Claims use numbered citations linked to the source list below.</p>
                  </div>
                  <div className="report-actions">
                    <button type="button" className="secondary-button" onClick={copyReport}>Copy report</button>
                    <button type="button" className="secondary-button" onClick={downloadReport}>Download .md</button>
                  </div>
                </div>
                <ReportContent markdown={result.report_markdown} />
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
                  <article className="source-card" key={source.url}>
                    <div className="source-meta">
                      <span>Source [{index + 1}]</span>
                      {source.published_date && <span>{source.published_date}</span>}
                    </div>
                    <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a></h3>
                    <p>{source.snippet || "No preview was provided by the search provider."}</p>
                    <a className="source-link" href={source.url} target="_blank" rel="noreferrer">{new URL(source.url).hostname}</a>
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
            <h2 id="examples-title">Start with an idea</h2>
            <span>Choose a prompt to explore</span>
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
  );
}
