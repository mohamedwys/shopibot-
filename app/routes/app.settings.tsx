import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Banner,
  BlockStack,
  Text,
  Divider,
  List,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { requireBilling } from "../lib/billing.server";
import { prisma as db } from "../db.server";
import { useTranslation } from "react-i18next";

export const handle = {
  i18n: "common",
};

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  position: "bottom-right",
  buttonText: "Ask AI Assistant",
  chatTitle: "AI Sales Assistant",
  welcomeMessage: "Hello! I'm your AI sales assistant. I can help you find products, answer questions about pricing, shipping, and provide personalized recommendations. How can I assist you today?",
  inputPlaceholder: "Ask me anything about our products...",
  primaryColor: "#4c71d6ff",
  interfaceLanguage: "en",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  await requireBilling(billing);

  try {
    if (!db) {
      throw new Error("Database connection not available");
    }
    
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
    logger.error(error, `Database error in settings loader for shop: ${session.shop}`);
    console.error("Full database error:", error);

    return json({
      settings: {
        shop: session.shop,
        ...DEFAULT_SETTINGS
      }
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  await requireBilling(billing);

  const formData = await request.formData();

  const webhookUrl = formData.get("webhookUrl") as string | null;
  const normalizedWebhookUrl = webhookUrl?.trim() || null;
  const workflowType = (formData.get("workflowType") as string) || "DEFAULT";

  const settingsData = {
    enabled: formData.get("enabled") === "true",
    position: formData.get("position") as string,
    buttonText: formData.get("buttonText") as string,
    chatTitle: formData.get("chatTitle") as string,
    welcomeMessage: formData.get("welcomeMessage") as string,
    inputPlaceholder: formData.get("inputPlaceholder") as string,
    primaryColor: formData.get("primaryColor") as string,
    interfaceLanguage: formData.get("interfaceLanguage") as string,
    workflowType: workflowType as "DEFAULT" | "CUSTOM",
    webhookUrl: normalizedWebhookUrl,
  };

  try {
    logger.info(`Saving settings for shop: ${session.shop}`);
    logger.info(`Workflow type being saved: ${workflowType}`);
    logger.info(`Webhook URL being saved: ${normalizedWebhookUrl || '[CLEARED/DEFAULT]'}`);

    const settings = await db.widgetSettings.upsert({
      where: { shop: session.shop },
      update: settingsData,
      create: {
        shop: session.shop,
        ...settingsData
      }
    });

    logger.info("Settings saved to database successfully");
    logger.info(`Final workflowType in database: ${(settings as any).workflowType}`);
    logger.info(`Final webhookUrl in database: ${settings.webhookUrl || '[NULL/DEFAULT]'}`);

    return json({
      success: true,
      message: "Settings saved successfully!",
      settings
    });
  } catch (error) {
    logger.error(error, `Database save error for shop: ${session.shop}`);
    console.error("Full database save error:", error);

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
  const { t } = useTranslation();

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

    // ✅ IMPROVED: Determine workflow type based on webhookUrl validity
    const webhookUrl = (settings as any).webhookUrl || "";
    const isValidCustomUrl = webhookUrl &&
                           typeof webhookUrl === 'string' &&
                           webhookUrl.trim() !== '' &&
                           webhookUrl !== 'https://' &&
                           webhookUrl !== 'null' &&
                           webhookUrl !== 'undefined' &&
                           webhookUrl.startsWith('https://') &&
                           webhookUrl.length > 8;

    const workflowType = isValidCustomUrl ? "CUSTOM" : "DEFAULT";

    Object.entries(settings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    // ✅ ADDED: Append workflowType
    formData.append("workflowType", workflowType);

    submit(formData, { method: "post" });
    setIsSaving(false);
  }, [settings, submit]);

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

      {/* Integration Instructions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {t("settings.integration.title")}
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("settings.integration.subtitle")}
                  </Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              <BlockStack gap="400">
                <Banner tone="info">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={AlertCircleIcon} />
                    <Text variant="bodyMd" as="p">
                      <strong>{t("settings.integration.importantLabel")}</strong> {t("settings.integration.importantMessage")}
                    </Text>
                  </InlineStack>
                </Banner>

                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">
                    {t("settings.integration.guideTitle")}
                  </Text>

                  <List type="number">
                    <List.Item>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {t("settings.integration.step1Title")}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {t("settings.integration.step1Description")}
                        </Text>
                      </BlockStack>
                    </List.Item>

                    <List.Item>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {t("settings.integration.step2Title")}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {t("settings.integration.step2Description")}
                        </Text>
                      </BlockStack>
                    </List.Item>

                    <List.Item>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {t("settings.integration.step3Title")}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {t("settings.integration.step3Description")}
                        </Text>
                      </BlockStack>
                    </List.Item>
                    
                    <List.Item>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {t("settings.integration.step4Title")}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {t("settings.integration.step4Description")}
                        </Text>
                      </BlockStack>
                    </List.Item>
                  </List>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">
                    {t("settings.integration.customizationTitle")}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {t("settings.integration.customizationDescription")}
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text variant="bodyMd" as="p" tone="success">
                      {t("settings.integration.customizationNote")}
                    </Text>
                  </InlineStack>
                </BlockStack>

                <Divider />

                <Banner tone="warning">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      {t("settings.integration.helpTitle")}
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {t("settings.integration.helpDescription")}
                    </Text>
                  </BlockStack>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* AI Workflow Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                {t("settings.aiWorkflow")}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("settings.aiWorkflowDesc")}
              </Text>

              <FormLayout>
                <Select
                  label={t("settings.workflowType")}
                  value={(() => {
                    const url = (settings as any).webhookUrl;
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
                    { label: t("settings.defaultWorkflow"), value: "default" },
                    { label: t("settings.customWorkflow"), value: "custom" }
                  ]}
                  onChange={(value) => {
                    if (value === "default") {
                      setSettings((prev: any) => ({ ...prev, webhookUrl: "" }));
                    } else {
                      setSettings((prev: any) => {
                        const currentUrl = prev.webhookUrl || "";
                        return { ...prev, webhookUrl: currentUrl || "https://" };
                      });
                    }
                  }}
                  helpText={t("settings.workflowTypeHelp")}
                />

                <TextField
                  label={t("settings.customWebhookUrl")}
                  value={(settings as any).webhookUrl || ""}
                  onChange={(value) =>
                    setSettings((prev: any) => ({ ...prev, webhookUrl: value }))
                  }
                  placeholder={t("settings.webhookPlaceholder")}
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
                      return t("settings.webhookValidHelp");
                    } else if (url && url.length > 0) {
                      return t("settings.webhookInvalidHelp");
                    } else {
                      return t("settings.webhookEmptyHelp");
                    }
                  })()}
                  autoComplete="off"
                  type="url"
                />

                <Banner tone="info">
                  <Text variant="bodyMd" as="p">
                    <strong>{t("settings.workflowInfoDefault").split(':')[0]}:</strong> {t("settings.workflowInfoDefault").split(':')[1]}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>{t("settings.workflowInfoCustom").split(':')[0]}:</strong> {t("settings.workflowInfoCustom").split(':')[1]}
                  </Text>
                </Banner>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}