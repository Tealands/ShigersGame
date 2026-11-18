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
