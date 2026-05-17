// js/plans.js - Sistema completo de planes y funcionalidades

const PLANS = {
    // ========== PLANES PERSONALES ==========
    PERSONAL: {
        GRATUITO: {
            id: 'PERSONAL_GRATUITO',
            name: 'Gratuito',
            icon: 'fa-solid fa-cloud',
            color: '#A0A0B8',
            storage: 15 * 1024 * 1024 * 1024, // 15 GB
            storageFormatted: '15 GB',
            ia: {
                name: 'IA Básica',
                model: 'basic',
                credits: 200,
                resetPeriod: 'unique', // Únicos, no renuevan
                features: [
                    'Consultas básicas',
                    'Resumen de archivos de texto',
                    'Búsqueda inteligente'
                ]
            },
            price: {
                monthly: 0,
                annual: 0,
                currency: '€',
                formatted: '0 €/mes'
            },
            features: [
                '15 GB almacenamiento',
                'IA básica',
                '200 créditos IA únicos',
                'Compartir por link',
                'Acceso web y móvil'
            ],
            limitations: {
                maxFileSize: 100 * 1024 * 1024, // 100 MB por archivo
                maxShareLinks: 50,
                maxFolders: 100,
                versionHistory: false,
                advancedSearch: false,
                api: false
            }
        },
        
        PLUS: {
            id: 'PERSONAL_PLUS',
            name: 'Plus',
            icon: 'fa-solid fa-star',
            color: '#6C5CE7',
            badge: 'Popular',
            storage: 125 * 1024 * 1024 * 1024, // 125 GB
            storageFormatted: '125 GB',
            ia: {
                name: 'IA Avanzada Básica',
                model: 'advanced',
                credits: 350,
                resetPeriod: 'monthly',
                features: [
                    'Consultas avanzadas',
                    'Análisis de documentos',
                    'Generación de resúmenes',
                    'Reconocimiento de imágenes',
                    'Búsqueda contextual'
                ]
            },
            price: {
                monthly: 1.99,
                annual: 22.99,
                currency: '€',
                formatted: '1,99 €/mes',
                annualFormatted: '22,99 €/año',
                savings: '33% ahorro anual',
                promo: {
                    active: true,
                    firstMonths: 3,
                    promoPrice: 0.49,
                    promoFormatted: '0,49 €/mes (3 meses)',
                    thenPrice: 1.99
                }
            },
            features: [
                '125 GB almacenamiento',
                '350 créditos IA/mes',
                'IA avanzada básica',
                'Sin anuncios',
                'Compartir con permisos',
                'Historial de versiones (30 días)',
                'Búsqueda avanzada'
            ],
            limitations: {
                maxFileSize: 500 * 1024 * 1024,
                maxShareLinks: 200,
                maxFolders: 500,
                versionHistory: 30,
                advancedSearch: true,
                api: false
            }
        },
        
        PRO: {
            id: 'PERSONAL_PRO',
            name: 'Pro',
            icon: 'fa-solid fa-crown',
            color: '#FFD43B',
            badge: 'Premium',
            storage: 350 * 1024 * 1024 * 1024, // 350 GB
            storageFormatted: '350 GB',
            ia: {
                name: 'IA Premium',
                model: 'premium',
                credits: 750,
                resetPeriod: 'monthly',
                features: [
                    'IA premium sin límites',
                    'Análisis avanzado de documentos',
                    'Generación de contenido',
                    'Reconocimiento OCR',
                    'Traducción automática',
                    'Asistente de organización',
                    'Automatizaciones inteligentes',
                    'API de IA personal'
                ]
            },
            price: {
                monthly: 19.99,
                annual: 199.99,
                currency: '€',
                formatted: '19,99 €/mes',
                annualFormatted: '199,99 €/año',
                savings: '17% ahorro anual'
            },
            features: [
                '350 GB almacenamiento',
                '750 créditos IA/mes',
                'IA premium',
                'Herramientas profesionales',
                'Historial de versiones (90 días)',
                'Compartir con equipos',
                'API de desarrollador',
                'Soporte prioritario 24/7',
                'Estadísticas avanzadas'
            ],
            limitations: {
                maxFileSize: 2 * 1024 * 1024 * 1024, // 2 GB
                maxShareLinks: 1000,
                maxFolders: 2000,
                versionHistory: 90,
                advancedSearch: true,
                api: true
            }
        }
    },
    
    // ========== PLANES EMPRESARIALES ==========
    EMPRESA: {
        GRATUITO: {
            id: 'EMPRESA_GRATUITO',
            name: 'Empresa Gratuito',
            icon: 'fa-solid fa-building',
            color: '#A0A0B8',
            storage: 15 * 1024 * 1024 * 1024, // 15 GB
            storageFormatted: '15 GB',
            ia: {
                name: 'IA Básica Empresarial',
                model: 'business-basic',
                credits: 500,
                resetPeriod: 'monthly',
                features: [
                    'Consultas básicas',
                    'Resumen de archivos',
                    'Búsqueda en equipo'
                ]
            },
            price: {
                monthly: 0,
                annual: 0,
                currency: '€',
                formatted: '0 €/mes'
            },
            features: [
                '15 GB almacenamiento',
                'IA básica',
                'Colaboración simple',
                'Hasta 5 miembros',
                'Panel de administración básico'
            ],
            limitations: {
                maxFileSize: 100 * 1024 * 1024,
                maxShareLinks: 100,
                maxFolders: 200,
                maxTeamMembers: 5,
                versionHistory: false,
                advancedSearch: false,
                api: false,
                sso: false,
                auditLog: false
            },
            isEnterprise: true
        },
        
        BUSINESS_PRO: {
            id: 'EMPRESA_BUSINESS_PRO',
            name: 'Business Pro',
            icon: 'fa-solid fa-briefcase',
            color: '#6C5CE7',
            badge: 'Empresarial',
            storage: 500 * 1024 * 1024 * 1024 * 1024, // 500 TB
            storageFormatted: '500 TB',
            ia: {
                name: 'IA Empresarial',
                model: 'enterprise',
                credits: '2000-5000', // Escala con miembros
                resetPeriod: 'monthly',
                features: [
                    'IA empresarial avanzada',
                    'Análisis predictivo',
                    'Automatización de flujos',
                    'Reconocimiento avanzado',
                    'Procesamiento de lenguaje natural',
                    'Custom ML models',
                    'API empresarial dedicada',
                    'Entrenamiento personalizado'
                ]
            },
            price: {
                monthly: 59.99,
                annual: 599.99,
                currency: '€',
                formatted: '59,99 €/mes',
                annualFormatted: '599,99 €/año',
                perUser: 9.99,
                savings: '17% ahorro anual'
            },
            features: [
                '500 TB almacenamiento',
                '2.000-5.000 créditos IA/mes',
                'IA empresarial',
                'Seguridad avanzada',
                'Hasta 50 miembros',
                'Panel de administración avanzado',
                'SSO (Single Sign-On)',
                'API empresarial',
                'SLA 99.9%',
                'Soporte dedicado 24/7',
                'Auditoría y logs',
                'Cumplimiento GDPR/HIPAA'
            ],
            limitations: {
                maxFileSize: 10 * 1024 * 1024 * 1024, // 10 GB
                maxShareLinks: 10000,
                maxFolders: 10000,
                maxTeamMembers: 50,
                versionHistory: 365,
                advancedSearch: true,
                api: true,
                sso: true,
                auditLog: true
            },
            isEnterprise: true
        },
        
        BUSINESS_INFINITY: {
            id: 'EMPRESA_BUSINESS_INFINITY',
            name: 'Business Infinity',
            icon: 'fa-solid fa-infinity',
            color: '#00CECE',
            badge: 'Ilimitado',
            storage: 1000 * 1024 * 1024 * 1024 * 1024, // 1000 TB (1 PB)
            storageFormatted: '1000 TB (1 PB)',
            ia: {
                name: 'IA Corporativa Avanzada',
                model: 'corporate',
                credits: 'Ilimitados',
                resetPeriod: 'monthly',
                features: [
                    'IA corporativa sin límites',
                    'Deep learning personalizado',
                    'Automatización total',
                    'Análisis de big data',
                    'Procesamiento ilimitado',
                    'Modelos custom ilimitados',
                    'API dedicada multi-region',
                    'Entrenamiento continuo',
                    'Consultoría IA incluida'
                ]
            },
            price: {
                monthly: 79.99,
                annual: 799.99,
                currency: '€',
                formatted: '79,99 €/mes',
                annualFormatted: '799,99 €/año',
                perUser: 14.99,
                savings: '17% ahorro anual',
                customPricing: true
            },
            features: [
                '1 PB almacenamiento',
                'Créditos IA ilimitados',
                'IA corporativa avanzada',
                'APIs y automatización',
                'Miembros ilimitados',
                'Seguridad enterprise',
                'SSO avanzado',
                'API multi-region',
                'SLA 99.99%',
                'Soporte premium 24/7',
                'Auditoría avanzada',
                'Backup multi-region',
                'Encriptación custom',
                'Consultoría dedicada'
            ],
            limitations: {
                maxFileSize: 50 * 1024 * 1024 * 1024, // 50 GB
                maxShareLinks: 'Ilimitado',
                maxFolders: 'Ilimitado',
                maxTeamMembers: 'Ilimitado',
                versionHistory: 'Ilimitado',
                advancedSearch: true,
                api: true,
                sso: true,
                auditLog: true
            },
            isEnterprise: true,
            isUnlimited: true
        }
    },
    
    // ========== FUNCIONES ÚTILES ==========
    // Obtener plan por ID
    getPlanById(planId) {
        for (const category of Object.values(this)) {
            if (typeof category === 'object') {
                for (const plan of Object.values(category)) {
                    if (plan.id === planId) return plan;
                }
            }
        }
        return this.PERSONAL.GRATUITO; // Plan por defecto
    },
    
    // Obtener créditos IA máximos
    getIACredits(planId) {
        const plan = this.getPlanById(planId);
        if (!plan || !plan.ia) return 0;
        
        if (plan.ia.credits === 'Ilimitados') return Infinity;
        if (typeof plan.ia.credits === 'string' && plan.ia.credits.includes('-')) {
            // Para Business Pro que tiene rango
            const max = parseInt(plan.ia.credits.split('-')[1]);
            return max || 5000;
        }
        return plan.ia.credits || 0;
    },
    
    // Verificar si es plan empresarial
    isEnterprisePlan(planId) {
        const plan = this.getPlanById(planId);
        return plan?.isEnterprise || false;
    },
    
    // Obtener límite de almacenamiento
    getStorageLimit(planId) {
        const plan = this.getPlanById(planId);
        return plan?.storage || 15 * 1024 * 1024 * 1024;
    },
    
    // Formatear precio para mostrar
    formatPrice(plan, period = 'monthly') {
        if (!plan.price) return 'Gratuito';
        
        if (plan.price[period] === 0) return 'Gratuito';
        
        const symbol = plan.price.currency || '€';
        const price = plan.price[period];
        
        return `${price.toFixed(2)} ${symbol}/${period === 'annual' ? 'año' : 'mes'}`;
    }
};

// Exportar para uso global
window.PLANS = PLANS;

console.log('💎 Sistema de planes cargado:', 
    Object.keys(PLANS.PERSONAL).length, 'planes personales,',
    Object.keys(PLANS.EMPRESA).length, 'planes empresariales'
);
