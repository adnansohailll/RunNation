export default function EmptyStatePage({ title, message, icon }) {
  return (
    <main className="main">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">{title}</h2>
        </div>

        <div className="empty-state-page">
          {icon}
          <p>{message}</p>
        </div>
      </div>
    </main>
  );
}
