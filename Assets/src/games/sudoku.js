export function makeSudoku(difficulty) {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  const valid = (r, c, n) => {
    for (let i = 0; i < 9; i++) if (solution[r][i] === n || solution[i][c] === n) return false;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let y = br; y < br + 3; y++) for (let x = bc; x < bc + 3; x++) if (solution[y][x] === n) return false;
    return true;
  };
  const fill = (index = 0) => {
    if (index === 81) return true;
    const r = Math.floor(index / 9), c = index % 9;
    const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - .5);
    for (const n of nums) if (valid(r, c, n)) { solution[r][c] = n; if (fill(index + 1)) return true; solution[r][c] = 0; }
    return false;
  };
  fill();
  const puzzle = solution.map(row => [...row]);
  const holes = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 40 : 50;
  let removed = 0;
  while (removed < holes) { const r = Math.floor(Math.random()*9), c = Math.floor(Math.random()*9); if (puzzle[r][c]) { puzzle[r][c] = 0; removed++; } }
  return { puzzle, solution };
}

export function validSudoku(board) {
  const validGroup = group => group.slice().sort().join('') === '123456789';
  for (let i = 0; i < 9; i++) {
    if (!validGroup(board[i]) || !validGroup(board.map(row => row[i]))) return false;
  }
  for (let r = 0; r < 9; r += 3) for (let c = 0; c < 9; c += 3) {
    const box = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) box.push(board[r+y][c+x]);
    if (!validGroup(box)) return false;
  }
  return true;
}
