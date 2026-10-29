(() => {
  const stage = document.querySelector('.controller-stage');
  const controller = document.querySelector('.controller');
  if (!stage || !controller) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const REST_X = -18;
  const REST_Y = -22;
  let rx = REST_X, ry = REST_Y, vx = 0, vy = 0;
  let dragging = false, px = 0, py = 0, lastX = 0, lastY = 0;
  let frame = 0, previousTime = 0, spinSpeed = 0.28;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const angleDelta = (target, current) => ((target - current + 180) % 360 + 360) % 360 - 180;
  const bounds = () => ({
    x: Math.max(0, stage.clientWidth - controller.offsetWidth),
    y: Math.max(0, stage.clientHeight - controller.offsetHeight)
  });

  function paint() {
    const limit = bounds();
    // The uploaded image is a multi-view sheet. Cycle between front/back
    // crops as the controller turns, keeping the sheet itself hidden.
    const yaw = ((ry % 360) + 360) % 360;
    const side = Math.abs(Math.sin(ry * Math.PI / 180));
    controller.style.setProperty('--controller-face', yaw > 90 && yaw < 270 ? 'back' : 'front');
    controller.style.setProperty('--controller-turn', side.toFixed(3));
    px = clamp(px, 0, limit.x);
    py = clamp(py, 0, limit.y);
    controller.style.left = px + 'px';
    controller.style.top = py + 'px';
    // Keep angles unwrapped so repeated drags can complete multiple full turns.
    // Simulated 3D turn: rotate around both axes while the sprite crop
    // switches between the sheet's front and rear views.
    controller.style.transform =
      'translate3d(0,0,0) rotateX(' + rx + 'deg) rotateY(' + ry +
      'deg) rotateZ(' + (Math.sin(ry * Math.PI / 180) * 4) + 'deg)';
  }

  function animate(now) {
    frame = 0;
    if (dragging) return;
    if (!previousTime) previousTime = now;
    const dt = Math.min(2, (now - previousTime) / 16.667 || 1);
    previousTime = now;

    if (!reducedMotion) {
      // Inertia plus a damped spring that settles the controller back to its
      // resting pose, with a little overshoot for a physical, springy feel.
      const spring = 0.018 * dt;
      const damping = Math.pow(0.88, dt);
      // Keep a slow continuous Y-axis spin; scrolling boosts its speed.
      spinSpeed += (0.28 - spinSpeed) * (1 - Math.pow(0.985, dt));
      vy += angleDelta(REST_X, rx) * spring;
      vx *= damping;
      vy *= damping;
      ry += (spinSpeed + vx * 0.12) * dt;
      rx += vy * dt;
      if (Math.abs(vy) < 0.025 && Math.abs(angleDelta(REST_X, rx)) < 0.35) {
        rx = REST_X; vy = 0;
      }
      paint();
      frame = requestAnimationFrame(animate);
    } else {
      vx = vy = 0;
      previousTime = 0;
    }
  }

  function start(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previousTime = 0;
    controller.setPointerCapture?.(e.pointerId);
    lastX = e.clientX; lastY = e.clientY;
    vx = vy = 0;
    controller.classList.add('is-dragging');
    e.preventDefault();
  }

  function move(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    // Horizontal drag spins around Y; vertical drag spins around X.
    ry += dx * 1.15;
    rx -= dy * 1.15;
    vx = dx * 1.15;
    vy = -dy * 1.15;
    lastX = e.clientX; lastY = e.clientY;

    const limit = bounds();
    px = clamp(px + dx, 0, limit.x);
    py = clamp(py + dy, 0, limit.y);
    paint();
  }

  function end() {
    if (!dragging) return;
    dragging = false;
    controller.classList.remove('is-dragging');
    previousTime = 0;
    if (!reducedMotion) frame = requestAnimationFrame(animate);
    else { rx = REST_X; paint(); }
  }

  function resetPosition() {
    const limit = bounds();
    px = limit.x / 2;
    py = limit.y / 2;
    paint();
  }

  controller.style.cursor = 'grab';
  controller.style.touchAction = 'none';
  controller.style.left = '0px';
  controller.style.top = '0px';
  controller.setAttribute('role', 'img');
  controller.setAttribute('aria-label',
    'Interactive 3D REDCORE controller. Drag horizontally and vertically for full 360-degree rotation on both axes; release for spring motion.');
  controller.addEventListener('pointerdown', start);
  controller.addEventListener('pointermove', move);
  controller.addEventListener('pointerup', end);
  controller.addEventListener('pointercancel', end);
  controller.addEventListener('lostpointercapture', end);
  let lastScrollY = window.scrollY;
  addEventListener('scroll', () => {
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    lastScrollY = currentY;
    spinSpeed = clamp(spinSpeed + delta * 0.018, -7, 7);
    if (!dragging && !reducedMotion && !frame) frame = requestAnimationFrame(animate);
  }, { passive: true });
  addEventListener('resize', resetPosition);
  resetPosition();
})();