/**
 * BURGER & CO. - Main Application & Multi-Page Router
 * Handles navigation across Home, Menu, Our Story, Stores, and Contact pages,
 * category browsing, pickup/delivery mode, store selection, and cart integration.
 */

class RestaurantApp {
    constructor() {
        this.currentView = "home";
        this.activeCategory = "all";
        this.orderMode = "pickup"; // 'pickup' or 'delivery'
        this.selectedStore = "Downtown Central Flagship";
        this.deliveryAddress = "";
        this.searchQuery = "";

        this.init();
    }

    init() {
        this.bindNavigation();
        this.renderHomeCategories();
        this.renderMenuCategories();
        this.renderMenuItems();
        this.renderStoresPage();
        this.bindOrderModeToggle();
        this.bindSearchInput();
        this.bindForms();
        this.handleInitialRoute();
    }

    /**
     * Handle initial URL hash or default to home
     */
    handleInitialRoute() {
        const hash = (window.location.hash || "").replace("#", "").toLowerCase();
        const validViews = ["home", "menu", "story", "stores", "contact"];
        if (validViews.includes(hash)) {
            this.switchPageView(hash);
        } else {
            this.switchPageView("home");
        }

        window.addEventListener("hashchange", () => {
            const newHash = (window.location.hash || "").replace("#", "").toLowerCase();
            if (validViews.includes(newHash) && newHash !== this.currentView) {
                this.switchPageView(newHash);
            }
        });
    }

    /**
     * Switch page view between Home, Menu, Story, Stores, Contact
     */
    switchPageView(viewName) {
        this.currentView = viewName;

        // Toggle active view container
        document.querySelectorAll(".page-view").forEach(view => {
            view.classList.remove("active-view");
        });
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.add("active-view");
        }

        // Update header nav active state
        document.querySelectorAll(".nav-item-link, .mobile-nav-link").forEach(link => {
            const linkView = link.getAttribute("data-view");
            if (linkView === viewName) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });

        // Close mobile drawer if open
        const mobileDrawer = document.getElementById("mobile-nav-drawer");
        if (mobileDrawer) {
            mobileDrawer.classList.remove("active");
            document.body.classList.remove("modal-open");
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Update URL hash
        window.location.hash = viewName;
    }

    /**
     * Bind all header, mobile, and footer page navigation buttons
     */
    bindNavigation() {
        // Nav Links
        document.querySelectorAll("[data-view]").forEach(elem => {
            elem.addEventListener("click", (e) => {
                e.preventDefault();
                const view = elem.getAttribute("data-view");
                const catFilter = elem.getAttribute("data-category-target");
                
                this.switchPageView(view);

                if (catFilter) {
                    this.filterMenuByCategory(catFilter);
                }
            });
        });

        // Mobile Menu Toggle
        const mobileToggle = document.getElementById("mobile-menu-toggle");
        const mobileDrawer = document.getElementById("mobile-nav-drawer");
        if (mobileToggle && mobileDrawer) {
            mobileToggle.addEventListener("click", () => {
                const isOpen = mobileDrawer.classList.toggle("active");
                document.body.classList.toggle("modal-open", isOpen);
            });
        }
    }

    /**
     * Render Home Page Categories Cards
     */
    renderHomeCategories() {
        const container = document.getElementById("home-categories-grid");
        if (!container) return;

        // Skip 'all' for homepage display
        const displayCats = MenuDatabase.categories.filter(c => c.id !== "all");

        container.innerHTML = displayCats.map(cat => `
            <a class="category-card" href="#menu" data-view="menu" data-category-target="${cat.id}">
                <img src="${cat.image}" alt="${cat.name}" class="category-card-img" loading="lazy">
                <div class="category-card-overlay">
                    <span class="category-name-badge">${cat.name}</span>
                </div>
            </a>
        `).join('');

        // Rebind click to handle view switch & filter
        container.querySelectorAll(".category-card").forEach(card => {
            card.addEventListener("click", (e) => {
                e.preventDefault();
                const cat = card.getAttribute("data-category-target");
                this.switchPageView("menu");
                this.filterMenuByCategory(cat);
            });
        });
    }

    /**
     * Render Menu Page Category Navigation Tabs
     */
    renderMenuCategories() {
        const container = document.getElementById("menu-category-tabs");
        if (!container) return;

        container.innerHTML = MenuDatabase.categories.map(cat => `
            <button type="button" class="menu-cat-tab ${cat.id === this.activeCategory ? 'active' : ''}" data-cat-id="${cat.id}">
                ${cat.name}
            </button>
        `).join('');

        container.querySelectorAll(".menu-cat-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const catId = tab.getAttribute("data-cat-id");
                this.filterMenuByCategory(catId);
            });
        });
    }

    filterMenuByCategory(catId) {
        this.activeCategory = catId;

        // Update tab active classes
        document.querySelectorAll(".menu-cat-tab").forEach(tab => {
            if (tab.getAttribute("data-cat-id") === catId) {
                tab.classList.add("active");
            } else {
                tab.classList.remove("active");
            }
        });

        this.renderMenuItems();
    }

    /**
     * Render Menu Items Grid
     */
    renderMenuItems() {
        const container = document.getElementById("menu-items-grid");
        if (!container) return;

        let filtered = MenuDatabase.items.filter(item => {
            const matchCategory = this.activeCategory === "all" || item.category === this.activeCategory;
            let matchSearch = true;
            if (this.searchQuery.trim().length > 0) {
                const q = this.searchQuery.toLowerCase();
                matchSearch = item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
            }
            return matchCategory && matchSearch;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #1a1a1a; border-radius: 12px;">
                    <p style="font-size: 1.2rem; color: #888;">No food items found matching your search.</p>
                    <button class="btn-red-pill" style="margin-top: 1rem; align-self: center;" onclick="window.restaurantApp.resetSearch()">View All Menu</button>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => `
            <div class="food-card-restaurant" data-dish-id="${item.id}">
                <div class="food-card-image-wrap">
                    <img src="${item.image}" alt="${item.name}" class="food-card-image" loading="lazy">
                    ${item.badge ? `<span class="food-card-badge">${item.badge}</span>` : ''}
                </div>
                <div class="food-card-details">
                    <h3 class="food-card-name">${item.name}</h3>
                    <p class="food-card-desc">${item.desc}</p>
                    <div class="food-card-bottom-row">
                        <span class="food-card-price">$${item.price.toFixed(2)}</span>
                        <button class="btn-card-add" onclick="window.customizerModal ? window.customizerModal.open('${item.id}') : window.cart.addItem(MenuDatabase.items.find(i => i.id === '${item.id}'))">
                            Add +
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render Stores Page
     */
    renderStoresPage() {
        const container = document.getElementById("stores-list-grid");
        if (!container) return;

        container.innerHTML = RestaurantConfig.stores.map(store => `
            <div class="store-card">
                <div class="store-img-wrap">
                    <img src="${store.image}" alt="${store.name}" loading="lazy">
                    <span class="store-status-badge">${store.status}</span>
                </div>
                <div class="store-card-body">
                    <h3 class="store-card-name">${store.name}</h3>
                    <div class="store-info-row">
                        <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        <span>${store.address}</span>
                    </div>
                    <div class="store-info-row">
                        <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                        <span>${store.hours}</span>
                    </div>
                    <div class="store-info-row">
                        <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        <span><a href="tel:${store.phoneRaw}" style="color: inherit;">${store.phone}</a></span>
                    </div>
                    <div class="store-card-actions">
                        <a href="${store.googleMapsUrl}" target="_blank" rel="noopener" class="btn-outline-pill" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Directions</a>
                        <button class="btn-red-pill" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="window.restaurantApp.selectStoreAndOrder('${store.name}')">Order Here</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    selectStoreAndOrder(storeName) {
        this.selectedStore = storeName;
        this.orderMode = "pickup";
        this.switchPageView("menu");

        const storeSelect = document.getElementById("pickup-store-select");
        if (storeSelect) storeSelect.value = storeName;

        if (window.ToastManager) {
            window.ToastManager.show(`Ordering for Pickup from: ${storeName}`, "info");
        }
    }

    /**
     * Bind Pickup / Delivery Mode Toggle on Menu page
     */
    bindOrderModeToggle() {
        const modeBtns = document.querySelectorAll(".mode-btn");
        const pickupFields = document.getElementById("pickup-mode-fields");
        const deliveryFields = document.getElementById("delivery-mode-fields");

        modeBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                modeBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                this.orderMode = btn.getAttribute("data-mode");
                if (this.orderMode === "pickup") {
                    if (pickupFields) pickupFields.style.display = "flex";
                    if (deliveryFields) deliveryFields.style.display = "none";
                } else {
                    if (pickupFields) pickupFields.style.display = "none";
                    if (deliveryFields) deliveryFields.style.display = "flex";
                }
            });
        });
    }

    bindSearchInput() {
        const input = document.getElementById("menu-search-input");
        if (input) {
            input.addEventListener("input", (e) => {
                this.searchQuery = e.target.value;
                this.renderMenuItems();
            });
        }
    }

    resetSearch() {
        this.searchQuery = "";
        this.activeCategory = "all";
        const input = document.getElementById("menu-search-input");
        if (input) input.value = "";
        this.filterMenuByCategory("all");
    }

    bindForms() {
        // Newsletter
        const newsForms = document.querySelectorAll(".newsletter-form-fields, .footer-newsletter-form");
        newsForms.forEach(form => {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                if (window.ToastManager) {
                    window.ToastManager.show("Thanks for subscribing! Check your inbox for exclusive deals.", "success");
                }
                form.reset();
            });
        });

        // Contact Form
        const contactForm = document.getElementById("restaurant-contact-form");
        if (contactForm) {
            contactForm.addEventListener("submit", (e) => {
                e.preventDefault();
                if (window.ToastManager) {
                    window.ToastManager.show("Thank you! Your message has been sent to our team.", "success");
                }
                contactForm.reset();
            });
        }
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.restaurantApp = new RestaurantApp();
});
