import { bestGomokuMove, hasFive } from './pointgomoku.js';

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const boardKey = board => board.map(row => row.join('')).join('');

function countWinningMoves(board, player) {
  let count = 0;
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    if (board[r][c]) continue;
    board[r][c] = player;
    if (hasFive(board, r, c, player)) count++;
    board[r][c] = 0;
  }
  return count;
}

function evaluateBoard(board, player) {
  const opponent = 3 - player;
  const patternScores = [0, 1, 10, 100, 10000, 1000000];
  let score = 0;

  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    for (const [dr, dc] of DIRECTIONS) {
      const endR = r + dr * 4;
      const endC = c + dc * 4;
      if (endR < 0 || endR >= board.length || endC < 0 || endC >= board[r].length) continue;

      let own = 0;
      let enemy = 0;
      for (let offset = 0; offset < 5; offset++) {
        const stone = board[r + dr * offset][c + dc * offset];
        if (stone === player) own++;
        if (stone === opponent) enemy++;
      }
      if (own && enemy) continue;
      score += patternScores[own] - patternScores[enemy] * 1.1;
    }
  }
  return score;
}

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
          score: evaluateBoard(board, player),
        });
      }
      board[tr][tc] = 0;
    }
    board[r][c] = player;
  }
  choices.sort((a, b) => a.opponentWins - b.opponentWins || b.score - a.score);
  if (!choices.length) return null;
  const { opponentWins, score, ...action } = choices[0];
  return action;
}
