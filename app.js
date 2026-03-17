/* ═══════════════════════════════════════════════════════════════════════════
   ONTARIO PAVING CORP — app.js
   SPA navigation · Gallery filter & lightbox · FAQ accordion
   Scroll reveal · Contact form validation & AJAX submit
═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── SPA Tab Navigation ───────────────────────────────────────────────────────
const NAV_LINKS = document.querySelectorAll('.nav-link');
const TAB_SECTIONS = document.querySelectorAll('.tab-section');

/**
 * showTab(tabId, options?)
 *  options.scrollTo  — CSS selector to scroll to after tab switch
 *  options.service   — pre-select a service in the contact form
 *  options.filter    — activate a gallery filter
 */
function showTab(tabId, options) {
    if (typeof options === 'boolean') options = {}; // legacy compat
    options = options || {};

    TAB_SECTIONS.forEach(s => s.classList.remove('active'));
    NAV_LINKS.forEach(l => l.classList.remove('active'));

    const target = document.getElementById('tab-' + tabId);
    if (target) target.classList.add('active');

    const activeLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Close mobile menu
    document.getElementById('main-nav').classList.remove('open');

    // Push history
    history.pushState({ tab: tabId }, '', '#' + tabId);

    // Re-trigger scroll observer for newly visible section
    triggerReveal();

    // Pre-select service in contact form
    if (options.service) {
        const sel = document.getElementById('service');
        if (sel) {
            for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].text === options.service || sel.options[i].value === options.service) {
                    sel.selectedIndex = i;
                    break;
                }
            }
        }
    }

    // Activate gallery filter
    if (options.filter) {
        const filterBtnsLocal = document.querySelectorAll('.filter-btn');
        const galleryItemsLocal = document.querySelectorAll('.gallery-item');
        filterBtnsLocal.forEach(b => {
            b.classList.toggle('active', b.dataset.filter === options.filter);
        });
        galleryItemsLocal.forEach(item => {
            const match = options.filter === 'all' || item.dataset.category === options.filter;
            item.classList.toggle('hidden', !match);
        });
    }

    // Scroll to specific element or top
    if (options.scrollTo) {
        requestAnimationFrame(() => {
            setTimeout(() => {
                const el = document.querySelector(options.scrollTo);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Brief highlight effect
                    el.classList.add('highlight-pulse');
                    setTimeout(() => el.classList.remove('highlight-pulse'), 1500);
                }
            }, 100);
        });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Nav link click
NAV_LINKS.forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const tab = link.dataset.tab;
        showTab(tab);
    });
});

// Browser back/forward
window.addEventListener('popstate', e => {
    const tab = (e.state && e.state.tab) ? e.state.tab : 'home';
    showTab(tab);
});

// Load from hash
(function initFromHash() {
    const hash = window.location.hash.replace('#', '');
    const valid = [...TAB_SECTIONS].some(s => s.id === 'tab-' + hash);
    showTab(valid ? hash : 'home');
})();

// ── Hamburger ─────────────────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const mainNav = document.getElementById('main-nav');
hamburger.addEventListener('click', () => {
    mainNav.classList.toggle('open');
});

// ── Scroll Reveal (IntersectionObserver) ─────────────────────────────────────
function triggerReveal() {
    const revealEls = document.querySelectorAll('.tab-section.active .reveal');
    if (!revealEls.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, i * 80);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });

    revealEls.forEach(el => {
        if (!el.classList.contains('visible')) observer.observe(el);
    });
}

// Hero elements animate immediately on load
window.addEventListener('load', () => {
    document.querySelectorAll('.hero .fade-in-up').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 130);
    });
    triggerReveal();
});

window.addEventListener('scroll', triggerReveal, { passive: true });

// ── Gallery Filter ─────────────────────────────────────────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        galleryItems.forEach(item => {
            const match = filter === 'all' || item.dataset.category === filter;
            item.classList.toggle('hidden', !match);
        });
    });
});

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbCaption = document.getElementById('lightbox-caption');
const lbClose = document.getElementById('lightbox-close');

function openLightbox(src, caption) {
    lbImg.src = src;
    lbImg.alt = caption;
    lbCaption.textContent = caption;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { lbImg.src = ''; }, 200);
}

galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        openLightbox(item.dataset.img, item.dataset.title);
    });
});

lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── FAQ Accordion ──────────────────────────────────────────────────────────────
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const item = question.closest('.faq-item');
        const isOpen = item.classList.contains('open');

        // Close all
        document.querySelectorAll('.faq-item').forEach(fi => {
            fi.classList.remove('open');
            fi.querySelector('.faq-question').classList.remove('open');
        });

        // Toggle clicked
        if (!isOpen) {
            item.classList.add('open');
            question.classList.add('open');
        }
    });
});

// ── File Input Labels ──────────────────────────────────────────────────────────
const photosInput = document.getElementById('photos');
const fileNames = document.getElementById('file-names');
if (photosInput) {
    photosInput.addEventListener('change', () => {
        const files = Array.from(photosInput.files);
        fileNames.textContent = files.length
            ? files.map(f => f.name).join(', ')
            : '';
    });
}

// ── Contact Form Validation & Submit ──────────────────────────────────────────
const contactForm = document.getElementById('contact-form');

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePhone(phone) {
    return /^[\d\s\-\+\(\)\.]{7,20}$/.test(phone.trim());
}

function setError(fieldId, errId, message) {
    const field = document.getElementById(fieldId);
    const err = document.getElementById(errId);
    if (message) {
        field && field.classList.add('error');
        if (err) err.textContent = message;
        return false;
    } else {
        field && field.classList.remove('error');
        if (err) err.textContent = '';
        return true;
    }
}

function validateForm() {
    let valid = true;

    const name = document.getElementById('name').value;
    if (!name || name.trim().length < 2) {
        valid = setError('name', 'err-name', 'Please enter your full name.') && valid;
    } else {
        setError('name', 'err-name', '');
    }

    const email = document.getElementById('email').value;
    if (!validateEmail(email)) {
        valid = setError('email', 'err-email', 'Please enter a valid email address.') && valid;
    } else {
        setError('email', 'err-email', '');
    }

    const phone = document.getElementById('phone').value;
    if (!validatePhone(phone)) {
        valid = setError('phone', 'err-phone', 'Please enter a valid phone number.') && valid;
    } else {
        setError('phone', 'err-phone', '');
    }

    const service = document.getElementById('service').value;
    if (!service) {
        valid = setError('service', 'err-service', 'Please select a service type.') && valid;
    } else {
        setError('service', 'err-service', '');
    }

    const address = document.getElementById('address').value;
    if (!address || address.trim().length < 5) {
        valid = setError('address', 'err-address', 'Please enter the project address.') && valid;
    } else {
        setError('address', 'err-address', '');
    }

    return valid;
}

// Live validation on blur
['name', 'email', 'phone', 'service', 'address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', validateForm);
});

if (contactForm) {
    contactForm.addEventListener('submit', async e => {
        e.preventDefault();

        const successMsg = document.getElementById('form-success');
        const errorMsg = document.getElementById('form-error');
        const submitBtn = document.getElementById('submit-btn');
        const submitText = document.getElementById('submit-text');
        const spinner = document.getElementById('submit-spinner');

        // Hide previous messages
        successMsg.classList.add('hidden');
        errorMsg.classList.add('hidden');

        if (!validateForm()) return;

        // Check honeypot on client side too
        const honeypot = document.getElementById('honeypot');
        if (honeypot && honeypot.value.trim() !== '') return;

        // Loading state
        submitBtn.disabled = true;
        submitText.textContent = 'Sending...';
        spinner.classList.remove('hidden');

        // Build FormData (includes files)
        const formData = new FormData();
        formData.append('website', honeypot ? honeypot.value : '');
        formData.append('name', document.getElementById('name').value.trim());
        formData.append('email', document.getElementById('email').value.trim());
        formData.append('phone', document.getElementById('phone').value.trim());
        formData.append('address', document.getElementById('address').value.trim());
        formData.append('service', document.getElementById('service').value);
        formData.append('dimensions', document.getElementById('dimensions').value.trim());
        formData.append('message', document.getElementById('message').value.trim());

        // Append photos
        const photosEl = document.getElementById('photos');
        if (photosEl && photosEl.files.length > 0) {
            for (let i = 0; i < photosEl.files.length; i++) {
                formData.append('photos', photosEl.files[i]);
            }
        }

        try {
            // Use XMLHttpRequest for upload progress tracking
            const xhr = new XMLHttpRequest();
            const result = await new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        submitText.textContent = pct < 100
                            ? `Uploading ${pct}%...`
                            : 'Sending...';
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
                    } catch {
                        resolve({ ok: false, data: { error: 'Invalid server response.' } });
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error')));
                xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

                xhr.open('POST', '/api/contact');
                xhr.send(formData);
            });

            if (result.ok && result.data.success) {
                successMsg.classList.remove('hidden');
                contactForm.reset();
                if (fileNames) fileNames.textContent = '';
            } else {
                errorMsg.textContent = result.data.error || 'Something went wrong. Please try again.';
                errorMsg.classList.remove('hidden');
            }
        } catch (err) {
            errorMsg.textContent = 'Network error. Please check your connection and try again, or call us directly.';
            errorMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitText.textContent = 'Send Quote Request';
            spinner.classList.add('hidden');
        }
    });
}

// ── Expose showTab globally (used by inline onclick in HTML) ──────────────────
window.showTab = showTab;
