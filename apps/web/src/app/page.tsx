"use client";

import { useState } from "react";

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

export default function Home() {
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState("standard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startResearch() {
    const trimmed = question.trim();
    if (trimmed.length < 12) {
      setError("Please enter a research question with a little more detail.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/v1/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, depth }),
      });
      if (!response.ok) {
        throw new Error(response.status === 404
          ? "The research API is not connected yet. The next milestone adds the research pipeline."
          : `Research request failed (${response.status}). Please try again.`);
      }
      const result: unknown = await response.json();
      setError("The API accepted the request, but the report workspace is still being built.");
      console.info("Research request response", result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the API. Check that the backend is running.");
    } finally {
      setLoading(false);
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
              {loading ? "Connecting…" : "Start researching"} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p id="question-help" className="status-note">
            Research results will include source links so you can verify the evidence.
          </p>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

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
                onClick={() => { setQuestion(example.prompt); setError(""); }}
              >
                <span className="example-icon" aria-hidden="true">{example.icon}</span>
                <span className="example-title">{example.title}</span>
                <span className="example-desc">{example.description}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="footer">
          <span>ResearchPilot AI · Early development</span>
          <span>Evidence first. Clear reasoning. Traceable sources.</span>
        </footer>
      </main>
    </div>
  );
}
