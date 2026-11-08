import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  /* ─────────────────────────────────────────────────────────
     1. LIVE VIEWFINDER SMPTE TIMECODE (~30fps)
  ───────────────────────────────────────────────────────── */
  let hours = 0,
    minutes = 4,
    seconds = 20,
    frames = 0;
  const timecodeElement = document.getElementById('live-timecode');
  const tapeReelElement = document.getElementById('tape-reel-indicator');

  function updateTimecode() {
    frames++;
    if (frames >= 30) {
      frames = 0;
      seconds++;
      if (seconds >= 60) {
        seconds = 0;
        minutes++;
        if (minutes >= 60) {
          minutes = 0;
          hours++;
          if (hours >= 24) hours = 0;
        }
      }
    }
    if (timecodeElement) {
      timecodeElement.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
    }
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  let timecodeInterval = setInterval(updateTimecode, 33.3);

  window.addEventListener('beforeunload', () => {
    if (timecodeInterval) clearInterval(timecodeInterval);
  });

  /* ─────────────────────────────────────────────────────────
     2. REC / PAUSE TOGGLE
  ───────────────────────────────────────────────────────── */
  const recContainer = document.querySelector('.rec-container');
  const recDot = document.querySelector('.rec-dot');
  const recLabel = document.querySelector('.rec-label');
  let isRecording = true;

  if (recContainer) {
    recContainer.style.cursor = 'pointer';
    recContainer.setAttribute('title', 'Click to pause/resume recording');

    recContainer.addEventListener('click', () => {
      isRecording = !isRecording;
      if (isRecording) {
        recDot.classList.add('blink');
        recDot.style.backgroundColor = 'var(--color-accent-pink)';
        recLabel.textContent = 'REC';
        recLabel.style.color = 'var(--color-accent-pink)';
        if (tapeReelElement) tapeReelElement.style.animationPlayState = 'running';
        timecodeInterval = setInterval(updateTimecode, 33.3);
      } else {
        recDot.classList.remove('blink');
        recDot.style.backgroundColor = 'var(--color-cyan)';
        recLabel.textContent = 'PAUSED';
        recLabel.style.color = 'var(--color-cyan)';
        if (tapeReelElement) tapeReelElement.style.animationPlayState = 'paused';
        clearInterval(timecodeInterval);
      }
    });
  }

  /* ─────────────────────────────────────────────────────────
     3. FEATURE CARD CLICK FLASH
  ───────────────────────────────────────────────────────── */
  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('click', () => {
      const title = card.querySelector('.feature-title').textContent;
      console.log(`[SARJ-CAM] Feature: ${title}`);
      card.style.outline = '3px solid var(--color-cyan)';
      setTimeout(() => (card.style.outline = ''), 300);
    });
  });

  /* ─────────────────────────────────────────────────────────
     4. NAVBAR – glass blur on scroll
  ───────────────────────────────────────────────────────── */
  const navbar = document.getElementById('top-navbar');
  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY > 40) {
        navbar?.classList.add('scrolled');
      } else {
        navbar?.classList.remove('scrolled');
      }
    },
    { passive: true }
  );

  /* ─────────────────────────────────────────────────────────
     5. HERO HEADLINE – character-by-character slide-up
  ───────────────────────────────────────────────────────── */
  function splitAndAnimateHeadline() {
    const headline = document.getElementById('hero-headline-split');
    if (!headline) return;

    // Collect raw HTML (keep <br/> and <span> tags)
    // We'll walk text nodes only inside the h1
    const walker = document.createTreeWalker(headline, NodeFilter.SHOW_TEXT, null);

    let node;
    const textNodes = [];
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach((textNode) => {
      const text = textNode.textContent;
      const frag = document.createDocumentFragment();
      [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.className = 'hero-char char-hidden';
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.style.animationDelay = `${i * 40}ms`;
        frag.appendChild(span);
      });
      textNode.parentNode.replaceChild(frag, textNode);
    });

    // Trigger animation after a brief delay
    requestAnimationFrame(() => {
      setTimeout(() => {
        headline.querySelectorAll('.hero-char').forEach((el) => {
          el.classList.remove('char-hidden');
          el.classList.add('char-visible');
        });
      }, 120);
    });
  }

  splitAndAnimateHeadline();

  /* ─────────────────────────────────────────────────────────
     6. SCROLL REVEAL – IntersectionObserver
  ───────────────────────────────────────────────────────── */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document
    .querySelectorAll('.reveal-up, .reveal-left, .reveal-right')
    .forEach((el) => revealObserver.observe(el));

  /* ─────────────────────────────────────────────────────────
     7. FLOW STEP ANIMATIONS (triggered when cyan block visible)
  ───────────────────────────────────────────────────────── */
  const flowStepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.flow-step-anim').forEach((step) => {
            step.classList.add('is-visible');
          });
          flowStepObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  const cyanBlock = document.querySelector('.content-block-cyan');
  if (cyanBlock) flowStepObserver.observe(cyanBlock);

  /* ─────────────────────────────────────────────────────────
     8. STATS COUNTER ANIMATION
  ───────────────────────────────────────────────────────── */
  function animateCounter(el, target, duration = 1400) {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.stat-number[data-target]').forEach((el) => {
            const target = parseInt(el.dataset.target, 10);
            animateCounter(el, target);
          });
          statsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  const statsSection = document.getElementById('stats-area');
  if (statsSection) statsObserver.observe(statsSection);

  /* ─────────────────────────────────────────────────────────
     9. SCROLL-STACK CARDS (Jeton signature interaction)
        Uses getBoundingClientRect for reliable positioning.
        The wrapper is calc(520px + 150vh) tall so the section
        stays visible for a long enough scroll range.
  ───────────────────────────────────────────────────────── */
  const stackWrapper = document.getElementById('scroll-stack-area');
  const stackCards = document.querySelectorAll('.stack-card');
  const stackDots = document.querySelectorAll('.stack-dot');
  const totalCards = stackCards.length;
  let currentStack = -1;

  function applyStackState(activeIndex) {
    if (activeIndex === currentStack) return;
    currentStack = activeIndex;

    stackCards.forEach((card, i) => {
      card.classList.remove('is-active', 'is-behind-1', 'is-behind-2', 'is-hidden');
      if (i === activeIndex) card.classList.add('is-active');
      else if (i === activeIndex + 1) card.classList.add('is-behind-1');
      else if (i >= activeIndex + 2) card.classList.add('is-behind-2');
      else card.classList.add('is-hidden');
    });

    stackDots.forEach((dot, i) => {
      dot.classList.toggle('stack-dot-active', i === activeIndex);
    });
  }

  // Initialise card classes before any scroll
  applyStackState(0);

  function onScroll() {
    if (!stackWrapper) return;

    const rect = stackWrapper.getBoundingClientRect();
    const wrapH = stackWrapper.offsetHeight;
    // scrolled is how far we've pulled the wrapper top above the viewport top
    const scrolled = -rect.top;
    // scrollable range = total wrapper height minus one viewport height
    const scrollable = wrapH - window.innerHeight;

    if (scrollable <= 0) return;

    const progress = Math.max(0, Math.min(1, scrolled / scrollable));
    // Divide the progress evenly into slots for each card
    const idx = Math.min(Math.floor(progress * totalCards), totalCards - 1);
    applyStackState(idx);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // Run once on load in case page is already scrolled
  onScroll();

  // Dots – click to scroll to the corresponding position in the wrapper
  stackDots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (!stackWrapper) return;
      const wrapTop = stackWrapper.getBoundingClientRect().top + window.scrollY;
      const wrapH = stackWrapper.offsetHeight;
      const scrollable = wrapH - window.innerHeight;
      const target = wrapTop + (i / totalCards) * scrollable;
      window.scrollTo({ top: target, behavior: 'smooth' });
    });
  });

  /* ─────────────────────────────────────────────────────────
     10. CARD MOUSE-TILT (Jeton-style 3D hover on cards)
  ───────────────────────────────────────────────────────── */
  function addTilt(el, strength = 8) {
    if (!el) return;
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      el.style.transform = `perspective(800px) rotateY(${dx * strength}deg) rotateX(${-dy * strength}deg) scale(1.02)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  }

  addTilt(document.getElementById('cyan-tilt-card'), 5);
  addTilt(document.getElementById('tactile-tilt-card'), 6);
  addTilt(document.getElementById('camcorder-frame'), 4);

  /* ─────────────────────────────────────────────────────────
     11. MARQUEE – pause on hover
  ───────────────────────────────────────────────────────── */
  const marqueeContent = document.querySelector('.marquee-content');
  const marqueeSection = document.querySelector('.marquee-section');

  if (marqueeSection && marqueeContent) {
    marqueeSection.addEventListener('mouseenter', () => {
      marqueeContent.style.animationPlayState = 'paused';
    });
    marqueeSection.addEventListener('mouseleave', () => {
      marqueeContent.style.animationPlayState = 'running';
    });
  }

  /* ─────────────────────────────────────────────────────────
     12. CTA GIANT TEXT – parallax on scroll
  ───────────────────────────────────────────────────────── */
  const ctaGiant = document.getElementById('cta-giant');
  if (ctaGiant) {
    window.addEventListener(
      'scroll',
      () => {
        const rect = ctaGiant.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          const progress = 1 - rect.top / window.innerHeight;
          ctaGiant.style.transform = `translateY(${progress * -30}px)`;
          ctaGiant.style.opacity = `${Math.min(1, progress * 2.5)}`;
        }
      },
      { passive: true }
    );
  }

  /* ─────────────────────────────────────────────────────────
     13. CONSOLE GREETING
  ───────────────────────────────────────────────────────── */
  console.log(
    '%c SARJ-CAM SYSTEM INITIALIZED ',
    'background: #161e24; color: #2ddbde; font-weight: bold; font-size: 14px; padding: 4px; border: 2px solid #2ddbde;'
  );
  console.log(
    '%c Animations: scroll-reveal | marquee | stack-cards | tilt | counter | char-split',
    'color: #2ddbde; font-size: 11px;'
  );
});
