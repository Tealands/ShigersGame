import { useEffect, useRef, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import GomokuBoard from '../components/GomokuBoard.jsx';
import { bestGomokuMove, emptyBoard, hasFive } from './pointgomoku.js';

export default function GuessGomoku() {
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(1);
  const [vsAi, setVsAi] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [prediction, setPrediction] = useState(null);
  const predictionRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, hits: 0, ppoints: 0, score: 0 });
  const [result, setResult] = useState(null);
  const [ended, setEnded] = useState(false);
  const [reviewingBoard, setReviewingBoard] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);
  const log = (message, type = 'info') => setLogs(old => [{ message, type, time: new Date().toLocaleTimeString() }, ...old].slice(0, 30));
  const restart = (mode = vsAi) => {
    clearTimeout(timerRef.current); setVsAi(mode); setBoard(emptyBoard()); setTurn(1); setThinking(false); setCountdown(3);
    setPrediction(null); predictionRef.current = null; setLogs([]); setStats(s => ({ ...s, total: 0, hits: 0, ppoints: 0 })); setResult(null); setEnded(false); setReviewingBoard(false);
  };
  const place = (next, r, c, player) => {
    next[r][c] = player;
    setBoard(next);
    if (player === 2 && predictionRef.current) {
      const hit = predictionRef.current.r === r && predictionRef.current.c === c;
      setStats(s => ({ ...s, total: s.total + 1, hits: s.hits + (hit ? 1 : 0), ppoints: s.ppoints + (hit ? 1 : -1) }));
      log(hit ? '予想的中！ +1 pt' : '予想は外れ… -1 pt', hit ? 'success' : 'miss');
      predictionRef.current = null; setPrediction(null);
    }
    if (hasFive(next, r, c, player)) {
      setEnded(true);
      const userWon = !vsAi || player === 1;
      if (userWon) setStats(s => ({ ...s, score: s.score + 100 }));
      setResult(userWon ? '勝利！ +100 pt' : '敗北…');
      log(userWon ? 'あなたの勝利！' : '相手の勝利です', userWon ? 'success' : 'miss');
      return true;
    }
    if (next.every(row => row.every(cell => cell))) { setEnded(true); setResult('引き分け'); return true; }
    return false;
  };
  const handleCell = (r, c) => {
    if (ended || board[r][c]) return;
    if (vsAi && turn === 2) {
      setPrediction({ r, c }); predictionRef.current = { r, c };
      log(`次手予想: ${r + 1}行 ${c + 1}列`);
      return;
    }
    const next = board.map(row => [...row]);
    if (place(next, r, c, turn)) return;
    const nextTurn = turn === 1 ? 2 : 1;
    setTurn(nextTurn);
    if (vsAi && nextTurn === 2) {
      setThinking(true); setCountdown(3);
      let remaining = 3;
      const tick = () => {
        remaining -= 1; setCountdown(Math.max(remaining, 0));
        if (remaining > 0) timerRef.current = setTimeout(tick, 1000);
        else {
          const move = bestGomokuMove(next, 2);
          setThinking(false);
          if (move && !place(next, move.r, move.c, 2)) setTurn(1);
        }
      };
      timerRef.current = setTimeout(tick, 1000);
    }
  };
  const accuracy = stats.total ? Math.round(stats.hits / stats.total * 100) : 0;

  return <GameLayout title="Gomoku Prediction" subtitle="待ち時間に次の一手を予想" theme="prediction">
    <main className="prediction-layout">
      <aside className="game-sidebar">
        <section className="game-panel"><div className="panel-heading"><span>対局ステータス</span><span className="badge">{vsAi ? 'VS AI' : '2P'}</span></div>
          <div className="turn-card"><i className={`turn-disc ${turn === 1 ? 'black' : 'white'}`} /><div><small>手番</small><strong>{thinking ? `AI思考中 (${countdown}s)` : turn === 1 ? 'あなたの番 (黒)' : vsAi ? 'AIの番 (白)' : '白の番'}</strong></div></div>
          <div className="prediction-card"><strong>次手予想</strong><p>AIが考えている間に、次に打つ場所を選んでください。</p><span>的中 +1 pt　·　外れ -1 pt</span><small>勝利ボーナス +100 pt</small></div>
          <div className="stats-row"><div><small>予想数</small><b>{stats.total}</b></div><div><small>的中</small><b>{stats.hits}</b></div><div><small>的中率</small><b>{accuracy}%</b></div></div>
          <button className="game-button primary full" onClick={() => restart()}>盤面リセット</button>
          <div className="button-row"><button className="game-button" onClick={() => restart(true)}>VS AI</button><button className="game-button" onClick={() => restart(false)}>2P 対戦</button></div>
        </section>
        <section className="game-panel"><h2>予想ログ・対局履歴</h2><div className="log-list">{logs.length ? logs.map((entry,i)=><div className={`log-entry ${entry.type}`} key={i}><span>{entry.message}</span><time>{entry.time}</time></div>) : <p className="muted">対局が始まると予想結果が表示されます</p>}</div></section>
      </aside>
      <section className="prediction-board-area"><GomokuBoard board={board} onCell={handleCell} lastMove={null} prediction={prediction} /><p className="board-caption">黒：先手　·　白：後手　·　🎯：予想位置</p>{reviewingBoard && <button className="game-button" onClick={() => setReviewingBoard(false)}>対局結果を見る</button>}</section>
    </main>
    {result && !reviewingBoard && <div className="game-modal"><div><h2>{result}</h2><p>予想的中 {stats.hits} / {stats.total}　獲得ポイント {stats.ppoints}</p><button className="game-button" onClick={() => setReviewingBoard(true)}>盤面を見る</button><button className="game-button primary" onClick={() => restart()}>もう一度遊ぶ</button></div></div>}
    <div className="score-corner">TOTAL <strong>{stats.score}</strong> pt</div>
  </GameLayout>;
}
