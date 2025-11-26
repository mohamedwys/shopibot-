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
  Avatar,
  Divider,
  Badge,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  productRecommendations?: ProductRecommendation[];
}

interface ProductRecommendation {
  id: string;
  title: string;
  handle: string;
  price: string;
  image?: string;
  description?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Fetch products for recommendations
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

  const products = (response.data as any)?.products?.edges?.map((edge: any) => ({
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
    // Here we'll integrate with N8N workflow
    // For now, we'll create a simple response system
    const response = await processUserMessage(userMessage, admin);
    
    return json({ 
      response: response.message,
      recommendations: response.recommendations 
    });
  } catch (error) {
    console.error("Error processing message:", error);
    return json({ error: "Failed to process message" }, { status: 500 });
  }
};

async function processUserMessage(message: string, admin: any) {
  // This is where we'll integrate with N8N
  // For now, let's create a simple product recommendation system
  
  const lowerMessage = message.toLowerCase();
  let recommendations: ProductRecommendation[] = [];
  let responseMessage = "";

  // Simple keyword matching for demonstration
  if (lowerMessage.includes("recommend") || lowerMessage.includes("suggest")) {
    // Fetch some products
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
      variables: { first: 3 }
    });

    recommendations = (response.data as any)?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node.price || "0.00"
    })) || [];

    responseMessage = "Here are some products I'd recommend based on your request:";
  } else if (lowerMessage.includes("price") || lowerMessage.includes("cost")) {
    responseMessage = "I can help you find products within your budget. What price range are you looking for?";
  } else if (lowerMessage.includes("shipping") || lowerMessage.includes("delivery")) {
    responseMessage = "Let me check the shipping options for you. Most of our products offer free shipping on orders over $50.";
  } else {
    responseMessage = "I'm here to help you find the perfect products! You can ask me about product recommendations, pricing, shipping, or any other questions about our store.";
  }

  return {
    message: responseMessage,
    recommendations
  };
}

export default function SalesAssistant() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (fetcher.data && !(fetcher.data as any).error) {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: (fetcher.data as any).response,
        timestamp: new Date(),
        productRecommendations: (fetcher.data as any).recommendations,
      };
      setMessages(prev => [...prev, newMessage]);
    }
  }, [fetcher.data]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    fetcher.submit(
      { message: inputMessage },
      { method: "POST" }
    );

    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Page>
      <TitleBar title="AI Sales Assistant" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Chat with your AI Sales Representative
              </Text>
              
              <div style={{ height: "500px", overflowY: "auto", border: "1px solid #e1e3e5", borderRadius: "8px", padding: "16px" }}>
                <BlockStack gap="300">
                  {messages.map((message) => (
                    <div key={message.id}>
                      <InlineStack align={message.role === "user" ? "end" : "start"}>
                        <div style={{ 
                          maxWidth: "70%", 
                          padding: "12px", 
                          borderRadius: "8px",
                          backgroundColor: message.role === "user" ? "#006fbb" : "#f6f6f7",
                          color: message.role === "user" ? "white" : "black"
                        }}>
                          <InlineStack gap="200" align="start">
                            <Avatar 
                              size="extraSmall" 
                              name={message.role === "user" ? "User" : "Assistant"}
                              initials={message.role === "user" ? "U" : "AI"}
                            />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" as="p">{message.content}</Text>
                              {message.productRecommendations && message.productRecommendations.length > 0 && (
                                <BlockStack gap="200">
                                  {message.productRecommendations.map((product) => (
                                    <Card key={product.id} padding="200">
                                      <InlineStack gap="300" align="start">
                                        {product.image && (
                                          <img 
                                            src={product.image} 
                                            alt={product.title}
                                            style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "4px" }}
                                          />
                                        )}
                                        <BlockStack gap="100">
                                          <Text variant="headingSm">{product.title}</Text>
                                          <Badge tone="success">${product.price}</Badge>
                                          {product.description && (
                                            <Text variant="bodySm" color="subdued">
                                              {product.description.substring(0, 100)}...
                                            </Text>
                                          )}
                                        </BlockStack>
                                      </InlineStack>
                                    </Card>
                                  ))}
                                </BlockStack>
                              )}
                            </BlockStack>
                          </InlineStack>
                        </div>
                      </InlineStack>
                    </div>
                  ))}
                  {fetcher.state === "submitting" && (
                    <InlineStack align="start">
                      <div style={{ 
                        padding: "12px", 
                        borderRadius: "8px",
                        backgroundColor: "#f6f6f7"
                      }}>
                        <InlineStack gap="200">
                          <Avatar size="small" name="Assistant" initials="AI" />
                          <Text variant="bodyMd">Thinking...</Text>
                        </InlineStack>
                      </div>
                    </InlineStack>
                  )}
                  <div ref={messagesEndRef} />
                </BlockStack>
              </div>

              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    value={inputMessage}
                    onChange={setInputMessage}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me about products, pricing, shipping, or anything else..."
                    autoComplete="off"
                    multiline={2}
                  />
                </div>
                <Button 
                  primary 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || fetcher.state === "submitting"}
                >
                  Send
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 