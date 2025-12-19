import { useState, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Avatar,
  Divider,
  Icon,
  EmptyState,
  ButtonGroup,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  ProductIcon, 
  SendIcon,
  QuestionCircleIcon,
  RefreshIcon
} from '@shopify/polaris-icons';
import { authenticate } from "../shopify.server";
import { n8nService } from "../services/n8n.service.server";

// ✅ FIXED: Added productRecommendations back to Message interface
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  productRecommendations?: ProductInfo[];  // ✅ This was missing!
}

interface ProductInfo {
  id: string;
  title: string;
  handle: string;
  price: string;
  image?: string;
  description?: string;
}

type Intent = 
  | { type: "PRODUCT_SEARCH"; query: string }
  | { type: "GENERAL_CHAT" };

function detectIntent(message: string): Intent {
  const lower = message.toLowerCase().trim();

  if (
    /(?:montre|affiche|voir|recommande|t-shirt|tshirt|chaussure|vêtement|produit|collection|best[-\s]?seller|meilleur|nouveau)/.test(lower)
  ) {
    if (/(t[-\s]?shirt)/.test(lower)) return { type: "PRODUCT_SEARCH", query: "t-shirt" };
    if (/chaussure|shoe|basket/.test(lower)) return { type: "PRODUCT_SEARCH", query: "shoe" };
    if (/best[-\s]?seller|bestsell|meilleur/.test(lower)) return { type: "PRODUCT_SEARCH", query: "bestseller" };
    if (/nouveau|new/.test(lower)) return { type: "PRODUCT_SEARCH", query: "new" };
    return { type: "PRODUCT_SEARCH", query: "product" };
  }

  if (
    /(show|see|display|recommend|suggest|best[-\s]?seller|on sale|product|item)/.test(lower)
  ) {
    if (/t[-\s]?shirt/.test(lower)) return { type: "PRODUCT_SEARCH", query: "t-shirt" };
    if (/shoe|sneaker|boot/.test(lower)) return { type: "PRODUCT_SEARCH", query: "shoe" };
    if (/best[-\s]?seller/.test(lower)) return { type: "PRODUCT_SEARCH", query: "bestseller" };
    if (/new|latest/.test(lower)) return { type: "PRODUCT_SEARCH", query: "new" };
    return { type: "PRODUCT_SEARCH", query: "product" };
  }

  return { type: "GENERAL_CHAT" };
}

const quickActions = [
  "Show me your bestsellers",
  "What's on sale today?",
  "I need help with shipping",
  "Tell me about your return policy",
  "Recommend products for me",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const userMessage = formData.get("message");

  if (typeof userMessage !== "string" || !userMessage.trim()) {
    return json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const intent = detectIntent(userMessage);
    console.log("🔍 Detected intent:", intent);

    if (intent.type === "PRODUCT_SEARCH") {
      const variables: { first: number; query?: string } = { first: 8 };
      if (intent.query === "bestseller") {
        variables.query = "tag:bestseller";
      } else if (intent.query === "t-shirt") {
        variables.query = "product_type:t-shirt";
      } else if (intent.query === "shoe") {
        variables.query = "product_type:shoe";
      } else if (intent.query === "new") {
        variables.query = "created_at:>now-30d";
      }

      console.log("📦 Fetching products with variables:", variables);

      const response = await admin.graphql(`
        query getProductsByIntent($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                description
                featuredImage { url }
                variants(first: 1) {
                  edges { node { price } }
                }
              }
            }
          }
        }
      `, { variables });

      const responseJson = await response.json();
      console.log("📤 Shopify GraphQL response:", JSON.stringify(responseJson, null, 2));

      const edges = responseJson?.data?.products?.edges || [];
      console.log("📊 Number of product edges returned:", edges.length);

      const products: ProductInfo[] = edges.map((edge: any) => {
        const node = edge?.node;
        if (!node) return null;
        const price = node.variants?.edges?.[0]?.node?.price || "0.00";
        return {
          id: node.id || "",
          title: node.title || "Untitled",
          handle: node.handle || "",
          description: node.description || "",
          image: node.featuredImage?.url,
          price: typeof price === "string" ? price : "0.00"
        };
      }).filter(Boolean) as ProductInfo[];

      console.log("✅ Final parsed products:", products.length);

      const messages: Record<string, string> = {
        "t-shirt": "👕 Voici nos t-shirts disponibles :",
        "shoe": "👟 Voici nos chaussures du moment :",
        "bestseller": "⭐ Découvrez nos best-sellers :",
        "new": "✨ Découvrez nos nouveautés :",
        "product": "📦 Voici quelques produits que vous pourriez aimer :"
      };

      const responseText = messages[intent.query] || messages["product"];

      console.log("💬 Assistant response:", responseText);
      console.log("🛒 Recommendations count:", products.length);

      return json({ 
        response: responseText,
        recommendations: products,
        confidence: 1.0
      });
    }

    // General chat — no products
    const n8nResponse = await n8nService.processUserMessage({
      userMessage,
      products: [],
      context: { previousMessages: [] }
    });

    const fallbackMessage = String(n8nResponse.message || "Désolé, je n'ai pas compris.");
    console.log("🤖 AI response (non-product):", fallbackMessage);

    return json({ 
      response: fallbackMessage,
      recommendations: [],
      confidence: typeof n8nResponse.confidence === "number" ? n8nResponse.confidence : 0.7
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("💥 Error in action:", errorMessage);
    logger.error(`Error in sales assistant action: ${errorMessage}`);

    return json({ 
      response: "Désolé, une erreur est survenue. Veuillez réessayer.",
      recommendations: [],
      confidence: 0
    }, { status: 500 });
  }
};

export default function SalesAssistantAdvanced() {
  useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "👋 Bonjour ! Je suis votre assistant commercial IA. Comment puis-je vous aider aujourd'hui ?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [recommendations, setRecommendations] = useState<ProductInfo[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ✅ FIXED: Now attaches products to the message object
  useEffect(() => {
    if (fetcher.data && 'response' in fetcher.data) {
      const products = Array.isArray(fetcher.data.recommendations) ? fetcher.data.recommendations : [];
      
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: String(fetcher.data.response || "Une erreur est survenue."),
        timestamp: new Date(),
        productRecommendations: products  // ✅ Products attached to message!
      };
      
      setMessages(prev => [...prev, newMessage]);
      setRecommendations(products); // Also update sidebar
      setShowQuickActions(false);
    }
  }, [fetcher.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputMessage.trim();
    if (!textToSend) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    fetcher.submit({ message: textToSend }, { method: "POST" });
    setInputMessage("");
    setShowQuickActions(false);
    formRef.current?.reset();
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: "👋 Bonjour ! Je suis votre assistant commercial IA. Comment puis-je vous aider aujourd'hui ?",
        timestamp: new Date(),
      },
    ]);
    setRecommendations([]);
    setShowQuickActions(true);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Page>
      <TitleBar title="Assistant Commercial IA" />
      <Layout>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">💬 Analytique du Chat</Text>
                  <Badge tone="info">En direct</Badge>
                </InlineStack>
                <Divider />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
                    <Text variant="heading2xl" as="p" fontWeight="bold">{messages.filter(m => m.role === 'user').length}</Text>
                    <Text variant="bodySm" as="p" tone="subdued">Vos messages</Text>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
                    <Text variant="heading2xl" as="p" fontWeight="bold">{recommendations.length}</Text>
                    <Text variant="bodySm" as="p" tone="subdued">Produits trouvés</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={ProductIcon} tone="base" />
                    <Text variant="headingMd" as="h2">Recommandations Intelligentes</Text>
                  </InlineStack>
                  {recommendations.length > 0 && <Badge tone="success">{`${recommendations.length}`}</Badge>}
                </InlineStack>
                <Divider />
                {recommendations.length > 0 ? (
                  <BlockStack gap="300">
                    {recommendations.slice(0, 3).map((product) => (
                      <Card key={product.id} background="bg-surface-secondary">
                        <BlockStack gap="300">
                          <InlineStack gap="300" wrap={false} blockAlign="start">
                            {product.image ? (
                              <div style={{ width: '70px', height: '70px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '1px solid #e1e3e5' }}>
                                <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ) : (
                              <div style={{ width: '70px', height: '70px', borderRadius: '12px', backgroundColor: '#f6f6f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e1e3e5' }}>
                                <Icon source={ProductIcon} tone="base" />
                              </div>
                            )}
                            <BlockStack gap="200">
                              <Text variant="headingSm" as="h3" fontWeight="semibold">{product.title}</Text>
                              <Badge tone="success">{`$${parseFloat(product.price).toFixed(2)}`}</Badge>
                            </BlockStack>
                          </InlineStack>
                          {product.description && (
                            <Text variant="bodySm" as="p" tone="subdued">
                              {product.description.substring(0, 60)}{product.description.length > 60 && '...'}
                            </Text>
                          )}
                          <ButtonGroup>
                            <Button size="slim" fullWidth>Voir les détails</Button>
                          </ButtonGroup>
                        </BlockStack>
                      </Card>
                    ))}
                    {recommendations.length > 3 && (
                      <Button fullWidth variant="plain">{`Voir les ${recommendations.length} produits`}</Button>
                    )}
                  </BlockStack>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    <EmptyState heading="" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
                      <Text variant="bodyMd" as="p" tone="subdued" alignment="center">Posez-moi une question sur vos produits pour voir des recommandations ici</Text>
                    </EmptyState>
                  </div>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="fullWidth">
          <Card padding="0">
            <div style={{ padding: '20px', borderBottom: '1px solid #e1e3e5', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Avatar customer name="Assistant IA" />
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2" tone="text-inverse">Assistant Commercial IA</Text>
                    <InlineStack gap="100" blockAlign="center">
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#47c97e', boxShadow: '0 0 8px rgba(71, 201, 126, 0.6)' }} />
                      <Text variant="bodySm" as="p" tone="text-inverse">Toujours en ligne</Text>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>
                <ButtonGroup>
                  <Tooltip content="Nouvelle conversation">
                    <Button icon={RefreshIcon} onClick={handleClearChat} variant="tertiary" />
                  </Tooltip>
                  <Tooltip content="Aide">
                    <Button icon={QuestionCircleIcon} variant="tertiary" />
                  </Tooltip>
                </ButtonGroup>
              </InlineStack>
            </div>

            <div style={{ height: "520px", overflowY: "auto", padding: "24px", backgroundColor: "#fafbfb" }}>
              <BlockStack gap="400">
                {messages.map((message) => (
                  <div key={message.id}>
                    <InlineStack gap="300" align={message.role === "user" ? "end" : "start"} blockAlign="start">
                      {message.role === "assistant" && <div style={{ flexShrink: 0 }}><Avatar customer name="IA" size="sm" /></div>}
                      <BlockStack gap="100" align={message.role === "user" ? "end" : "start"}>
                        <div style={{ maxWidth: "80%", padding: "14px 18px", borderRadius: message.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px", background: message.role === "user" ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#ffffff", color: message.role === "user" ? "white" : "black", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: message.role === "assistant" ? "1px solid #e1e3e5" : "none" }}>
                          <Text variant="bodyMd" as="p">{message.content}</Text>
                          
                          {/* ✅ FIXED: Now renders products inside chat messages! */}
                          {message.productRecommendations && message.productRecommendations.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                              <BlockStack gap="200">
                                {message.productRecommendations.map((product) => (
                                  <Card key={product.id} padding="300">
                                    <InlineStack gap="300" align="start" wrap={false}>
                                      {product.image ? (
                                        <img 
                                          src={product.image} 
                                          alt={product.title}
                                          style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }}
                                        />
                                      ) : (
                                        <div style={{ width: "80px", height: "80px", backgroundColor: "#f6f6f7", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                          <Icon source={ProductIcon} tone="base" />
                                        </div>
                                      )}
                                      <BlockStack gap="200">
                                        <Text variant="headingSm" fontWeight="semibold">{product.title}</Text>
                                        <Badge tone="success">${parseFloat(product.price).toFixed(2)}</Badge>
                                        {product.description && (
                                          <Text variant="bodySm" tone="subdued">
                                            {product.description.substring(0, 100)}...
                                          </Text>
                                        )}
                                      </BlockStack>
                                    </InlineStack>
                                  </Card>
                                ))}
                              </BlockStack>
                            </div>
                          )}
                        </div>
                        <Text variant="bodySm" as="p" tone="subdued">{formatTime(message.timestamp)}</Text>
                      </BlockStack>
                      {message.role === "user" && <div style={{ flexShrink: 0 }}><Avatar customer name="Vous" size="sm" /></div>}
                    </InlineStack>
                  </div>
                ))}

                {fetcher.state === "submitting" && (
                  <InlineStack gap="300" blockAlign="start">
                    <div style={{ flexShrink: 0 }}><Avatar customer name="IA" size="sm" /></div>
                    <div style={{ padding: "14px 18px", borderRadius: "20px 20px 20px 4px", backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e1e3e5" }}>
                      <InlineStack gap="100">
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#667eea', animation: `typing 1.4s infinite ${delay}s` }} />
                        ))}
                      </InlineStack>
                    </div>
                  </InlineStack>
                )}

                {showQuickActions && messages.length === 1 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text variant="bodySm" as="p" tone="subdued" alignment="center">💡 Essayez de demander :</Text>
                    <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                      {quickActions.map((action, index) => (
                        <Button key={index} size="slim" onClick={() => {
                          setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: action, timestamp: new Date() }]);
                          fetcher.submit({ message: action }, { method: "POST" });
                          setShowQuickActions(false);
                        }} variant="plain">{action}</Button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </BlockStack>
            </div>

            <form onSubmit={handleSubmit} ref={formRef} style={{ padding: '20px', borderTop: '1px solid #e1e3e5', backgroundColor: '#ffffff' }}>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    value={inputMessage}
                    onChange={setInputMessage}
                    placeholder="Tapez votre message..."
                    autoComplete="off"
                    multiline={2}
                  />
                </div>
                <Button 
                  variant="primary"
                  type="submit"
                  disabled={!inputMessage.trim() || fetcher.state === "submitting"}
                  size="large"
                  icon={SendIcon}
                >
                  Envoyer
                </Button>
              </InlineStack>
            </form>
          </Card>
        </Layout.Section>
      </Layout>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </Page>
  );
}