/**
 * BURGER & CO. - Master Food Menu & Category Database
 * Modeled after Burger Station categories: Breakfast, Toasties, Classic Burgers,
 * Gourmet Burgers, Chicken Burgers, Fries & Snacks, Desserts, Shakes & Drinks.
 */

const MenuDatabase = {
    categories: [
        {
            id: "all",
            name: "All Items",
            image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "breakfast",
            name: "Breakfast",
            image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "toasties",
            name: "Ciabatta Toasties",
            image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "classic-burgers",
            name: "Classic Burgers",
            image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "gourmet-burgers",
            name: "Gourmet Burgers",
            image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "chicken-burgers",
            name: "Chicken Burgers",
            image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "sides",
            name: "Fries & Snacks",
            image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "desserts",
            name: "Desserts",
            image: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: "drinks",
            name: "Shakes & Drinks",
            image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80"
        }
    ],

    items: [
        // --- GOURMET BURGERS ---
        {
            id: "gourmet-wagyu-royale",
            name: "Smoked Wagyu Truffle Royale",
            category: "gourmet-burgers",
            price: 21.50,
            image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
            badge: "Chef Signature",
            desc: "200g prime Wagyu beef patty, melted aged Swiss cheese, shaved black truffles, caramelized bourbon onions, truffle aioli on toasted brioche.",
            temperatureSelect: true,
            addOns: [
                { id: "add-bacon", name: "Crispy Smoked Bacon", price: 3.50 },
                { id: "add-egg", name: "Fried Farm Egg", price: 2.50 },
                { id: "add-patty", name: "Extra Wagyu Patty", price: 6.00 }
            ]
        },
        {
            id: "gourmet-double-smash",
            name: "Double Cheddar Monster Smash",
            category: "gourmet-burgers",
            price: 19.90,
            image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80",
            badge: "Best Seller",
            desc: "Double smashed fresh beef patties with lacy crispy edges, triple vintage cheddar, dill pickles, grilled onions, house burger sauce.",
            temperatureSelect: false,
            addOns: [
                { id: "add-bacon", name: "Smoked Bacon Strips", price: 3.50 },
                { id: "add-cheese", name: "Extra Melted Cheddar", price: 2.00 }
            ]
        },
        {
            id: "gourmet-bbq-bacon",
            name: "Smokey Texas Bacon & Onion Ring",
            category: "gourmet-burgers",
            price: 18.50,
            image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
            badge: "Smokey Favorite",
            desc: "Thick beef patty, crispy beer-battered onion ring, double smoked bacon, smoked Monterey Jack cheese, sweet hickory BBQ sauce.",
            temperatureSelect: true,
            addOns: [
                { id: "add-jalapenos", name: "Spicy Pickled Jalapeños", price: 1.50 }
            ]
        },

        // --- CLASSIC BURGERS ---
        {
            id: "classic-cheeseburger",
            name: "The Classic Cheeseburger",
            category: "classic-burgers",
            price: 14.50,
            image: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=800&q=80",
            badge: "Classic",
            desc: "100% pure beef patty, melted American cheese, crisp lettuce, ripe tomato, sweet pickles, ketchup and mustard on toasted sesame bun.",
            addOns: [
                { id: "add-bacon", name: "Add Bacon", price: 3.00 },
                { id: "add-patty", name: "Make it a Double", price: 4.50 }
            ]
        },
        {
            id: "classic-bacon-deluxe",
            name: "Bacon & Cheddar Deluxe",
            category: "classic-burgers",
            price: 16.50,
            image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
            badge: "Popular",
            desc: "Grilled beef patty, double streaky bacon, melted cheddar cheese, crisp oak lettuce, tomato, red onion, and creamy secret sauce.",
            addOns: [
                { id: "add-egg", name: "Sunny Side Egg", price: 2.50 }
            ]
        },
        {
            id: "classic-kiwi-burger",
            name: "The Great Kiwi Station Burger",
            category: "classic-burgers",
            price: 17.50,
            image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=800&q=80",
            badge: "Local Legend",
            desc: "Fresh beef patty, fried egg, sliced beetroot, grilled pineapple, cheddar cheese, crisp lettuce, tomato, and house relish.",
            addOns: [
                { id: "add-bacon", name: "Add Crispy Bacon", price: 3.00 }
            ]
        },

        // --- CHICKEN BURGERS ---
        {
            id: "chicken-crispy-bird",
            name: "Southern Crispy Buttermilk Chicken",
            category: "chicken-burgers",
            price: 17.90,
            image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80",
            badge: "Extra Crispy",
            desc: "Hand-breaded buttermilk fried chicken breast, creamy purple cabbage slaw, sliced pickles, and chipotle mayo on potato brioche.",
            addOns: [
                { id: "add-cheese", name: "Add Melted Cheese", price: 2.00 },
                { id: "add-bacon", name: "Add Bacon", price: 3.00 }
            ]
        },
        {
            id: "chicken-hot-honey",
            name: "Nashville Hot Honey Crispy Bird",
            category: "chicken-burgers",
            price: 18.50,
            image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=800&q=80",
            badge: "Spicy Hit 🔥",
            desc: "Fiery Nashville spiced fried chicken thigh tossed in hot chili honey, crunchy slaw, ranch dressing, and dill pickles.",
            addOns: [
                { id: "add-cheese", name: "Melted Pepperjack", price: 2.00 }
            ]
        },

        // --- TOASTIES ---
        {
            id: "toastie-pastrami",
            name: "Smoked Pastrami & Swiss Ciabatta",
            category: "toasties",
            price: 15.00,
            image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80",
            badge: "Pressed Fresh",
            desc: "Warm pressed artisan ciabatta packed with shaved smoked beef pastrami, molten Swiss cheese, sauerkraut, and Russian dressing.",
            addOns: []
        },
        {
            id: "toastie-four-cheese",
            name: "Ultimate 4-Cheese Melt Toastie",
            category: "toasties",
            price: 12.50,
            image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&w=800&q=80",
            badge: "Cheese Pull",
            desc: "Golden buttered sourdough pressed with mozzarella, aged cheddar, gruyère, and parmesan with garlic herb butter.",
            addOns: []
        },

        // --- BREAKFAST ---
        {
            id: "breakfast-bacon-egg",
            name: "Morning Stack Brioche & Hash Brown",
            category: "breakfast",
            price: 13.90,
            image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80",
            badge: "Breakfast Star",
            desc: "Double crispy bacon, fried free-range egg, golden crispy hash brown, melted cheddar, and smoky tomato relish on brioche.",
            addOns: []
        },

        // --- SIDES & SNACKS ---
        {
            id: "sides-seasoned-fries",
            name: "Golden Station Seasoned Fries",
            category: "sides",
            price: 6.90,
            image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
            badge: "Crunchy",
            desc: "Hot crispy skin-on potato fries tossed in our signature herbs and seasoned sea salt. Served with garlic aioli.",
            addOns: [
                { id: "add-cheese-sauce", name: "Warm Liquid Cheese Sauce", price: 2.50 },
                { id: "add-truffle-oil", name: "Truffle Oil & Parmesan", price: 3.00 }
            ]
        },
        {
            id: "sides-onion-rings",
            name: "Beer-Battered Crispy Onion Rings",
            category: "sides",
            price: 8.50,
            image: "https://images.unsplash.com/photo-1639024471287-032f66ab7503?auto=format&fit=crop&w=800&q=80",
            badge: "Beer Battered",
            desc: "Giant thick-cut sweet onions in a crisp golden craft beer batter. Served with smokey BBQ ranch dip.",
            addOns: []
        },
        {
            id: "sides-loaded-fries",
            name: "Loaded Bacon & Cheese Fries",
            category: "sides",
            price: 11.50,
            image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=800&q=80",
            badge: "Crowd Pleaser",
            desc: "Large seasoned fries smothered in molten cheddar sauce, crispy chopped bacon bits, sour cream, and fresh spring onions.",
            addOns: []
        },

        // --- DESSERTS ---
        {
            id: "dessert-choc-cake",
            name: "Warm Molten Lava Chocolate Cake",
            category: "desserts",
            price: 10.50,
            image: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=800&q=80",
            badge: "Molten Heart",
            desc: "Decadent dark chocolate cake with a molten flowing center, served with vanilla bean ice cream and chocolate drizzle.",
            addOns: []
        },

        // --- SHAKES & DRINKS ---
        {
            id: "drink-thickshake-choc",
            name: "Signature Hand-Spun Thickshake",
            category: "drinks",
            price: 8.50,
            image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80",
            badge: "Hand Spun",
            desc: "Real dairy ice cream blended thick with rich chocolate fudge, malt, topped with whipped cream and wafer roll.",
            addOns: []
        },
        {
            id: "drink-craft-cola",
            name: "Artisanal Ice-Cold Craft Soda",
            category: "drinks",
            price: 4.50,
            image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80",
            badge: "Chilled",
            desc: "Refreshing bottled craft soda over crushed ice with fresh lemon or lime.",
            addOns: []
        }
    ]
};

window.MenuDatabase = MenuDatabase;
