import { useState, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
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
  ChatIcon, 
  ProductIcon, 
  SendIcon,
  QuestionCircleIcon,
  RefreshIcon,
  DeleteIcon
} from '@shopify/polaris-icons';
import { authenticate } from "../shopify.server";
import { n8nService } from "../services/n8n.service";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ProductInfo {
  id: string;
  title: string;
  handle: string;
  price: string;
  image?: string;
  description?: string;
}

// Quick action suggestions
const quickActions = [
  "Show me your bestsellers",
  "What's on sale today?",
  "I need help with shipping",
  "Tell me about your return policy",
  "Recommend products for me",
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(`
    #graphql
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            description
            featuredImage {
              url
            }
            variants(first: 1) {
              edges {
                node {
                  price
                }
              }
            }
          }
        }
      }
    }
  `, {
    variables: { first: 50 }
  });

  const responseJson = await response.json();
  const responseData = responseJson.data as any;
  const products = responseData?.products?.edges?.map((edge: any) => ({
    id: edge.node.id,
    title: edge.node.title,
    handle: edge.node.handle,
    description: edge.node.description,
    image: edge.node.featuredImage?.url,
    price: edge.node.variants.edges[0]?.node.price || "0.00"
  })) || [];

  return json({ products });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const userMessage = formData.get("message") as string;
  
  if (!userMessage) {
    return json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const response = await admin.graphql(`
      #graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              description
              featuredImage {
                url
              }
              variants(first: 1) {
                edges {
                  node {
                    price
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: { first: 50 }
    });

    const responseJson = await response.json();
    const responseData = responseJson.data as any;
    const products = responseData?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node.price || "0.00"
    })) || [];

    const n8nResponse = await n8nService.processUserMessage({
      userMessage,
      products,
      context: {
        previousMessages: []
      }
    });
    
    return json({ 
      response: n8nResponse.message,
      recommendations: n8nResponse.recommendations || [],
      confidence: n8nResponse.confidence || 0.7
    });
  } catch (error) {
    console.error("Error processing message:", error);
    return json({ error: "Failed to process message" }, { status: 500 });
  }
};

export default function SalesAssistantAdvanced() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "👋 Hello! I'm your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. What can I help you with today?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [recommendations, setRecommendations] = useState<ProductInfo[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (fetcher.data && fetcher.data.response) {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: fetcher.data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      
      if (fetcher.data.recommendations) {
        setRecommendations(fetcher.data.recommendations);
      }
      setShowQuickActions(false);
    }
  }, [fetcher.data]);

  const handleSendMessage = (messageText?: string) => {
    const textToSend = messageText || inputMessage;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    fetcher.submit(
      { message: textToSend },
      { method: "POST" }
    );

    setInputMessage("");
    setShowQuickActions(false);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: "👋 Hello! I'm your AI sales assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ]);
    setRecommendations([]);
    setShowQuickActions(true);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Page>
      <TitleBar title="AI Sales Assistant" />
      <Layout>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Stats Card */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    💬 Chat Analytics
                  </Text>
                  <Badge tone="info">Live</Badge>
                </InlineStack>
                <Divider />
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '16px' 
                }}>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px',
                    backgroundColor: '#f6f6f7',
                    borderRadius: '8px'
                  }}>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {messages.filter(m => m.role === 'user').length}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Your Messages
                    </Text>
                  </div>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px',
                    backgroundColor: '#f6f6f7',
                    borderRadius: '8px'
                  }}>
                    <Text variant="heading2xl" as="p" fontWeight="bold">
                      {recommendations.length}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Products Found
                    </Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            {/* Product Recommendations */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={ProductIcon} tone="base" />
                    <Text variant="headingMd" as="h2">
                      Smart Recommendations
                    </Text>
                  </InlineStack>
                  {recommendations.length > 0 && (
                    <Badge tone="success">{recommendations.length}</Badge>
                  )}
                </InlineStack>
                <Divider />
                
                {recommendations.length > 0 ? (
                  <BlockStack gap="300">
                    {recommendations.slice(0, 3).map((product) => (
                      <Card key={product.id} background="bg-surface-secondary">
                        <BlockStack gap="300">
                          <InlineStack gap="300" wrap={false} blockAlign="start">
                            {product.image ? (
                              <div style={{ 
                                width: '70px', 
                                height: '70px', 
                                borderRadius: '12px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                border: '1px solid #e1e3e5'
                              }}>
                                <img 
                                  src={product.image} 
                                  alt={product.title}
                                  style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'cover' 
                                  }}
                                />
                              </div>
                            ) : (
                              <div style={{ 
                                width: '70px', 
                                height: '70px', 
                                borderRadius: '12px',
                                backgroundColor: '#f6f6f7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: '1px solid #e1e3e5'
                              }}>
                                <Icon source={ProductIcon} tone="base" />
                              </div>
                            )}
                            <BlockStack gap="200">
                              <Text variant="headingSm" as="h3" fontWeight="semibold">
                                {product.title}
                              </Text>
                              <Badge tone="success">
                                ${parseFloat(product.price).toFixed(2)}
                              </Badge>
                            </BlockStack>
                          </InlineStack>
                          
                          {product.description && (
                            <Text variant="bodySm" as="p" tone="subdued">
                              {product.description.substring(0, 60)}
                              {product.description.length > 60 && '...'}
                            </Text>
                          )}
                          
                          <ButtonGroup>
                            <Button size="slim" fullWidth>
                              View Details
                            </Button>
                          </ButtonGroup>
                        </BlockStack>
                      </Card>
                    ))}
                    {recommendations.length > 3 && (
                      <Button fullWidth variant="plain">
                        View all {recommendations.length} products
                      </Button>
                    )}
                  </BlockStack>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    <EmptyState
                      heading=""
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
                        Ask me about products to see recommendations here
                      </Text>
                    </EmptyState>
                  </div>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="twoThirds">
          <Card padding="0">
            {/* Header */}
            <div style={{ 
              padding: '20px',
              borderBottom: '1px solid #e1e3e5',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Avatar customer name="AI Assistant" />
                  <BlockStack gap="50">
                    <Text variant="headingMd" as="h2" tone="text-inverse">
                      AI Sales Assistant
                    </Text>
                    <InlineStack gap="100" blockAlign="center">
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#47c97e',
                        boxShadow: '0 0 8px rgba(71, 201, 126, 0.6)'
                      }} />
                      <Text variant="bodySm" as="p" tone="text-inverse">
                        Always Online
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>
                
                <ButtonGroup>
                  <Tooltip content="New conversation">
                    <Button 
                      icon={RefreshIcon} 
                      onClick={handleClearChat}
                      variant="tertiary"
                    />
                  </Tooltip>
                  <Tooltip content="Help">
                    <Button 
                      icon={QuestionCircleIcon}
                      variant="tertiary"
                    />
                  </Tooltip>
                </ButtonGroup>
              </InlineStack>
            </div>

            {/* Messages */}
            <div style={{ 
              height: "520px", 
              overflowY: "auto", 
              padding: "24px",
              backgroundColor: "#fafbfb"
            }}>
              <BlockStack gap="400">
                {messages.map((message) => (
                  <div key={message.id}>
                    <InlineStack 
                      gap="300" 
                      align={message.role === "user" ? "end" : "start"}
                      blockAlign="start"
                    >
                      {message.role === "assistant" && (
                        <div style={{ flexShrink: 0 }}>
                          <Avatar customer name="AI" size="sm" />
                        </div>
                      )}
                      
                      <BlockStack gap="100" align={message.role === "user" ? "end" : "start"}>
                        <div style={{ 
                          maxWidth: "80%", 
                          padding: "14px 18px", 
                          borderRadius: message.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                          background: message.role === "user" 
                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                            : "#ffffff",
                          color: message.role === "user" ? "white" : "black",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          border: message.role === "assistant" ? "1px solid #e1e3e5" : "none"
                        }}>
                          <Text variant="bodyMd" as="p">
                            {message.content}
                          </Text>
                        </div>
                        <Text variant="bodySm" as="p" tone="subdued">
                          {formatTime(message.timestamp)}
                        </Text>
                      </BlockStack>
                      
                      {message.role === "user" && (
                        <div style={{ flexShrink: 0 }}>
                          <Avatar customer name="You" size="sm" />
                        </div>
                      )}
                    </InlineStack>
                  </div>
                ))}
                
                {fetcher.state === "submitting" && (
                  <InlineStack gap="300" blockAlign="start">
                    <div style={{ flexShrink: 0 }}>
                      <Avatar customer name="AI" size="sm" />
                    </div>
                    <div style={{ 
                      padding: "14px 18px", 
                      borderRadius: "20px 20px 20px 4px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      border: "1px solid #e1e3e5"
                    }}>
                      <InlineStack gap="100">
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <div key={i} style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#667eea',
                            animation: `typing 1.4s infinite ${delay}s`
                          }} />
                        ))}
                      </InlineStack>
                    </div>
                  </InlineStack>
                )}
                
                {/* Quick Actions */}
                {showQuickActions && messages.length === 1 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                      💡 Try asking:
                    </Text>
                    <div style={{ 
                      marginTop: '12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      justifyContent: 'center'
                    }}>
                      {quickActions.map((action, index) => (
                        <Button
                          key={index}
                          size="slim"
                          onClick={() => handleSendMessage(action)}
                          variant="plain"
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </BlockStack>
            </div>

            {/* Input */}
            <div style={{ 
              padding: '20px',
              borderTop: '1px solid #e1e3e5',
              backgroundColor: '#ffffff'
            }}>
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    value={inputMessage}
                    onChange={setInputMessage}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message... (Press Enter to send)"
                    autoComplete="off"
                    multiline={2}
                  />
                </div>
                <Button 
                  variant="primary"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || fetcher.state === "submitting"}
                  size="large"
                  icon={SendIcon}
                >
                  Send
                </Button>
              </InlineStack>
            </div>
          </Card>
        </Layout.Section>
      </Layout>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
      `}</style>
    </Page>
  );
}