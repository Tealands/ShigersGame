export const boardSaveStorageKey = (gameId, variant = 'default') =>
  `shigers.board-save.v1.${gameId}.${variant}`;

export function readBoardSave(storageKey, validateSnapshot) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return { current: null, recovery: null, error: '' };

    const data = JSON.parse(stored);
    if (data?.version !== 1) {
      return { current: null, recovery: null, error: '保存データを読み取れませんでした。新しい対局を開始します。' };
    }

    const current = validateSnapshot(data.current) ? data.current : null;
    const recovery = validateSnapshot(data.recovery) ? data.recovery : null;
    const error = data.current && !current
      ? '保存データが壊れていたため、新しい対局を開始します。'
      : '';
    return { current, recovery, error };
  } catch {
    return { current: null, recovery: null, error: '保存データを読み込めませんでした。' };
  }
}

export function writeBoardSave(storageKey, current, recovery = null) {
  window.localStorage.setItem(storageKey, JSON.stringify({
    version: 1,
    current,
    recovery,
  }));
}

export function createBoardSaveJson(gameId, variant, current, recovery = null) {
  return JSON.stringify({
    version: 1,
    gameId,
    variant,
    current,
    recovery,
  }, null, 2);
}

export function downloadBoardSave(gameId, variant, current, recovery = null) {
  const json = createBoardSaveJson(gameId, variant, current, recovery);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${gameId}-${variant}-board.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return json;
}

export async function readBoardSaveFile(file, validateSnapshot) {
  if (!file) throw new Error('JSONファイルが選択されていません。');
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('有効なJSONファイルではありません。');
  }
  if (data?.version !== 1) throw new Error('対応していない盤面ファイルです。');
  if (!validateSnapshot(data.current)) throw new Error('盤面データが壊れているか、このゲームと形式が一致しません。');
  return data.current;
}
