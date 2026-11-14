import { useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import { makeSudoku, validSudoku } from './sudoku.js';

export default function NumberPlace() {
  const [game, setGame] = useState(() => makeSudoku('easy'));
  const [values, setValues] = useState(() => game.puzzle.map(row => [...row]));
  const [message, setMessage] = useState('1から9の数字を入力してください。');
  const [difficulty, setDifficulty] = useState('easy');
  const start = level => { const next = makeSudoku(level); setDifficulty(level); setGame(next); setValues(next.puzzle.map(row => [...row])); setMessage('1から9の数字を入力してください。'); };
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
      </section>
    </main>
  </GameLayout>;
}
