import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useTranslation } from "react-i18next";
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
import { i18n } from "../i18n.server";
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
  const t = await i18n.getFixedT(request, "settings");
  
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

  // Handle webhookUrl explicitly - allow empty string to clear it
  const webhookUrl = formData.get("webhookUrl") as string | null;
  const normalizedWebhookUrl = webhookUrl?.trim() || null;

  const settingsData = {
    enabled: formData.get("enabled") === "true",
    position: formData.get("position") as string,
    buttonText: formData.get("buttonText") as string,
    chatTitle: formData.get("chatTitle") as string,
    welcomeMessage: formData.get("welcomeMessage") as string,
    inputPlaceholder: formData.get("inputPlaceholder") as string,
    primaryColor: formData.get("primaryColor") as string,
    webhookUrl: normalizedWebhookUrl, // Always include, null clears it
  };

  try {
    console.log('💾 Saving settings for shop:', session.shop);
    console.log('🔧 Webhook URL being saved:', normalizedWebhookUrl || '[CLEARED/DEFAULT]');

    // Save settings to database
    const settings = await db.widgetSettings.upsert({
      where: { shop: session.shop },
      update: settingsData,
      create: {
        shop: session.shop,
        ...settingsData
      }
    });

    console.log("✅ Settings saved to database successfully");
    console.log("🔧 Final webhookUrl in database:", settings.webhookUrl || '[NULL/DEFAULT]');

    return json({
      success: true,
      message: "Settings saved successfully!",
      settings
    });
  } catch (error) {
    console.error("❌ Database save error:", error);
    // Return error to user instead of silent fallback
    return json({
      success: false,
      message: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      settings: {
        shop: session.shop,
        ...settingsData
      }
    }, { status: 500 });
  }
};

export default function SettingsPage() {
  const { settings: initialSettings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const { t } = useTranslation("settings");

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
    { label: t("settings.widgetConfiguration.positions.bottomRight"), value: "bottom-right" },
    { label: t("settings.widgetConfiguration.positions.bottomLeft"), value: "bottom-left" },
    { label: t("settings.widgetConfiguration.positions.topRight"), value: "top-right" },
    { label: t("settings.widgetConfiguration.positions.topLeft"), value: "top-left" },
    { label: t("settings.widgetConfiguration.positions.centerRight"), value: "center-right" },
    { label: t("settings.widgetConfiguration.positions.centerLeft"), value: "center-left" },
  ];

  return (
    <Page
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      primaryAction={{
        content: t("settings.saveSettings"),
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
                {t("settings.widgetConfiguration.title")}
              </Text>

              <FormLayout>
                <Checkbox
                  label={t("settings.widgetConfiguration.enableWidget")}
                  checked={settings.enabled}
                  onChange={(checked) =>
                    setSettings((prev: SettingsType) => ({ ...prev, enabled: checked }))
                  }
                  helpText={t("settings.widgetConfiguration.enableWidgetHelp")}
                />

                <Select
                  label={t("settings.widgetConfiguration.widgetPosition")}
                  options={positionOptions}
                  value={settings.position}
                  onChange={(value) =>
                    setSettings((prev: SettingsType) => ({ ...prev, position: value }))
                  }
                  helpText={t("settings.widgetConfiguration.widgetPositionHelp")}
                />

                <TextField
                  label={t("settings.widgetConfiguration.buttonText")}
                  value={settings.buttonText}
                  onChange={(value) =>
                    setSettings((prev: SettingsType) => ({ ...prev, buttonText: value }))
                  }
                  helpText={t("settings.widgetConfiguration.buttonTextHelp")}
                  autoComplete="off"
                />

                <TextField
                  label={t("settings.widgetConfiguration.chatTitle")}
                  value={settings.chatTitle}
                  onChange={(value) =>
                    setSettings((prev: SettingsType) => ({ ...prev, chatTitle: value }))
                  }
                  helpText={t("settings.widgetConfiguration.chatTitleHelp")}
                  autoComplete="off"
                />

                <TextField
                  label={t("settings.widgetConfiguration.welcomeMessage")}
                  value={settings.welcomeMessage}
                  onChange={(value) =>
                    setSettings((prev: SettingsType) => ({ ...prev, welcomeMessage: value }))
                  }
                  multiline={4}
                  helpText={t("settings.widgetConfiguration.welcomeMessageHelp")}
                  autoComplete="off"
                />

                <TextField
                  label={t("settings.widgetConfiguration.inputPlaceholder")}
                  value={settings.inputPlaceholder}
                  onChange={(value) =>
                    setSettings((prev: SettingsType) => ({ ...prev, inputPlaceholder: value }))
                  }
                  helpText={t("settings.widgetConfiguration.inputPlaceholderHelp")}
                  autoComplete="off"
                />

                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    {t("settings.widgetConfiguration.primaryColor")}
                  </Text>
                  <ColorPicker
                    color={hexToHsb(settings.primaryColor)}
                    onChange={(color) => {
                      const hex = hsbToHex(color);
                      setSettings((prev: any) => ({ ...prev, primaryColor: hex }));
                    }}
                  />
                  <Text variant="bodySm" as="p" tone="subdued">
                    {t("settings.widgetConfiguration.currentColor", { color: settings.primaryColor })}
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
                {t("settings.aiWorkflow.title")}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("settings.aiWorkflow.subtitle")}
              </Text>
              
              <FormLayout>
                <Select
                  label={t("settings.aiWorkflow.workflowType")}
                  value={(() => {
                    const url = (settings as any).webhookUrl;
                    // Check if webhook URL is valid for custom workflow
                    const isValidCustomUrl = url &&
                                           typeof url === 'string' &&
                                           url.trim() !== '' &&
                                           url !== 'https://' &&
                                           url !== 'null' &&
                                           url !== 'undefined' &&
                                           url.startsWith('https://') &&
                                           url.length > 8;
                    return isValidCustomUrl ? "custom" : "default";
                  })()}
                  options={[
                    { label: t("settings.aiWorkflow.types.default"), value: "default" },
                    { label: t("settings.aiWorkflow.types.custom"), value: "custom" }
                  ]}
                  onChange={(value) => {
                    if (value === "default") {
                      // Clear webhook URL to use developer default workflow
                      setSettings((prev: any) => ({ ...prev, webhookUrl: "" }));
                    } else {
                      // Custom mode: only set placeholder if URL is empty
                      setSettings((prev: any) => {
                        const currentUrl = prev.webhookUrl || "";
                        // Keep existing URL, or set placeholder if empty
                        return { ...prev, webhookUrl: currentUrl || "https://" };
                      });
                    }
                  }}
                  helpText={t("settings.aiWorkflow.workflowTypeHelp")}
                />
                
                <TextField
                  label={t("settings.aiWorkflow.webhookUrl")}
                  value={(settings as any).webhookUrl || ""}
                  onChange={(value) =>
                    setSettings((prev: any) => ({ ...prev, webhookUrl: value }))
                  }
                  placeholder={t("settings.aiWorkflow.webhookUrlPlaceholder")}
                  helpText={(() => {
                    const url = (settings as any).webhookUrl;
                    const isValidCustomUrl = url &&
                                           typeof url === 'string' &&
                                           url.trim() !== '' &&
                                           url !== 'https://' &&
                                           url !== 'null' &&
                                           url !== 'undefined' &&
                                           url.startsWith('https://') &&
                                           url.length > 8;
                    if (isValidCustomUrl) {
                      return t("settings.aiWorkflow.webhookUrlValid");
                    } else if (url && url.length > 0) {
                      return t("settings.aiWorkflow.webhookUrlEnter");
                    } else {
                      return t("settings.aiWorkflow.webhookUrlEmpty");
                    }
                  })()}
                  autoComplete="off"
                  type="url"
                />

                <Banner tone="info">
                  <Text variant="bodyMd" as="p">
                    <strong>{t("settings.aiWorkflow.defaultWorkflow")}</strong> {t("settings.aiWorkflow.defaultWorkflowDesc")}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>{t("settings.aiWorkflow.customWorkflow")}</strong> {t("settings.aiWorkflow.customWorkflowDesc")}
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
                {t("settings.preview.title")}
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
                     {t("settings.preview.subtitle")}
                   </Text>
                   <br />
                   <Text variant="bodySm" as="p" tone="subdued">
                     {t("settings.preview.position", { position: positionOptions.find(opt => opt.value === settings.position)?.label })}
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
                {t("settings.integration.title")}
              </Text>

              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" dangerouslySetInnerHTML={{ __html: t("settings.integration.step1") }} />
                <Text variant="bodyMd" as="p" dangerouslySetInnerHTML={{ __html: t("settings.integration.step2") }} />
                <Text variant="bodyMd" as="p" dangerouslySetInnerHTML={{ __html: t("settings.integration.step3") }} />
                <Text variant="bodyMd" as="p" dangerouslySetInnerHTML={{ __html: t("settings.integration.step4") }} />
                <Text variant="bodyMd" as="p" dangerouslySetInnerHTML={{ __html: t("settings.integration.step5") }} />
              </BlockStack>

              <Divider />

              <Text variant="bodyMd" as="p" tone="subdued">
                {t("settings.integration.footer")}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 