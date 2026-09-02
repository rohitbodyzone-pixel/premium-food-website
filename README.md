# BURGER & CO. - Handcrafted Burger Restaurant Website

A production-ready, food-first, responsive burger restaurant web application inspired by [Burger Station NZ](https://burgerstation.co.nz/).

---

## 🍔 Features

- **Food-First Visual Presentation**: High-contrast, appetizing imagery, bold display typography (`Bangers`, `Oswald`, `Plus Jakarta Sans`), and signature crimson & charcoal restaurant color palette.
- **Hero Banner & Floating Order Strip**: Full-width flame-seared burger hero composition with express delivery/pickup quick toggle.
- **Promotional 3-Banner Grid**: Visual highlights for ciabatta toasties, epic monster burger deals, and full menu exploration.
- **Visual Category Grid**: 8 distinct categories (*Breakfast*, *Ciabatta Toasties*, *Classic Burgers*, *Gourmet Burgers*, *Chicken Burgers*, *Fries & Snacks*, *Desserts*, *Shakes & Drinks*) with one-click filtering.
- **Multi-Page SPA Navigation**:
  - **Home**: Hero, Deals, Categories, Story intro, App download promotion, and Newsletter subscription.
  - **Menu**: Interactive Pickup / Delivery selector, live search bar, sticky category navigation, and rich food cards.
  - **Our Story**: Heritage backstory and the 3 culinary pillars (100% fresh beef, daily baked brioche, scratch-made sauces).
  - **Stores**: Location directory with live open statuses, service hours, direct phone dialers, and GPS directions.
  - **Contact**: Hours, direct line, store list, and interactive message submission form.
- **Complete Ordering & Cart Engine**:
  - Dish customizer modal with temperature doneness, spice level, gourmet add-ons, and kitchen notes.
  - Slide-out Cart drawer with quantity steppers, promo codes (`BURGER10`, `COMBO5`, `EPICDEAL`), and 15% GST calculations.
  - Express Checkout modal with simulated Apple Pay / G Pay / Pay in Store.
  - Live 4-stage kitchen order tracker timeline.

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser or serve locally with any static file server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js npx serve
npx serve .
```

---

## 📁 Project Structure

```
├── assets/
│   ├── icons/
│   └── images/
├── css/
│   ├── luxury-food.css   # Main restaurant theme variables & typography
│   ├── components.css    # Header, hero, categories, menu, cards, cart drawer, modals
│   ├── animations.css    # Keyframe animations
│   └── responsive.css    # Desktop, tablet, and mobile media queries
├── js/
│   ├── restaurant-config.js  # Brand data, stores, hours, promo codes
│   ├── menu-data.js          # Categories & full food items database
│   ├── cart.js               # Cart calculation engine & drawer UI
│   ├── interactions.js       # Customizer, checkout modal & live tracker
│   ├── app.js                # Multi-page router & category filtering
│   ├── animations.js         # Interactive animations & tilts
│   └── three-food.js         # WebGL culinary visual atmosphere
├── index.html            # Main HTML5 application
├── .gitignore
└── README.md
```

---

## 📄 License
MIT License. &copy; 2026 BURGER & CO. All Rights Reserved.
