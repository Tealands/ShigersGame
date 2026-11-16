import { useState } from 'react';
import GameLayout from '../components/GameLayout.jsx';
import GomokuBoard from '../components/GomokuBoard.jsx';
import { playStoneSound } from '../components/playStoneSound.js';
import { emptyBoard } from './pointgomoku.js';

function captureSurrounded(board, target) {
  const next=board.map(row=>[...row]), visited=new Set(), dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let r=0;r<next.length;r++) for(let c=0;c<next.length;c++) if(next[r][c]===target && !visited.has(`${r},${c}`)) {
    const group=[], queue=[[r,c]], liberties=new Set(); visited.add(`${r},${c}`);
    while(queue.length) { const [y,x]=queue.pop(); group.push([y,x]); for(const [dy,dx] of dirs) { const ny=y+dy,nx=x+dx,key=`${ny},${nx}`; if(next[ny]?.[nx]===0) liberties.add(key); else if(next[ny]?.[nx]===target&&!visited.has(key)){visited.add(key);queue.push([ny,nx]);} } }
    if(!liberties.size) group.forEach(([y,x])=>next[y][x]=0);
  }
  return next;
}

export default function MoveStone() {
  const querySize=Number(new URLSearchParams(window.location.search).get('size'));
  const size=[9,13,19].includes(querySize)?querySize:19;
  const [board,setBoard]=useState(()=>emptyBoard(size));
  const [turn,setTurn]=useState(1);
  const [moveMode,setMoveMode]=useState(false);
  const [moves,setMoves]=useState(0);
  const [selected,setSelected]=useState(null);
  const [history,setHistory]=useState([]);
  const [message,setMessage]=useState('空き交点に置くか、移動モードで石を動かします。');
  const switchTurn=()=>{setTurn(t=>3-t);setMoveMode(false);setMoves(0);setSelected(null);};
  const snapshot=()=>setHistory(h=>[...h,{board:board.map(row=>[...row]),turn,moveMode,moves}]);
  const clickCell=(r,c)=>{
    if(!moveMode) {
      if(board[r][c]) {setMessage('そこには置けません。');return;}
      playStoneSound();
      snapshot();const next=board.map(row=>[...row]);next[r][c]=turn;setBoard(captureSurrounded(next,3-turn));switchTurn();setMessage('石を配置しました。');return;
    }
    if(!selected){if(board[r][c]===turn)setSelected({r,c});else setMessage('自分の石を選んでください。');return;}
    if(board[r][c] || (Math.abs(selected.r-r)+Math.abs(selected.c-c)!==1)){setMessage('隣の空点を移動先に選んでください。');return;}
    playStoneSound();
    snapshot();const next=board.map(row=>[...row]);next[selected.r][selected.c]=0;next[r][c]=turn;setBoard(captureSurrounded(next,3-turn));setSelected(null);
    if(moves+1>=2){switchTurn();setMessage('石を移動し、手番を交代しました。');}else{setMoves(m=>m+1);setMessage('あと1回移動できます。');}
  };
  const toggleMove=()=>{setMoveMode(v=>!v);setSelected(null);setMoves(0);};
  const undo=()=>{const previous=history[history.length-1];if(!previous)return;setBoard(previous.board);setTurn(previous.turn);setMoveMode(previous.moveMode);setMoves(previous.moves);setHistory(h=>h.slice(0,-1));setSelected(null);};
  return <GameLayout title="移碁" subtitle="石を動かして相手を囲む、戦略型ボードゲーム" theme="moves">
    <main className="moves-layout"><aside className="game-sidebar"><section className="game-panel"><p className="eyebrow">対局状況</p><div className="moves-turn"><i className={`turn-disc ${turn===1?'black':'white'}`}/>{turn===1?'黒の手番':'白の手番'}</div>
      <p className="moves-message">{message}</p><div className="button-column"><button className={`game-button primary ${moveMode?'active':''}`} onClick={toggleMove}>{moveMode?'通常モードへ':'石の移動モード'}</button><button className="game-button" disabled={!history.length} onClick={undo}>1手戻す</button><button className="game-button" onClick={()=>{setBoard(emptyBoard(size));setTurn(1);setHistory([]);setMoveMode(false);setMoves(0);}}>新しい対局</button></div>
      {moveMode&&<p className="help-text">自分の石を選び、隣の空点を選ぶと移動。手番ごとに2回まで移動できます。</p>}
      </section></aside><section className="moves-board-area"><GomokuBoard board={board} size={size} onCell={clickCell} selected={selected}/><p className="board-caption">{size} × {size} · {moveMode?'移動モード':'配置モード'}</p></section></main>
  </GameLayout>;
}
