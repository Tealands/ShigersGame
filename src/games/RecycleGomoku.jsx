import { useEffect, useMemo, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import GomokuBoard from '../components/GomokuBoard.jsx';
import { emptyBoard, hasFive } from './pointgomoku.js';
import { chooseRecycleAction } from './recycleCpu.js';

const cloneBoard = board => board.map(row => [...row]);
const keyOf = board => board.map(row => row.join('')).join('');

export default function RecycleGomoku() {
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(1);
  const [mode, setMode] = useState('P2P');
  const [limit, setLimit] = useState(15);
  const [limitDraft, setLimitDraft] = useState(15);
  const [phase, setPhase] = useState('PLACE');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [seen, setSeen] = useState(() => new Set([keyOf(emptyBoard())]));
  const [status, setStatus] = useState('手番ごとに石を配置または移動します。');
  const [winner, setWinner] = useState(0);
  const [reviewingBoard, setReviewingBoard] = useState(false);
  const [rules, setRules] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [seconds, setSeconds] = useState(15);
  const [logs, setLogs] = useState([]);
  const counts = useMemo(() => ({ 1: board.flat().filter(n => n === 1).length, 2: board.flat().filter(n => n === 2).length }), [board]);
  const actionDefault = count => count < limit ? 'PLACE' : 'MOVE';

  const reset = (nextMode = mode, nextLimit = limit) => {
    setBoard(emptyBoard()); setTurn(1); setMode(nextMode); setLimit(nextLimit); setLimitDraft(nextLimit); setPhase('PLACE'); setSelected(null);
    setHistory([]); setSeen(new Set([keyOf(emptyBoard())])); setWinner(0); setReviewingBoard(false); setSeconds(15); setLogs([]);
    setStatus('手番ごとに石を配置または移動します。');
  };
  const save = () => setHistory(items => [...items, { board: cloneBoard(board), turn, phase, seen: new Set(seen), winner }]);
  const completeTurn = (nextBoard, type, info = {}) => {
    const serialized = keyOf(nextBoard);
    if (seen.has(serialized)) { setSelected(null); setStatus('コウルール違反：過去と同じ盤面に戻る手は禁手です。'); return false; }
    save(); setBoard(nextBoard); setSeen(old => new Set([...old, serialized]));
    setLogs(old => [{ player: turn, type, ...info }, ...old].slice(0, 40));
    const pos = info.r !== undefined ? `(${info.r+1}, ${info.c+1})` : '';
    setStatus(type === 'PLACE' ? `${turn === 1 ? '黒' : '白'}: ${pos} に配置` : type === 'MOVE' ? `${turn === 1 ? '黒' : '白'}: 石を移動` : 'パスしました');
    if (info.r !== undefined && hasFive(nextBoard, info.r, info.c, turn)) { setWinner(turn); return true; }
    const nextTurn = 3 - turn;
    setTurn(nextTurn); setPhase(actionDefault(nextBoard.flat().filter(n => n === nextTurn).length)); setSelected(null); setSeconds(15);
    return true;
  };
  const clickCell = (r,c) => {
    if (winner || (mode === 'AI' && turn === 2)) return;
    if (phase === 'PLACE') {
      if (counts[turn] >= limit) { setStatus('石の上限です。移動フェーズを選んでください。'); return; }
      if (board[r][c]) return;
      const next = cloneBoard(board); next[r][c] = turn; completeTurn(next, 'PLACE', { r, c }); return;
    }
    if (!selected) { if (board[r][c] === turn) setSelected({r,c}); else setStatus('移動させる自分の石を選んでください。'); return; }
    if (selected.r === r && selected.c === c) { setSelected(null); return; }
    if (board[r][c]) { if (board[r][c] === turn) setSelected({r,c}); return; }
    const next = cloneBoard(board); next[selected.r][selected.c] = 0; next[r][c] = turn;
    completeTurn(next, 'MOVE', { fromR: selected.r, fromC: selected.c, r, c });
  };
  const undo = () => {
    if (!history.length) return;
    const steps = mode === 'AI' && turn === 1 && history.length > 1 ? 2 : 1;
    const past = history[history.length - steps];
    setBoard(past.board); setTurn(past.turn); setPhase(past.phase); setSeen(past.seen); setWinner(past.winner);
    setHistory(history.slice(0, -steps)); setSelected(null); setStatus('手を戻しました。');
  };
  const pass = () => { save(); const nextTurn=3-turn; setTurn(nextTurn); setPhase(actionDefault(counts[nextTurn])); setSelected(null); setSeconds(15); setLogs(old=>[{player:turn,type:'PASS'},...old]); };

  useEffect(() => {
    if (winner || mode !== 'AI' || turn !== 2) return undefined;
    const id = setTimeout(() => {
      const action = chooseRecycleAction(cloneBoard(board), 2, limit, counts, actionDefault(counts[2]), seen);
      if (!action) { pass(); return; }
      if (action.type === 'PLACE') { const next=cloneBoard(board); next[action.r][action.c]=2; completeTurn(next,'PLACE',action); }
      else { const next=cloneBoard(board); next[action.fromR][action.fromC]=0; next[action.r][action.c]=2; completeTurn(next,'MOVE',action); }
    }, 450);
    return () => clearTimeout(id);
  }, [board, turn, mode, limit, winner, seen]);

  useEffect(() => {
    if (!timerEnabled || winner) return undefined;
    const id = setInterval(() => setSeconds(s => { if (s <= 1) { const nextTurn=3-turn; setStatus('時間切れ。手番を交代します。'); setTurn(nextTurn); setPhase(actionDefault(counts[nextTurn])); setSelected(null); return 15; } return s - 1; }), 1000);
    return () => clearInterval(id);
  }, [timerEnabled, turn, winner]);

  return <GameLayout title="リサイクル・ゴモク" subtitle="Recycle Gomoku (15×15 / 石数変更可)" theme="recycle">
    <main className="recycle-layout"><aside className="game-sidebar">
      <section className="game-panel"><h2>対局設定</h2><div className="button-row"><button className={`game-button ${mode==='P2P'?'active':''}`} onClick={()=>reset('P2P')}>二人で遊ぶ</button><button className={`game-button ${mode==='AI'?'active':''}`} onClick={()=>reset('AI')}>VS AI (後手)</button></div>
        <label className="setting-row"><span>思考時間制限</span><input type="checkbox" checked={timerEnabled} onChange={e=>setTimerEnabled(e.target.checked)}/></label>
        <label className="setting-row"><span>各プレイヤーの石の上限</span><input type="number" min="5" max="30" value={limitDraft} onChange={e=>setLimitDraft(Number(e.target.value))} onBlur={()=>reset(mode,Math.max(5,Math.min(30,limitDraft||15)))}/></label>
      </section>
      <section className="game-panel"><div className="panel-heading"><strong>{winner ? (winner===1?'黒':'白')+'の勝利' : turn===1?'黒番 (先手)':mode==='AI'?'白番 (AI)':'白番 (後手)'}</strong><span className="badge">{phase==='PLACE'?'配置':'移動'}</span></div>
        <p className="recycle-status">{status}</p><div className="button-row"><button className={`game-button ${phase==='PLACE'?'active':''}`} disabled={counts[turn]>=limit || (mode===String.fromCharCode(65,73) && turn===2)} onClick={()=>{setPhase('PLACE');setSelected(null);}}>石を置く</button><button className={`game-button ${phase==='MOVE'?'active':''}`} disabled={!counts[turn]} onClick={()=>{setPhase('MOVE');setSelected(null);}}>石を移動</button></div>
        {timerEnabled && <p>残り {seconds}s</p>}
        <div className="inventory"><span>⚫ {counts[1]}/{limit} ({limit-counts[1]}個未配置)</span><span>⚪ {counts[2]}/{limit} ({limit-counts[2]}個未配置)</span></div>
        <div className="button-row"><button className="game-button" disabled={!history.length} onClick={undo}>待った (1手戻す)</button><button className="game-button" onClick={pass}>パス</button><button className="game-button" onClick={()=>setRules(true)}>ルール</button></div>
      </section>
      <section className="game-panel"><h2>棋譜・対局履歴 <small>{logs.length}手</small></h2><div className="log-list">{logs.map((m,i)=><div className="log-entry" key={i}>{m.player===1?'黒':'白'} · {m.type==='PASS'?'パス':m.type==='PLACE'?`(${m.r+1},${m.c+1}) に配置`:`(${m.fromR+1},${m.fromC+1}) → (${m.r+1},${m.c+1})`}</div>)}</div></section>
    </aside><section className="recycle-board-area"><GomokuBoard board={board} onCell={clickCell} selected={selected} /><p className="board-caption">{phase==='PLACE'?'空き交点に石を置く':'自分の石を選んで空き交点へ移動'}</p>{reviewingBoard && <button className="game-button" onClick={() => setReviewingBoard(false)}>対局結果を見る</button>}</section></main>
    {rules && <div className="game-modal"><div><button className="modal-close" onClick={()=>setRules(false)}>×</button><h2>リサイクル・ゴモクのルール</h2><p>石数の上限まで配置し、その後は自分の石を空き交点へ移動します。五連を作ると勝利です。過去と同じ盤面には移動できません。</p><button className="game-button primary" onClick={()=>setRules(false)}>OK</button></div></div>}
    {winner>0 && !reviewingBoard && <div className="game-modal"><div><h2>{winner===1?'黒':'白'}の勝利！</h2><p>5連が完成しました</p><button className="game-button" onClick={()=>setReviewingBoard(true)}>盤面を見る</button><button className="game-button primary" onClick={()=>reset()}>もう一度遊ぶ</button></div></div>}
  </GameLayout>;
}
