import { useEffect, useRef, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import fieldText from '../../field/field.txt?raw';
import boomSound from '../../Sounds/Boom.mp3';
import clearSound from '../../Sounds/Clear.mp3';
import flagSound from '../../Sounds/Flag.mp3';
import missSound from '../../Sounds/Miss.mp3';
import openSound from '../../Sounds/Open.mp3';
import payingSound from '../../Sounds/Paying.mp3';
import { boardSaveStorageKey, readBoardSave, writeBoardSave } from '../components/boardSave.js';

const achievementStorageKey = 'minesweeper.clearAchievements';
const mineSaveKey = boardSaveStorageKey('minesweeper');
const difficulties = { 100: '簡単', 200: '普通', 300: '難しい' };
const flagColors = [
  { id: 'red', label: '赤' },
  { id: 'blue', label: '青' },
  { id: 'yellow', label: '黄' },
  { id: 'green', label: '緑' },
];
const sounds = {
  boom: boomSound,
  clear: clearSound,
  flag: flagSound,
  miss: missSound,
  open: openSound,
  paying: payingSound,
};

function readAchievements() {
  const saved = window.localStorage.getItem(achievementStorageKey);
  if (saved === null) return [];

  let records;
  try {
    records = JSON.parse(saved);
  } catch {
    throw new Error('保存したクリア実績を読み取れません。');
  }
  const isValidRecord = (record) => record && typeof record === 'object'
    && Object.hasOwn(difficulties, record.mines)
    && Number.isFinite(record.money)
    && Number.isInteger(record.foundMineCount) && record.foundMineCount >= 0
    && Number.isInteger(record.hitCount) && record.hitCount >= 0
    && typeof record.clearedAt === 'string' && Number.isFinite(Date.parse(record.clearedAt));
  if (!Array.isArray(records) || !records.every(isValidRecord)) {
    throw new Error('保存したクリア実績の形式が正しくありません。');
  }
  return records;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function createGame(mines) {
  const lines = fieldText.trimEnd().split(/\r?\n/);
  if (!lines.length || !lines[0].length) throw new Error('盤面データが空です。');

  const rows = lines.length;
  const cols = Math.max(...lines.map((line) => line.length));
  const cells = lines.map((line) => Array.from({ length: cols }, (_, col) => ({
    playable: line[col] === '?',
    mine: false,
    removed: false,
    exploded: false,
    state: 'closed',
    flagColor: null,
    allyDanger: false,
  })));
  const playableCount = cells.flat().filter((cell) => cell.playable).length;
  if (mines >= playableCount) throw new Error('このフィールドには指定された数の地雷を配置できません。');

  return {
    mineSetting: mines,
    firstMove: true,
    won: false,
    money: mines * 1000,
    reward: mines * 1000,
    allyCost: 500,
    removeCost: 100,
    board: {
      rows,
      cols,
      cells,
      totalMines: mines,
      safeCellsToOpen: playableCount - mines,
      hits: 0,
      flags: 0,
      initialized: false,
    },
  };
}

function coordinates(game) {
  return game.board.cells.flatMap((row, r) =>
    row.flatMap((cell, c) => (cell.playable ? [[r, c]] : [])));
}

function neighbors(game, row, col) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row + dr;
      const c = col + dc;
      if (game.board.cells[r]?.[c]?.playable) result.push([r, c]);
    }
  }
  return result;
}

function initialize(game, safeRow, safeCol) {
  const board = game.board;
  const available = shuffle(coordinates(game).filter(([row, col]) =>
    safeRow === undefined || row !== safeRow || col !== safeCol));
  available.slice(0, Math.min(board.totalMines, available.length))
    .forEach(([row, col]) => { board.cells[row][col].mine = true; });
  board.initialized = true;
}

function openCell(game, row, col) {
  const cell = game.board.cells[row]?.[col];
  if (!cell?.playable || cell.state !== 'closed' || cell.mine) return;
  cell.state = 'opened';
  game.board.safeCellsToOpen--;
  const adjacent = neighbors(game, row, col);
  if (adjacent.every(([r, c]) => !game.board.cells[r][c].mine)) {
    adjacent.forEach(([r, c]) => openCell(game, r, c));
  }
}

function act(game, row, col, action, flagColorId) {
  const board = game.board;
  const cell = board.cells[row]?.[col];
  let hit = false;
  let flagPlaced = false;
  if (cell?.exploded) return { hit, removedMine: false };
  const firstOpen = action === 'open' && !board.initialized;
  let removedMine = false;

  if (action === 'flag') {
    if (cell.state === 'closed') {
      cell.state = 'flagged';
      cell.flagColor = flagColorId;
      board.flags++;
      flagPlaced = true;
    } else if (cell.state === 'flagged') {
      if (cell.flagColor === flagColorId) {
        cell.state = 'closed';
        cell.flagColor = null;
        board.flags--;
      } else {
        cell.flagColor = flagColorId;
      }
    }
    return { hit, removedMine, flagPlaced };
  }

  if (action === 'ally') {
    if (!board.initialized) initialize(game);
    const candidates = shuffle(coordinates(game).filter(([r, c]) =>
      board.cells[r][c].state === 'closed' && !board.cells[r][c].allyDanger));
    const target = candidates[0];
    if (!target) return { hit, removedMine, performed: false };
    const [targetRow, targetCol] = target;
    const targetCell = board.cells[targetRow][targetCol];
    if (targetCell.mine) targetCell.allyDanger = true;
    else openCell(game, targetRow, targetCol);
    return { hit, removedMine, performed: true };
  }

  if (action === 'remove') {
    if (!board.initialized) initialize(game);
    if (cell.state === 'flagged') {
      board.flags--;
      cell.state = 'closed';
      cell.flagColor = null;
    }
    if (cell.mine) {
      cell.mine = false;
      cell.removed = true;
      cell.allyDanger = false;
      board.totalMines = Math.max(0, board.totalMines - 1);
      cell.state = 'opened';
      removedMine = true;
    } else {
      openCell(game, row, col);
    }
    return { hit, removedMine };
  }

  if (!board.initialized) initialize(game, row, col);
  if (cell.state === 'closed') {
    if (cell.mine) {
      cell.state = 'opened';
      cell.exploded = true;
      board.hits++;
      board.totalMines = Math.max(0, board.totalMines - 1);
      hit = true;
    } else {
      openCell(game, row, col);
      if (firstOpen && board.totalMines > 0) {
        let opened = board.cells.flat().filter((item) =>
          item.state === 'opened' && !item.mine).length;
        for (const [r, c] of shuffle(coordinates(game))) {
          if (opened >= 3) break;
          const extra = board.cells[r][c];
          if (extra.state === 'closed' && !extra.mine) {
            openCell(game, r, c);
            opened++;
          }
        }
      }
    }
  }
  return { hit, removedMine };
}

function viewState(game, message) {
  const board = game.board;
  const cells = board.cells.map((row, r) => row.map((cell, c) => {
    const opened = cell.playable && cell.state === 'opened';
    return {
      playable: cell.playable,
      opened,
      flagged: cell.state === 'flagged',
      flagColor: cell.flagColor,
      mine: cell.playable && cell.mine && (opened || board.safeCellsToOpen === 0),
      removed: cell.removed,
      exploded: cell.exploded,
      allyDanger: cell.playable && cell.allyDanger && cell.state === 'closed',
      value: opened && !cell.mine
        ? neighbors(game, r, c).filter(([nr, nc]) => board.cells[nr][nc].mine).length
        : 0,
    };
  }));
  return {
    rows: board.rows,
    cols: board.cols,
    mineSetting: game.mineSetting,
    minesLeft: board.totalMines,
    hitCount: board.hits,
    flagsCount: board.flags,
    foundMineCount: board.cells.flat().filter((cell) =>
      cell.removed || (cell.mine && cell.state === 'flagged')).length,
    money: game.money,
    removeCost: game.removeCost,
    won: game.won,
    message,
    cells,
  };
}

function isMineSnapshot(value) {
  return value && ['home', 'game', 'clear', 'rules'].includes(value.screen)
    && Number.isInteger(value.currentMines) && [100, 200, 300].includes(value.currentMines)
    && value.game && value.game.board
    && Array.isArray(value.game.board.cells)
    && Number.isInteger(value.game.board.rows)
    && Number.isInteger(value.game.board.cols)
    && typeof value.game.board.initialized === 'boolean';
}

export default function Minesweeper() {
  const [initialSave] = useState(() => readBoardSave(mineSaveKey, isMineSnapshot));
  const saved = initialSave.current;
  const [screen, setScreen] = useState(() => saved?.screen && saved.game ? saved.screen : 'home');
  const [game, setGame] = useState(() => saved?.game ?? null);
  const [currentMines, setCurrentMines] = useState(() => saved?.currentMines ?? 100);
  const [removeMode, setRemoveMode] = useState(() => saved?.removeMode ?? false);
  const [flagColorIndex, setFlagColorIndex] = useState(() => saved?.flagColorIndex ?? 0);
  const [message, setMessage] = useState(() => saved?.message ?? '');
  const [homeMessage, setHomeMessage] = useState('');
  const [achievementMessage, setAchievementMessage] = useState('');
  const [clearAchievementMessage, setClearAchievementMessage] = useState('');
  const [achievements, setAchievements] = useState([]);
  const [achievementError, setAchievementError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const audioRefs = useRef({});
  const [recovery, setRecovery] = useState(initialSave.recovery);
  const state = game ? viewState(game, message) : null;
  const selectedFlag = flagColors[flagColorIndex];
  const cellSize = state
    ? Math.max(12, Math.min(30, Math.floor((Math.min(viewportWidth - 48, 1080) - (state.cols - 1) * 2) / state.cols)))
    : 30;
  const mineSnapshot = () => ({
    screen, game, currentMines, removeMode, flagColorIndex, message,
  });

  useEffect(() => {
    try { writeBoardSave(mineSaveKey, mineSnapshot(), recovery); }
    catch { setHomeMessage('盤面を保存できませんでした。ブラウザーのストレージ設定をご確認ください。'); }
  }, [screen, game, currentMines, removeMode, flagColorIndex, message, recovery]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (screen !== 'home') return;
    try {
      setAchievements(readAchievements());
      setAchievementError('');
      setAchievementMessage('');
    } catch (error) {
      setAchievementError(error.message);
    }
  }, [screen]);

  function playSound(name) {
    const audio = audioRefs.current[name] || new Audio(sounds[name]);
    audioRefs.current[name] = audio;
    audio.currentTime = 0;
    audio.play().catch((error) => console.warn(`効果音を再生できませんでした (${name}):`, error));
  }

  function startGame(mines = currentMines) {
    try {
      if (game && screen === 'game') setRecovery(mineSnapshot());
      const next = createGame(mines);
      setCurrentMines(mines);
      setGame(next);
      setRemoveMode(false);
      setMessage('ゲーム開始、マスを選んでください。');
      setHomeMessage('');
      setScreen('game');
    } catch (error) {
      setHomeMessage(error.message);
    }
  }

  function saveClearAchievement(next) {
    try {
      const records = readAchievements();
      records.unshift({
        mines: next.mineSetting,
        money: next.money,
        foundMineCount: next.board.cells.flat().filter((cell) =>
          cell.removed || (cell.mine && cell.state === 'flagged')).length,
        hitCount: next.board.hits,
        clearedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(achievementStorageKey, JSON.stringify(records));
      setAchievements(records);
      setAchievementError('');
      setAchievementMessage('今回のクリア実績を保存しました。');
      setClearAchievementMessage('今回のクリア実績を保存しました。');
    } catch (error) {
      const errorMessage = `クリア実績を保存できませんでした: ${error.message}`;
      setAchievementMessage(errorMessage);
      setClearAchievementMessage(errorMessage);
    }
  }

  function performAction(row, col, action) {
    if (!game || game.won) return;
    const cell = game.board.cells[row]?.[col];
    if (action !== 'ally' && !cell?.playable) return;
    if (action === 'remove' && cell.state === 'opened') {
      setMessage('すでに開いているマスには撤去依頼できません。');
      return;
    }
    if (action === 'ally' && game.money < game.allyCost) {
      setMessage(`仲間を使うには${game.allyCost}$が必要です。`);
      return;
    }
    if (action === 'remove' && game.money < game.removeCost) {
      setMessage(`撤去依頼には${game.removeCost}$が必要です。`);
      return;
    }

    const next = {
      ...game,
      board: {
        ...game.board,
        cells: game.board.cells.map((rowCells) => rowCells.map((item) => ({ ...item }))),
      },
    };
    const safeCellsToOpenBefore = next.board.safeCellsToOpen;
    const result = act(next, row, col, action, selectedFlag.id);
    if (action === 'ally' && !result.performed) {
      setGame(next);
      setMessage('調査できる未開封マスがありません。');
      return;
    }
    const openedSafeCell = next.board.safeCellsToOpen < safeCellsToOpenBefore;
    if (action === 'ally') next.money -= next.allyCost;
    if (action === 'remove') next.money -= next.removeCost;
    if (result.hit) next.money -= 100000;
    if (action === 'open' || action === 'remove' || action === 'ally') next.firstMove = false;
    next.won = next.board.safeCellsToOpen === 0;

    if (next.won) playSound('clear');
    else if (result.hit) playSound('boom');
    else if (openedSafeCell) playSound('open');
    else if (result.flagPlaced) playSound('flag');
    else if (action === 'ally') playSound('paying');
    else if (action === 'remove') playSound(result.removedMine ? 'paying' : 'miss');

    if (next.won) saveClearAchievement(next);
    const nextMessage = next.won ? 'クリア、すべての安全なマスを開きました。'
      : result.hit ? '地雷を踏みました。治療費100000$を支払いました。'
        : action === 'open' ? 'マスを開きました。'
          : action === 'ally' ? '仲間が手伝い、マスを確認しました。'
            : action === 'flag' ? '旗を更新しました。'
              : result.removedMine ? '地雷を撤去しました。'
                : 'このマスに地雷はありませんでした。撤去費用が発生し、マスを開きました。';
    setGame(next);
    setMessage(nextMessage);
    if (next.won) setScreen('clear');
  }

  function cycleFlagColor(direction = 1) {
    setFlagColorIndex((index) => (index + direction + flagColors.length) % flagColors.length);
  }

  const restoreSavedBoard = () => {
    if (!recovery) return;
    setScreen(recovery.screen === 'clear' ? 'clear' : 'game');
    setGame(recovery.game);
    setCurrentMines(recovery.currentMines);
    setRemoveMode(recovery.removeMode ?? false);
    setFlagColorIndex(recovery.flagColorIndex ?? 0);
    setMessage(recovery.message ?? '保存した盤面を復元しました。');
    setRecovery(null);
  };

  const backHome = () => {
    setRemoveMode(false);
    setScreen('home');
  };

  return (
    <GameLayout title="💣 マインスイーパー" subtitle="地雷を避けて、安全なマスをすべて開こう。" theme="minesweeper">
      <main className="mine-container">
        {screen === 'home' && (
          <section className="mine-screen mine-home" aria-labelledby="mine-home-title">
            <h2 id="mine-home-title">難易度を選んでゲーム開始</h2>
            <div className="mine-menu">
              {[100, 200, 300].map((mines) => (
                <button className="mine-menu-button" type="button" key={mines} onClick={() => startGame(mines)}>
                  {difficulties[mines]} (地雷 {mines}個)
                </button>
              ))}
              <button className="mine-menu-button secondary" type="button" onClick={() => setScreen('rules')}>
                遊び方・ルール
              </button>
              <button className="mine-menu-button secondary" type="button" onClick={restoreSavedBoard} disabled={!recovery}>
                保存した盤面を復元
              </button>
            </div>
            {homeMessage && <p className="mine-message error" role="alert">{homeMessage}</p>}
            <section className="mine-achievements" aria-labelledby="mine-achievement-title">
              <h2 id="mine-achievement-title">🏆 クリア実績</h2>
              <p>クリア回数: {achievementError ? '—' : `${achievements.length}回`}</p>
              {achievementError && <p className="mine-message error" role="status">クリア実績を読み込めませんでした: {achievementError}</p>}
              {achievementMessage && <p className="mine-message" role="status">{achievementMessage}</p>}
              <ul>
                {!achievementError && achievements.length === 0 && <li>まだクリア実績はありません。</li>}
                {achievements.slice(0, 5).map((record, index) => (
                  <li key={`${record.clearedAt}-${index}`}>
                    {new Date(record.clearedAt).toLocaleString('ja-JP')} — {difficulties[record.mines]} (地雷 {record.mines}個)
                    {' / 残金 '}{record.money.toLocaleString('ja-JP')}$ / 発見 {record.foundMineCount}個 / 被弾 {record.hitCount}回
                  </li>
                ))}
                {achievements.length > 5 && <li>最新5件を表示中（全{achievements.length}件）</li>}
              </ul>
            </section>
          </section>
        )}

        {screen === 'rules' && (
          <section className="mine-screen mine-rules" aria-labelledby="mine-rules-title">
            <h2 id="mine-rules-title">📖 遊び方・ルール</h2>
            <p className="mine-intro">地雷を避けながら安全なマスをすべて開き、依頼をクリアしましょう。</p>
            <div className="mine-rule-card">
              <h3>基本の遊び方</h3>
              <ul>
                <li>難易度を選ぶとゲーム開始。地雷は <strong>100・200・300個</strong> から選べます。</li>
                <li>マスをクリックして開きます。数字は、そのマスの周囲8マスにある地雷の数です。</li>
                <li>最初の通常クリックで選んだマスには地雷がありません（先に仲間・撤去依頼を使った場合を除く）。安全なマスを開くと周囲も続けて開くことがあります。</li>
                <li>地雷と思うマスは右クリックで旗を立てます。違う色を選んでから右クリックすると色を変更でき、同じ色で右クリックすると旗を外せます。</li>
                <li>画面はマウスホイールでスクロールします。盤面上でホイールを押し込むと旗の色を切り替えられます。</li>
              </ul>
            </div>
            <div className="mine-rule-card">
              <h3>仲間と撤去依頼</h3>
              <ul>
                <li><strong>仲間に任せる（1回 500$）:</strong> ランダムな未開封マスを調査します。安全なら開き、地雷なら「×」で知らせます。</li>
                <li><strong>撤去依頼（1回 100$）:</strong> モードをオンにして対象マスをクリック。地雷を撤去し、安全なマスなら開きます。モードはオフにするまで続きます。</li>
                <li>どちらも所持金を消費し、所持金が足りている場合だけ使えます。</li>
              </ul>
            </div>
            <div className="mine-rule-card">
              <h3>報酬とクリア条件</h3>
              <ul>
                <li>開始時の所持金は <strong>地雷数 × 1,000$</strong> です。</li>
                <li>地雷を踏むと治療費として <strong>100,000$</strong> を支払います。ゲームは続けられます。</li>
                <li>旗は必須ではありません。地雷以外の安全なマスをすべて開くとクリアです。</li>
                <li>クリア時に残った所持金が成績になります。</li>
              </ul>
            </div>
            <button type="button" className="mine-control-button primary" onClick={backHome}>難易度選択に戻る</button>
          </section>
        )}

        {screen === 'clear' && state && (
          <section className="mine-screen mine-clear" aria-labelledby="mine-clear-title" aria-live="polite">
            <h2 id="mine-clear-title">🎉 クリア！</h2>
            <p className="mine-intro">すべての安全なマスを開きました。今回の成績はこちらです。</p>
            <div className="mine-results">
              <div><span>💰 儲け（残り所持金）</span><strong className="money">{state.money.toLocaleString('ja-JP')}$</strong></div>
              <div><span>🚩 自分で見つけた地雷数</span><strong className="mines">{state.foundMineCount}個</strong></div>
              <div><span>💥 被弾数</span><strong className="hits">{state.hitCount}回</strong></div>
            </div>
            {clearAchievementMessage && <p className="mine-message" role="status">{clearAchievementMessage}</p>}
            <div className="mine-controls">
              <button type="button" className="mine-control-button primary" onClick={() => startGame(currentMines)}>もう一度遊ぶ</button>
              <button type="button" className="mine-control-button" onClick={backHome}>ホームへ</button>
            </div>
          </section>
        )}

        {screen === 'game' && state && (
          <section className="mine-screen mine-game" aria-label="マインスイーパーのゲーム">
            <div className="mine-status">
              <span>🚩 残り地雷数: {state.minesLeft}</span>
              <span>🚩 旗: {state.flagsCount}</span>
              <span>💰 所持金: {state.money.toLocaleString('ja-JP')}$</span>
              <span>💥 踏んだ回数: {state.hitCount}</span>
            </div>
            <div
              className="mine-board-wrap"
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  cycleFlagColor();
                }
              }}
            >
              <div
                className="mine-board"
                role="grid"
                aria-label="マインスイーパーの盤面"
                style={{ gridTemplateColumns: `repeat(${state.cols}, var(--mine-cell-size))`, '--mine-cell-size': `${cellSize}px` }}
              >
                {state.cells.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
                  const classes = ['mine-cell'];
                  let content = '';
                  let ariaLabel = `行${rowIndex + 1}、列${colIndex + 1}`;
                  let disabled = state.won;
                  if (!cell.playable) {
                    classes.push('wall');
                    disabled = true;
                  } else if (cell.removed) {
                    classes.push('opened', 'removed');
                    content = '✓';
                    ariaLabel += '、地雷撤去済み';
                    disabled = true;
                  } else if (cell.exploded) {
                    classes.push('opened', 'mine');
                    content = '💥';
                    ariaLabel += '、爆発済み';
                    disabled = true;
                  } else if (cell.mine) {
                    classes.push('opened', 'mine');
                    content = '💣';
                  } else if (cell.allyDanger) {
                    classes.push('ally-danger');
                    content = '×';
                  } else if (cell.opened) {
                    classes.push('opened');
                    if (cell.value > 0) {
                      classes.push(`n${cell.value}`);
                      content = cell.value;
                    }
                  } else if (cell.flagged) {
                    classes.push('flagged', `flag-${cell.flagColor || 'red'}`);
                    content = '⚑';
                  }
                  return (
                    <button
                      type="button"
                      role="gridcell"
                      className={classes.join(' ')}
                      aria-label={ariaLabel}
                      key={`${rowIndex}-${colIndex}`}
                      disabled={disabled}
                      onClick={() => performAction(rowIndex, colIndex, removeMode ? 'remove' : 'open')}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (!removeMode) performAction(rowIndex, colIndex, 'flag');
                      }}
                    >
                      {content}
                    </button>
                  );
                }))}
              </div>
            </div>
            <p className={`mine-message${message.includes('必要です') ? ' error' : ''}`} role="status" aria-live="polite">{message}</p>
            <div className="mine-controls">
              <button type="button" className="mine-control-button" onClick={() => {
                if (removeMode) setRemoveMode(false);
                performAction(undefined, undefined, 'ally');
              }}>🤝 仲間に任せる (500$)</button>
              <button
                type="button"
                className={`mine-control-button${removeMode ? ' active' : ''}`}
                aria-pressed={removeMode}
                onClick={() => {
                  if (game.won && !removeMode) {
                    setMessage('ゲームクリア済みです。もう一度遊ぶ場合はホームへ戻ってください。');
                    return;
                  }
                  const enabled = !removeMode;
                  setRemoveMode(enabled);
                  setMessage(enabled ? '撤去依頼モードON: 撤去するマスをクリックしてください。' : '撤去依頼モードを解除しました。');
                }}
              >💸 撤去依頼 ({state.removeCost}$)</button>
              <button
                type="button"
                className={`mine-control-button flag-color flag-${selectedFlag.id}`}
                title="クリック、または盤面上でマウスホイールを押し込むと旗の色を切り替え"
                aria-label={`旗の色: ${selectedFlag.label}。クリック、または盤面上でマウスホイールを押し込むと切り替え`}
                onClick={() => cycleFlagColor()}
              >旗の色: {selectedFlag.label}</button>
              <button type="button" className="mine-control-button" onClick={() => startGame(currentMines)}>もう一度</button>
              <button type="button" className="mine-control-button" onClick={backHome}>ホームへ</button>
            </div>
          </section>
        )}
      </main>
    </GameLayout>
  );
}
