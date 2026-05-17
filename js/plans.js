// js/plans.js
const PLANS = {
    PERSONAL: {
        GRATUITO: {
            name: "Gratuito",
            storage: 15 * 1024 * 1024 * 1024, // 15 GB en bytes
            ia: "Básica",
            iaCredits: 200,
            price: 0
        },
        PLUS: {
            name: "Plus",
            storage: 125 * 1024 * 1024 * 1024,
            ia: "Avanzada Básica",
            iaCredits: 350,
            priceMonthly: 1.99, // Precio final tras 3 meses
            priceAnnual: 22.99  // Precio final tras 3 meses
        },
        PRO: {
            name: "Pro",
            storage: 350 * 1024 * 1024 * 1024,
            ia: "Premium",
            iaCredits: 750,
            priceMonthly: 19.99,
            priceAnnual: 199.99
        }
    },
    EMPRESA: {
        GRATUITO: {
            name: "Empresa Gratuito",
            storage: "Básico (sin definir TB exactos)", // Menos prioritario ahora
            ia: "Básica",
            price: 0
        },
        BUSINESS_PRO: {
            name: "Business Pro",
            storage: 500 * 1024 * 1024 * 1024 * 1024, // 500 TB
            ia: "Empresarial",
            iaCredits: "2.000–5.000",
            priceMonthly: 59.99
        },
        BUSINESS_INFINITY: {
            name: "Business Infinity",
            storage: 1000 * 1024 * 1024 * 1024 * 1024, // 1000 TB
            ia: "Corporativa Avanzada",
            iaCredits: "Ilimitados",
            priceMonthly: 79.99
        }
    }
};
