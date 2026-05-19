(function () {
    'use strict';

    const nav = document.querySelector('.navbar-default');
    const navToggle = document.querySelector('.navbar-toggle');
    const navCollapse = document.querySelector('.navbar-collapse');
    const navLinks = Array.from(document.querySelectorAll('.navbar-nav a[href^="#"]'));
    const backToTop = document.querySelector('.scrollToTop');
    const portfolioGrid = document.getElementById('js-grid-masonry');
    const filterWrap = document.getElementById('js-filters-masonry');
    const portfolioItems = portfolioGrid ? Array.from(portfolioGrid.querySelectorAll('.cbp-item')) : [];
    const portfolioLinks = portfolioGrid ? Array.from(portfolioGrid.querySelectorAll('.cbp-lightbox')) : [];

    function smoothScrollTo(target) {
        const element = document.querySelector(target);
        if (!element) return;
        const navHeight = nav ? nav.offsetHeight : 0;
        const top = element.getBoundingClientRect().top + window.pageYOffset - navHeight + 1;
        window.scrollTo({ top, behavior: 'smooth' });
    }

    function updateChrome() {
        const scrolled = window.pageYOffset > 100;
        if (nav) nav.classList.toggle('navbar-shrink', window.pageYOffset > 300);
        if (backToTop) backToTop.classList.toggle('is-visible', scrolled);
    }

    function updateActiveNav() {
        const navHeight = nav ? nav.offsetHeight : 0;
        let activeId = 'page-top';

        navLinks.forEach((link) => {
            const id = link.getAttribute('href').slice(1);
            const section = document.getElementById(id);
            if (!section) return;
            if (section.getBoundingClientRect().top <= navHeight + 30) {
                activeId = id;
            }
        });

        navLinks.forEach((link) => {
            const active = link.getAttribute('href') === `#${activeId}`;
            link.parentElement.classList.toggle('active', active);
        });
    }

    function closeNav() {
        if (!navCollapse || !navToggle) return;
        navCollapse.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
    }

    function initNavigation() {
        if (navToggle && navCollapse) {
            navToggle.addEventListener('click', () => {
                const isOpen = navCollapse.classList.toggle('is-open');
                navToggle.setAttribute('aria-expanded', String(isOpen));
            });
        }

        document.querySelectorAll('a.page-scroll[href^="#"], .scrollToTop[href^="#"]').forEach((link) => {
            link.addEventListener('click', (event) => {
                const target = link.getAttribute('href');
                if (!target || target === '#') return;
                event.preventDefault();
                closeNav();
                smoothScrollTo(target);
            });
        });

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                updateChrome();
                updateActiveNav();
                ticking = false;
            });
        }, { passive: true });

        updateChrome();
        updateActiveNav();
    }

    function matchesFilter(item, selector) {
        return selector === '*' || item.matches(selector);
    }

    function visiblePortfolioLinks() {
        return portfolioLinks.filter((link) => !link.closest('.cbp-item').classList.contains('is-hidden'));
    }

    function updateCounters() {
        if (!filterWrap) return;
        filterWrap.querySelectorAll('.cbp-filter-item').forEach((filter) => {
            const selector = filter.dataset.filter || '*';
            const counter = filter.querySelector('.cbp-filter-counter');
            if (!counter) return;
            const count = portfolioItems.filter((item) => matchesFilter(item, selector)).length;
            counter.textContent = String(count);
        });
    }

    function setFilter(selector) {
        portfolioItems.forEach((item) => {
            item.classList.toggle('is-hidden', !matchesFilter(item, selector));
        });

        filterWrap.querySelectorAll('.cbp-filter-item').forEach((filter) => {
            filter.classList.toggle('cbp-filter-item-active', filter.dataset.filter === selector);
        });
    }

    function initPortfolioFilters() {
        if (!filterWrap || !portfolioGrid) return;

        updateCounters();
        filterWrap.querySelectorAll('.cbp-filter-item').forEach((filter) => {
            filter.setAttribute('role', 'button');
            filter.setAttribute('tabindex', '0');
            filter.addEventListener('click', () => setFilter(filter.dataset.filter || '*'));
            filter.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFilter(filter.dataset.filter || '*');
                }
            });
        });
    }

    function youtubeEmbedUrl(url) {
        const parsed = new URL(url, window.location.href);
        const host = parsed.hostname.replace(/^www\./, '');
        let id = '';

        if (host === 'youtu.be') {
            id = parsed.pathname.slice(1);
        } else if (host === 'youtube.com' || host === 'm.youtube.com') {
            id = parsed.searchParams.get('v') || '';
        }

        return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : '';
    }

    function createLightbox() {
        const lightbox = document.createElement('div');
        lightbox.className = 'portfolio-lightbox';
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-modal', 'true');
        lightbox.setAttribute('aria-label', 'Portfolio video');
        lightbox.innerHTML = `
            <div class="portfolio-lightbox__panel">
                <div class="portfolio-lightbox__frame"></div>
                <div class="portfolio-lightbox__bar">
                    <div>
                        <p class="portfolio-lightbox__title"></p>
                        <p class="portfolio-lightbox__desc"></p>
                        <p class="portfolio-lightbox__count"></p>
                    </div>
                    <div class="portfolio-lightbox__actions">
                        <button type="button" class="portfolio-lightbox__prev" aria-label="Previous video">‹</button>
                        <button type="button" class="portfolio-lightbox__next" aria-label="Next video">›</button>
                        <button type="button" class="portfolio-lightbox__close" aria-label="Close video">×</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(lightbox);
        return lightbox;
    }

    function initLightbox() {
        if (!portfolioLinks.length) return;

        const lightbox = createLightbox();
        const frame = lightbox.querySelector('.portfolio-lightbox__frame');
        const title = lightbox.querySelector('.portfolio-lightbox__title');
        const description = lightbox.querySelector('.portfolio-lightbox__desc');
        const count = lightbox.querySelector('.portfolio-lightbox__count');
        const closeButton = lightbox.querySelector('.portfolio-lightbox__close');
        const prevButton = lightbox.querySelector('.portfolio-lightbox__prev');
        const nextButton = lightbox.querySelector('.portfolio-lightbox__next');
        let activeIndex = 0;
        let activeLinks = [];
        let lastFocus = null;

        function render() {
            const link = activeLinks[activeIndex];
            if (!link) return;
            const embed = youtubeEmbedUrl(link.href);
            const desc = link.querySelector('.cbp-l-caption-desc')?.textContent.trim() || '';
            frame.innerHTML = embed ? `<iframe src="${embed}" title="${link.dataset.title || 'Portfolio video'}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` : '';
            title.textContent = link.dataset.title || link.textContent.trim() || 'Portfolio video';
            description.textContent = desc;
            description.hidden = !desc;
            count.textContent = `${activeIndex + 1} of ${activeLinks.length}`;
        }

        function open(link) {
            activeLinks = visiblePortfolioLinks();
            activeIndex = Math.max(0, activeLinks.indexOf(link));
            lastFocus = document.activeElement;
            render();
            lightbox.classList.add('is-open');
            document.body.classList.add('has-open-lightbox');
            closeButton.focus();
        }

        function close() {
            lightbox.classList.remove('is-open');
            document.body.classList.remove('has-open-lightbox');
            frame.innerHTML = '';
            if (lastFocus) lastFocus.focus();
        }

        function jump(delta) {
            if (!activeLinks.length) return;
            activeIndex = (activeIndex + delta + activeLinks.length) % activeLinks.length;
            render();
        }

        portfolioLinks.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                open(link);
            });
        });

        closeButton.addEventListener('click', close);
        prevButton.addEventListener('click', () => jump(-1));
        nextButton.addEventListener('click', () => jump(1));
        lightbox.addEventListener('click', (event) => {
            if (event.target === lightbox) close();
        });

        document.addEventListener('keydown', (event) => {
            if (!lightbox.classList.contains('is-open')) return;
            if (event.key === 'Escape') close();
            if (event.key === 'ArrowLeft') jump(-1);
            if (event.key === 'ArrowRight') jump(1);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initNavigation();
        initPortfolioFilters();
        initLightbox();
    });
})();
