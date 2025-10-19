// Lightweight audio controller
function initAudio() {
  const audio = document.getElementById('bg-music');
  const muteBtn = document.getElementById('mute-btn');
  const volumeSlider = document.getElementById('volume-slider');
  if (!audio || !muteBtn || !volumeSlider) return;

  // Helpers
  const safeSetVolume = (v) => {
    const n = Number(v);
    if (!isFinite(n) || n < 0) return;
    audio.volume = Math.max(0, Math.min(1, n));
  };

  const updateIcon = () => {
    muteBtn.innerHTML = audio.muted || audio.volume === 0 ? '🔇︎&#xFE0E;' : '🔈︎&#xFE0E;';
  };

  const tryPlayWithFallback = () => {
    audio.play().catch(() => {
      // If the browser blocks play(), resume on the next user gesture
      const resume = () => { audio.play().catch(() => {}); document.body.removeEventListener('click', resume); };
      document.body.addEventListener('click', resume, { once: true });
    });
  };


  let primed = false;

  // Restore last volume (persisted) or use slider value
  const persisted = Number(localStorage.getItem('lastVolume'));
  const initVol = (isFinite(persisted) && persisted > 0) ? persisted : Number(volumeSlider.value || 0.2);
  safeSetVolume(initVol);
  if (initVol > 0) try { localStorage.setItem('lastVolume', String(initVol)); } catch (e) {}

  // Keep slider in sync
  volumeSlider.value = String(audio.volume);
  audio.muted = true;
  updateIcon();

  const tryImmediatePlay = () => {

  audio.play().then(() => { primed = true; }).catch(() => {

      const warmup = () => {
        const userDesiredMuted = audio.muted; 
        audio.muted = true;
        audio.play().then(() => {
          primed = true;
        
          audio.muted = Boolean(userDesiredMuted);
        }).catch(() => {
         
        });
        document.body.removeEventListener('click', warmup);
      };
      document.body.addEventListener('click', warmup, { once: true });
    });
  };

  tryImmediatePlay();

  // Mute/unmute button
  muteBtn.addEventListener('click', () => {
    const willUnmute = audio.muted === true;
    audio.muted = !audio.muted;
    if (willUnmute) {
      // Restore a sensible volume on unmute
      const last = Number(localStorage.getItem('lastVolume')) || Number(volumeSlider.value) || 0.2;
      const volToSet = (isFinite(last) && last > 0) ? last : 0.2;
      safeSetVolume(volToSet);
      volumeSlider.value = String(audio.volume);

      const setAndPlay = () => {
        try {
          if (audio.readyState >= 1) {
            // set to 0.5s to avoid audible restart from 0
            audio.currentTime = Math.min(0.5, Math.max(0, audio.duration ? Math.min(audio.duration - 0.1, 0.5) : 0.5));
          } else {
            // wait for metadata if not available yet
            audio.addEventListener('loadedmetadata', function onMeta() {
              audio.currentTime = Math.min(0.5, Math.max(0, audio.duration ? Math.min(audio.duration - 0.1, 0.5) : 0.5));
              audio.removeEventListener('loadedmetadata', onMeta);
            });
          }
        } catch (err) {
          // ignore timing errors
        }
        tryPlayWithFallback();
      };

      if (!primed) setAndPlay(); else tryPlayWithFallback();
    }
    updateIcon();
  });

  volumeSlider.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    safeSetVolume(v);
    if (v <= 0) {
      audio.muted = true;
    } else {
      if (audio.muted) audio.muted = false;
      try { localStorage.setItem('lastVolume', String(v)); } catch (err) {}
      tryPlayWithFallback();
    }
    updateIcon();
  });

  audio.addEventListener('volumechange', updateIcon);
}

if (typeof window !== 'undefined') {

  window['__audio'] = window['__audio'] || {};
  window['__audio'].initAudio = initAudio;
}

export { initAudio };