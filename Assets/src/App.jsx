import { useEffect, useState } from 'react';
import NumberPlace from './games/NumberPlace.jsx';
import MoveStone from './games/MoveStone.jsx';
import GuessGomoku from './games/GuessGomoku.jsx';
import Igomoku from './games/Igomoku.jsx';
import RecycleGomoku from './games/RecycleGomoku.jsx';
import CorrectPage from './games/CorrectPage.jsx';

const games = [
  { id: 'number-place', title: '数独', description: '数字を入れてパズルを完成しよう。', mark: '数', color: 'rose', Component: NumberPlace },
  { id: 'move-stone', title: '移碁', description: '石を動かして相手を囲む戦略ゲーム。', mark: '移', color: 'green', Component: MoveStone },
  { id: 'guess-gomoku', title: '予想五目', description: '相手の次の一手を予想する五目並べ。', mark: '予', color: 'amber', Component: GuessGomoku },
  { id: 'igomoku', title: '囲碁五目並べ', description: '囲碁と五目並べを組み合わせたゲーム。', mark: '碁', color: 'violet', Component: Igomoku },
  { id: 'recycle-gomoku', title: '限定五目並べ', description: '石数上限の後は石を移動して続ける五目並べ。', mark: '限', color: 'cyan', Component: RecycleGomoku },
];

function readRoute() { return window.location.hash.replace(/^#\/?/, ''); }

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const selected = games.find((game) => game.id === route);
  const GameComponent = selected?.Component;

  useEffect(() => {
    const updateRoute = () => setRoute(readRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  useEffect(() => {
    document.title = route === 'sudoku-success' ? 'Congratulation! | Shiger\'s Game' : selected ? `${selected.title} | Shiger's Game` : "Shiger's Game";
  }, [selected, route]);

  if (route === 'sudoku-success') return <CorrectPage />;
  if (selected) return <GameComponent />;

  return (
    <main className="home">
      <header className="hero">
        <div className="eyebrow">SHIGER'S GAME ROOM</div>
        <h1>{'遊ぶゲームを選ぼう'}</h1>
        <p>{'気になるゲームを選んで、すぐにプレイ。'}</p>
      </header>
      <section className="game-grid" aria-label={'ゲーム一覧'}>
        {games.map((game) => (
          <a className={`game-card ${game.color}`} href={`#/${game.id}`} key={game.id}>
            <span className="game-mark" aria-hidden="true">{game.mark}</span>
            <span className="game-info"><strong>{game.title}</strong><span>{game.description}</span></span>
            <span className="card-arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </section>
      <footer>SHIGER'S GAME ROOM <span>·</span> 2026</footer>
    </main>
  );
}
