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

export function bestGomokuMove(board, player = 2) {
  const opponent = player === 1 ? 2 : 1;
  const candidates = [];
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board.length; c++) {
    if (board[r][c]) continue;
    board[r][c] = player;
    if (hasFive(board, r, c, player)) { board[r][c] = 0; return { r, c }; }
    board[r][c] = opponent;
    if (hasFive(board, r, c, opponent)) { board[r][c] = 0; return { r, c }; }
    board[r][c] = 0;
    let score = 14 - Math.abs(r - 7) - Math.abs(c - 7);
    for (const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) for (const who of [player, opponent]) {
      let count = 0;
      for (const sign of [-1,1]) {
        let y = r + dr*sign, x = c + dc*sign;
        while (board[y]?.[x] === who) { count++; y += dr*sign; x += dc*sign; }
      }
      score += Math.pow(who === player ? 10 : 8, count);
    }
    candidates.push({ r, c, score });
  }
  candidates.sort((a,b) => b.score-a.score);
  return candidates[0] ?? null;
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
