export function initImmersiveUI(doc = document) {
  const menu = doc.querySelector('.museum-menu');
  const panel = doc.querySelector('.museum-menu-panel');
  const stage = doc.getElementById('gallery-stage');
  if (!menu || !panel || !stage) return () => {};

  const view = doc.defaultView;
  const summary = menu.querySelector('summary');
  const navigation = doc.querySelector('.tour-navigation');
  const listeners = new AbortController();
  const signal = listeners.signal;
  const idleDelay = 4500;
  let idleTimer = null;
  let touchEndTimer = null;
  let touchingStage = false;
  let lastActivity = view.performance.now();
  let restoreMenuFocus = false;
  const intro = doc.getElementById('museum-intro');
  function dismissIntro(focus = false) {
    if (!intro || intro.hidden) return;
    intro.hidden = true;
    try { view.sessionStorage.setItem('museum-intro-seen', '1'); } catch { /* Storage is optional. */ }
    if (focus) stage.querySelector('[data-guide-target]')?.focus({preventScroll:true});
    revealNavigation();
  }
  if (intro) {
    function showIntro() {
      let seen = false;
      try { seen = view.sessionStorage.getItem('museum-intro-seen') === '1'; } catch { /* Show without storage. */ }
      intro.hidden = seen || stage.dataset.room !== 'lobby';
    }
    doc.getElementById('dismiss-museum-intro').addEventListener('click', () => dismissIntro(true), {signal});
    stage.addEventListener('museum-ready', showIntro, {signal});
    stage.addEventListener('click', event => {
      if (!intro.contains(event.target) && event.target.closest('canvas, [data-guide-target], .work-label, .hall-display-hit')) dismissIntro();
    }, {signal});
    stage.addEventListener('museum-room-change', () => { if (stage.dataset.room !== 'lobby') dismissIntro(); }, {signal});
  }

  function scheduleIdle() {
    idleTimer = view.setTimeout(() => {
      idleTimer = null;
      const remaining = idleDelay - (view.performance.now() - lastActivity);
      if (remaining > 0) {
        scheduleIdle();
      } else {
        if (!intro || intro.hidden) doc.body.classList.add('museum-idle');
      }
    }, Math.max(1, idleDelay - (view.performance.now() - lastActivity)));
  }
  function revealNavigation() {
    lastActivity = view.performance.now();
    doc.body.classList.remove('museum-idle');
    // Pointer events only update a timestamp; they do not create/cancel a timer each frame.
    if (idleTimer === null && !doc.hidden) scheduleIdle();
  }

  panel.addEventListener('click', event => {
    const control = event.target.closest('.site-nav button, .brand');
    if (!control || control.id === 'language-toggle') return;
    restoreMenuFocus = Boolean(doc.querySelector('dialog[open]'));
    menu.open = false;
  }, { signal });
  doc.addEventListener('pointerdown', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  }, { signal });
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      summary.focus({ preventScroll: true });
    }
    revealNavigation();
  }, { signal });
  doc.addEventListener('focusin', () => {
    if (!touchingStage) revealNavigation();
  }, { signal });
  menu.addEventListener('toggle', () => {
    // Prevent Tab from reaching the visually hidden navigation behind an open menu.
    if (navigation) navigation.inert = menu.open;
    revealNavigation();
  }, { signal });
  for (const dialog of doc.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => {
      if (restoreMenuFocus && !doc.querySelector('dialog[open]')) {
        restoreMenuFocus = false;
        summary.focus({ preventScroll: true });
      }
    }, { signal });
  }
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') {
      touchingStage = true;
      if (touchEndTimer !== null) {
        view.clearTimeout(touchEndTimer);
        touchEndTimer = null;
      }
    } else {
      revealNavigation();
    }
  }, { passive: true, signal });
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') revealNavigation();
  }, { passive: true, signal });
  doc.addEventListener('pointerup', event => {
    if (event.pointerType === 'touch' && touchingStage) {
      // Keep focus from revealing the navigation before the synthesized click.
      touchEndTimer = view.setTimeout(() => { touchingStage = false; touchEndTimer = null; }, 0);
    }
  }, { passive: true, signal });
  doc.addEventListener('pointercancel', event => {
    if (event.pointerType === 'touch') touchingStage = false;
  }, { passive: true, signal });
  stage.addEventListener('click', revealNavigation, { signal });
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden && idleTimer !== null) {
      view.clearTimeout(idleTimer);
      idleTimer = null;
    } else if (!doc.hidden) revealNavigation();
  }, { signal });
  revealNavigation();
  return () => {
    listeners.abort();
    if (idleTimer !== null) view.clearTimeout(idleTimer);
    if (touchEndTimer !== null) view.clearTimeout(touchEndTimer);
    if (navigation) navigation.inert = false;
  };
}

if (typeof document !== 'undefined') initImmersiveUI();
