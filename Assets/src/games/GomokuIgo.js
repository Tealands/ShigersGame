import { captureMove, getGroup, hasFive } from './pointgomoku.js';

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const positionKey = (r, c) => `${r},${c}`;
const boardKey = board => board.map(row => row.join('')).join('');
const inBounds = (board, r, c) => r >= 0 && r < board.length && c >= 0 && c < board[r].length;

function getLegalMoves(board, player, seen) {
  const moves = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] !== 0) continue;
      const move = captureMove(board, r, c, player);
      if (!move || seen.has(boardKey(move.board))) continue;
      moves.push({ r, c, ...move });
    }
  }
  return moves;
}

function getWinningMoves(board, player, seen) {
  return getLegalMoves(board, player, seen)
    .filter(move => hasFive(move.board, move.r, move.c, player));
}

function getLine(board, r, c, dr, dc) {
  let startR = r;
  let startC = c;
  while (inBounds(board, startR - dr, startC - dc)) {
    startR -= dr;
    startC -= dc;
  }

  const line = [];
  while (inBounds(board, startR, startC)) {
    line.push({ r: startR, c: startC });
    startR += dr;
    startC += dc;
  }
  return line;
}

function getLineWinningPoints(board, player, r, c, dr, dc, requiredStones = []) {
  const line = getLine(board, r, c, dr, dc);
  const indexes = new Map(line.map((point, index) => [positionKey(point.r, point.c), index]));
  const requiredIndexes = requiredStones.map(stone => indexes.get(positionKey(stone.r, stone.c)));
  if (requiredIndexes.some(index => index === undefined)) return [];

  const wins = [];
  for (let pointIndex = 0; pointIndex < line.length; pointIndex++) {
    const point = line[pointIndex];
    if (board[point.r][point.c] !== 0) continue;

    const firstWindow = Math.max(0, pointIndex - 4);
    const lastWindow = Math.min(pointIndex, line.length - 5);
    for (let start = firstWindow; start <= lastWindow; start++) {
      if (requiredIndexes.some(index => index < start || index >= start + 5)) continue;
      let completesFive = true;
      for (let index = start; index < start + 5; index++) {
        const cell = line[index];
        if (index !== pointIndex && board[cell.r][cell.c] !== player) {
          completesFive = false;
          break;
        }
      }
      if (completesFive) {
        wins.push(point);
        break;
      }
    }
  }
  return wins;
}

function getLegalLineWinningPoints(board, player, points, seen) {
  return points.filter(point => {
    const move = captureMove(board, point.r, point.c, player);
    return move && !seen.has(boardKey(move.board));
  });
}

function getGapFourDirections(board, player, r, c, seen) {
  let directions = 0;
  for (const [dr, dc] of DIRECTIONS.slice(0, 2)) {
    let hasGapFour = false;
    for (const sign of [-1, 1]) {
      const gapR = r + dr * sign;
      const gapC = c + dc * sign;
      if (!inBounds(board, gapR, gapC) || board[gapR][gapC] !== 0) continue;

      let hasThreeBeyondGap = true;
      for (let distance = 2; distance <= 4; distance++) {
        const stoneR = r + dr * sign * distance;
        const stoneC = c + dc * sign * distance;
        if (!inBounds(board, stoneR, stoneC) || board[stoneR][stoneC] !== player) {
          hasThreeBeyondGap = false;
          break;
        }
      }
      if (!hasThreeBeyondGap) continue;

      const legalWins = getLegalLineWinningPoints(
        board,
        player,
        getLineWinningPoints(board, player, r, c, dr, dc, [{ r, c }]),
        seen,
      );
      if (legalWins.some(point => point.r === gapR && point.c === gapC)) {
        hasGapFour = true;
        break;
      }
    }
    if (hasGapFour) directions++;
  }
  return directions;
}

function getWinningSupportStones(board, player, winningPoint, dr, dc, requiredStones = []) {
  const line = getLine(board, winningPoint.r, winningPoint.c, dr, dc);
  const indexes = new Map(line.map((point, index) => [positionKey(point.r, point.c), index]));
  const winningIndex = indexes.get(positionKey(winningPoint.r, winningPoint.c));
  const requiredIndexes = requiredStones.map(stone => indexes.get(positionKey(stone.r, stone.c)));
  const support = new Set();
  if (winningIndex === undefined || requiredIndexes.some(index => index === undefined)) return support;

  const firstWindow = Math.max(0, winningIndex - 4);
  const lastWindow = Math.min(winningIndex, line.length - 5);
  for (let start = firstWindow; start <= lastWindow; start++) {
    if (requiredIndexes.some(index => index < start || index >= start + 5)) continue;
    let completesFive = true;
    for (let index = start; index < start + 5; index++) {
      const point = line[index];
      if (index !== winningIndex && board[point.r][point.c] !== player) {
        completesFive = false;
        break;
      }
    }
    if (!completesFive) continue;

    for (let index = start; index < start + 5; index++) {
      if (index === winningIndex) continue;
      const point = line[index];
      support.add(positionKey(point.r, point.c));
    }
  }
  return support;
}

function getWinningThreatStones(board, player, winningMoves) {
  const stones = new Set();
  for (const move of winningMoves) {
    for (const [dr, dc] of DIRECTIONS) {
      for (const stone of getWinningSupportStones(board, player, move, dr, dc)) {
        stones.add(stone);
      }
    }
  }
  return stones;
}

function getOpenThreeThreats(board, player, seen) {
  const extensionPoints = new Set();
  const supportingStones = new Set();
  const threats = new Map();

  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] !== 0) continue;
      const extension = captureMove(board, r, c, player);
      if (!extension || seen.has(boardKey(extension.board))) continue;

      const seenAfterExtension = new Set(seen);
      seenAfterExtension.add(boardKey(extension.board));
      for (const [dr, dc] of DIRECTIONS) {
        const possibleWins = getLineWinningPoints(extension.board, player, r, c, dr, dc, [{ r, c }]);
        const legalWins = getLegalLineWinningPoints(extension.board, player, possibleWins, seenAfterExtension);
        if (legalWins.length < 2) continue;

        const extensionKey = positionKey(r, c);
        const directionIndex = DIRECTIONS.findIndex(([rowStep, columnStep]) => rowStep === dr && columnStep === dc);
        const threatStones = new Set();
        for (const winningPoint of legalWins) {
          const support = getWinningSupportStones(
            extension.board,
            player,
            winningPoint,
            dr,
            dc,
            [{ r, c }],
          );
          for (const stone of support) {
            const [stoneR, stoneC] = stone.split(',').map(Number);
            if (board[stoneR][stoneC] === player) {
              threatStones.add(stone);
              supportingStones.add(stone);
            }
          }
        }

        extensionPoints.add(extensionKey);
        const threatKey = `${directionIndex}:${[...threatStones].sort().join('|')}`;
        if (!threats.has(threatKey)) {
          threats.set(threatKey, { extensionPoints: new Set(), supportingStones: new Set() });
        }
        const threat = threats.get(threatKey);
        threat.extensionPoints.add(extensionKey);
        threatStones.forEach(stone => threat.supportingStones.add(stone));
      }
    }
  }

  return { extensionPoints, supportingStones, threats: [...threats.values()] };
}

function getLinePatternProfile(board, player, r, c, seen) {
  let openFourDirections = 0;
  let closedFourDirections = 0;
  let activeThreeDirections = 0;
  let stoppedThreeDirections = 0;

  for (const [dr, dc] of DIRECTIONS) {
    const directWins = getLegalLineWinningPoints(
      board,
      player,
      getLineWinningPoints(board, player, r, c, dr, dc, [{ r, c }]),
      seen,
    );
    if (directWins.length >= 2) openFourDirections++;
    else if (directWins.length === 1) closedFourDirections++;

    let makesActiveThree = false;
    let makesStoppedThree = false;
    for (let distance = -4; distance <= 4; distance++) {
      if (distance === 0) continue;
      const extensionR = r + dr * distance;
      const extensionC = c + dc * distance;
      if (!inBounds(board, extensionR, extensionC) || board[extensionR][extensionC] !== 0) continue;

      const extension = captureMove(board, extensionR, extensionC, player);
      if (!extension || seen.has(boardKey(extension.board))) continue;
      const seenAfterExtension = new Set(seen);
      seenAfterExtension.add(boardKey(extension.board));

      const possibleWins = getLineWinningPoints(
        extension.board,
        player,
        r,
        c,
        dr,
        dc,
        [{ r, c }, { r: extensionR, c: extensionC }],
      );
      const legalWins = getLegalLineWinningPoints(extension.board, player, possibleWins, seenAfterExtension);
      if (legalWins.length >= 2) makesActiveThree = true;
      else if (legalWins.length === 1) makesStoppedThree = true;
      if (makesActiveThree) break;
    }

    if (makesActiveThree) activeThreeDirections++;
    else if (makesStoppedThree) stoppedThreeDirections++;
  }

  return { openFourDirections, closedFourDirections, activeThreeDirections, stoppedThreeDirections };
}

function getLibertySummary(board, player) {
  const visited = new Set();
  let total = 0;
  let groupsInAtari = 0;

  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const position = positionKey(r, c);
      if (board[r][c] !== player || visited.has(position)) continue;

      const group = getGroup(board, r, c);
      group.group.forEach(stone => visited.add(positionKey(stone.r, stone.c)));
      total += group.liberties.size;
      if (group.liberties.size === 1) groupsInAtari++;
    }
  }

  return { total, groupsInAtari };
}

function getAtariGroups(board, player) {
  const visited = new Set();
  const groups = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const position = positionKey(r, c);
      if (board[r][c] !== player || visited.has(position)) continue;
      const group = getGroup(board, r, c);
      group.group.forEach(stone => visited.add(positionKey(stone.r, stone.c)));
      if (group.liberties.size === 1) groups.push(group.group);
    }
  }
  return groups;
}

function countEscapedGroups(board, nextBoard, player, atariGroups) {
  let escaped = 0;
  for (const group of atariGroups) {
    const survivingStone = group.find(stone => nextBoard[stone.r][stone.c] === player);
    if (!survivingStone) continue;
    if (getGroup(nextBoard, survivingStone.r, survivingStone.c).liberties.size > 1) escaped++;
  }
  return escaped;
}

function getCapturedStones(board, nextBoard, player) {
  const captured = new Set();
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === player && nextBoard[r][c] === 0) captured.add(positionKey(r, c));
    }
  }
  return captured;
}

function getPatternScore(profile) {
  const fourDirections = profile.openFourDirections + profile.closedFourDirections;
  const threeDirections = profile.activeThreeDirections;
  return (profile.openFourDirections * 100000000)
    + (fourDirections >= 2 ? 10000000 : 0)
    + (profile.closedFourDirections * 1000000)
    + (threeDirections >= 2 ? 100000 : 0)
    + (threeDirections * 10000);
}

function getCenterPreference(board, r, c) {
  const center = (board.length - 1) / 2;
  return board.length - 1 - Math.abs(r - center) - Math.abs(c - center);
}

export function chooseGomokuIgoMove(board, player, seen = new Set()) {
  const candidates = getLegalMoves(board, player, seen);
  if (!candidates.length) return null;

  const winningMove = candidates.find(move => hasFive(move.board, move.r, move.c, player));
  if (winningMove) return { r: winningMove.r, c: winningMove.c };

  const opponent = 3 - player;
  const opponentWinningMoves = getWinningMoves(board, opponent, seen);
  const opponentWinningPoints = new Set(opponentWinningMoves.map(move => positionKey(move.r, move.c)));
  const opponentWinningStones = getWinningThreatStones(board, opponent, opponentWinningMoves);
  const opponentOpenThrees = getOpenThreeThreats(board, opponent, seen);
  const currentOpponentLiberties = getLibertySummary(board, opponent);
  const currentPlayerAtariGroups = getAtariGroups(board, player);
  const currentPlayerLiberties = getLibertySummary(board, player);

  const evaluated = candidates.map(move => {
    const serialized = boardKey(move.board);
    const seenAfterMove = new Set(seen);
    seenAfterMove.add(serialized);
    const profile = getLinePatternProfile(move.board, player, move.r, move.c, seenAfterMove);
    const nextOpponentLiberties = getLibertySummary(move.board, opponent);
    const nextPlayerLiberties = getLibertySummary(move.board, player);
    const capturedStones = getCapturedStones(board, move.board, opponent);
    const capturedWinningStones = [...capturedStones].filter(stone => opponentWinningStones.has(stone)).length;
    const capturedOpenThreeStones = [...capturedStones]
      .filter(stone => opponentOpenThrees.supportingStones.has(stone)).length;
    const moveKey = positionKey(move.r, move.c);
    const remainingOpenThreeThreats = opponentOpenThrees.threats.filter(threat => (
      !threat.extensionPoints.has(moveKey)
      && ![...capturedStones].some(stone => threat.supportingStones.has(stone))
    )).length;

    let remainingWinningMoves = 0;
    if (opponentWinningMoves.length) {
      remainingWinningMoves = getWinningMoves(move.board, opponent, seenAfterMove).length;
    }

    return {
      ...move,
      profile,
      remainingWinningMoves,
      blocksStopFour: opponentWinningPoints.has(positionKey(move.r, move.c)) || capturedWinningStones > 0,
      extendsThreeToFour: getGapFourDirections(move.board, player, move.r, move.c, seenAfterMove),
      openThreeDisruption: capturedOpenThreeStones > 0
        ? 2
        : opponentOpenThrees.extensionPoints.has(moveKey) ? 1 : 0,
      remainingOpenThreeThreats,
      escapedGroups: countEscapedGroups(board, move.board, player, currentPlayerAtariGroups),
      ownLibertyGain: nextPlayerLiberties.total - currentPlayerLiberties.total,
      opponentLibertyReduction: currentOpponentLiberties.total - nextOpponentLiberties.total,
      patternScore: getPatternScore(profile),
      centerPreference: getCenterPreference(board, move.r, move.c),
      pressureScore: move.captured * 1000
        + (currentOpponentLiberties.total - nextOpponentLiberties.total) * 20
        + (nextOpponentLiberties.groupsInAtari - currentOpponentLiberties.groupsInAtari) * 5
        + getCenterPreference(board, move.r, move.c) / 100,
    };
  });

  if (opponentWinningMoves.length) {
    const minimumRemainingWins = Math.min(...evaluated.map(move => move.remainingWinningMoves));
    const best = evaluated
      .filter(move => move.remainingWinningMoves === minimumRemainingWins)
      .sort((a, b) => b.blocksStopFour - a.blocksStopFour
        || b.extendsThreeToFour - a.extendsThreeToFour
        || b.openThreeDisruption - a.openThreeDisruption
        || b.patternScore - a.patternScore
        || b.pressureScore - a.pressureScore)[0];
    return { r: best.r, c: best.c };
  }

  if (opponentOpenThrees.threats.length) {
    const minimumRemainingThreats = Math.min(...evaluated.map(move => move.remainingOpenThreeThreats));
    if (minimumRemainingThreats < opponentOpenThrees.threats.length) {
      const best = evaluated
        .filter(move => move.remainingOpenThreeThreats === minimumRemainingThreats)
        .sort((a, b) => b.openThreeDisruption - a.openThreeDisruption
          || b.escapedGroups - a.escapedGroups
          || b.patternScore - a.patternScore
          || b.pressureScore - a.pressureScore)[0];
      return { r: best.r, c: best.c };
    }
  }

  const maximumEscapes = Math.max(...evaluated.map(move => move.escapedGroups));
  if (maximumEscapes > 0) {
    const best = evaluated
      .filter(move => move.escapedGroups === maximumEscapes)
      .sort((a, b) => b.ownLibertyGain - a.ownLibertyGain
        || b.patternScore - a.patternScore
        || b.pressureScore - a.pressureScore)[0];
    return { r: best.r, c: best.c };
  }

  const maximumPatternScore = Math.max(...evaluated.map(move => move.patternScore));
  if (maximumPatternScore > 0) {
    const best = evaluated
      .filter(move => move.patternScore === maximumPatternScore)
      .sort((a, b) => b.pressureScore - a.pressureScore)[0];
    return { r: best.r, c: best.c };
  }

  evaluated.sort((a, b) => b.pressureScore - a.pressureScore
    || b.centerPreference - a.centerPreference);
  return { r: evaluated[0].r, c: evaluated[0].c };
}
