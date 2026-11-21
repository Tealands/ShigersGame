import { useEffect, useMemo, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import GomokuBoard from '../components/GomokuBoard.jsx';
import { playStoneSound } from '../components/playStoneSound.js';
import { boardSaveStorageKey, readBoardSave, writeBoardSave } from '../components/boardSave.js';
import BoardSaveControls from '../components/BoardSaveControls.jsx';
import { emptyBoard, hasFive } from './pointgomoku.js';
import { chooseRecycleAction } from './recycleCpu.js';

const cloneBoard = board => board.map(row => [...row]);
const keyOf = board => board.map(row => row.join('')).join('');
const recycleSaveKey = boardSaveStorageKey('recycle-gomoku');

function isRecycleSnapshot(value) {
  return value && Array.isArray(value.board) && value.board.length === 15
    && value.board.every(row => Array.isArray(row) && row.length === 15 && row.every(cell => cell === 0 || cell === 1 || cell === 2))
    && (value.turn === 1 || value.turn === 2) && (value.mode === 'P2P' || value.mode === 'CPU')
    && Number.isInteger(value.limit) && value.limit >= 5 && value.limit <= 30
    && (value.phase === 'PLACE' || value.phase === 'MOVE')
    && Array.isArray(value.seen) && value.seen.every(item => typeof item === 'string')
    && Array.isArray(value.history) && (value.winner === 0 || value.winner === 1 || value.winner === 2);
}

export default function RecycleGomoku() {
  const [initialSave] = useState(() => readBoardSave(recycleSaveKey, isRecycleSnapshot));
  const saved = initialSave.current;
  const [board, setBoard] = useState(() => saved?.board ?? emptyBoard());
  const [turn, setTurn] = useState(() => saved?.turn ?? 1);
  const [mode, setMode] = useState(() => saved?.mode ?? 'P2P');
  const [limit, setLimit] = useState(() => saved?.limit ?? 15);
  const [limitDraft, setLimitDraft] = useState(() => saved?.limit ?? 15);
  const [phase, setPhase] = useState(() => saved?.phase ?? 'PLACE');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(() => saved?.history?.map(item => ({ ...item, seen: new Set(item.seen) })) ?? []);
  const [seen, setSeen] = useState(() => saved ? new Set(saved.seen) : new Set([keyOf(emptyBoard())]));
  const [status, setStatus] = useState('手番ごとに石を配置または移動します。');
  const [winner, setWinner] = useState(() => saved?.winner ?? 0);
  const [reviewingBoard, setReviewingBoard] = useState(false);
  const [rules, setRules] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(() => saved?.timerEnabled ?? false);
  const [seconds, setSeconds] = useState(() => saved?.seconds ?? 15);
  const [logs, setLogs] = useState(() => saved?.logs ?? []);
  const [recovery, setRecovery] = useState(initialSave.recovery);
  const snapshot = () => ({
    board: cloneBoard(board), turn, mode, limit, limitDraft, phase,
    history: history.map(item => ({ ...item, board: cloneBoard(item.board), seen: [...item.seen] })),
    seen: [...seen], winner, timerEnabled, seconds, logs,
  });
  const counts = useMemo(() => ({ 1: board.flat().filter(n => n === 1).length, 2: board.flat().filter(n => n === 2).length }), [board]);
  const actionDefault = count => count < limit ? 'PLACE' : 'MOVE';

  const reset = (nextMode = mode, nextLimit = limit) => {
    const hasProgress = board.some(row => row.some(cell => cell !== 0)) || history.length > 0 || winner > 0;
    if (hasProgress) setRecovery(snapshot());
    setBoard(emptyBoard()); setTurn(1); setMode(nextMode); setLimit(nextLimit); setLimitDraft(nextLimit); setPhase('PLACE'); setSelected(null);
    setHistory([]); setSeen(new Set([keyOf(emptyBoard())])); setWinner(0); setReviewingBoard(false); setSeconds(15); setLogs([]);
    setStatus(hasProgress ? '盤面をリセットしました。前の盤面を復元できます。' : '手番ごとに石を配置または移動します。');
  };
  const restore = () => {
    if (!recovery) return;
    setBoard(cloneBoard(recovery.board)); setTurn(recovery.turn); setMode(recovery.mode); setLimit(recovery.limit);
    setLimitDraft(recovery.limitDraft); setPhase(recovery.phase);
    setHistory(recovery.history.map(item => ({ ...item, board: cloneBoard(item.board), seen: new Set(item.seen) })));
    setSeen(new Set(recovery.seen)); setWinner(recovery.winner); setTimerEnabled(recovery.timerEnabled ?? false);
    setSeconds(recovery.seconds ?? 15); setLogs(recovery.logs ?? []); setSelected(null); setRecovery(null);
    setStatus('保存していた盤面を復元しました。');
  };
  const save = () => setHistory(items => [...items, { board: cloneBoard(board), turn, phase, seen: new Set(seen), winner }]);
  const completeTurn = (nextBoard, type, info = {}) => {
    const serialized = keyOf(nextBoard);
    if (seen.has(serialized)) { setSelected(null); setStatus('コウルール違反：過去と同じ盤面に戻る手は禁手です。'); return false; }
    playStoneSound();
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
    if (winner || (mode === 'CPU' && turn === 2)) return;
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
    const steps = mode === 'CPU' && turn === 1 && history.length > 1 ? 2 : 1;
    const past = history[history.length - steps];
    setBoard(past.board); setTurn(past.turn); setPhase(past.phase); setSeen(past.seen); setWinner(past.winner);
    setHistory(history.slice(0, -steps)); setSelected(null); setStatus('手を戻しました。');
  };
  const pass = () => { save(); const nextTurn=3-turn; setTurn(nextTurn); setPhase(actionDefault(counts[nextTurn])); setSelected(null); setSeconds(15); setLogs(old=>[{player:turn,type:'PASS'},...old]); };
  const importBoard = imported => {
    setBoard(cloneBoard(imported.board));setTurn(imported.turn);setMode(imported.mode);setLimit(imported.limit);
    setLimitDraft(imported.limitDraft ?? imported.limit);setPhase(imported.phase);
    setHistory(imported.history.map(item=>({...item,board:cloneBoard(item.board),seen:new Set(item.seen)})));
    setSeen(new Set(imported.seen));setWinner(imported.winner);setTimerEnabled(imported.timerEnabled ?? false);
    setSeconds(imported.seconds ?? 15);setLogs(imported.logs ?? []);setSelected(null);
    setStatus('JSONから盤面を復元しました。');
  };

  useEffect(() => {
    if (winner || mode !== 'CPU' || turn !== 2) return undefined;
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

  useEffect(() => {
    try { writeBoardSave(recycleSaveKey, snapshot(), recovery); }
    catch { setStatus('盤面を保存できませんでした。ブラウザーのストレージ設定をご確認ください。'); }
  }, [board, turn, mode, limit, limitDraft, phase, history, seen, winner, timerEnabled, seconds, logs, recovery]);

  return <GameLayout title="リサイクル・ゴモク" subtitle="Recycle Gomoku (15×15 / 石数変更可)" theme="recycle">
    <main className="recycle-layout"><aside className="game-sidebar">
      <section className="game-panel"><h2>対局設定</h2><div className="button-row"><button className={`game-button ${mode==='P2P'?'active':''}`} onClick={()=>reset('P2P')}>二人で遊ぶ</button><button className={`game-button ${mode==='CPU'?'active':''}`} onClick={()=>reset('CPU')}>VS CPU (後手)</button></div>
        <label className="setting-row"><span>思考時間制限</span><input type="checkbox" checked={timerEnabled} onChange={e=>setTimerEnabled(e.target.checked)}/></label>
        <label className="setting-row"><span>各プレイヤーの石の上限</span><input type="number" min="5" max="30" value={limitDraft} onChange={e=>setLimitDraft(Number(e.target.value))} onBlur={()=>reset(mode,Math.max(5,Math.min(30,limitDraft||15)))}/></label>
      </section>
      <section className="game-panel"><div className="panel-heading"><strong>{winner ? (winner===1?'黒':'白')+'の勝利' : turn===1?'黒番 (先手)':mode==='CPU'?'白番 (CPU)':'白番 (後手)'}</strong><span className="badge">{phase==='PLACE'?'配置':'移動'}</span></div>
        <p className="recycle-status">{status}</p><div className="button-row"><button className={`game-button ${phase==='PLACE'?'active':''}`} disabled={counts[turn]>=limit || (mode===String.fromCharCode(65,73) && turn===2)} onClick={()=>{setPhase('PLACE');setSelected(null);}}>石を置く</button><button className={`game-button ${phase==='MOVE'?'active':''}`} disabled={!counts[turn]} onClick={()=>{setPhase('MOVE');setSelected(null);}}>石を移動</button></div>
        {timerEnabled && <p>残り {seconds}s</p>}
        <div className="inventory"><span>⚫ {counts[1]}/{limit} ({limit-counts[1]}個未配置)</span><span>⚪ {counts[2]}/{limit} ({limit-counts[2]}個未配置)</span></div>
        <div className="button-row"><button className="game-button" disabled={!history.length} onClick={undo}>待った (1手戻す)</button><button className="game-button" onClick={pass}>パス</button><button className="game-button" onClick={()=>setRules(true)}>ルール</button></div>
        <button className="game-button full" onClick={restore} disabled={!recovery}>保存した盤面を復元</button>
        <BoardSaveControls gameId="recycle-gomoku" snapshot={snapshot} validateSnapshot={isRecycleSnapshot} onImport={importBoard} storageKey={recycleSaveKey} recovery={recovery}/>
        <p className="help-text">盤面はこのブラウザーに自動保存されます。</p>
      </section>
      <section className="game-panel"><h2>棋譜・対局履歴 <small>{logs.length}手</small></h2><div className="log-list">{logs.map((m,i)=><div className="log-entry" key={i}>{m.player===1?'黒':'白'} · {m.type==='PASS'?'パス':m.type==='PLACE'?`(${m.r+1},${m.c+1}) に配置`:`(${m.fromR+1},${m.fromC+1}) → (${m.r+1},${m.c+1})`}</div>)}</div></section>
    </aside><section className="recycle-board-area"><GomokuBoard board={board} onCell={clickCell} selected={selected} /><p className="board-caption">{phase==='PLACE'?'空き交点に石を置く':'自分の石を選んで空き交点へ移動'}</p>{reviewingBoard && <button className="game-button" onClick={() => setReviewingBoard(false)}>対局結果を見る</button>}</section></main>
    {rules && <div className="game-modal"><div><button className="modal-close" onClick={()=>setRules(false)}>×</button><h2>リサイクル・ゴモクのルール</h2><p>石数の上限まで配置し、その後は自分の石を空き交点へ移動します。五連を作ると勝利です。過去と同じ盤面には移動できません。</p><button className="game-button primary" onClick={()=>setRules(false)}>OK</button></div></div>}
    {winner>0 && !reviewingBoard && <div className="game-modal"><div><h2>{winner===1?'黒':'白'}の勝利！</h2><p>5連が完成しました</p><button className="game-button" onClick={()=>setReviewingBoard(true)}>盤面を見る</button><button className="game-button primary" onClick={()=>reset()}>もう一度遊ぶ</button></div></div>}
  </GameLayout>;
}
