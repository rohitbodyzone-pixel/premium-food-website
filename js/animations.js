/**
 * CRAVE & CO. - Cinematic Animations & Scroll Effects
 * Powered by GSAP / ScrollTrigger with pure Vanilla JS fallback,
 * 3D card tilt with specular shine, counter animations, magnetic buttons, and parallax.
 */

class AnimationController {
    constructor() {
        this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        this.init();
    }

    init() {
        this.initHeaderScroll();
        this.init3DCardTilt();
        this.initMagneticButtons();
        this.initScrollReveals();
        this.initStatCounters();
        this.initReviewsCarousel();
        this.initStoryScrubber();
    }

    /**
     * Navbar frosted glass transition on scroll
     */
    initHeaderScroll() {
        const header = document.getElementById("main-header");
        if (!header) return;

        let lastScroll = 0;
        window.addEventListener("scroll", () => {
            const currentScroll = window.scrollY || window.pageYOffset;

            if (currentScroll > 50) {
                header.classList.add("header-scrolled");
            } else {
                header.classList.remove("header-scrolled");
            }

            // Hide header on fast scroll down, reveal on scroll up
            if (currentScroll > 400 && currentScroll > lastScroll && !document.body.classList.contains("modal-open")) {
                header.classList.add("header-hidden");
            } else {
                header.classList.remove("header-hidden");
            }

            lastScroll = currentScroll;
        }, { passive: true });
    }

    /**
     * Premium 3D Perspective Tilt on Hover with Dynamic Specular Glare
     */
    init3DCardTilt() {
        if (this.isReducedMotion) return;
        const tiltCards = document.querySelectorAll(".tilt-card, .menu-item-card, .deal-card");

        tiltCards.forEach(card => {
            card.addEventListener("mousemove", (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -7; // max 7 deg
                const rotateY = ((x - centerX) / centerX) * 7;

                card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;

                // Update glare position
                const glare = card.querySelector(".card-glare");
                if (glare) {
                    glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 65%)`;
                }
            });

            card.addEventListener("mouseleave", () => {
                card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
                card.style.transition = "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)";
                const glare = card.querySelector(".card-glare");
                if (glare) glare.style.background = "none";
            });

            card.addEventListener("mouseenter", () => {
                card.style.transition = "none";
            });
        });
    }

    /**
     * Magnetic Buttons (Pulls gently towards cursor)
     */
    initMagneticButtons() {
        if (this.isReducedMotion || "ontouchstart" in window) return;

        const magneticElements = document.querySelectorAll(".btn-magnetic");
        magneticElements.forEach(elem => {
            elem.addEventListener("mousemove", (e) => {
                const rect = elem.getBoundingClientRect();
                const x = e.clientX - (rect.left + rect.width / 2);
                const y = e.clientY - (rect.top + rect.height / 2);

                elem.style.transform = `translate3d(${x * 0.28}px, ${y * 0.28}px, 0)`;
            });

            elem.addEventListener("mouseleave", () => {
                elem.style.transform = "translate3d(0, 0, 0)";
                elem.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
            });

            elem.addEventListener("mouseenter", () => {
                elem.style.transition = "none";
            });
        });
    }

    /**
     * Scroll Reveals using IntersectionObserver
     */
    initScrollReveals() {
        const revealElements = document.querySelectorAll(".reveal-fade, .reveal-up, .reveal-stagger");
        if (revealElements.length === 0) return;

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                    obs.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: "0px 0px -40px 0px"
        });

        revealElements.forEach(el => observer.observe(el));
    }

    /**
     * Animated Counter Statistics
     */
    initStatCounters() {
        const statsSection = document.getElementById("about-stats-container");
        if (!statsSection) return;

        const counterObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counters = statsSection.querySelectorAll(".stat-number");
                    counters.forEach(counter => {
                        const target = parseFloat(counter.getAttribute("data-target"));
                        const suffix = counter.getAttribute("data-suffix") || "";
                        const decimals = parseInt(counter.getAttribute("data-decimals")) || 0;
                        const duration = 2000;
                        const start = performance.now();

                        const update = (now) => {
                            const progress = Math.min((now - start) / duration, 1);
                            // Ease out cubic
                            const easeProgress = 1 - Math.pow(1 - progress, 3);
                            const current = (easeProgress * target).toFixed(decimals);
                            counter.textContent = `${current}${suffix}`;

                            if (progress < 1) {
                                requestAnimationFrame(update);
                            } else {
                                counter.textContent = `${target}${suffix}`;
                            }
                        };
                        requestAnimationFrame(update);
                    });
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        counterObserver.observe(statsSection);
    }

    /**
     * Interactive Story Scrubber & Step Switcher
     */
    initStoryScrubber() {
        const storyPills = document.querySelectorAll(".story-step-pill");
        const storyCards = document.querySelectorAll(".story-content-card");

        storyPills.forEach(pill => {
            pill.addEventListener("click", () => {
                const targetStep = pill.dataset.step;
                storyPills.forEach(p => p.classList.remove("active"));
                storyCards.forEach(c => c.classList.remove("active"));

                pill.classList.add("active");
                const activeCard = document.querySelector(`.story-content-card[data-step="${targetStep}"]`);
                if (activeCard) activeCard.classList.add("active");

                if (window.AudioEngine) window.AudioEngine.play("click");
            });
        });
    }

    /**
     * Reviews Testimonial Slider & Drag
     */
    initReviewsCarousel() {
        const carousel = document.getElementById("reviews-track");
        const prevBtn = document.getElementById("review-prev-btn");
        const nextBtn = document.getElementById("review-next-btn");
        if (!carousel) return;

        let currentIndex = 0;
        const cards = carousel.querySelectorAll(".review-card");
        const totalCards = cards.length;

        const updateCarousel = () => {
            const cardWidth = cards[0] ? cards[0].offsetWidth + 24 : 360;
            carousel.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        };

        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                currentIndex = (currentIndex + 1) % totalCards;
                updateCarousel();
                if (window.AudioEngine) window.AudioEngine.play("click");
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                currentIndex = (currentIndex - 1 + totalCards) % totalCards;
                updateCarousel();
                if (window.AudioEngine) window.AudioEngine.play("click");
            });
        }

        // Auto-scroll loop every 6s
        let autoScrollInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % totalCards;
            updateCarousel();
        }, 6000);

        carousel.addEventListener("mouseenter", () => clearInterval(autoScrollInterval));
        carousel.addEventListener("mouseleave", () => {
            autoScrollInterval = setInterval(() => {
                currentIndex = (currentIndex + 1) % totalCards;
                updateCarousel();
            }, 6000);
        });
    }
}

window.AnimationController = AnimationController;
