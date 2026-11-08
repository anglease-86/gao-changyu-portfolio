(() => {
  'use strict';
  const opening = document.getElementById('opening');
  const main = document.getElementById('main-content');
  const header = document.getElementById('site-header');
  const progress = document.getElementById('page-progress');
  const hero = document.getElementById('home');
  const heroCopy = document.querySelector('.hero-copy');
  const chapterTeaser = document.querySelector('.chapter-teaser');
  const fallback = document.querySelector('.scene-fallback');
  const about = document.getElementById('about');
  const works = document.getElementById('works');
  const worksViewport = document.getElementById('works-viewport');
  const worksTrack = document.getElementById('works-track');
  const worksIndex = document.getElementById('works-index');
  const railLabel = document.querySelector('[data-section-label]');
  const railProgress = document.querySelector('.rail-line span');
  const status = document.getElementById('animation-status');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set();
  let leaving = false;
  let previousFocus = null;
  let rafPending = false;
  let heroTravel = 1;
  let worksStart = 0;
  let worksTravel = 1;
  let pageTravel = 1;
  let headerHeight = 94;
  let loopPeriod = 0;
  let carouselStep = 0;
  let carouselOffset = 0;
  let carouselFrame = 0;
  let lastCarouselTime = 0;
  let carouselVisible = false;
  let carouselStarted = false;
  let hoverPaused = false;
  let focusPaused = false;
  let dragging = false;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragLastX = 0;
  let dragMoved = false;
  let suppressClickUntil = 0;
  let pauseUntil = 0;
  let sectionPositions = [];
  let activeSectionElement = null;
  let currentWork = 0;
  let projectTrigger = null;
  const originalTrackGroup = worksTrack.querySelector('[data-track-group="original"]');
  const workItems = [...originalTrackGroup.querySelectorAll('.work-item')];
  const workCount = workItems.length;
  const projectDialog = document.getElementById('project-dialog');
  const workProgress = document.querySelector('.work-progress span');

  function makeTrackCopy() {
    const copy = originalTrackGroup.cloneNode(true);
    copy.removeAttribute('data-track-group');
    copy.classList.add('is-loop-copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('[data-reveal]').forEach(element => {
      element.removeAttribute('data-reveal');
      element.classList.remove('is-visible');
    });
    copy.querySelectorAll('summary').forEach(summary => { summary.tabIndex = -1; });
    return copy;
  }
  worksTrack.prepend(makeTrackCopy());
  worksTrack.append(makeTrackCopy());

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const later = (callback, delay) => {
    const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
  };
  const clearTimers = () => { timers.forEach(window.clearTimeout); timers.clear(); };

  function finishOpening(immediate = false) {
    if (leaving || opening.hidden) return;
    leaving = true;
    clearTimers();
    opening.classList.add('is-leaving');
    document.body.classList.add('is-revealed');
    main.inert = false;
    header.inert = false;
    window.dispatchEvent(new CustomEvent('portfolio:intro-end'));
    const complete = () => {
      opening.hidden = true;
      document.body.classList.remove('intro-active');
      status.textContent = '高长宇的个人主页已显示。';
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else if (opening.contains(document.activeElement)) document.getElementById('replay-opening').focus({ preventScroll: true });
      measure();
    };
    if (immediate || motionPreference.matches) complete();
    else later(complete, 1050);
  }

  function startOpening(isReplay = false) {
    clearTimers();
    leaving = false;
    previousFocus = isReplay ? document.activeElement : null;
    window.scrollTo({ top: 0, behavior: 'instant' });
    opening.hidden = false;
    opening.classList.remove('is-playing', 'is-leaving');
    document.body.classList.remove('is-revealed');
    document.body.classList.add('intro-active');
    main.inert = true;
    header.inert = true;
    heroCopy.style.opacity = '';
    heroCopy.style.transform = '';
    window.dispatchEvent(new CustomEvent('portfolio:intro-start'));
    void opening.offsetWidth;
    opening.classList.add('is-playing');
    if (isReplay) document.getElementById('skip-opening').focus({ preventScroll: true });
    if (motionPreference.matches) finishOpening(true);
    else later(() => finishOpening(), 2050);
  }

  function activeSection(y) {
    let active = sectionPositions[0].element;
    sectionPositions.forEach(section => {
      if (section.top - headerHeight * .7 <= y) active = section.element;
    });
    return active;
  }

  function updateScroll() {
    rafPending = false;
    const y = window.scrollY;
    const heroProgress = motionPreference.matches ? 0 : clamp(y / heroTravel);
    const fade = 1 - clamp((heroProgress - .1) / .72);
    heroCopy.style.opacity = String(fade);
    heroCopy.style.transform = motionPreference.matches ? '' : 'translate3d(0,' + (-heroProgress * 76) + 'px,0)';
    progress.style.transform = 'scaleX(' + clamp(y / pageTravel) + ')';
    const worksProgress = motionPreference.matches ? 0 : clamp((y - worksStart) / worksTravel);
    chapterTeaser.hidden = y > heroTravel * .35;
    fallback.style.opacity = y > worksStart - window.innerHeight * .3 ? '0' : String(1 - heroProgress);
    header.classList.add('is-dark');
    themeColor.content = '#050505';
    const section = activeSection(y + window.innerHeight * .35);
    if (section !== activeSectionElement) {
      activeSectionElement?.classList.remove('is-current');
      section.classList.add('is-current');
      activeSectionElement = section;
    }
    const sectionIndex = Math.max(1, sectionPositions.findIndex(item => item.element === section) + 1);
    railLabel.textContent = section.dataset.section || 'TOP';
    document.querySelector('.rail-count b').textContent = String(sectionIndex).padStart(2, '0');
    railProgress.style.height = String(sectionIndex / 5 * 100) + '%';
    document.body.dataset.section = section.dataset.section || 'TOP';
    window.dispatchEvent(new CustomEvent('portfolio:scroll', { detail: { y, heroTravel, worksStart, worksProgress, pageTravel, sections: sectionPositions.map(({ id, top, height }) => ({ id, top, height })) } }));
  }

  function measure() {
    const previousPeriod = loopPeriod;
    const phase = previousPeriod ? carouselOffset / previousPeriod : 0;
    heroTravel = Math.max(1, hero.offsetHeight - window.innerHeight);
    worksStart = works.offsetTop;
    worksTravel = Math.max(1, works.offsetHeight - window.innerHeight);
    headerHeight = header.offsetHeight;
    document.documentElement.style.setProperty('--header-height', headerHeight + 'px');
    pageTravel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    sectionPositions = [...document.querySelectorAll('main [data-section]')].map(element => ({ element, id: element.id, top: element.offsetTop, height: element.offsetHeight }));
    const groupStyle = getComputedStyle(originalTrackGroup);
    const gap = parseFloat(groupStyle.columnGap) || 0;
    loopPeriod = originalTrackGroup.getBoundingClientRect().width;
    carouselStep = (workItems[0]?.getBoundingClientRect().width || 0) + gap;
    if (previousPeriod && loopPeriod) carouselOffset = phase * loopPeriod;
    renderCarousel();
    updateScroll();
  }

  document.getElementById('skip-opening').addEventListener('click', () => finishOpening());
  document.getElementById('replay-opening').addEventListener('click', () => startOpening(true));
  document.getElementById('toggle-motion').addEventListener('click', event => {
    const button = event.currentTarget;
    const paused = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? '播放场景动画' : '暂停场景动画');
    button.dataset.tooltip = paused ? '播放动画' : '暂停动画';
    button.querySelector('[data-icon]').innerHTML = '';
    button.querySelector('[data-icon]').dataset.icon = paused ? 'play' : 'pause';
    renderIcon(button.querySelector('[data-icon]'));
    window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused } }));
  });

  function renderCarousel() {
    if (!loopPeriod || !carouselStep) return;
    carouselOffset %= loopPeriod;
    worksTrack.style.transform = 'translate3d(' + (-loopPeriod - carouselOffset) + 'px,0,0)';
    const phase = (carouselOffset + loopPeriod) % loopPeriod;
    const nextWork = Math.floor(phase / carouselStep) % workCount;
    worksIndex.textContent = String(nextWork + 1).padStart(2, '0');
    if (nextWork !== currentWork) currentWork = nextWork;
    workProgress.style.transform = 'scaleX(' + (phase / loopPeriod) + ')';
  }

  function setCarouselOffset(offset) {
    if (!loopPeriod) return;
    carouselOffset = offset % loopPeriod;
    renderCarousel();
  }

  function carouselFrameStep(time) {
    carouselFrame = 0;
    if (!carouselVisible || document.hidden || motionPreference.matches) {
      lastCarouselTime = 0;
      return;
    }
    const delta = lastCarouselTime ? Math.min((time - lastCarouselTime) / 1000, .05) : 0;
    lastCarouselTime = time;
    if (!hoverPaused && !focusPaused && !dragging && !projectDialog.open && time >= pauseUntil) {
      setCarouselOffset(carouselOffset + delta * 36);
    }
    carouselFrame = requestAnimationFrame(carouselFrameStep);
  }

  function syncCarouselPlayback() {
    const shouldRun = carouselVisible && !document.hidden && !motionPreference.matches;
    if (shouldRun && !carouselFrame) {
      lastCarouselTime = 0;
      carouselFrame = requestAnimationFrame(carouselFrameStep);
    } else if (!shouldRun && carouselFrame) {
      cancelAnimationFrame(carouselFrame);
      carouselFrame = 0;
      lastCarouselTime = 0;
    }
  }

  function moveWork(direction) {
    setCarouselOffset(carouselOffset + direction * carouselStep);
    pauseUntil = performance.now() + 1800;
  }
  document.getElementById('previous-work').addEventListener('click', () => moveWork(-1));
  document.getElementById('next-work').addEventListener('click', () => moveWork(1));

  worksViewport.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') hoverPaused = true;
  });
  worksViewport.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') hoverPaused = false;
  });
  worksViewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button,a,summary,input,select,textarea')) return;
    dragging = true;
    dragPointerId = event.pointerId;
    dragStartX = dragLastX = event.clientX;
    dragMoved = false;
    worksViewport.setPointerCapture(event.pointerId);
    worksTrack.classList.add('is-dragging');
    event.preventDefault();
  });
  worksViewport.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragPointerId) return;
    const delta = event.clientX - dragLastX;
    dragLastX = event.clientX;
    if (Math.abs(event.clientX - dragStartX) > 4) dragMoved = true;
    if (delta) setCarouselOffset(carouselOffset - delta);
  });
  function finishCarouselDrag(event) {
    if (!dragging || event.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    worksTrack.classList.remove('is-dragging');
    pauseUntil = performance.now() + 1400;
    if (dragMoved) suppressClickUntil = performance.now() + 350;
  }
  worksViewport.addEventListener('pointerup', finishCarouselDrag);
  worksViewport.addEventListener('pointercancel', finishCarouselDrag);
  worksViewport.addEventListener('dragstart', event => event.preventDefault());
  worksViewport.addEventListener('focusin', event => {
    if (!keyboardNavigation || !event.target.matches('.work-detail summary')) return;
    focusPaused = true;
    const index = Number(event.target.closest('.work-item').dataset.workIndex) - 1;
    setCarouselOffset(index * carouselStep);
  });
  worksViewport.addEventListener('focusout', () => {
    requestAnimationFrame(() => { focusPaused = worksViewport.contains(document.activeElement); });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      carouselVisible = entries.some(entry => entry.isIntersecting);
      if (carouselVisible && !carouselStarted) {
        pauseUntil = performance.now() + 1000;
        carouselStarted = true;
      }
      syncCarouselPlayback();
    }, { threshold: 0 }).observe(worksViewport);
  } else {
    carouselVisible = true;
    pauseUntil = performance.now() + 1000;
    carouselStarted = true;
    syncCarouselPlayback();
  }
  document.addEventListener('visibilitychange', syncCarouselPlayback);

  let projectIndex = 0;
  let keyboardNavigation = false;
  document.addEventListener('keydown', event => { keyboardNavigation = event.key === 'Tab'; });
  document.addEventListener('pointerdown', () => { keyboardNavigation = false; }, { passive: true });
  function renderProject(index) {
    projectIndex = (index + workItems.length) % workItems.length;
    const item = workItems[projectIndex];
    document.getElementById('project-title').textContent = item.querySelector('h3').textContent;
    document.getElementById('project-meta').textContent = item.querySelector('.work-info>p').textContent;
    document.getElementById('project-role').textContent = item.querySelector('.work-info>span').textContent;
    document.getElementById('project-description').textContent = item.querySelector('.work-detail p').textContent;
    document.getElementById('project-position').textContent = String(projectIndex + 1).padStart(2, '0') + ' / 06';
    document.getElementById('project-art').replaceChildren(item.querySelector('.work-visual').cloneNode(true));
  }
  if (typeof projectDialog.showModal === 'function') {
    document.documentElement.classList.add('has-project-dialog');
    worksTrack.addEventListener('click', event => {
      const trigger = event.target.closest('.work-detail summary');
      if (!trigger) return;
      event.preventDefault();
      if (performance.now() < suppressClickUntil) return;
      const index = Number(trigger.closest('.work-item').dataset.workIndex) - 1;
      projectTrigger = workItems[index].querySelector('summary');
      renderProject(index);
      projectDialog.showModal();
      document.body.classList.add('project-open');
    });
    document.getElementById('close-project').addEventListener('click', () => projectDialog.close());
    projectDialog.addEventListener('click', event => { if (event.target === projectDialog) projectDialog.close(); });
    projectDialog.addEventListener('close', () => {
      document.body.classList.remove('project-open');
      projectTrigger?.focus({ preventScroll: true });
    });
    projectDialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') renderProject(projectIndex + 1);
      if (event.key === 'ArrowLeft') renderProject(projectIndex - 1);
    });
    document.getElementById('project-previous').addEventListener('click', () => renderProject(projectIndex - 1));
    document.getElementById('project-next').addEventListener('click', () => renderProject(projectIndex + 1));
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !opening.hidden) finishOpening();
    if (event.key === 'Tab' && !opening.hidden && !leaving) {
      event.preventDefault();
      document.getElementById('skip-opening').focus();
    }
  });
  function resetFallbackTilt() {
    fallback.style.setProperty('--pointer-x', '0');
    fallback.style.setProperty('--pointer-y', '0');
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    fallback.style.setProperty('--pointer-x', ((event.clientX / window.innerWidth - .5) * 10) + 'deg');
    fallback.style.setProperty('--pointer-y', ((.5 - event.clientY / window.innerHeight) * 8) + 'deg');
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', resetFallbackTilt);
  window.addEventListener('scroll', () => {
    if (!rafPending) { rafPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches && !opening.hidden) finishOpening(true);
    measure();
    syncCarouselPlayback();
  });
  if ('ResizeObserver' in window) {
    new ResizeObserver(measure).observe(about);
    new ResizeObserver(measure).observe(works);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));
  } else document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('is-visible'));

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      const top = target === hero ? 0 : target.offsetTop - headerHeight;
      window.scrollTo({ top, behavior: motionPreference.matches ? 'instant' : 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
      if (link.classList.contains('skip-link')) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });

  const iconPaths = {
    'arrow-up-right': ['M7 7h10v10', 'M7 17 17 7'],
    'arrow-down': ['M12 5v14', 'm5 12 7 7 7-7'],
    'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
    'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
    'pause': ['M9 5H6v14h3z', 'M18 5h-3v14h3z'],
    'play': ['m7 4 14 8-14 8z'],
    'x': ['m18 6-12 12', 'm6 6 12 12'],
    'rotate-ccw': ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
    'plus': ['M5 12h14', 'M12 5v14']
  };
  function renderIcon(element) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    iconPaths[element.dataset.icon]?.forEach(d => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.append(path);
    });
    element.append(svg);
  }
  document.querySelectorAll('[data-icon]').forEach(renderIcon);

  measure();
  if (location.hash && document.querySelector(location.hash)) {
    opening.hidden = true;
    document.body.classList.add('is-revealed');
    requestAnimationFrame(() => window.scrollTo({ top: document.querySelector(location.hash).offsetTop - headerHeight, behavior: 'instant' }));
  } else startOpening();
})();
