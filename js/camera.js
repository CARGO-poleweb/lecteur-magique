/** Accès à la caméra arrière du téléphone, et prise de vue. */

export function createCamera(video) {
  let stream = null;
  let facing = 'environment';

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Ce navigateur ne donne pas accès à la caméra. Essaie Chrome ou Safari.");
    }
    if (!window.isSecureContext) {
      throw new Error('La caméra exige une connexion sécurisée (https) ou localhost.');
    }
    stop();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error("Accès à la caméra refusé. Autorise-le dans les réglages du navigateur.");
      }
      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        throw new Error("Aucune caméra utilisable n'a été trouvée sur cet appareil.");
      }
      throw new Error(`La caméra n'a pas pu démarrer (${error.name}).`);
    }
    video.srcObject = stream;
    await video.play().catch(() => { /* iOS rejoue au premier geste */ });
    return stream;
  }

  function stop() {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  const track = () => stream?.getVideoTracks()?.[0] || null;

  function hasTorch() {
    const capabilities = track()?.getCapabilities?.();
    return Boolean(capabilities && 'torch' in capabilities);
  }

  async function setTorch(on) {
    const videoTrack = track();
    if (!videoTrack) return false;
    try {
      await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }

  async function flip() {
    facing = facing === 'environment' ? 'user' : 'environment';
    await start();
    return facing;
  }

  /** Fige l'image courante dans un canvas. */
  function capture() {
    if (!video.videoWidth) throw new Error("L'aperçu de la caméra n'est pas encore prêt.");
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas;
  }

  return { start, stop, capture, hasTorch, setTorch, flip, get facing() { return facing; }, get active() { return Boolean(stream); } };
}
