export default function GomokuBoard({ board, onCell, lastMove, prediction, selected, size = 15, label = 'ゲーム盤' }) {
  return (
    <div className="gomoku-board-wrap">
      <div className="gomoku-board" role="grid" aria-label={label} style={{ '--board-size': size, '--grid-offset': `${50 / (size - 1)}%` }}>
        {board.map((row, r) => row.map((stone, c) => {
          const isLast = lastMove?.r === r && lastMove?.c === c;
          const isPrediction = prediction?.r === r && prediction?.c === c;
          const isSelected = selected?.r === r && selected?.c === c;
          return (
            <button className={`gomoku-cell ${isSelected ? 'selected' : ''}`} key={`${r}-${c}`} onClick={() => onCell(r, c)} aria-label={`${r + 1}行${c + 1}列${stone ? stone === 1 ? ' 黒石' : ' 白石' : ''}`}>
              {(size === 9 ? [2, 4, 6] : size === 13 ? [3, 6, 9] : size === 15 ? [3, 7, 11] : [3, 9, 15]).includes(r) && (size === 9 ? [2, 4, 6] : size === 13 ? [3, 6, 9] : size === 15 ? [3, 7, 11] : [3, 9, 15]).includes(c) && <i className="star-ppoint" />}
              {stone !== 0 && <i className={`stone stone-${stone === 1 ? 'black' : 'white'}`}>{isLast && <b />}</i>}
              {isPrediction && !stone && <i className="prediction-dot">🎯</i>}
            </button>
          );
        }))}
      </div>
    </div>
  );
}
