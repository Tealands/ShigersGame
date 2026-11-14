import { bestGomokuMove, hasFive } from './pointgomoku.js';

export function chooseRecycleAction(board, player, limit, counts, phase, seen = new Set()) {
  if (phase === 'PLACE' && counts[player] < limit) {
    const move = bestGomokuMove(board, player);
    return move ? { type: 'PLACE', ...move } : null;
  }
  const choices = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (board[r][c] === player) {
    board[r][c] = 0;
    for (let tr = 0; tr < 15; tr++) for (let tc = 0; tc < 15; tc++) if (!board[tr][tc]) {
      board[tr][tc] = player;
      const winning = hasFive(board, tr, tc, player);
      const score = winning ? 10000 : Math.random() * 10 + (14 - Math.abs(tr - 7) - Math.abs(tc - 7));
      if (!seen.has(board.map(row => row.join('')).join(''))) choices.push({ type: 'MOVE', fromR: r, fromC: c, r: tr, c: tc, score });
      board[tr][tc] = 0;
    }
    board[r][c] = player;
  }
  choices.sort((a,b) => b.score-a.score);
  return choices[0] ?? null;
}
