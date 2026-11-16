import {
  bestGomokuMove,
  countActiveThreeThreats,
  countWinningMoves,
  evaluateGomokuBoard,
  hasFive,
} from './pointgomoku.js';

const boardKey = board => board.map(row => row.join('')).join('');

export function chooseRecycleAction(board, player, limit, counts, phase, seen = new Set()) {
  if (phase === 'PLACE' && counts[player] < limit) {
    const move = bestGomokuMove(board, player);
    return move ? { type: 'PLACE', ...move } : null;
  }
  const opponent = 3 - player;
  const choices = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (board[r][c] === player) {
    board[r][c] = 0;
    for (let tr = 0; tr < 15; tr++) for (let tc = 0; tc < 15; tc++) if (!board[tr][tc]) {
      board[tr][tc] = player;
      const serialized = boardKey(board);
      if (!seen.has(serialized)) {
        const winning = hasFive(board, tr, tc, player);
        if (winning) {
          board[tr][tc] = 0;
          board[r][c] = player;
          return { type: 'MOVE', fromR: r, fromC: c, r: tr, c: tc };
        }
        choices.push({
          type: 'MOVE',
          fromR: r,
          fromC: c,
          r: tr,
          c: tc,
          opponentWins: countWinningMoves(board, opponent),
          opponentActiveThrees: countActiveThreeThreats(board, opponent),
          score: evaluateGomokuBoard(board, player),
        });
      }
      board[tr][tc] = 0;
    }
    board[r][c] = player;
  }
  choices.sort((a, b) => a.opponentWins - b.opponentWins
    || a.opponentActiveThrees - b.opponentActiveThrees
    || b.score - a.score);
  if (!choices.length) return null;
  const { opponentWins, opponentActiveThrees, score, ...action } = choices[0];
  return action;
}
