import { useState } from "react";

const TABS = [
  { key: "bib", label: "Bib Exchange", message: "No bibs up for grabs yet — be the first to list one." },
  { key: "shoe", label: "Shoe Exchange", message: "No shoes up for grabs yet — be the first to list a pair." },
];

export default function Exchange() {
  const [tab, setTab] = useState("bib");
  const activeMessage = TABS.find((t) => t.key === tab).message;

  return (
    <main className="main">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Exchange</h2>
        </div>

        <div className="exchange-tabs" role="tablist">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`exchange-tab-btn${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="empty-state-page">
          <p>{activeMessage}</p>
        </div>
      </div>
    </main>
  );
}
