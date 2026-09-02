/**
 * CRAVE & CO. - Cart & Ordering State Engine
 * Handles cart item storage, customization parameters, add-ons calculation,
 * promo code validation, tax & subtotal math, drawer rendering, and checkout integration.
 */

class CartEngine {
    constructor() {
        this.items = [];
        this.appliedPromo = null;
        this.selectedPickupTime = "ASAP (Approx. 15-20 mins)";
        this.storageKey = "crave_co_cart_v1";

        this.init();
    }

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.renderCartUI();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.items = Array.isArray(parsed.items) ? parsed.items : [];
                this.appliedPromo = parsed.appliedPromo || null;
                this.selectedPickupTime = parsed.selectedPickupTime || "ASAP (Approx. 15-20 mins)";
            }
        } catch (e) {
            console.warn("Could not load cart from storage:", e);
            this.items = [];
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                items: this.items,
                appliedPromo: this.appliedPromo,
                selectedPickupTime: this.selectedPickupTime
            }));
        } catch (e) {
            console.warn("Could not save cart to storage:", e);
        }
    }

    /**
     * Add dish to cart with options
     */
    addItem(dish, options = {}) {
        const {
            quantity = 1,
            temperature = null,
            spiceLevel = null,
            selectedAddOns = [],
            specialInstructions = ""
        } = options;

        // Generate unique key for distinct customization configurations
        const customSignature = `${dish.id}_${temperature || ''}_${spiceLevel || ''}_${selectedAddOns.map(a => a.id).sort().join('-')}`;

        const existingIndex = this.items.findIndex(item => item.signature === customSignature);

        if (existingIndex > -1) {
            this.items[existingIndex].quantity += quantity;
        } else {
            // Calculate item unit price including add-ons
            const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
            const unitPrice = dish.price + addOnsTotal;

            this.items.push({
                signature: customSignature,
                id: dish.id,
                name: dish.name,
                image: dish.image,
                basePrice: dish.price,
                unitPrice: unitPrice,
                quantity: quantity,
                temperature: temperature,
                spiceLevel: spiceLevel,
                addOns: selectedAddOns,
                specialInstructions: specialInstructions
            });
        }

        this.saveToStorage();
        this.renderCartUI();
        this.triggerCartBadgeAnimation();

        // Play subtle sound & toast
        if (window.AudioEngine) window.AudioEngine.play("cartAdd");
        if (window.ToastManager) {
            window.ToastManager.show(`Added ${quantity}x "${dish.name}" to cart!`, "success");
        }
    }

    /**
     * Add entire promotional deal bundle to cart
     */
    addDeal(deal) {
        const customSignature = `deal_${deal.id}`;
        const existingIndex = this.items.findIndex(item => item.signature === customSignature);

        if (existingIndex > -1) {
            this.items[existingIndex].quantity += 1;
        } else {
            this.items.push({
                signature: customSignature,
                id: deal.id,
                name: deal.name,
                image: deal.image,
                basePrice: deal.price,
                unitPrice: deal.price,
                quantity: 1,
                isDeal: true,
                badge: deal.badge,
                addOns: [],
                specialInstructions: deal.includes.join(", ")
            });
        }

        this.saveToStorage();
        this.renderCartUI();
        this.triggerCartBadgeAnimation();

        if (window.AudioEngine) window.AudioEngine.play("cartAdd");
        if (window.ToastManager) {
            window.ToastManager.show(`Promotional Deal "${deal.name}" added to cart!`, "success");
        }
    }

    updateQuantity(signature, delta) {
        const index = this.items.findIndex(item => item.signature === signature);
        if (index === -1) return;

        this.items[index].quantity += delta;
        if (this.items[index].quantity <= 0) {
            this.items.splice(index, 1);
        }

        this.saveToStorage();
        this.renderCartUI();
        if (window.AudioEngine) window.AudioEngine.play("click");
    }

    removeItem(signature) {
        this.items = this.items.filter(item => item.signature !== signature);
        this.saveToStorage();
        this.renderCartUI();
        if (window.AudioEngine) window.AudioEngine.play("click");
        if (window.ToastManager) window.ToastManager.show("Item removed from cart.", "info");
    }

    clearCart() {
        this.items = [];
        this.appliedPromo = null;
        this.saveToStorage();
        this.renderCartUI();
    }

    applyPromoCode(codeStr) {
        const cleanCode = (codeStr || "").trim().toUpperCase();
        if (!cleanCode) return { success: false, message: "Please enter a valid promotion code." };

        const promo = RestaurantConfig.promoCodes[cleanCode];
        if (!promo) {
            if (window.AudioEngine) window.AudioEngine.play("error");
            return { success: false, message: "Invalid promo code. Try 'CRAVE10' or 'GOLDVIP'." };
        }

        const subtotal = this.calculateSubtotal();
        if (promo.minOrder && subtotal < promo.minOrder) {
            if (window.AudioEngine) window.AudioEngine.play("error");
            return { success: false, message: `Code requires a minimum subtotal of $${promo.minOrder.toFixed(2)}.` };
        }

        this.appliedPromo = { code: cleanCode, ...promo };
        this.saveToStorage();
        this.renderCartUI();
        
        if (window.AudioEngine) window.AudioEngine.play("success");
        return { success: true, message: `Promo code "${cleanCode}" applied! ${promo.description}` };
    }

    removePromoCode() {
        this.appliedPromo = null;
        this.saveToStorage();
        this.renderCartUI();
        if (window.ToastManager) window.ToastManager.show("Promo code removed.", "info");
    }

    calculateSubtotal() {
        return this.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    }

    calculateDiscount() {
        if (!this.appliedPromo) return 0;
        const subtotal = this.calculateSubtotal();
        if (this.appliedPromo.type === "percent") {
            return (subtotal * this.appliedPromo.value) / 100;
        } else if (this.appliedPromo.type === "fixed") {
            return Math.min(this.appliedPromo.value, subtotal);
        }
        return 0;
    }

    calculateTax() {
        const taxableAmount = Math.max(0, this.calculateSubtotal() - this.calculateDiscount());
        return taxableAmount * (RestaurantConfig.brand.taxRate || 0.0825);
    }

    calculateTotal() {
        const subtotal = this.calculateSubtotal();
        const discount = this.calculateDiscount();
        const tax = this.calculateTax();
        const pickupFee = RestaurantConfig.brand.clickAndCollectFee || 0;
        return Math.max(0, subtotal - discount + tax + pickupFee);
    }

    getTotalItemCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    triggerCartBadgeAnimation() {
        const badge = document.getElementById("nav-cart-count");
        if (badge) {
            badge.classList.remove("bump-anim");
            void badge.offsetWidth; // trigger reflow
            badge.classList.add("bump-anim");
        }
    }

    bindEvents() {
        // Open drawer
        const openButtons = document.querySelectorAll(".btn-open-cart");
        openButtons.forEach(btn => {
            btn.addEventListener("click", () => this.openDrawer());
        });

        // Close drawer
        const closeBtn = document.getElementById("cart-close-btn");
        const backdrop = document.getElementById("cart-backdrop");
        if (closeBtn) closeBtn.addEventListener("click", () => this.closeDrawer());
        if (backdrop) backdrop.addEventListener("click", () => this.closeDrawer());

        // Promo form submission
        const promoForm = document.getElementById("cart-promo-form");
        if (promoForm) {
            promoForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const input = document.getElementById("cart-promo-input");
                if (!input) return;
                const result = this.applyPromoCode(input.value);
                if (window.ToastManager) {
                    window.ToastManager.show(result.message, result.success ? "success" : "error");
                }
                if (result.success) input.value = "";
            });
        }

        // Pickup time selector change
        const timeSelect = document.getElementById("cart-pickup-time");
        if (timeSelect) {
            timeSelect.addEventListener("change", (e) => {
                this.selectedPickupTime = e.target.value;
                this.saveToStorage();
            });
        }

        // Checkout Button trigger
        const checkoutBtn = document.getElementById("cart-checkout-btn");
        if (checkoutBtn) {
            checkoutBtn.addEventListener("click", () => {
                if (this.items.length === 0) {
                    if (window.ToastManager) window.ToastManager.show("Your cart is empty. Add culinary dishes first!", "error");
                    return;
                }
                this.closeDrawer();
                if (window.CheckoutModal) {
                    window.CheckoutModal.open();
                }
            });
        }

        // Keyboard escape
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeDrawer();
            }
        });
    }

    openDrawer() {
        const drawer = document.getElementById("cart-drawer");
        const backdrop = document.getElementById("cart-backdrop");
        if (drawer && backdrop) {
            drawer.classList.add("active");
            backdrop.classList.add("active");
            document.body.classList.add("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerOpen");
    }

    closeDrawer() {
        const drawer = document.getElementById("cart-drawer");
        const backdrop = document.getElementById("cart-backdrop");
        if (drawer && backdrop) {
            drawer.classList.remove("active");
            backdrop.classList.remove("active");
            document.body.classList.remove("modal-open");
        }
        if (window.AudioEngine) window.AudioEngine.play("drawerClose");
    }

    renderCartUI() {
        const countBadges = document.querySelectorAll(".cart-count-badge, .cart-count-pill");
        const totalCount = this.getTotalItemCount();
        countBadges.forEach(b => {
            b.textContent = totalCount;
            b.style.display = totalCount > 0 ? "flex" : "none";
        });

        const itemsContainer = document.getElementById("cart-items-container");
        const emptyState = document.getElementById("cart-empty-state");
        const footerSection = document.getElementById("cart-drawer-footer");

        if (!itemsContainer) return;

        if (this.items.length === 0) {
            if (emptyState) emptyState.style.display = "flex";
            if (itemsContainer) itemsContainer.innerHTML = "";
            if (footerSection) footerSection.style.display = "none";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        if (footerSection) footerSection.style.display = "block";

        // Render Item Cards
        itemsContainer.innerHTML = this.items.map(item => {
            const addOnsText = item.addOns && item.addOns.length > 0
                ? `<div class="cart-item-addons">+ ${item.addOns.map(a => `${a.name} ($${a.price.toFixed(2)})`).join(', ')}</div>`
                : '';

            const tempOrSpice = (item.temperature || item.spiceLevel)
                ? `<div class="cart-item-spec">${item.temperature ? `Temp: ${item.temperature}` : ''} ${item.spiceLevel ? `• Spice: ${item.spiceLevel}` : ''}</div>`
                : '';

            return `
                <div class="cart-item-card" data-signature="${item.signature}">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-thumb" loading="lazy">
                    <div class="cart-item-details">
                        <div class="cart-item-header">
                            <h4 class="cart-item-title">${item.name}</h4>
                            <button class="cart-item-remove-btn" onclick="window.cart.removeItem('${item.signature}')" aria-label="Remove item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                        ${addOnsText}
                        ${tempOrSpice}
                        <div class="cart-item-bottom">
                            <div class="cart-stepper">
                                <button class="stepper-btn" onclick="window.cart.updateQuantity('${item.signature}', -1)" aria-label="Decrease quantity">−</button>
                                <span class="stepper-val">${item.quantity}</span>
                                <button class="stepper-btn" onclick="window.cart.updateQuantity('${item.signature}', 1)" aria-label="Increase quantity">+</button>
                            </div>
                            <span class="cart-item-price">$${(item.unitPrice * item.quantity).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Render Calculations
        const subtotal = this.calculateSubtotal();
        const discount = this.calculateDiscount();
        const tax = this.calculateTax();
        const total = this.calculateTotal();

        const elSubtotal = document.getElementById("cart-summary-subtotal");
        const elTax = document.getElementById("cart-summary-tax");
        const elDiscountRow = document.getElementById("cart-summary-discount-row");
        const elDiscount = document.getElementById("cart-summary-discount");
        const elTotal = document.getElementById("cart-summary-total");

        if (elSubtotal) elSubtotal.textContent = `$${subtotal.toFixed(2)}`;
        if (elTax) elTax.textContent = `$${tax.toFixed(2)}`;
        if (elTotal) elTotal.textContent = `$${total.toFixed(2)}`;

        if (elDiscountRow && elDiscount) {
            if (discount > 0 && this.appliedPromo) {
                elDiscountRow.style.display = "flex";
                elDiscount.textContent = `-$${discount.toFixed(2)} (${this.appliedPromo.code})`;
            } else {
                elDiscountRow.style.display = "none";
            }
        }

        // Render Promo Tag if applied
        const promoActiveContainer = document.getElementById("cart-active-promo");
        if (promoActiveContainer) {
            if (this.appliedPromo) {
                promoActiveContainer.innerHTML = `
                    <div class="active-promo-pill">
                        <span>🏷️ <strong>${this.appliedPromo.code}</strong>: ${this.appliedPromo.description}</span>
                        <button onclick="window.cart.removePromoCode()" class="remove-promo-btn" title="Remove promo">&times;</button>
                    </div>
                `;
                promoActiveContainer.style.display = "block";
            } else {
                promoActiveContainer.innerHTML = "";
                promoActiveContainer.style.display = "none";
            }
        }
    }
}

// Attach to window
window.CartEngine = CartEngine;
