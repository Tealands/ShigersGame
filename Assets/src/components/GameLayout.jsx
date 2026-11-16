export default function GameLayout({ title, subtitle, children, theme = 'dark' }) {
  return (
    <div className={`game-page game-theme-${theme}`}>
      <header className="game-header">
        <a href="#/" className="game-home"><span aria-hidden="true">⌂</span>タイトル画面に戻る</a>
        <div><h1>{title}</h1><p>{subtitle}</p></div>
      </header>
      {children}
      <footer className="game-footer">Shiger's Game Room · 2026</footer>
    </div>
  );
}
