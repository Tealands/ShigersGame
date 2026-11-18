import { useEffect, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import { boardSaveStorageKey, readBoardSave, writeBoardSave } from '../components/boardSave.js';
import { makeSudoku, validSudoku } from './sudoku.js';

const sudokuSaveKey = boardSaveStorageKey('number-place');

function isSudokuSnapshot(value) {
  return value
    && ['easy', 'medium', 'hard'].includes(value.difficulty)
    && value.game
    && Array.isArray(value.game.puzzle)
    && value.game.puzzle.length === 9
    && value.game.puzzle.every(row => Array.isArray(row) && row.length === 9)
    && Array.isArray(value.values)
    && value.values.length === 9
    && value.values.every(row => Array.isArray(row)
      && row.length === 9
      && row.every(value => Number.isInteger(value) && value >= 0 && value <= 9));
}

export default function NumberPlace() {
  const [initialSave] = useState(() => readBoardSave(sudokuSaveKey, isSudokuSnapshot));
  const saved = initialSave.current;
  const [game, setGame] = useState(() => saved?.game ?? makeSudoku('easy'));
  const [values, setValues] = useState(() => saved?.values ?? game.puzzle.map(row => [...row]));
  const [message, setMessage] = useState('1から9の数字を入力してください。');
  const [difficulty, setDifficulty] = useState(saved?.difficulty ?? 'easy');
  const [recovery, setRecovery] = useState(initialSave.recovery);
  const snapshot = () => ({ game, values: values.map(row => [...row]), difficulty });
  useEffect(() => {
    try {
      writeBoardSave(sudokuSaveKey, snapshot(), recovery);
    } catch {
      setMessage('盤面を保存できませんでした。ブラウザーのストレージ設定をご確認ください。');
    }
  }, [game, values, difficulty, recovery]);
  const start = level => {
    const hasProgress = values.some((row, r) => row.some((value, c) => value !== 0 && value !== game.puzzle[r][c]));
    if (hasProgress) setRecovery(snapshot());
    const next = makeSudoku(level);
    setDifficulty(level);
    setGame(next);
    setValues(next.puzzle.map(row => [...row]));
    setMessage(hasProgress ? '新しい問題を開始しました。前の盤面を復元できます。' : '1から9の数字を入力してください。');
  };
  const restore = () => {
    if (!recovery) return;
    setGame(recovery.game);
    setValues(recovery.values.map(row => [...row]));
    setDifficulty(recovery.difficulty);
    setRecovery(null);
    setMessage('保存した盤面を復元しました。');
  };
  const edit = (r, c, value) => setValues(prev => prev.map((row, y) => row.map((v, x) => y === r && x === c ? (value ? Number(value) : 0) : v)));
  const check = () => {
    if (validSudoku(values)) window.location.hash = '#/sudoku-success';
    else setMessage('まだ正しくありません。空欄や重複を確認してください。');
  };

  return <GameLayout title="Sudoku Game" subtitle="1から9の正しい整数をマスに入れてください。" theme="sudoku">
    <main className="sudoku-content">
      <section className="sudoku-card">
        <div className="sudoku-grid">
          {values.map((row, r) => row.map((value, c) => game.puzzle[r][c] ? <div key={`${r}-${c}`} className="sudoku-fixed">{game.puzzle[r][c]}</div> : <input key={`${r}-${c}`} aria-label={`${r+1}行${c+1}列`} type="number" min="1" max="9" value={value || ''} onChange={e => edit(r,c,e.target.value.slice(-1))} />))}
        </div>
        <p className="sudoku-message" role="status">{message}</p>
        <div className="sudoku-controls"><div>{['easy','medium','hard'].map(level => <button className={difficulty === level ? 'active' : ''} key={level} onClick={() => start(level)}>{level[0].toUpperCase()+level.slice(1)}</button>)}</div><button className="primary" onClick={check}>Check Solution</button></div>
        <div className="button-row sudoku-recovery"><button className="game-button" onClick={restore} disabled={!recovery}>保存した盤面を復元</button></div>
        <p className="help-text">盤面はこのブラウザーに自動保存されます。</p>
      </section>
    </main>
  </GameLayout>;
}
