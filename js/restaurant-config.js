/**
 * BURGER & CO. - Master Restaurant Configuration
 * Contains brand data, stores list, hours, contacts, and delivery/pickup settings.
 */

const RestaurantConfig = {
    brand: {
        name: "BURGER & CO.",
        shortName: "Burger & Co.",
        tagline: "Handcrafted Burgers & Wood-Fired Bites",
        headline: "Get the Best Burgers in Town",
        subheadline: "100% pure fresh beef, artisan toasted brioche buns, fresh local produce, and secret signature sauces. Order hot for pickup or express delivery.",
        currency: "$",
        currencyCode: "NZD",
        taxRate: 0.15, // 15% GST
        deliveryFee: 4.99,
        freeDeliveryThreshold: 45.00,
        clickAndCollectFee: 0.00
    },

    stores: [
        {
            id: "store-central",
            name: "Downtown Central Flagship",
            address: "142 High Street, Downtown Central, Christchurch 8011",
            phone: "03 666 0134",
            phoneRaw: "+6436660134",
            email: "central@burgerandco.nz",
            hours: "Mon - Sun: 11:00 AM – 10:30 PM",
            status: "Open Now",
            image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
            googleMapsUrl: "https://maps.google.com/?q=Christchurch+Central"
        },
        {
            id: "store-riverside",
            name: "Riverside Promenade",
            address: "88 Riverside Boulevard, West Quay, Christchurch 8013",
            phone: "03 666 0135",
            phoneRaw: "+6436660135",
            email: "riverside@burgerandco.nz",
            hours: "Mon - Sun: 10:30 AM – Midnight",
            status: "Open Now",
            image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
            googleMapsUrl: "https://maps.google.com/?q=Riverside+Christchurch"
        },
        {
            id: "store-lincoln",
            name: "Lincoln Road Station",
            address: "204 Lincoln Road, Lincoln Village, Canterbury 7608",
            phone: "03 666 0136",
            phoneRaw: "+6436660136",
            email: "lincoln@burgerandco.nz",
            hours: "Mon - Sun: 11:00 AM – 10:00 PM",
            status: "Open Now",
            image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80",
            googleMapsUrl: "https://maps.google.com/?q=Lincoln+Canterbury"
        }
    ],

    contact: {
        phone: "03 666 0134",
        phoneRaw: "+6436660134",
        email: "support@burgerandco.nz",
        headOffice: "142 High Street, Downtown Central, Christchurch NZ",
        social: {
            facebook: "https://facebook.com",
            instagram: "https://instagram.com",
            youtube: "https://youtube.com"
        }
    },

    promoCodes: {
        "BURGER10": { type: "percent", value: 10, description: "10% off your entire meal", minOrder: 20 },
        "COMBO5": { type: "fixed", value: 5, description: "$5 off any combo over $30", minOrder: 30 },
        "EPICDEAL": { type: "percent", value: 15, description: "15% off Weekend Feast", minOrder: 40 }
    },

    pickupTimeSlots: [
        "ASAP (15-20 min)",
        "Today at 12:30 PM",
        "Today at 1:00 PM",
        "Today at 1:30 PM",
        "Today at 5:30 PM",
        "Today at 6:30 PM",
        "Today at 7:30 PM",
        "Today at 8:30 PM"
    ]
};

window.RestaurantConfig = RestaurantConfig;
