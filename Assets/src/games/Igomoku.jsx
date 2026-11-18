import { useEffect, useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import GomokuBoard from '../components/GomokuBoard.jsx';
import { playStoneSound } from '../components/playStoneSound.js';
import { boardSaveStorageKey, readBoardSave, writeBoardSave } from '../components/boardSave.js';
import { captureMove, emptyBoard, hasFive } from './pointgomoku.js';
import { chooseGomokuIgoMove } from './GomokuIgo.js';

const key=board=>board.map(row=>row.join('')).join('');
const emptyCaps=()=>({1:0,2:0});
const igomokuSaveKey=boardSaveStorageKey('igomoku');

function isIgomokuSnapshot(value) {
  return value && Array.isArray(value.board) && value.board.length===19
    && value.board.every(row=>Array.isArray(row)&&row.length===19&&row.every(cell=>cell===0||cell===1||cell===2))
    && (value.turn===1||value.turn===2) && (value.mode==='P2P'||value.mode==='AI')
    && value.captures && Number.isInteger(value.captures[1]) && Number.isInteger(value.captures[2])
    && Array.isArray(value.seen) && value.seen.every(item=>typeof item==='string')
    && Array.isArray(value.history) && value.history.every(item=>item
      && Array.isArray(item.seen) && item.seen.every(seenItem=>typeof seenItem==='string'))
    && (!value.last || (Number.isInteger(value.last.r) && Number.isInteger(value.last.c)))
    && (value.winner===0||value.winner===1||value.winner===2);
}

export default function Igomoku() {
  const [initialSave] = useState(() => readBoardSave(igomokuSaveKey, isIgomokuSnapshot));
  const saved=initialSave.current;
  const [board,setBoard]=useState(() => saved?.board ?? emptyBoard());
  const [turn,setTurn]=useState(() => saved?.turn ?? 1);
  const [mode,setMode]=useState(() => saved?.mode ?? 'P2P');
  const [last,setLast]=useState(() => saved?.last ?? null);
  const [captures,setCaptures]=useState(() => saved?.captures ?? emptyCaps());
  const [seen,setSeen]=useState(()=>saved ? new Set(saved.seen) : new Set([key(emptyBoard())]));
  const [history,setHistory]=useState(() => saved?.history?.map(item=>({...item, seen:new Set(item.seen)})) ?? []);
  const [message,setMessage]=useState('黒番から始めます。五連を作るか、相手の石を囲んで取りましょう。');
  const [winner,setWinner]=useState(() => saved?.winner ?? 0);
  const [showResult,setShowResult]=useState(false);
  const [reviewing,setReviewing]=useState(false);
  const [reviewIndex,setReviewIndex]=useState(0);
  const [rules,setRules]=useState(false);
  const [recovery,setRecovery]=useState(initialSave.recovery);
  const snapshot=()=>({
    board, turn, mode, last, captures:{...captures}, seen:[...seen], history:history.map(item=>({...item, seen:[...item.seen]})), winner,
  });
  const place=(r,c,player=turn,fromAI=false)=>{
    if(winner || (mode==='AI' && turn===2 && !fromAI))return;
    if(board[r][c]){setMessage('その交点には既に石があります。');return;}
    const move=captureMove(board,r,c,player);
    if(!move){setMessage('呼吸点がない自殺手は打てません。');return;}
    const serialized=key(move.board);
    if(seen.has(serialized)){setMessage('千日手禁止：過去と同じ盤面には戻れません。');return;}
    playStoneSound();
    setHistory(h=>[...h,{board,turn,last,captures,seen}]);setBoard(move.board);setSeen(s=>new Set([...s,serialized]));setLast({r,c});
    if(move.captured)setCaptures(old=>({...old,[player]:old[player]+move.captured}));
    if(hasFive(move.board,r,c,player)){setWinner(player);setShowResult(true);setMessage(`${player===1?'黒':'白'}番が5連を達成しました！`);return;}
    setMessage(move.captured?`${player===1?'黒':'白'}が石を${move.captured}個取りました。`:`${player===1?'黒':'白'}: (${r+1}, ${c+1})`);
    setTurn(3-player);
  };
  const pass=(player=turn,fromAI=false)=>{if(!winner&&player===turn&&!(mode==='AI'&&player===2&&!fromAI)){setMessage(`${player===1?'黒':'白'}がパスしました。`);setTurn(3-player);}};
  const reset=(nextMode=mode)=>{
    const hasProgress=board.some(row=>row.some(cell=>cell!==0))||history.length>0||winner>0;
    if(hasProgress)setRecovery(snapshot());
    setMode(nextMode);setBoard(emptyBoard());setTurn(1);setLast(null);setCaptures(emptyCaps());setSeen(new Set([key(emptyBoard())]));setHistory([]);setWinner(0);setShowResult(false);setReviewing(false);setReviewIndex(0);setMessage(hasProgress?'盤面リセットしました。前の盤面を復元できます。':'黒番から始めます。五連を作るか、相手の石を囲んで取りましょう。');
  };
  const restore=()=>{
    if(!recovery)return;
    setBoard(recovery.board.map(row=>[...row]));
    setTurn(recovery.turn);setMode(recovery.mode);setLast(recovery.last ?? null);setCaptures({...recovery.captures});
    setSeen(new Set(recovery.seen));
    setHistory(recovery.history.map(item=>({...item,seen:new Set(item.seen)})));
    setWinner(recovery.winner);setRecovery(null);setShowResult(false);setReviewing(false);
    setReviewIndex(0);setMessage('保存した盤面を復元しました。');
  };
  const undo=()=>{if(!history.length)return;const steps=mode==='AI'&&(turn===1||winner===2)&&history.length>1?2:1;const prev=history[history.length-steps];setBoard(prev.board);setTurn(prev.turn);setLast(prev.last);setCaptures(prev.captures);setSeen(prev.seen);setHistory(h=>h.slice(0,-steps));setWinner(0);setShowResult(false);setReviewing(false);setReviewIndex(0);};
  const startReview=()=>{setReviewIndex(history.length);setReviewing(true);setShowResult(false);};
  const returnToFinalBoard=()=>{setReviewIndex(history.length);setReviewing(false);};
  const reviewedState=reviewing&&reviewIndex<history.length?history[reviewIndex]:{board,turn,last,captures};

  useEffect(()=>{
    try { writeBoardSave(igomokuSaveKey,snapshot(),recovery); }
    catch { setMessage('盤面を保存できませんでした。ブラウザーのストレージ設定をご確認ください。'); }
  },[board,turn,mode,last,captures,seen,history,winner,recovery]);

  useEffect(()=>{
    if(mode!=='AI'||turn!==2||winner)return undefined;
    setMessage('AIが呼吸点を探しています…');
    const timer=setTimeout(()=>{
      const move=chooseGomokuIgoMove(board,2,seen);
      if(move)place(move.r,move.c,2,true);
      else pass(2,true);
    },450);
    return ()=>clearTimeout(timer);
  },[board,turn,mode,winner,seen]);

  return <GameLayout title="囲碁五目並べ" subtitle="「5連で勝利」×「囲めば消える」新感覚ボードゲーム" theme="igomoku">
    <main className="igomoku-layout"><aside className="game-sidebar"><section className="game-panel"><p className="eyebrow">手番</p><div className="moves-turn"><i className={`turn-disc ${(reviewing?reviewedState.turn:turn)===1?'black':'white'}`}/>{reviewing?`盤面確認中 (${reviewIndex}/${history.length}手)`:winner?`${winner===1?'黒':'白'}の勝利`:turn===1?'黒番 (先手)':mode==='AI'?'白番 (AI)':'白番 (後手)'}</div>
      <div className="capture-counts"><div>⚫ 黒の捕獲 <b>{(reviewing?reviewedState.captures:captures)[1]}</b></div><div>⚪ 白の捕獲 <b>{(reviewing?reviewedState.captures:captures)[2]}</b></div></div>
      <p className="moves-message">{reviewing?`${reviewIndex}手目の盤面を表示中です。`:message}</p>
      {reviewing&&<div className="button-row"><button className="game-button" disabled={reviewIndex===0} onClick={()=>setReviewIndex(index=>Math.max(0,index-1))}>前の手</button><button className="game-button" disabled={reviewIndex>=history.length} onClick={()=>setReviewIndex(index=>Math.min(history.length,index+1))}>次の手</button></div>}
      {reviewing&&<button className="game-button full" onClick={returnToFinalBoard}>最終盤面に戻る</button>}
      {winner>0&&!reviewing&&<button className="game-button primary full" onClick={startReview}>対局を見直す</button>}
      <div className="button-row"><button className={`game-button ${mode==='P2P'?'active':''}`} onClick={()=>reset('P2P')}>二人で対戦</button><button className={`game-button ${mode==='AI'?'active':''}`} onClick={()=>reset('AI')}>VS AI (後手)</button></div>
      <div className="button-column"><button className="game-button primary" disabled={winner>0||(mode==='AI'&&turn===2)} onClick={()=>pass()}>パス</button><button className="game-button" disabled={!history.length||winner>0} onClick={undo}>一手戻す</button><button className="game-button" onClick={()=>setRules(true)}>ルール説明</button><button className="game-button" onClick={()=>reset()}>盤面リセット</button></div>
      <button className="game-button full" onClick={restore} disabled={!recovery}>保存した盤面を復元</button>
      <p className="help-text">盤面はこのブラウザーに自動保存されます。</p>
      </section></aside><section className="igomoku-board-area"><GomokuBoard board={reviewing?reviewedState.board:board} onCell={place} lastMove={reviewing?reviewedState.last:last}/><p className="board-caption">{reviewing?`${reviewIndex} / ${history.length}手`:<>⚫ 黒石　 ⚪ 白石　 ·　赤点：最新の着手</>}</p></section></main>
    {rules&&<div className="game-modal"><div><button className="modal-close" onClick={()=>setRules(false)}>×</button><h2>ルール</h2><p>五連を作ると勝利です。相手の石を四方から囲むと捕獲できます。呼吸点がない自殺手、同じ盤面に戻る手は禁止です。</p><button className="game-button primary" onClick={()=>setRules(false)}>閉じる</button></div></div>}
    {winner>0&&showResult&&<div className="game-modal"><div><h2>{winner===1?'黒':'白'}番の勝利！</h2><p>五連が完成しました</p><button className="game-button" onClick={startReview}>盤面を見直す</button><button className="game-button primary" onClick={()=>reset()}>もう一度遊ぶ</button></div></div>}
  </GameLayout>;
}
