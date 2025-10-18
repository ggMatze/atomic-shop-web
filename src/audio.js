// Audio module: handles background music, mute button and volume slider
function initAudio() {
  const audio = document.getElementById('bg-music');
  const muteBtn = document.getElementById('mute-btn');
  const volumeSlider = document.getElementById('volume-slider');
  if (!audio || !muteBtn || !volumeSlider) return;

  // Play on first user interaction (many browsers block autoplay with sound)
  document.body.addEventListener('click', () => {
    audio.muted = true;
    audio.play().catch(() => {});
    audio.volume = 0.3;
  }, { once: true });

  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.innerHTML = audio.muted ? '🔇&#xFE0E;' : '🔈&#xFE0E;';
    if (!audio.muted) audio.play().catch(() => {});
  });

  volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value;
    if (+volumeSlider.value === 0) {
      audio.muted = true;
      muteBtn.innerHTML = '🔇&#xFE0E;';
    } else {
      audio.muted = false;
      muteBtn.innerHTML = '🔈&#xFE0E;';
      audio.play().catch(() => {});
    }
  });
}

if (typeof window !== 'undefined') {
  window.__audio = window.__audio || {};
  window.__audio.initAudio = initAudio;
}

export { initAudio };
