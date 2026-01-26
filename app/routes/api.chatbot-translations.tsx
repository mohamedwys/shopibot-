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
    support: "Support",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "Tell me about shipping and delivery",
    returnsPrompt: "What is your return policy?",
    trackOrderPrompt: "How can I track my order?",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "Show me your popular products",
    newArrivalsPrompt: "Show me new arrivals",
    onSalePrompt: "What products are on sale?",
    recommendedPrompt: "Show me recommendations for me",
    // ⭐ Rating prompts
    ratingTitle: "How was your experience?",
    ratingFeedbackPlaceholder: "Additional feedback (optional)",
    ratingSkip: "Skip",
    ratingThankYou: "Thank you for your feedback!",
    ratingAriaLabel: "Rate {{stars}} star",
    // 👋 Welcome popup
    welcomeMessage: "👋 I'm here to help",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "Type your question below to get started"
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
    support: "Soporte",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "Cuéntame sobre el envío y la entrega",
    returnsPrompt: "¿Cuál es su política de devoluciones?",
    trackOrderPrompt: "¿Cómo puedo rastrear mi pedido?",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "Muéstrame tus productos populares",
    newArrivalsPrompt: "Muéstrame novedades",
    onSalePrompt: "¿Qué productos están en oferta?",
    recommendedPrompt: "Muéstrame recomendaciones para mí",
    // ⭐ Rating prompts
    ratingTitle: "¿Cómo fue tu experiencia?",
    ratingFeedbackPlaceholder: "Comentarios adicionales (opcional)",
    ratingSkip: "Omitir",
    ratingThankYou: "¡Gracias por tu comentario!",
    ratingAriaLabel: "Calificar {{stars}} estrella",
    // 👋 Welcome popup
    welcomeMessage: "👋 Estoy aquí para ayudarte",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "Escribe tu pregunta abajo para comenzar"
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
    support: "Support",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "Parlez-moi de la livraison et de l'expédition",
    returnsPrompt: "Quelle est votre politique de retour ?",
    trackOrderPrompt: "Comment puis-je suivre ma commande ?",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "Montrez-moi vos produits populaires",
    newArrivalsPrompt: "Montrez-moi les nouveautés",
    onSalePrompt: "Quels produits sont en promotion ?",
    recommendedPrompt: "Montrez-moi des recommandations pour moi",
    // ⭐ Rating prompts
    ratingTitle: "Comment était votre expérience ?",
    ratingFeedbackPlaceholder: "Commentaires supplémentaires (facultatif)",
    ratingSkip: "Passer",
    ratingThankYou: "Merci pour votre retour !",
    ratingAriaLabel: "Noter {{stars}} étoile",
    // 👋 Welcome popup
    welcomeMessage: "👋 Je suis là pour vous aider",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "Tapez votre question ci-dessous pour commencer"
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
    support: "Support",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "Erzählen Sie mir über Versand und Lieferung",
    returnsPrompt: "Was ist Ihre Rückgaberichtlinie?",
    trackOrderPrompt: "Wie kann ich meine Bestellung verfolgen?",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "Zeigen Sie mir Ihre beliebten Produkte",
    newArrivalsPrompt: "Zeigen Sie mir Neuheiten",
    onSalePrompt: "Welche Produkte sind im Angebot?",
    recommendedPrompt: "Zeigen Sie mir Empfehlungen für mich",
    // ⭐ Rating prompts
    ratingTitle: "Wie war Ihre Erfahrung?",
    ratingFeedbackPlaceholder: "Zusätzliches Feedback (optional)",
    ratingSkip: "Überspringen",
    ratingThankYou: "Vielen Dank für Ihr Feedback!",
    ratingAriaLabel: "{{stars}} Stern bewerten",
    // 👋 Welcome popup
    welcomeMessage: "👋 Ich bin hier, um Ihnen zu helfen",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "Geben Sie Ihre Frage unten ein, um zu beginnen"
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
    support: "サポート",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "配送と配達について教えてください",
    returnsPrompt: "返品ポリシーは何ですか？",
    trackOrderPrompt: "注文を追跡するにはどうすればよいですか？",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "人気商品を見せてください",
    newArrivalsPrompt: "新着商品を見せてください",
    onSalePrompt: "セール中の商品は何ですか？",
    recommendedPrompt: "おすすめを見せてください",
    // ⭐ Rating prompts
    ratingTitle: "ご体験はいかがでしたか？",
    ratingFeedbackPlaceholder: "追加のフィードバック（任意）",
    ratingSkip: "スキップ",
    ratingThankYou: "フィードバックありがとうございます！",
    ratingAriaLabel: "{{stars}}つ星を評価",
    // 👋 Welcome popup
    welcomeMessage: "👋 お手伝いさせていただきます",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "下にご質問を入力してください"
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
    support: "Supporto",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "Parlami della spedizione e della consegna",
    returnsPrompt: "Qual è la vostra politica di reso?",
    trackOrderPrompt: "Come posso tracciare il mio ordine?",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "Mostrami i tuoi prodotti popolari",
    newArrivalsPrompt: "Mostrami le novità",
    onSalePrompt: "Quali prodotti sono in offerta?",
    recommendedPrompt: "Mostrami raccomandazioni per me",
    // ⭐ Rating prompts
    ratingTitle: "Come è stata la tua esperienza?",
    ratingFeedbackPlaceholder: "Feedback aggiuntivo (facoltativo)",
    ratingSkip: "Salta",
    ratingThankYou: "Grazie per il tuo feedback!",
    ratingAriaLabel: "Valuta {{stars}} stella",
    // 👋 Welcome popup
    welcomeMessage: "👋 Sono qui per aiutarti",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "Scrivi la tua domanda qui sotto per iniziare"
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
    support: "Suporte",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "Conte-me sobre envio e entrega",
    returnsPrompt: "Qual é a sua política de devolução?",
    trackOrderPrompt: "Como posso rastrear meu pedido?",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "Mostre-me seus produtos populares",
    newArrivalsPrompt: "Mostre-me novidades",
    onSalePrompt: "Quais produtos estão em promoção?",
    recommendedPrompt: "Mostre-me recomendações para mim",
    // ⭐ Rating prompts
    ratingTitle: "Como foi sua experiência?",
    ratingFeedbackPlaceholder: "Feedback adicional (opcional)",
    ratingSkip: "Pular",
    ratingThankYou: "Obrigado pelo seu feedback!",
    ratingAriaLabel: "Avaliar {{stars}} estrela",
    // 👋 Welcome popup
    welcomeMessage: "👋 Estou aqui para ajudar",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "Digite sua pergunta abaixo para começar"
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
    support: "支持",
    // 🌍 Button prompts for quick actions
    shippingPrompt: "告诉我关于配送和交付",
    returnsPrompt: "你们的退货政策是什么？",
    trackOrderPrompt: "我如何追踪我的订单？",
    // 🛍️ Discovery button prompts
    bestSellersPrompt: "给我看你们的热门产品",
    newArrivalsPrompt: "给我看新品上市",
    onSalePrompt: "哪些产品在促销？",
    recommendedPrompt: "给我看推荐产品",
    // ⭐ Rating prompts
    ratingTitle: "您的体验如何？",
    ratingFeedbackPlaceholder: "额外反馈（可选）",
    ratingSkip: "跳过",
    ratingThankYou: "感谢您的反馈！",
    ratingAriaLabel: "评价{{stars}}星",
    // 👋 Welcome popup
    welcomeMessage: "👋 我在这里帮助您",
    // 💬 Fallback message when all quick buttons are hidden
    typeYourQuestion: "在下方输入您的问题开始"
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
