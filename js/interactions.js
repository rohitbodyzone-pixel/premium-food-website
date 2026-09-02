/**
 * CRAVE & CO. - Luxury Interactions & UI Modules
 * Includes Web Audio sound synthesizer, magnetic luxury cursor, dish customizer modal,
 * simulated checkout & live order tracking, toast notifications, and gallery lightbox.
 */

// ==========================================
// 1. WEB AUDIO API SOUND SYNTHESIZER
// ==========================================
class WebAudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = localStorage.getItem("crave_audio_muted") === "true";
        this.initAudioContext();
        this.bindToggle();
    }

    initAudioContext() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            // Lazy initialize on first user gesture
            const unlock = () => {
                if (!this.ctx) {
                    this.ctx = new AudioContext();
                }
                if (this.ctx && this.ctx.state === "suspended") {
                    this.ctx.resume();
                }
                document.removeEventListener("click", unlock);
                document.removeEventListener("touchstart", unlock);
            };
            document.addEventListener("click", unlock, { once: true });
            document.addEventListener("touchstart", unlock, { once: true });
        }
    }

    play(soundType) {
        if (this.isMuted) return;
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
            else return;
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        try {
            switch (soundType) {
                case "click": {
                    // Delicate luxury tactile click
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(800, now);
                    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.04);
                    break;
                }
                case "hover": {
                    // Soft warm glass tone
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(660, now + 0.05);
                    gain.gain.setValueAtTime(0.015, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.05);
                    break;
                }
                case "cartAdd": {
                    // Harmonic luxury double chime
                    const osc1 = this.ctx.createOscillator();
                    const osc2 = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc1.type = "triangle";
                    osc2.type = "sine";
                    osc1.frequency.setValueAtTime(523.25, now); // C5
                    osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
                    osc2.frequency.setValueAtTime(1046.5, now + 0.08); // C6
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc1.start(now);
                    osc2.start(now + 0.08);
                    osc1.stop(now + 0.35);
                    osc2.stop(now + 0.35);
                    break;
                }
                case "drawerOpen": {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(240, now);
                    osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;
                }
                case "drawerClose": {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(420, now);
                    osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
                    gain.gain.setValueAtTime(0.03, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
                }
                case "success": {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(587.33, now); // D5
                    osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
                    gain.gain.setValueAtTime(0.06, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                }
                case "error": {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = "sawtooth";
                    osc.frequency.setValueAtTime(220, now);
                    osc.frequency.setValueAtTime(160, now + 0.08);
                    gain.gain.setValueAtTime(0.04, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                }
            }
        } catch (e) {
            // Audio policy or error
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem("crave_audio_muted", this.isMuted);
        this.updateToggleButtonUI();
        if (!this.isMuted) this.play("success");
    }

    bindToggle() {
        const toggleBtn = document.getElementById("audio-toggle-btn");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => this.toggleMute());
            this.updateToggleButtonUI();
        }
    }

    updateToggleButtonUI() {
        const toggleBtn = document.getElementById("audio-toggle-btn");
        if (!toggleBtn) return;
        const iconContainer = toggleBtn.querySelector(".audio-icon-wrap");
        if (iconContainer) {
            if (this.isMuted) {
                toggleBtn.classList.add("muted");
                toggleBtn.setAttribute("title", "Enable Sound Effects");
                iconContainer.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <line x1="23" y1="9" x2="17" y2="15"/>
                        <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                `;
            } else {
                toggleBtn.classList.remove("muted");
                toggleBtn.setAttribute("title", "Mute Sound Effects");
                iconContainer.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                `;
            }
        }
    }
}

// ==========================================
// 2. LUXURY MAGNETIC CURSOR
// ==========================================
class LuxuryCursor {
    constructor() {
        this.cursorDot = document.getElementById("custom-cursor-dot");
        this.cursorRing = document.getElementById("custom-cursor-ring");
        this.pos = { x: -100, y: -100 };
        this.target = { x: -100, y: -100 };
        this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

        if (this.isTouch || !this.cursorDot || !this.cursorRing) {
            if (this.cursorDot) this.cursorDot.style.display = "none";
            if (this.cursorRing) this.cursorRing.style.display = "none";
            return;
        }

        this.init();
    }

    init() {
        document.body.classList.add("has-custom-cursor");

        window.addEventListener("mousemove", (e) => {
            this.target.x = e.clientX;
            this.target.y = e.clientY;
        }, { passive: true });

        // Hover expansions
        const interactiveSelectors = 'a, button, .interactive-card, input, select, textarea, .filter-pill, .gallery-item';
        
        document.addEventListener("mouseover", (e) => {
            const target = e.target.closest(interactiveSelectors);
            if (target) {
                this.cursorRing.classList.add("cursor-hover");
                this.cursorDot.classList.add("cursor-hover");
                if (window.AudioEngine && !target.dataset.noAudio) {
                    window.AudioEngine.play("hover");
                }
            }
        });

        document.addEventListener("mouseout", (e) => {
            const target = e.target.closest(interactiveSelectors);
            if (target) {
                this.cursorRing.classList.remove("cursor-hover");
                this.cursorDot.classList.remove("cursor-hover");
            }
        });

        this.render();
    }

    render() {
        this.pos.x += (this.target.x - this.pos.x) * 0.18;
        this.pos.y += (this.target.y - this.pos.y) * 0.18;

        if (this.cursorDot) {
            this.cursorDot.style.transform = `translate3d(${this.target.x}px, ${this.target.y}px, 0)`;
        }
        if (this.cursorRing) {
            this.cursorRing.style.transform = `translate3d(${this.pos.x}px, ${this.pos.y}px, 0)`;
        }

        requestAnimationFrame(() => this.render());
    }
}

// ==========================================
// 3. TOAST NOTIFICATIONS
// ==========================================
class ToastManager {
    constructor() {
        this.container = document.getElementById("toast-container");
    }

    show(message, type = "info", duration = 3500) {
        if (!this.container) return;

        const toast = document.createElement("div");
        toast.className = `toast-pill toast-${type}`;
        
        let iconSvg = '';
        if (type === "success") {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (type === "error") {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5252" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        } else {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        }

        toast.innerHTML = `
            <span class="toast-icon">${iconSvg}</span>
            <span class="toast-text">${message}</span>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("toast-show");
        }, 10);

        setTimeout(() => {
            toast.classList.remove("toast-show");
            setTimeout(() => {
                if (toast.parentElement) toast.parentElement.removeChild(toast);
            }, 300);
        }, duration);
    }
}

// ==========================================
// 4. DISH CUSTOMIZER MODAL
// ==========================================
class DishCustomizerModal {
    constructor() {
        this.modal = document.getElementById("dish-customizer-modal");
        this.backdrop = document.getElementById("modal-backdrop");
        this.currentDish = null;
        this.quantity = 1;
        this.selectedAddOns = [];
        this.selectedTemperature = "Medium Rare";
        this.selectedSpiceLevel = "Medium";

        this.bindEvents();
    }

    bindEvents() {
        const closeBtn = document.getElementById("customizer-close-btn");
        if (closeBtn) closeBtn.addEventListener("click", () => this.close());
        if (this.backdrop) this.backdrop.addEventListener("click", () => this.close());

        const form = document.getElementById("customizer-form");
        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleAddToCart();
            });
        }
    }

    open(dishId) {
        // Find dish in database
        const allDishes = [...(MenuDatabase.signatureDishes || []), ...(MenuDatabase.items || [])];
        this.currentDish = allDishes.find(d => d.id === dishId);
        if (!this.currentDish) return;

        this.quantity = 1;
        this.selectedAddOns = [];
        this.selectedTemperature = "Medium Rare";
        this.selectedSpiceLevel = "Medium";

        this.renderModalContent();

        if (this.modal && this.backdrop) {
            this.modal.classList.add("active");
            this.backdrop.classList.add("active");
            document.body.classList.add("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerOpen");
    }

    close() {
        if (this.modal && this.backdrop) {
            this.modal.classList.remove("active");
            this.backdrop.classList.remove("active");
            document.body.classList.remove("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerClose");
    }

    renderModalContent() {
        const dish = this.currentDish;
        const container = document.getElementById("customizer-body");
        if (!container) return;

        let optionsHtml = '';

        // Cooking Temperature options (for steaks & burgers)
        if (dish.temperatureSelect) {
            optionsHtml += `
                <div class="custom-group">
                    <label class="custom-group-label">Cooking Temperature</label>
                    <div class="pill-selector" id="temp-pill-group">
                        ${["Medium Rare", "Medium", "Medium Well", "Chef's Cut"].map((temp, i) => `
                            <button type="button" class="option-pill ${i === 0 ? 'active' : ''}" data-val="${temp}" onclick="window.customizerModal.setTemp('${temp}', this)">${temp}</button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Spice Level options (for kebabs & spicy pizzas)
        if (dish.spiceLevelSelect) {
            optionsHtml += `
                <div class="custom-group">
                    <label class="custom-group-label">Spice Intensity</label>
                    <div class="pill-selector" id="spice-pill-group">
                        ${["Mild", "Medium Flame 🔥", "Extra Hot 🔥🔥", "Artisan Ghost 🔥🔥🔥"].map((spice, i) => `
                            <button type="button" class="option-pill ${i === 1 ? 'active' : ''}" data-val="${spice}" onclick="window.customizerModal.setSpice('${spice}', this)">${spice}</button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Add-Ons Checkboxes
        if (dish.addOns && dish.addOns.length > 0) {
            optionsHtml += `
                <div class="custom-group">
                    <label class="custom-group-label">Chef's Gourmet Enhancements</label>
                    <div class="addons-list">
                        ${dish.addOns.map(addon => `
                            <label class="addon-checkbox-row">
                                <input type="checkbox" value="${addon.id}" onchange="window.customizerModal.toggleAddon('${addon.id}', ${addon.price}, '${addon.name}', this)">
                                <div class="addon-info">
                                    <span class="addon-name">${addon.name}</span>
                                    <span class="addon-price">+$${addon.price.toFixed(2)}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Special Instructions
        optionsHtml += `
            <div class="custom-group">
                <label class="custom-group-label" for="customizer-notes">Special Kitchen Notes (Allergies, Dressing on side)</label>
                <textarea id="customizer-notes" class="custom-textarea" rows="2" placeholder="e.g., No fresh onions, extra cutlery..."></textarea>
            </div>
        `;

        container.innerHTML = `
            <div class="customizer-hero-card">
                <img src="${dish.image}" alt="${dish.name}" class="customizer-img">
                <div class="customizer-header-info">
                    <span class="dish-badge">${dish.badge || 'Chef Selection'}</span>
                    <h3 class="customizer-title">${dish.name}</h3>
                    <p class="customizer-desc">${dish.shortDesc || dish.desc}</p>
                    <div class="customizer-meta">
                        <span class="customizer-price">$${dish.price.toFixed(2)}</span>
                        ${dish.calories ? `<span class="customizer-cal">${dish.calories}</span>` : ''}
                        ${dish.prepTime ? `<span class="customizer-prep">⏱️ ${dish.prepTime}</span>` : ''}
                    </div>
                </div>
            </div>
            ${optionsHtml}
        `;

        this.updateModalBottomBar();
    }

    setTemp(val, btn) {
        this.selectedTemperature = val;
        btn.parentElement.querySelectorAll('.option-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.AudioEngine) window.AudioEngine.play("click");
    }

    setSpice(val, btn) {
        this.selectedSpiceLevel = val;
        btn.parentElement.querySelectorAll('.option-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.AudioEngine) window.AudioEngine.play("click");
    }

    toggleAddon(id, price, name, checkbox) {
        if (checkbox.checked) {
            this.selectedAddOns.push({ id, price, name });
        } else {
            this.selectedAddOns = this.selectedAddOns.filter(a => a.id !== id);
        }
        this.updateModalBottomBar();
        if (window.AudioEngine) window.AudioEngine.play("click");
    }

    updateQuantity(delta) {
        this.quantity = Math.max(1, this.quantity + delta);
        this.updateModalBottomBar();
        if (window.AudioEngine) window.AudioEngine.play("click");
    }

    updateModalBottomBar() {
        const qtyDisplay = document.getElementById("modal-qty-val");
        const totalBtn = document.getElementById("modal-add-cart-btn");
        if (!this.currentDish) return;

        const addOnsPrice = this.selectedAddOns.reduce((sum, a) => sum + a.price, 0);
        const singlePrice = this.currentDish.price + addOnsPrice;
        const grandTotal = singlePrice * this.quantity;

        if (qtyDisplay) qtyDisplay.textContent = this.quantity;
        if (totalBtn) {
            totalBtn.innerHTML = `
                <span>Add to Cart</span>
                <span class="btn-price-tag">$${grandTotal.toFixed(2)}</span>
            `;
        }
    }

    handleAddToCart() {
        if (!this.currentDish) return;
        const notesInput = document.getElementById("customizer-notes");
        const notes = notesInput ? notesInput.value.trim() : "";

        window.cart.addItem(this.currentDish, {
            quantity: this.quantity,
            temperature: this.currentDish.temperatureSelect ? this.selectedTemperature : null,
            spiceLevel: this.currentDish.spiceLevelSelect ? this.selectedSpiceLevel : null,
            selectedAddOns: [...this.selectedAddOns],
            specialInstructions: notes
        });

        this.close();
    }
}

// ==========================================
// 5. SIMULATED CHECKOUT & LIVE ORDER TRACKER
// ==========================================
class CheckoutModal {
    constructor() {
        this.modal = document.getElementById("checkout-modal");
        this.trackerModal = document.getElementById("tracker-modal");
        this.backdrop = document.getElementById("modal-backdrop");
        this.selectedPayment = "apple-pay";

        this.bindEvents();
    }

    bindEvents() {
        const closeBtn = document.getElementById("checkout-close-btn");
        const trackerCloseBtn = document.getElementById("tracker-close-btn");

        if (closeBtn) closeBtn.addEventListener("click", () => this.close());
        if (trackerCloseBtn) trackerCloseBtn.addEventListener("click", () => this.closeTracker());

        // Payment method selector
        const payPills = document.querySelectorAll(".payment-method-pill");
        payPills.forEach(pill => {
            pill.addEventListener("click", () => {
                payPills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                this.selectedPayment = pill.dataset.method;
                if (window.AudioEngine) window.AudioEngine.play("click");
            });
        });

        // Form Submit
        const form = document.getElementById("checkout-form");
        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                this.processOrder();
            });
        }
    }

    open() {
        if (window.cart.items.length === 0) return;

        this.populateSummary();
        this.populatePickupTimes();

        if (this.modal && this.backdrop) {
            this.modal.classList.add("active");
            this.backdrop.classList.add("active");
            document.body.classList.add("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerOpen");
    }

    close() {
        if (this.modal && this.backdrop) {
            this.modal.classList.remove("active");
            this.backdrop.classList.remove("active");
            document.body.classList.remove("modal-open");
        }
    }

    closeTracker() {
        if (this.trackerModal && this.backdrop) {
            this.trackerModal.classList.remove("active");
            this.backdrop.classList.remove("active");
            document.body.classList.remove("modal-open");
        }
    }

    populatePickupTimes() {
        const select = document.getElementById("checkout-pickup-time");
        if (!select) return;
        const slots = (window.RestaurantConfig && window.RestaurantConfig.pickupTimeSlots) || [
            "ASAP (15-20 min)", "Today at 12:30 PM", "Today at 1:00 PM", "Today at 5:30 PM", "Today at 6:30 PM", "Today at 7:30 PM"
        ];
        select.innerHTML = slots.map(slot => `
            <option value="${slot}">${slot}</option>
        `).join('');
    }

    populateSummary() {
        const listEl = document.getElementById("checkout-order-items");
        const subtotalEl = document.getElementById("checkout-subtotal");
        const taxEl = document.getElementById("checkout-tax");
        const totalEl = document.getElementById("checkout-total");
        const discountEl = document.getElementById("checkout-discount");
        const discountRow = document.getElementById("checkout-discount-row");

        if (!listEl) return;

        let tableHeaderHtml = '';
        if (window.cart && window.cart.tableNumber) {
            tableHeaderHtml = `
                <div style="background: rgba(46, 204, 113, 0.15); border: 1px solid #2ecc71; color: #2ecc71; padding: 0.45rem 0.8rem; border-radius: 8px; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.8rem; text-align: center;">
                    📍 Dine-In Order — Serving to Table ${window.cart.tableNumber}
                </div>
            `;
        }

        listEl.innerHTML = tableHeaderHtml + window.cart.items.map(item => `
            <div class="checkout-item-line">
                <span>${item.quantity}x ${item.name}</span>
                <span>$${(item.unitPrice * item.quantity).toFixed(2)}</span>
            </div>
        `).join('');

        const subtotal = window.cart.calculateSubtotal();
        const discount = window.cart.calculateDiscount();
        const tax = window.cart.calculateTax();
        const total = window.cart.calculateTotal();

        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

        if (discountRow && discountEl) {
            if (discount > 0) {
                discountRow.style.display = "flex";
                discountEl.textContent = `-$${discount.toFixed(2)}`;
            } else {
                discountRow.style.display = "none";
            }
        }
    }

    processOrder() {
        const name = document.getElementById("checkout-name").value;
        const phone = document.getElementById("checkout-phone").value;
        const pickupSlot = document.getElementById("checkout-pickup-time").value;
        const orderId = `CRV-${Math.floor(100000 + Math.random() * 900000)}`;

        const orderData = {
            id: orderId,
            customerName: name,
            phone: phone,
            pickupTime: pickupSlot,
            items: [...window.cart.items],
            total: window.cart.calculateTotal(),
            placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Close checkout and open Live Order Tracker
        this.close();
        window.cart.clearCart();
        this.openTracker(orderData);

        if (window.AudioEngine) window.AudioEngine.play("success");
    }

    openTracker(order) {
        const idDisplay = document.getElementById("tracker-order-id");
        const timeDisplay = document.getElementById("tracker-pickup-time");
        const customerDisplay = document.getElementById("tracker-customer-name");
        const totalDisplay = document.getElementById("tracker-total");

        if (idDisplay) idDisplay.textContent = `#${order.id}`;
        if (timeDisplay) timeDisplay.textContent = order.pickupTime;
        if (customerDisplay) customerDisplay.textContent = order.customerName;
        if (totalDisplay) totalDisplay.textContent = `$${order.total.toFixed(2)}`;

        // Render progress simulator
        this.simulateOrderProgress();

        if (this.trackerModal && this.backdrop) {
            this.trackerModal.classList.add("active");
            this.backdrop.classList.add("active");
            document.body.classList.add("modal-open");
        }
    }

    simulateOrderProgress() {
        const step1 = document.getElementById("track-step-1");
        const step2 = document.getElementById("track-step-2");
        const step3 = document.getElementById("track-step-3");
        const step4 = document.getElementById("track-step-4");

        if (!step1) return;

        // Reset
        [step1, step2, step3, step4].forEach(s => s.classList.remove("active", "completed"));
        step1.classList.add("active");

        // Simulate kitchen progression steps
        setTimeout(() => {
            step1.classList.remove("active");
            step1.classList.add("completed");
            step2.classList.add("active");
        }, 3000);

        setTimeout(() => {
            step2.classList.remove("active");
            step2.classList.add("completed");
            step3.classList.add("active");
        }, 7000);

        setTimeout(() => {
            step3.classList.remove("active");
            step3.classList.add("completed");
            step4.classList.add("active");
            if (window.AudioEngine) window.AudioEngine.play("success");
        }, 11000);
    }
}

// ==========================================
// 6. GALLERY LIGHTBOX
// ==========================================
class GalleryLightbox {
    constructor() {
        this.modal = document.getElementById("gallery-lightbox-modal");
        this.lightboxImg = document.getElementById("lightbox-img");
        this.lightboxTitle = document.getElementById("lightbox-title");
        this.lightboxCategory = document.getElementById("lightbox-category");
        this.backdrop = document.getElementById("modal-backdrop");

        this.bindEvents();
    }

    bindEvents() {
        const closeBtn = document.getElementById("lightbox-close-btn");
        if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    }

    open(imageSrc, title, category) {
        if (this.lightboxImg) this.lightboxImg.src = imageSrc;
        if (this.lightboxTitle) this.lightboxTitle.textContent = title;
        if (this.lightboxCategory) this.lightboxCategory.textContent = category;

        if (this.modal && this.backdrop) {
            this.modal.classList.add("active");
            this.backdrop.classList.add("active");
            document.body.classList.add("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerOpen");
    }

    close() {
        if (this.modal && this.backdrop) {
            this.modal.classList.remove("active");
            this.backdrop.classList.remove("active");
            document.body.classList.remove("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerClose");
    }
}

// ==========================================
// 7. INITIALIZE MODULES ON DOM READY
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    window.AudioEngine = new WebAudioEngine();
    window.LuxuryCursor = new LuxuryCursor();
    window.ToastManager = new ToastManager();
    window.customizerModal = new DishCustomizerModal();
    window.CheckoutModal = new CheckoutModal();
    window.GalleryLightbox = new GalleryLightbox();
    window.cart = new CartEngine();
});
