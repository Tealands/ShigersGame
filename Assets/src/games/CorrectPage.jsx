import { useState } from 'react';
import anthem from '../../../KeepOut/rule_britannia.mp3';
import photo from '../../../KeepOut/Elizabeth_Tower,_June_2022.jpg';

export default function CorrectPage() {
  const [revealed, setRevealed] = useState(false);
  const celebrate = async () => {
    setRevealed(true);
    try { await new Audio(anthem).play(); } catch { /* Playback may be blocked by browser settings. */ }
  };
  return <main className="correct-page">
    <img src={photo} alt="Elizabeth Tower" />
    <h1>Congratulation!</h1>
    {!revealed ? <button className="game-button primary" onClick={celebrate}>次へ</button> : <div className="correct-links"><a href="https://tealands.github.io/Tealands_page/">しげるのページに戻る</a><a href="#/number-place">もう一度数独をプレイ</a></div>}
  </main>;
}
