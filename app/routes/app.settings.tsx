import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  ColorPicker,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Checkbox,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  position: "bottom-right",
  buttonText: "Ask AI Assistant",
  chatTitle: "AI Sales Assistant",
  welcomeMessage: "Hello! I'm your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?",
  inputPlaceholder: "Ask me anything about our products...",
  primaryColor: "#e620e6",
};

type SettingsType = typeof DEFAULT_SETTINGS & { shop?: string; id?: string; createdAt?: Date; updatedAt?: Date };

// Color conversion utility functions
function hexToHsb(hex: string) {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  
  // Convert RGB to HSB
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let hue = 0;
  if (diff !== 0) {
    if (max === r) {
      hue = ((g - b) / diff) % 6;
    } else if (max === g) {
      hue = (b - r) / diff + 2;
    } else {
      hue = (r - g) / diff + 4;
    }
  }
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  
  const saturation = max === 0 ? 0 : diff / max;
  const brightness = max;
  
  return {
    hue: isNaN(hue) ? 0 : hue,
    saturation: isNaN(saturation) ? 0 : saturation,
    brightness: isNaN(brightness) ? 0 : brightness
  };
}

function hsbToHex(hsb: { hue: number; saturation: number; brightness: number }) {
  const { hue, saturation, brightness } = hsb;
  
  const c = brightness * saturation;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = brightness - c;
  
  let r = 0, g = 0, b = 0;
  
  if (hue >= 0 && hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue >= 60 && hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue >= 120 && hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue >= 180 && hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue >= 240 && hue < 300) {
    r = x; g = 0; b = c;
  } else if (hue >= 300 && hue < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    // Ensure db is available
    if (!db) {
      throw new Error("Database connection not available");
    }
    
    // Fetch settings from database or create with defaults
    let settings = await db.widgetSettings.findUnique({
      where: { shop: session.shop }
    });
    
    if (!settings) {
      settings = await db.widgetSettings.create({
        data: {
          shop: session.shop,
          ...DEFAULT_SETTINGS
        }
      });
    }
    
    return json({ settings });
  } catch (error) {
    console.error("Database error in settings loader:", error);
    // Return default settings if database fails
    return json({ 
      settings: {
        shop: session.shop,
        ...DEFAULT_SETTINGS
      }
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const settingsData = {
    enabled: formData.get("enabled") === "true",
    position: formData.get("position") as string,
    buttonText: formData.get("buttonText") as string,
    chatTitle: formData.get("chatTitle") as string,
    welcomeMessage: formData.get("welcomeMessage") as string,
    inputPlaceholder: formData.get("inputPlaceholder") as string,
    primaryColor: formData.get("primaryColor") as string,
    // Handle webhookUrl properly - only include if it has a value
    ...(formData.get("webhookUrl") && { webhookUrl: formData.get("webhookUrl") as string }),
  };
  
  // Save settings to database
  const settings = await db.widgetSettings.upsert({
    where: { shop: session.shop },
    update: settingsData,
    create: {
      shop: session.shop,
      ...settingsData
    }
  });
  
  console.log("Saving settings:", settings);
  
  return json({ 
    success: true, 
    message: "Settings saved successfully!",
    settings 
  });
};

export default function SettingsPage() {
  const { settings: initialSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Show success banner when settings are saved
  useEffect(() => {
    if (actionData?.success) {
      setShowSuccessBanner(true);
    }
  }, [actionData]);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    const formData = new FormData();
    
    Object.entries(settings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    
    submit(formData, { method: "post" });
    setIsSaving(false);
  }, [settings, submit]);

  const positionOptions = [
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Top Right", value: "top-right" },
    { label: "Top Left", value: "top-left" },
    { label: "Center Right", value: "center-right" },
    { label: "Center Left", value: "center-left" },
  ];

  return (
    <Page
      title="AI Sales Assistant Settings"
      subtitle="Configure your AI-powered sales assistant widget"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        {showSuccessBanner && actionData?.success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Widget Configuration
              </Text>
              
              <FormLayout>
                <Checkbox
                  label="Enable AI Sales Assistant Widget"
                  checked={settings.enabled}
                  onChange={(checked) => 
                    setSettings((prev: SettingsType) => ({ ...prev, enabled: checked }))
                  }
                  helpText="Toggle the AI assistant widget on/off across your store"
                />

                <Select
                  label="Widget Position"
                  options={positionOptions}
                  value={settings.position}
                  onChange={(value) => 
                    setSettings((prev: SettingsType) => ({ ...prev, position: value }))
                  }
                  helpText="Choose where the widget appears on your store pages"
                />

                <TextField
                  label="Button Text"
                  value={settings.buttonText}
                  onChange={(value) => 
                    setSettings((prev: SettingsType) => ({ ...prev, buttonText: value }))
                  }
                  helpText="Text displayed on the chat button"
                  autoComplete="off"
                />

                <TextField
                  label="Chat Title"
                  value={settings.chatTitle}
                  onChange={(value) => 
                    setSettings((prev: SettingsType) => ({ ...prev, chatTitle: value }))
                  }
                  helpText="Title shown in the chat window header"
                  autoComplete="off"
                />

                <TextField
                  label="Welcome Message"
                  value={settings.welcomeMessage}
                  onChange={(value) => 
                    setSettings((prev: SettingsType) => ({ ...prev, welcomeMessage: value }))
                  }
                  multiline={4}
                  helpText="First message customers see when they open the chat"
                  autoComplete="off"
                />

                <TextField
                  label="Input Placeholder"
                  value={settings.inputPlaceholder}
                  onChange={(value) => 
                    setSettings((prev: SettingsType) => ({ ...prev, inputPlaceholder: value }))
                  }
                  helpText="Placeholder text in the message input field"
                  autoComplete="off"
                />

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    Primary Color
                  </Text>
                  <ColorPicker
                    color={hexToHsb(settings.primaryColor)}
                    onChange={(color) => {
                      const hex = hsbToHex(color);
                      setSettings((prev: any) => ({ ...prev, primaryColor: hex }));
                    }}
                  />
                  <Text variant="bodySm" as="p" tone="subdued">
                    Current color: {settings.primaryColor}
                  </Text>
                </BlockStack>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                AI Workflow Configuration
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Choose which AI workflow to use for processing customer messages. You can use the developer's default workflow or configure your own N8N workflow.
              </Text>
              
              <FormLayout>
                <Select
                  label="Workflow Type"
                  value={(() => {
                    const url = (settings as any).webhookUrl;
                    const isValidCustomUrl = url && 
                                           typeof url === 'string' && 
                                           url.trim() !== '' && 
                                           url !== 'https://' &&
                                           url.startsWith('https://') &&
                                           url.length > 8;
                    return isValidCustomUrl ? "custom" : "default";
                  })()}
                  options={[
                    { label: "Use Developer's Default Workflow", value: "default" },
                    { label: "Use My Custom N8N Workflow", value: "custom" }
                  ]}
                  onChange={(value) => {
                    if (value === "default") {
                      setSettings((prev: any) => ({ ...prev, webhookUrl: "" }));
                    } else {
                      setSettings((prev: any) => ({ ...prev, webhookUrl: "https://" }));
                    }
                  }}
                  helpText="Select whether to use the built-in AI workflow or your own custom setup"
                />
                
                <TextField
                  label="Custom N8N Webhook URL"
                  value={(settings as any).webhookUrl || ""}
                  onChange={(value) => 
                    setSettings((prev: any) => ({ ...prev, webhookUrl: value }))
                  }
                  placeholder="https://your-n8n-instance.com/webhook/your-workflow"
                  helpText={(() => {
                    const url = (settings as any).webhookUrl;
                    const isValidCustomUrl = url && 
                                           typeof url === 'string' && 
                                           url.trim() !== '' && 
                                           url !== 'https://' &&
                                           url.startsWith('https://') &&
                                           url.length > 8;
                    return isValidCustomUrl ? "Enter your N8N webhook URL. Must be HTTPS." : "Select 'Use My Custom N8N Workflow' above to enable this field.";
                  })()}
                  autoComplete="off"
                  type="url"
                  disabled={(() => {
                    const url = (settings as any).webhookUrl;
                    const isValidCustomUrl = url && 
                                           typeof url === 'string' && 
                                           url.trim() !== '' && 
                                           url !== 'https://' &&
                                           url.startsWith('https://') &&
                                           url.length > 8;
                    return !isValidCustomUrl && (!(settings as any).webhookUrl || (settings as any).webhookUrl === 'https://');
                  })()}
                />
                
                <Banner tone="info">
                  <Text variant="bodyMd" as="p">
                    <strong>Default Workflow:</strong> Uses the developer's pre-configured AI assistant with product recommendations and store context.
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Custom Workflow:</strong> Forward messages to your own N8N workflow for custom AI processing and responses.
                  </Text>
                </Banner>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Widget Preview
              </Text>
              
              <div style={{ 
                position: "relative", 
                height: "300px", 
                border: "2px dashed #e1e3e5", 
                borderRadius: "8px",
                background: "#f6f6f7"
              }}>
                <div style={{
                  position: "absolute",
                  ...(settings.position.includes("bottom") ? { bottom: "20px" } : { top: "20px" }),
                  ...(settings.position.includes("right") ? { right: "20px" } : { left: "20px" }),
                  ...(settings.position.includes("center") && { 
                    top: "50%", 
                    transform: "translateY(-50%)" 
                  }),
                }}>
                  <div style={{
                    background: settings.primaryColor,
                    color: "white",
                    padding: "12px 16px",
                    borderRadius: "25px",
                    fontSize: "14px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    opacity: settings.enabled ? 1 : 0.5,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {settings.buttonText}
                  </div>
                </div>
                
                                 <div style={{
                   position: "absolute",
                   top: "50%",
                   left: "50%",
                   transform: "translate(-50%, -50%)",
                   textAlign: "center",
                   color: "#6d7175"
                 }}>
                   <Text variant="bodyMd" as="p" tone="subdued">
                     Widget Preview
                   </Text>
                   <br />
                   <Text variant="bodySm" as="p" tone="subdued">
                     Position: {positionOptions.find(opt => opt.value === settings.position)?.label}
                   </Text>
                 </div>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Integration Instructions
              </Text>
              
              <Text variant="bodyMd" as="p">
                Your AI Sales Assistant is configured as an app embed. To activate it on your store:
              </Text>
              
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  1. Go to <strong>Online Store → Themes</strong>
                </Text>
                <Text variant="bodyMd" as="p">
                  2. Click <strong>Customize</strong> on your active theme
                </Text>
                <Text variant="bodyMd" as="p">
                  3. Scroll down to <strong>App embeds</strong> in the theme editor
                </Text>
                <Text variant="bodyMd" as="p">
                  4. Find <strong>AI Sales Assistant</strong> and toggle it ON
                </Text>
                <Text variant="bodyMd" as="p">
                  5. Save your theme changes
                </Text>
              </BlockStack>
              
              <Divider />
              
              <Text variant="bodyMd" as="p" tone="subdued">
                The widget will appear on all pages of your store once enabled in the theme editor.
                Settings configured here will automatically apply to the widget.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 