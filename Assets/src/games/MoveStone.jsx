import { useEffect, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import GomokuBoard from '../components/GomokuBoard.jsx';
import { playStoneSound } from '../components/playStoneSound.js';
import { boardSaveStorageKey, readBoardSave, writeBoardSave } from '../components/boardSave.js';
import { emptyBoard } from './pointgomoku.js';

const cloneBoard = board => board.map(row => [...row]);
const legacyStorageKey = size => `shigers.move-stone.v1.${size}`;
const storageKey = size => boardSaveStorageKey('move-stone', String(size));

function isGameSnapshot(value, size) {
  return value
    && Array.isArray(value.board)
    && value.board.length === size
    && value.board.every(row => Array.isArray(row)
      && row.length === size
      && row.every(stone => stone === 0 || stone === 1 || stone === 2))
    && (value.turn === 1 || value.turn === 2)
    && typeof value.moveMode === 'boolean'
    && Number.isInteger(value.moves)
    && value.moves >= 0
    && value.moves <= 1
    && value.captures
    && Number.isInteger(value.captures[1])
    && value.captures[1] >= 0
    && Number.isInteger(value.captures[2])
    && value.captures[2] >= 0
    && Number.isInteger(value.passStreak)
    && value.passStreak >= 0
    && value.passStreak <= 2
    && typeof value.finished === 'boolean'
    && (value.winner === 0 || value.winner === 1 || value.winner === 2);
}

function readSavedGame(size) {
  const saved = readBoardSave(storageKey(size), value => isGameSnapshot(value, size));
  if (saved.current || saved.recovery || saved.error) return saved;

  try {
    const stored = window.localStorage.getItem(legacyStorageKey(size));
    if (!stored) return saved;
    const data = JSON.parse(stored);
    if (data?.version !== 1 || data.size !== size) return saved;
    return {
      current: isGameSnapshot(data.current, size) ? data.current : null,
      recovery: isGameSnapshot(data.recovery, size) ? data.recovery : null,
      error: data.current && !isGameSnapshot(data.current, size)
        ? '保存データが壊れていたため、新しい対局を開始します。'
        : '',
    };
  } catch {
    return saved;
  }
}

function captureSurrounded(board, target) {
  const next = cloneBoard(board);
  const visited = new Set();
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let captured = 0;

  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next.length; c++) {
      if (next[r][c] !== target || visited.has(`${r},${c}`)) continue;
      const group = [];
      const queue = [[r, c]];
      const liberties = new Set();
      visited.add(`${r},${c}`);

      while (queue.length) {
        const [y, x] = queue.pop();
        group.push([y, x]);
        for (const [dy, dx] of directions) {
          const ny = y + dy;
          const nx = x + dx;
          const key = `${ny},${nx}`;
          if (next[ny]?.[nx] === 0) liberties.add(key);
          else if (next[ny]?.[nx] === target && !visited.has(key)) {
            visited.add(key);
            queue.push([ny, nx]);
          }
        }
      }

      if (!liberties.size) {
        group.forEach(([y, x]) => {
          next[y][x] = 0;
          captured++;
        });
      }
    }
  }
  return { board: next, captured };
}

export default function MoveStone() {
  const querySize = Number(new URLSearchParams(window.location.search).get('size'));
  const size = [9, 13, 19].includes(querySize) ? querySize : 19;
  const [initialSave] = useState(() => readSavedGame(size));
  const saved = initialSave.current;
  const [board, setBoard] = useState(() => saved ? cloneBoard(saved.board) : emptyBoard(size));
  const [turn, setTurn] = useState(() => saved?.turn ?? 1);
  const [moveMode, setMoveMode] = useState(() => saved?.moveMode ?? false);
  const [moves, setMoves] = useState(() => saved?.moves ?? 0);
  const [captures, setCaptures] = useState(() => saved ? { ...saved.captures } : { 1: 0, 2: 0 });
  const [passStreak, setPassStreak] = useState(() => saved?.passStreak ?? 0);
  const [finished, setFinished] = useState(() => saved?.finished ?? false);
  const [winner, setWinner] = useState(() => saved?.winner ?? 0);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [recovery, setRecovery] = useState(() => initialSave.recovery);
  const [storageError, setStorageError] = useState('');
  const [message, setMessage] = useState(() => initialSave.error
    || (saved ? '保存した盤面を復元しました。' : '空き交点に置くか、移動モードで石を動かします。'));

  const gameSnapshot = () => ({
    board: cloneBoard(board),
    turn,
    moveMode,
    moves,
    captures: { ...captures },
    passStreak,
    finished,
    winner,
  });
  const snapshot = () => setHistory(items => [...items, gameSnapshot()]);
  const switchTurn = () => {
    setTurn(current => 3 - current);
    setMoveMode(false);
    setMoves(0);
    setSelected(null);
  };

  useEffect(() => {
    try {
      writeBoardSave(storageKey(size), gameSnapshot(), recovery);
      setStorageError('');
    } catch {
      setStorageError('盤面を保存できませんでした。ブラウザーのストレージ設定をご確認ください。');
    }
  }, [board, turn, moveMode, moves, captures, passStreak, finished, winner, recovery, size]);

  const clickCell = (r, c) => {
    if (finished) return;
    if (!moveMode) {
      if (board[r][c]) {
        setMessage('そこには置けません。');
        return;
      }
      playStoneSound();
      snapshot();
      const next = cloneBoard(board);
      next[r][c] = turn;
      const result = captureSurrounded(next, 3 - turn);
      setBoard(result.board);
      if (result.captured) {
        setCaptures(current => ({ ...current, [turn]: current[turn] + result.captured }));
      }
      setPassStreak(0);
      switchTurn();
      setMessage(result.captured
        ? `${turn === 1 ? '黒' : '白'}が相手の石を${result.captured}個取りました。`
        : '石を配置しました。');
      return;
    }
    if (!selected) {
      if (board[r][c] === turn) setSelected({ r, c });
      else setMessage('自分の石を選んでください。');
      return;
    }
    if (board[r][c] || (Math.abs(selected.r - r) + Math.abs(selected.c - c) !== 1)) {
      setMessage('隣の空点を移動先に選んでください。');
      return;
    }
    playStoneSound();
    snapshot();
    const next = cloneBoard(board);
    next[selected.r][selected.c] = 0;
    next[r][c] = turn;
    const result = captureSurrounded(next, 3 - turn);
    setBoard(result.board);
    if (result.captured) {
      setCaptures(current => ({ ...current, [turn]: current[turn] + result.captured }));
    }
    setPassStreak(0);
    setSelected(null);
    if (moves + 1 >= 2) {
      switchTurn();
      setMessage(result.captured
        ? `石を移動し、相手の石を${result.captured}個取って手番を交代しました。`
        : '石を移動し、手番を交代しました。');
    } else {
      setMoves(current => current + 1);
      setMessage(result.captured
        ? `石を移動し、相手の石を${result.captured}個取りました。あと1回移動できます。`
        : 'あと1回移動できます。');
    }
  };

  const toggleMove = () => {
    if (finished) return;
    setMoveMode(value => !value);
    setSelected(null);
    setMoves(0);
  };

  const pass = () => {
    if (finished) return;
    snapshot();
    setSelected(null);
    setMoveMode(false);
    setMoves(0);
    if (passStreak >= 1) {
      setPassStreak(2);
      setFinished(true);
      setWinner(0);
      setMessage('連続パスにより対局を終了しました。');
      return;
    }
    setPassStreak(1);
    setMessage(`${turn === 1 ? '黒' : '白'}がパスしました。`);
    switchTurn();
  };

  const resign = () => {
    if (finished || !window.confirm(`${turn === 1 ? '黒' : '白'}が投了します。よろしいですか？`)) return;
    snapshot();
    setFinished(true);
    setWinner(3 - turn);
    setSelected(null);
    setMessage(`${turn === 1 ? '黒' : '白'}が投了しました。`);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setBoard(previous.board);
    setTurn(previous.turn);
    setMoveMode(previous.moveMode);
    setMoves(previous.moves);
    setCaptures(previous.captures);
    setPassStreak(previous.passStreak);
    setFinished(previous.finished);
    setWinner(previous.winner);
    setHistory(items => items.slice(0, -1));
    setSelected(null);
    setMessage('1手戻しました。');
  };

  const newGame = () => {
    const current = gameSnapshot();
    const hasProgress = board.some(row => row.some(stone => stone !== 0))
      || history.length > 0
      || turn !== 1
      || captures[1] > 0
      || captures[2] > 0
      || passStreak > 0
      || finished;
    if (hasProgress) setRecovery(current);
    setBoard(emptyBoard(size));
    setTurn(1);
    setCaptures({ 1: 0, 2: 0 });
    setPassStreak(0);
    setFinished(false);
    setWinner(0);
    setHistory([]);
    setMoveMode(false);
    setMoves(0);
    setSelected(null);
    setMessage(hasProgress ? '新しい対局を開始しました。前の盤面は復元できます。' : '新しい対局を開始しました。');
  };

  const restore = () => {
    if (!recovery) return;
    setRecovery(gameSnapshot());
    setBoard(cloneBoard(recovery.board));
    setTurn(recovery.turn);
    setMoveMode(recovery.moveMode);
    setMoves(recovery.moves);
    setCaptures({ ...recovery.captures });
    setPassStreak(recovery.passStreak);
    setFinished(recovery.finished);
    setWinner(recovery.winner);
    setHistory([]);
    setSelected(null);
    setMessage('保存していた盤面を復元しました。');
  };

  return <GameLayout title="移碁" subtitle="石を動かして相手を囲む、戦略型ボードゲーム" theme="moves">
    <main className="moves-layout">
      <aside className="game-sidebar">
        <section className="game-panel">
          <p className="eyebrow">対局状況</p>
          <div className="moves-turn">
            {!finished && <i className={`turn-disc ${turn === 1 ? 'black' : 'white'}`} />}
            {finished
              ? winner ? `${winner === 1 ? '黒' : '白'}の勝利` : '対局終了'
              : turn === 1 ? '黒の手番' : '白の手番'}
          </div>
          <div className="capture-counts moves-capture-counts">
            <div>⚫ 黒が取った石 <b>{captures[1]}</b></div>
            <div>⚪ 白が取った石 <b>{captures[2]}</b></div>
          </div>
          <p className="moves-message">{message}</p>
          {storageError && <p className="help-text" role="alert">{storageError}</p>}
          <div className="button-column">
            <button className={`game-button primary ${moveMode ? 'active' : ''}`} disabled={finished} onClick={toggleMove}>
              {moveMode ? '通常モードへ' : '石の移動モード'}
            </button>
            <div className="button-row">
              <button className="game-button" disabled={!history.length} onClick={undo}>1手戻す</button>
              <button className="game-button" onClick={pass} disabled={finished}>パス</button>
            </div>
            <div className="button-row">
              <button className="game-button" onClick={resign} disabled={finished}>投了</button>
              <button className="game-button" onClick={newGame}>新しい対局</button>
            </div>
            <button className="game-button" onClick={restore} disabled={!recovery}>保存した盤面を復元</button>
          </div>
          {moveMode && !finished && <p className="help-text">自分の石を選び、隣の空点を選ぶと移動。手番ごとに2回まで移動できます。</p>}
          {passStreak === 1 && !finished && <p className="help-text">次のパスで対局終了です。</p>}
          <p className="help-text">盤面はこのブラウザーに自動保存されます。新しい対局を始めると、直前の盤面を復元できます。</p>
        </section>
      </aside>
      <section className="moves-board-area">
        <GomokuBoard board={board} size={size} onCell={clickCell} selected={selected} />
        <p className="board-caption">{size} × {size} · {finished ? '対局終了' : moveMode ? '移動モード' : '配置モード'}</p>
      </section>
    </main>
  </GameLayout>;
}
