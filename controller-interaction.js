(() => {
  const stage = document.querySelector('.controller-stage');
  const controller = document.querySelector('.controller');
  if (!stage || !controller) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rx = -18, ry = -22, vx = 0, vy = 0, dragging = false, px = 0, py = 0, lastX = 0, lastY = 0, frame = 0;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const paint = () => {
    const maxX = Math.max(0, stage.clientWidth - controller.offsetWidth);
    const maxY = Math.max(0, stage.clientHeight - controller.offsetHeight);
    px = clamp(px, 0, maxX); py = clamp(py, 0, maxY);
    controller.style.left = px + 'px'; controller.style.top = py + 'px';
    controller.style.transform = 'translate3d(0,0,0) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) rotateZ(' + (Math.sin(ry * Math.PI / 180) * 4) + 'deg)';
  };
  const tick = () => {
    if (!dragging && !reduced) {
      vx *= .94; vy *= .94;
      if (Math.abs(vx) > .025 || Math.abs(vy) > .025) {
        ry += vx; rx = clamp(rx + vy, -360, 360); paint();
      } else { cancelAnimationFrame(frame); frame = 0; return; }
    }
    frame = requestAnimationFrame(tick);
  };
  const start = e => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; controller.setPointerCapture?.(e.pointerId);
    lastX = e.clientX; lastY = e.clientY; vx = vy = 0;
    controller.classList.add('is-dragging'); e.preventDefault();
  };
  const move = e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    ry += dx * .9; rx = clamp(rx - dy * .9, -360, 360);
    vx = dx * .9; vy = -dy * .9; lastX = e.clientX; lastY = e.clientY;
    px = clamp(px + dx, 0, Math.max(0, stage.clientWidth - controller.offsetWidth));
    py = clamp(py + dy, 0, Math.max(0, stage.clientHeight - controller.offsetHeight));
    paint();
  };
  const end = () => {
    if (!dragging) return; dragging = false; controller.classList.remove('is-dragging');
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const reset = () => { px = Math.max(0, (stage.clientWidth - controller.offsetWidth) / 2); py = Math.max(0, (stage.clientHeight - controller.offsetHeight) / 2); paint(); };
  controller.style.cursor = 'grab'; controller.style.touchAction = 'none'; controller.style.left = '0'; controller.style.top = '0';
  controller.setAttribute('role', 'img'); controller.setAttribute('aria-label', 'Interactive 3D REDCORE controller. Drag to rotate and move.');
  controller.addEventListener('pointerdown', start);
  controller.addEventListener('pointermove', move);
  controller.addEventListener('pointerup', end); controller.addEventListener('pointercancel', end);
  controller.addEventListener('lostpointercapture', end);
  addEventListener('resize', () => { px = clamp(px, 0, Math.max(0, stage.clientWidth-controller.offsetWidth)); py = clamp(py, 0, Math.max(0,stage.clientHeight-controller.offsetHeight)); paint(); });
  reset();
})();