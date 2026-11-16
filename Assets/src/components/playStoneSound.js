import stoneSound from '../../Sounds/碁石を打つ.mp3';

export function playStoneSound() {
  const sound = new Audio(stoneSound);
  sound.play().catch((error) => {
    console.warn('碁石を打つ音を再生できませんでした。', error);
  });
}
