export const SIZE = 15;
export const emptyBoard = (size = SIZE) => Array.from({ length: size }, () => Array(size).fill(0));

export function hasFive(board, r, c, player) {
  for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let y = r + dr * sign, x = c + dc * sign;
      while (board[y]?.[x] === player) { count++; y += dr * sign; x += dc * sign; }
    }
    if (count >= 5) return true;
  }
  return false;
}

export function countWinningMoves(board, player) {
  let count = 0;
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    if (board[r][c]) continue;
    board[r][c] = player;
    if (hasFive(board, r, c, player)) count++;
    board[r][c] = 0;
  }
  return count;
}

export function countActiveThreeThreats(board, player) {
  const threats = new Set();
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    for (const [dr, dc] of directions) {
      const endR = r + dr * 5;
      const endC = c + dc * 5;
      if (endR < 0 || endR >= board.length || endC < 0 || endC >= board[r].length) continue;
      if (board[r][c] !== 0 || board[endR][endC] !== 0) continue;

      let stones = 0;
      let extension = null;
      let blocked = false;
      for (let offset = 1; offset <= 4; offset++) {
        const row = r + dr * offset;
        const column = c + dc * offset;
        const cell = board[row][column];
        if (cell === 3 - player) {
          blocked = true;
          break;
        }
        if (cell === player) stones++;
        else extension = { row, column };
      }

      if (!blocked && stones === 3 && extension) {
        threats.add(`${extension.row},${extension.column},${dr},${dc}`);
      }
    }
  }
  return threats.size;
}

export function evaluateGomokuBoard(board, player) {
  const opponent = 3 - player;
  const patternScores = [0, 1, 10, 100, 10000, 1000000];
  let score = 0;

  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
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

export function bestGomokuMove(board, player = 2) {
  const opponent = player === 1 ? 2 : 1;
  const candidates = [];
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board.length; c++) {
    if (board[r][c]) continue;
    board[r][c] = player;
    if (hasFive(board, r, c, player)) { board[r][c] = 0; return { r, c }; }
    const positionScore = evaluateGomokuBoard(board, player);
    board[r][c] = 0;
    const center = (board.length - 1) / 2;
    candidates.push({
      r,
      c,
      opponentWins: countWinningMoves(board, opponent),
      opponentActiveThrees: countActiveThreeThreats(board, opponent),
      score: positionScore + board.length - Math.abs(r - center) - Math.abs(c - center),
    });
  }
  candidates.sort((a, b) => a.opponentWins - b.opponentWins
    || a.opponentActiveThrees - b.opponentActiveThrees
    || b.score - a.score);
  return candidates.length ? { r: candidates[0].r, c: candidates[0].c } : null;
}

export function getGroup(board, startR, startC) {
  const player = board[startR][startC], queue = [[startR,startC]], group = [], liberties = new Set(), visited = new Set([`${startR},${startC}`]);
  while (queue.length) {
    const [r,c] = queue.shift(); group.push({r,c});
    for (const [dr,dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
      const nr=r+dr,nc=c+dc,key=`${nr},${nc}`;
      if (board[nr]?.[nc] === 0) liberties.add(key);
      else if (board[nr]?.[nc] === player && !visited.has(key)) { visited.add(key); queue.push([nr,nc]); }
    }
  }
  return { group, liberties };
}

export function captureMove(board, r, c, player) {
  const next = board.map(row => [...row]);
  if (next[r][c]) return null;
  next[r][c] = player;
  const opponent = 3 - player, taken = [], checked = new Set();
  for (const [dr,dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
    const nr=r+dr,nc=c+dc,key=`${nr},${nc}`;
    if (next[nr]?.[nc] === opponent && !checked.has(key)) {
      const {group,liberties}=getGroup(next,nr,nc);
      group.forEach(p=>checked.add(`${p.r},${p.c}`));
      if (!liberties.size) taken.push(...group);
    }
  }
  taken.forEach(({r:y,c:x})=>next[y][x]=0);
  if (!getGroup(next,r,c).liberties.size && !taken.length) return null;
  return { board: next, captured: taken.length };
}
