import { useRef, useState } from 'react';
import { downloadBoardSave, readBoardSaveFile, writeBoardSave } from './boardSave.js';

export default function BoardSaveControls({
  gameId,
  variant = 'default',
  snapshot,
  validateSnapshot,
  onImport,
  storageKey,
  recovery = null,
}) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState('');

  const exportJson = () => {
    try {
      downloadBoardSave(gameId, variant, snapshot(), recovery);
      setMessage('JSONファイルを保存しました。');
    } catch {
      setMessage('JSONファイルを保存できませんでした。');
    }
  };

  const importJson = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const current = await readBoardSaveFile(file, validateSnapshot);
      if (storageKey) writeBoardSave(storageKey, current, recovery);
      onImport(current);
      setMessage('JSONから盤面を復元しました。');
    } catch (error) {
      setMessage(error.message || 'JSONから盤面を復元できませんでした。');
    }
  };

  return (
    <div className="board-save-controls">
      <div className="button-row">
        <button type="button" className="game-button" onClick={exportJson}>盤面をJSON保存</button>
        <button type="button" className="game-button" onClick={() => inputRef.current?.click()}>JSONから読込</button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          onChange={importJson}
          hidden
        />
      </div>
      {message && <p className="help-text" role="status">{message}</p>}
    </div>
  );
}
