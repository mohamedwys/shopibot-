import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// Define translations directly to avoid JSON import issues
const translations: Record<string, any> = {
  en: {
    online: "Online",
    offline: "Offline",
    close: "Close",
    thinking: "Thinking",
    poweredByAI: "Powered by AI",
    inputPlaceholder: "Ask me anything about our products...",
    bestSellers: "Best Sellers",
    newArrivals: "New Arrivals",
    onSale: "On Sale",
    recommended: "Recommended",
    shipping: "Shipping",
    returns: "Returns",
    trackOrder: "Track Order",
    help: "Help",
    discover: "Discover",
    support: "Support"
  },
  es: {
    online: "En línea",
    offline: "Desconectado",
    close: "Cerrar",
    thinking: "Pensando",
    poweredByAI: "Impulsado por IA",
    inputPlaceholder: "Pregúntame sobre nuestros productos...",
    bestSellers: "Más vendidos",
    newArrivals: "Novedades",
    onSale: "En oferta",
    recommended: "Recomendado",
    shipping: "Envío",
    returns: "Devoluciones",
    trackOrder: "Rastrear pedido",
    help: "Ayuda",
    discover: "Descubrir",
    support: "Soporte"
  },
  fr: {
    online: "En ligne",
    offline: "Hors ligne",
    close: "Fermer",
    thinking: "Réflexion",
    poweredByAI: "Propulsé par IA",
    inputPlaceholder: "Posez-moi des questions sur nos produits...",
    bestSellers: "Meilleures ventes",
    newArrivals: "Nouveautés",
    onSale: "En promotion",
    recommended: "Recommandé",
    shipping: "Livraison",
    returns: "Retours",
    trackOrder: "Suivre commande",
    help: "Aide",
    discover: "Découvrir",
    support: "Support"
  },
  de: {
    online: "Online",
    offline: "Offline",
    close: "Schließen",
    thinking: "Denken",
    poweredByAI: "Powered by KI",
    inputPlaceholder: "Fragen Sie mich zu unseren Produkten...",
    bestSellers: "Bestseller",
    newArrivals: "Neuheiten",
    onSale: "Im Angebot",
    recommended: "Empfohlen",
    shipping: "Versand",
    returns: "Rücksendungen",
    trackOrder: "Bestellung verfolgen",
    help: "Hilfe",
    discover: "Entdecken",
    support: "Support"
  },
  ja: {
    online: "オンライン",
    offline: "オフライン",
    close: "閉じる",
    thinking: "考え中",
    poweredByAI: "AI搭載",
    inputPlaceholder: "製品について質問してください...",
    bestSellers: "ベストセラー",
    newArrivals: "新着商品",
    onSale: "セール中",
    recommended: "おすすめ",
    shipping: "配送",
    returns: "返品",
    trackOrder: "注文を追跡",
    help: "ヘルプ",
    discover: "発見",
    support: "サポート"
  },
  it: {
    online: "Online",
    offline: "Offline",
    close: "Chiudi",
    thinking: "Pensando",
    poweredByAI: "Powered by IA",
    inputPlaceholder: "Chiedimi dei nostri prodotti...",
    bestSellers: "Più venduti",
    newArrivals: "Novità",
    onSale: "In offerta",
    recommended: "Consigliato",
    shipping: "Spedizione",
    returns: "Resi",
    trackOrder: "Traccia ordine",
    help: "Aiuto",
    discover: "Scopri",
    support: "Supporto"
  },
  pt: {
    online: "Online",
    offline: "Offline",
    close: "Fechar",
    thinking: "Pensando",
    poweredByAI: "Powered by IA",
    inputPlaceholder: "Pergunte-me sobre nossos produtos...",
    bestSellers: "Mais vendidos",
    newArrivals: "Novidades",
    onSale: "Em promoção",
    recommended: "Recomendado",
    shipping: "Envio",
    returns: "Devoluções",
    trackOrder: "Rastrear pedido",
    help: "Ajuda",
    discover: "Descobrir",
    support: "Suporte"
  },
  zh: {
    online: "在线",
    offline: "离线",
    close: "关闭",
    thinking: "思考中",
    poweredByAI: "AI驱动",
    inputPlaceholder: "询问我们的产品...",
    bestSellers: "畅销商品",
    newArrivals: "新品上市",
    onSale: "促销中",
    recommended: "推荐",
    shipping: "配送",
    returns: "退货",
    trackOrder: "追踪订单",
    help: "帮助",
    discover: "发现",
    support: "支持"
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const lang = url.searchParams.get("lang") || "en";

    // Validate language
    const validLangs = ["en", "es", "fr", "de", "ja", "it", "pt", "zh"];
    const selectedLang = validLangs.indexOf(lang) !== -1 ? lang : "en";

    // Get translations for selected language
    const chatbotTranslations = translations[selectedLang];

    return json(
      { translations: chatbotTranslations, lang: selectedLang },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "public, max-age=3600"
        }
      }
    );
  } catch (error) {
    console.error("Error loading chatbot translations:", error);

    // Return English translations on error
    return json(
      { translations: translations.en, lang: "en" },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      }
    );
  }
};

export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
