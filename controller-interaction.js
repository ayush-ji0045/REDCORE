(() => {
  const stage = document.querySelector('.controller-stage');
  const controller = document.querySelector('.controller');
  if (!stage || !controller) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const REST_Y = -4;
  const MAX_TILT = 13;
  let ry = REST_Y, targetY = REST_Y;
  let dragging = false, lastX = 0, frame = 0;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function paint() {
    // Keep the front face visible at all times: only a small left/right yaw.
    ry += (targetY - ry) * 0.14;
    controller.style.transform = 'translate3d(0,0,0) rotateY(' + ry + 'deg)';
    if (!dragging && Math.abs(targetY - ry) > 0.08 && !reducedMotion) {
      frame = requestAnimationFrame(paint);
    } else {
      frame = 0;
      if (reducedMotion) ry = targetY;
    }
  }

  function requestPaint() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function start(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    controller.setPointerCapture?.(e.pointerId);
    lastX = e.clientX;
    controller.classList.add('is-dragging');
    e.preventDefault();
  }

  function move(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    targetY = clamp(targetY + dx * 0.32, -MAX_TILT, MAX_TILT);
    if (reducedMotion) {
      ry = targetY;
      controller.style.transform = 'translate3d(0,0,0) rotateY(' + ry + 'deg)';
    } else requestPaint();
  }

  function end() {
    if (!dragging) return;
    dragging = false;
    controller.classList.remove('is-dragging');
    targetY = REST_Y;
    if (reducedMotion) {
      ry = REST_Y;
      controller.style.transform = 'rotateY(' + ry + 'deg)';
    } else requestPaint();
  }

  controller.style.cursor = 'grab';
  controller.style.touchAction = 'pan-y';
  controller.setAttribute('role', 'img');
  controller.setAttribute('aria-label',
    'REDCORE controller. Drag left or right to gently tilt the front face; it does not spin around or turn to the back.');
  controller.addEventListener('pointerdown', start);
  controller.addEventListener('pointermove', move);
  controller.addEventListener('pointerup', end);
  controller.addEventListener('pointercancel', end);
  controller.addEventListener('lostpointercapture', end);
  // A subtle, restrained idle tilt; scrolling no longer spins the controller.
  if (!reducedMotion) {
    const idle = () => {
      if (!dragging) {
        targetY = REST_Y + Math.sin(Date.now() / 1700) * 2.5;
        requestPaint();
      }
    };
    setInterval(idle, 900);
  }
  controller.style.transform = 'rotateY(' + REST_Y + 'deg)';
})();