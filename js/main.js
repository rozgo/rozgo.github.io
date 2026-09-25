(function () {
    'use strict';

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

    /* Cards lean toward the pointer. */
    function initTilt() {
        if (!canHover.matches) return;
        document.querySelectorAll('.system, .clip, .scene').forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
                card.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
            });
            card.addEventListener('pointerleave', () => {
                card.style.removeProperty('--ry');
                card.style.removeProperty('--rx');
            });
        });
    }

    function initMenu() {
        const button = document.querySelector('[data-menu-toggle]');
        const nav = document.getElementById('site-nav');
        if (!button || !nav) return;
        const close = () => {
            nav.classList.remove('is-open');
            button.setAttribute('aria-expanded', 'false');
        };
        button.addEventListener('click', () => {
            const open = nav.classList.toggle('is-open');
            button.setAttribute('aria-expanded', String(open));
        });
        nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
    }

    function initActiveNav() {
        const links = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
        if (!links.length || !('IntersectionObserver' in window)) return;
        const byId = new Map();
        links.forEach((link) => {
            const section = document.getElementById(link.getAttribute('href').slice(1));
            if (section) byId.set(section, link);
        });
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                links.forEach((link) => link.removeAttribute('aria-current'));
                byId.get(entry.target).setAttribute('aria-current', 'true');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        byId.forEach((_link, section) => observer.observe(section));
    }

    /* Hero reel: plays each clip in the list once, then moves to the next. */
    function initMonitor() {
        const monitor = document.querySelector('[data-monitor]');
        if (!monitor) return;
        const video = monitor.querySelector('video');
        const title = monitor.querySelector('.monitor-title');
        const progress = monitor.querySelector('.monitor-progress');
        const pauseButton = monitor.querySelector('.monitor-pause');
        const clips = Array.from(monitor.querySelectorAll('[data-clip]')).map((item) => ({
            src: item.dataset.src,
            poster: item.dataset.poster,
            title: item.dataset.title,
            href: item.dataset.href,
        }));
        if (!video || !clips.length) return;

        let index = 0;
        let paused = false;
        let visible = true;

        const dots = clips.map((clip, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.setAttribute('aria-label', `Show clip ${i + 1}: ${clip.title}`);
            dot.addEventListener('click', () => show(i));
            progress.appendChild(dot);
            return dot;
        });

        function syncPauseButton() {
            pauseButton.setAttribute('aria-label', paused ? 'Play clips' : 'Pause clips');
            pauseButton.querySelector('.icon-pause').style.display = paused ? 'none' : '';
            pauseButton.querySelector('.icon-play').style.display = paused ? '' : 'none';
        }

        function play() {
            if (paused || !visible || document.hidden) return;
            const attempt = video.play();
            if (attempt && attempt.catch) attempt.catch(() => {});
        }

        function show(i) {
            index = (i + clips.length) % clips.length;
            const clip = clips[index];
            video.poster = clip.poster;
            video.src = clip.src;
            title.innerHTML = '';
            const link = document.createElement('a');
            link.href = clip.href;
            link.textContent = clip.title;
            title.appendChild(link);
            dots.forEach((dot, n) => dot.setAttribute('aria-current', String(n === index)));
            play();
        }

        video.muted = true;
        video.addEventListener('ended', () => show(index + 1));
        pauseButton.addEventListener('click', () => {
            paused = !paused;
            syncPauseButton();
            if (paused) video.pause();
            else play();
        });
        document.addEventListener('visibilitychange', () => (document.hidden ? video.pause() : play()));
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((entries) => {
                visible = entries[0].isIntersecting;
                if (visible) play();
                else video.pause();
            }).observe(monitor);
        }
        syncPauseButton();
        show(0);
    }

    /* Clip cards preview their loop on hover or keyboard focus. */
    function initPreviews() {
        if (!canHover.matches) return;
        document.querySelectorAll('.clip[data-preview]').forEach((card) => {
            const media = card.querySelector('.clip-media');
            let video = null;
            const start = () => {
                if (!video) {
                    video = document.createElement('video');
                    video.src = card.dataset.preview;
                    video.muted = true;
                    video.loop = true;
                    video.playsInline = true;
                    video.setAttribute('aria-hidden', 'true');
                    media.appendChild(video);
                }
                card.classList.add('is-previewing');
                const attempt = video.play();
                if (attempt && attempt.catch) attempt.catch(() => {});
            };
            const stop = () => {
                card.classList.remove('is-previewing');
                if (video) video.pause();
            };
            card.addEventListener('pointerenter', start);
            card.addEventListener('pointerleave', stop);
            card.addEventListener('focus', start);
            card.addEventListener('blur', stop);
        });
    }

    function youtubeId(url) {
        try {
            const parsed = new URL(url, window.location.href);
            const host = parsed.hostname.replace(/^www\./, '');
            if (host === 'youtu.be') return parsed.pathname.slice(1);
            if (host.endsWith('youtube.com')) return parsed.searchParams.get('v') || '';
        } catch (error) {
            return '';
        }
        return '';
    }

    function embedFrame(id, title) {
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
        frame.title = title;
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        return frame;
    }

    function initLightbox() {
        const triggers = Array.from(document.querySelectorAll('a[data-video]'));
        if (!triggers.length) return;

        const box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Video player');
        box.innerHTML = `
            <div class="lightbox-panel">
                <div class="lightbox-frame"></div>
                <div class="lightbox-bar">
                    <div class="lightbox-text">
                        <p class="lightbox-title"></p>
                        <p class="lightbox-sub"></p>
                    </div>
                    <button type="button" class="icon-button" data-step="-1" aria-label="Previous video">‹</button>
                    <button type="button" class="icon-button" data-step="1" aria-label="Next video">›</button>
                    <button type="button" class="icon-button" data-close aria-label="Close video">×</button>
                </div>
            </div>`;
        document.body.appendChild(box);

        const frame = box.querySelector('.lightbox-frame');
        const titleEl = box.querySelector('.lightbox-title');
        const subEl = box.querySelector('.lightbox-sub');
        const closeButton = box.querySelector('[data-close]');
        let group = [];
        let index = 0;
        let lastFocus = null;

        function render() {
            const link = group[index];
            const id = youtubeId(link.href);
            const title = link.dataset.title || link.textContent.trim();
            frame.innerHTML = '';
            if (id) frame.appendChild(embedFrame(id, title));
            titleEl.textContent = title;
            const sub = [link.dataset.sub, group.length > 1 ? `${index + 1} of ${group.length}` : '']
                .filter(Boolean).join(' · ');
            subEl.textContent = sub;
            box.querySelectorAll('[data-step]').forEach((button) => {
                button.hidden = group.length < 2;
            });
        }

        function open(link) {
            const scope = link.closest('[data-video-group]');
            group = (scope ? Array.from(scope.querySelectorAll('a[data-video]')) : [link])
                .filter((item) => !item.closest('[hidden]'));
            index = Math.max(0, group.indexOf(link));
            lastFocus = document.activeElement;
            render();
            box.classList.add('is-open');
            document.body.classList.add('has-lightbox');
            closeButton.focus();
        }

        function close() {
            box.classList.remove('is-open');
            document.body.classList.remove('has-lightbox');
            frame.innerHTML = '';
            if (lastFocus) lastFocus.focus();
        }

        function step(delta) {
            if (group.length < 2) return;
            index = (index + delta + group.length) % group.length;
            render();
        }

        triggers.forEach((link) => {
            link.addEventListener('click', (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                open(link);
            });
        });
        closeButton.addEventListener('click', close);
        box.querySelectorAll('[data-step]').forEach((button) => {
            button.addEventListener('click', () => step(Number(button.dataset.step)));
        });
        box.addEventListener('click', (event) => {
            if (event.target === box) close();
        });
        document.addEventListener('keydown', (event) => {
            if (!box.classList.contains('is-open')) return;
            if (event.key === 'Escape') close();
            if (event.key === 'ArrowLeft') step(-1);
            if (event.key === 'ArrowRight') step(1);
            if (event.key === 'Tab') {
                const focusable = Array.from(box.querySelectorAll('button:not([hidden])'));
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
    }

    /* Inline players on detail pages load YouTube only after a click. */
    function initEmbeds() {
        document.querySelectorAll('.video-embed button[data-youtube]').forEach((button) => {
            button.addEventListener('click', () => {
                const container = button.parentElement;
                container.appendChild(embedFrame(button.dataset.youtube, button.getAttribute('aria-label') || 'Video'));
                button.remove();
            });
        });
    }

    function initFilters() {
        const bar = document.querySelector('[data-filters]');
        if (!bar) return;
        const buttons = Array.from(bar.querySelectorAll('[data-filter]'));
        const items = Array.from(document.querySelectorAll('[data-topics]'));
        const eras = Array.from(document.querySelectorAll('.era'));

        buttons.forEach((button) => {
            const topic = button.dataset.filter;
            const count = topic === 'all'
                ? items.length
                : items.filter((item) => item.dataset.topics.split(' ').includes(topic)).length;
            const badge = button.querySelector('.filter-count');
            if (badge) badge.textContent = String(count);
        });

        function apply(topic) {
            buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === topic)));
            items.forEach((item) => {
                item.hidden = topic !== 'all' && !item.dataset.topics.split(' ').includes(topic);
            });
            eras.forEach((era) => {
                era.hidden = !era.querySelector('[data-topics]:not([hidden])');
            });
            const url = new URL(window.location.href);
            if (topic === 'all') url.searchParams.delete('topic');
            else url.searchParams.set('topic', topic);
            window.history.replaceState(null, '', url);
        }

        buttons.forEach((button) => button.addEventListener('click', () => apply(button.dataset.filter)));
        const initial = new URL(window.location.href).searchParams.get('topic');
        apply(buttons.some((button) => button.dataset.filter === initial) ? initial : 'all');
    }

    document.addEventListener('DOMContentLoaded', () => {
        initTilt();
        initMenu();
        initActiveNav();
        initMonitor();
        initPreviews();
        initLightbox();
        initEmbeds();
        initFilters();
    });
})();
