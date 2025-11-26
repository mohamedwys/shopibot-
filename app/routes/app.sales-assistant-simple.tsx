import { useState, useEffect } from "react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { n8nService } from "../services/n8n.service";

interface Message {
  id: string;
  role: "user" | "assistant";
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

  const responseData = response.data as any;
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
    // Get products for context
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

    const responseData = response.data as any;
    const products = responseData?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      image: edge.node.featuredImage?.url,
      price: edge.node.variants.edges[0]?.node.price || "0.00"
    })) || [];

    // Process message through N8N service
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

export default function SalesAssistantSimple() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [recommendations, setRecommendations] = useState<ProductInfo[]>([]);

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

  return (
    <Page>
      <TitleBar title="AI Sales Assistant" />
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Product Recommendations
              </Text>
              {recommendations.length > 0 ? (
                <BlockStack gap="300">
                  {recommendations.map((product) => (
                    <Card key={product.id} padding="300">
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h3">{product.title}</Text>
                        <Badge tone="success">${product.price}</Badge>
                        {product.description && (
                          <Text variant="bodySm" as="p" color="subdued">
                            {product.description.substring(0, 100)}...
                          </Text>
                        )}
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>
              ) : (
                <Text variant="bodyMd" as="p" color="subdued">
                  Ask me for product recommendations to see suggestions here.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="twoThirds">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Chat with AI Sales Representative
              </Text>
              
              <div style={{ 
                height: "400px", 
                overflowY: "auto", 
                border: "1px solid #e1e3e5", 
                borderRadius: "8px", 
                padding: "16px",
                backgroundColor: "#fafbfb"
              }}>
                <BlockStack gap="300">
                  {messages.map((message) => (
                    <div key={message.id} style={{
                      display: "flex",
                      justifyContent: message.role === "user" ? "flex-end" : "flex-start"
                    }}>
                      <div style={{ 
                        maxWidth: "70%", 
                        padding: "12px", 
                        borderRadius: "8px",
                        backgroundColor: message.role === "user" ? "#006fbb" : "#ffffff",
                        color: message.role === "user" ? "white" : "black",
                        border: message.role === "assistant" ? "1px solid #e1e3e5" : "none"
                      }}>
                        <Text variant="bodyMd" as="p">
                          {message.content}
                        </Text>
                      </div>
                    </div>
                  ))}
                  {fetcher.state === "submitting" && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ 
                        padding: "12px", 
                        borderRadius: "8px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e1e3e5"
                      }}>
                        <Text variant="bodyMd" as="p">
                          Thinking...
                        </Text>
                      </div>
                    </div>
                  )}
                </BlockStack>
              </div>

              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label=""
                    value={inputMessage}
                    onChange={setInputMessage}
                    placeholder="Ask me about products, pricing, shipping, or anything else..."
                    autoComplete="off"
                  />
                </div>
                <Button 
                  variant="primary"
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