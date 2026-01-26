import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { logger } from "../lib/logger.server";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Select,
  Banner,
  BlockStack,
  Text,
  Divider,
  List,
  InlineStack,
  Icon,
  Button,
  Spinner,
  Badge,
  Box,
  Checkbox,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { requireBilling, getPlanLimits, checkBillingStatus } from "../lib/billing.server";
import { prisma as db } from "../db.server";
import { useTranslation } from "react-i18next";
import { encryptApiKey, decryptApiKey, isValidOpenAIKey } from "../lib/encryption.server";
import { getConversationUsage } from "../lib/conversation-usage.server";
import { PlanCode, getPlanOptions, normalizePlanCode } from "../lib/plans.config";
import type { WidgetSettings, ConversationUsage, SettingsLoaderData, ActionData } from "../lib/types";

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
  plan: PlanCode.STARTER, // ✅ Use standardized plan code
  openaiApiKey: "",
  // Quick Button Visibility - all enabled by default
  bestSellersVisible: true,
  newArrivalsVisible: true,
  onSaleVisible: true,
  recommendationsVisible: true,
  shippingVisible: true,
  returnsVisible: true,
  trackOrderVisible: true,
  helpVisible: true,
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

    // Decrypt OpenAI API key if it exists
    let decryptedSettings: WidgetSettings = { ...settings } as unknown as WidgetSettings;
    if (settings.openaiApiKey) {
      try {
        decryptedSettings.openaiApiKey = decryptApiKey(settings.openaiApiKey);
      } catch (error) {
        logger.error(error, "Failed to decrypt OpenAI API key");
        // If decryption fails, clear the key to avoid showing corrupted data
        decryptedSettings.openaiApiKey = "";
      }
    }

    // ✅ Normalize plan code and migrate database if needed (handles legacy BASIC/UNLIMITED codes)
    const originalPlan = settings.plan;
    const normalizedPlan = normalizePlanCode(settings.plan);
    decryptedSettings.plan = normalizedPlan;

    // 🔍 DEBUG: Log raw database plan value
    logger.info({
      shop: session.shop,
      rawDatabasePlan: originalPlan,
      normalizedPlan: normalizedPlan,
      planType: typeof originalPlan,
      isNull: originalPlan === null,
      isUndefined: originalPlan === undefined,
    }, '🔍 DEBUG: Raw database plan value');

    // Migrate database if plan code changed
    if (originalPlan !== normalizedPlan) {
      try {
        await db.widgetSettings.update({
          where: { id: settings.id },
          data: { plan: normalizedPlan }
        });
        logger.info({
          shop: session.shop,
          oldPlan: originalPlan,
          newPlan: normalizedPlan
        }, 'Migrated plan code in database');
      } catch (error) {
        logger.warn({
          error: error instanceof Error ? error.message : String(error),
          shop: session.shop
        }, 'Failed to migrate plan code (non-blocking)');
      }
    }

    // ✅ IMPROVED: Use shared conversation usage utility with proper timezone handling
    let conversationUsage: ConversationUsage | null = null;
    let planLimits = null;
    let activePlan = null;

    try {
      // ✅ FIX: Use database plan for conversation usage calculation
      // Database plan is the configured plan, billing is just for validation
      conversationUsage = await getConversationUsage(session.shop);

      // Get billing status for validation/display
      const billingStatus = await checkBillingStatus(billing);
      activePlan = billingStatus.activePlan;

      // ✅ FIX: Use normalized database plan for limits, not billing plan
      // This ensures UI shows what's configured in database, not what Shopify billing reports
      planLimits = getPlanLimits(normalizedPlan);

      // 🔍 DEBUG: Detailed logging for STARTER plan showing unlimited bug
      logger.info({
        shop: session.shop,
        databasePlan: normalizedPlan,
        billingPlan: activePlan,
        conversationUsage: {
          used: conversationUsage.used,
          limit: conversationUsage.limit,
          isUnlimited: conversationUsage.isUnlimited,
          percentUsed: conversationUsage.percentUsed,
          currentPlan: conversationUsage.currentPlan,
        },
        planLimits: {
          maxConversations: planLimits.maxConversations,
          isInfinity: planLimits.maxConversations === Infinity,
          hasCustomWebhook: planLimits.hasCustomWebhook,
        },
        planLimitsSource: 'database',
        resetDate: conversationUsage.resetDate
      }, '🔍 DEBUG: Complete conversation usage data');

      logger.debug({
        shop: session.shop,
        databasePlan: normalizedPlan,
        billingPlan: activePlan,
        conversationUsage,
        planLimitsSource: 'database',
        resetDate: conversationUsage.resetDate
      }, 'Fetched conversation usage');
    } catch (usageError) {
      logger.warn({
        error: usageError instanceof Error ? usageError.message : String(usageError),
        shop: session.shop
      }, 'Failed to fetch conversation usage (non-blocking)');
      // Continue without usage data
    }

    const loaderData: SettingsLoaderData = {
      settings: decryptedSettings,
      conversationUsage,
      planLimits,
      activePlan
    };

    return json(loaderData);
  } catch (error) {
    logger.error(error, `Database error in settings loader for shop: ${session.shop}`);
    console.error("Full database error:", error);

    return json({
      settings: {
        shop: session.shop,
        ...DEFAULT_SETTINGS
      },
      conversationUsage: null
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  await requireBilling(billing);

  const formData = await request.formData();

  const webhookUrl = formData.get("webhookUrl") as string | null;
  // Normalize webhook URL - convert empty strings and "null" string to actual null
  const normalizedWebhookUrl = (webhookUrl && webhookUrl.trim() !== "" && webhookUrl !== "null" && webhookUrl !== "undefined")
    ? webhookUrl.trim()
    : null;
  const workflowType = (formData.get("workflowType") as string) || "DEFAULT";
  const planFromForm = (formData.get("plan") as string) || PlanCode.STARTER;
  // ✅ Normalize plan code to handle legacy values
  const plan = normalizePlanCode(planFromForm);
  const openaiApiKey = formData.get("openaiApiKey") as string | null;

  // Validation: If plan is BYOK, openaiApiKey must be provided
  if (plan === PlanCode.BYOK) {
    if (!openaiApiKey || openaiApiKey.trim() === "") {
      return json({
        success: false,
        message: "OpenAI API Key is required for the BYOK plan. Please enter your API key.",
        settings: null
      }, { status: 400 });
    }

    // Validate API key format
    if (!isValidOpenAIKey(openaiApiKey)) {
      return json({
        success: false,
        message: "Invalid OpenAI API Key format. The key should start with 'sk-' or 'sk-proj-' and be at least 20 characters long.",
        settings: null
      }, { status: 400 });
    }
  }

  // Encrypt the API key if provided
  let encryptedApiKey: string | null = null;
  if (openaiApiKey && openaiApiKey.trim() !== "") {
    try {
      encryptedApiKey = encryptApiKey(openaiApiKey.trim());
      logger.info("OpenAI API key encrypted successfully");
    } catch (error) {
      logger.error(error, "Failed to encrypt OpenAI API key");
      return json({
        success: false,
        message: "Failed to encrypt API key. Please check your ENCRYPTION_KEY environment variable.",
        settings: null
      }, { status: 500 });
    }
  }

  // Helper to safely parse boolean from form data
  const parseBooleanField = (fieldName: string, defaultValue: boolean = true): boolean => {
    const value = formData.get(fieldName);
    if (value === null) return defaultValue; // Field not submitted, use default
    return value === "true";
  };

  // Prepare base settings data
  const settingsData: any = {
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
    plan: plan,
    openaiApiKey: encryptedApiKey,
    // Quick Button Visibility Settings
    bestSellersVisible: parseBooleanField("bestSellersVisible"),
    newArrivalsVisible: parseBooleanField("newArrivalsVisible"),
    onSaleVisible: parseBooleanField("onSaleVisible"),
    recommendationsVisible: parseBooleanField("recommendationsVisible"),
    shippingVisible: parseBooleanField("shippingVisible"),
    returnsVisible: parseBooleanField("returnsVisible"),
    trackOrderVisible: parseBooleanField("trackOrderVisible"),
    helpVisible: parseBooleanField("helpVisible"),
  };

  // Update apiKeyLastUpdated if API key was changed
  if (encryptedApiKey) {
    settingsData.apiKeyLastUpdated = new Date();
  }

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
    logger.info(`Final workflowType in database: ${settings.workflowType}`);
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
  const { settings: initialSettings, conversationUsage, planLimits, activePlan } = useLoaderData<SettingsLoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [settings, setSettings] = useState<WidgetSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [usageData, setUsageData] = useState<any>(null); // TODO: Type this properly when BYOK usage types are defined
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Helper functions for usage UI
  const getUsageTone = (percent: number): "success" | "attention" | "warning" | "critical" => {
    if (percent >= 100) return 'critical';
    if (percent >= 90) return 'warning';
    if (percent >= 80) return 'attention';
    return 'success';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-fill-critical-active';
    if (percent >= 90) return 'bg-fill-warning-active';
    if (percent >= 80) return 'bg-fill-caution-active';
    return 'bg-fill-success-active';
  };

  // Show success banner when settings are saved
  useEffect(() => {
    if (actionData?.success) {
      setShowSuccessBanner(true);
    }
  }, [actionData]);

  // Fetch usage data for BYOK plan
  useEffect(() => {
    if (settings.plan === PlanCode.BYOK) {
      const fetchUsage = async () => {
        setLoadingUsage(true);
        try {
          const response = await fetch(`/api/byok-usage?shop=${encodeURIComponent(settings.shop)}`);
          if (response.ok) {
            const data = await response.json();
            setUsageData(data);
          }
        } catch (error) {
          console.error("Failed to fetch BYOK usage data:", error);
        } finally {
          setLoadingUsage(false);
        }
      };
      fetchUsage();
    }
  }, [settings.plan, settings.shop]);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    const formData = new FormData();

    // ✅ IMPROVED: Determine workflow type based on webhookUrl validity
    const webhookUrl = settings.webhookUrl || "";
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

  const handleTestConnection = useCallback(async () => {
    const apiKey = settings.openaiApiKey;
    if (!apiKey || apiKey.trim() === "") {
      setKeyTestResult({
        valid: false,
        message: "Please enter an API key first"
      });
      return;
    }

    setIsTestingKey(true);
    setKeyTestResult(null);

    try {
      const response = await fetch("/api/test-openai-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          shop: settings.shop,
          apiKey: apiKey
        })
      });

      const result = await response.json();
      setKeyTestResult({
        valid: result.valid,
        message: result.message
      });
    } catch (error) {
      setKeyTestResult({
        valid: false,
        message: "Failed to test API key. Please try again."
      });
    } finally {
      setIsTestingKey(false);
    }
  }, [settings]);

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
        {/* Debug Info Banner - Shows plan details */}
        {process.env.NODE_ENV === 'development' && (
          <Layout.Section>
            <Banner tone="info">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  🔍 Debug Info (Development Only)
                </Text>
                <Text variant="bodySm" as="p">
                  <strong>Database Plan:</strong> {settings.plan} {' '}
                  {settings.plan === PlanCode.BYOK && '(BYOK - Should be Unlimited)'}
                  {settings.plan === PlanCode.PROFESSIONAL && '(Professional - Should be Unlimited)'}
                  {settings.plan === PlanCode.STARTER && '(Starter - Should show 1000 limit)'}
                </Text>
                {activePlan && (
                  <Text variant="bodySm" as="p">
                    <strong>Billing Plan:</strong> {activePlan}
                  </Text>
                )}
                {conversationUsage && (
                  <Text variant="bodySm" as="p">
                    <strong>Usage Calculation:</strong> {conversationUsage.used} / {conversationUsage.limit === Infinity ? '∞ (Unlimited)' : conversationUsage.limit}
                    {' | isUnlimited: '}{conversationUsage.isUnlimited ? '✓ TRUE' : '✗ FALSE'}
                  </Text>
                )}
                {planLimits && (
                  <Text variant="bodySm" as="p">
                    <strong>Plan Limits:</strong> maxConversations={planLimits.maxConversations === Infinity ? '∞' : planLimits.maxConversations},
                    hasCustomWebhook={planLimits.hasCustomWebhook ? 'true' : 'false'}
                  </Text>
                )}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {showSuccessBanner && actionData?.success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => {}}>
              <p>{actionData.message}</p>
            </Banner>
          </Layout.Section>
        )}

      {/* Integration Instructions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">
                  {t("settings.integration.title")}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("settings.integration.subtitle")}
                </Text>
              </BlockStack>

              <Divider />

              <Banner tone="info">
                <BlockStack gap="100">
                  <Text variant="bodyMd" as="p">
                    <Text as="span" fontWeight="semibold">
                      {t("settings.integration.importantLabel")}
                    </Text>{" "}
                    {t("settings.integration.importantMessage")}
                  </Text>

                  <Text variant="bodySm" as="p" tone="subdued">
                    {t("settings.integration.helpTitle")}{" "}
                    {t("settings.integration.helpDescription")}
                  </Text>
                </BlockStack>
              </Banner>

              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">
                  {t("settings.integration.guideTitle")}
                </Text>

                <List type="number">
                  <List.Item>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        {t("settings.integration.step1Title")}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("settings.integration.step1Description")}
                      </Text>
                    </BlockStack>
                  </List.Item>

                  <List.Item>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        {t("settings.integration.step2Title")}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("settings.integration.step2Description")}
                      </Text>
                    </BlockStack>
                  </List.Item>

                  <List.Item>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        {t("settings.integration.step3Title")}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("settings.integration.step3Description")}
                      </Text>
                    </BlockStack>
                  </List.Item>

                  <List.Item>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        {t("settings.integration.step4Title")}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {t("settings.integration.step4Description")}
                      </Text>
                    </BlockStack>
                  </List.Item>
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  {t("settings.integration.customizationTitle")}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("settings.integration.customizationDescription")}
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="bodySm" as="p" tone="subdued">
                    {t("settings.integration.customizationNote")}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick Button Visibility Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">
                  Quick Action Buttons
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Control which quick action buttons are displayed on the chatbot welcome screen. Hidden buttons will not be rendered or accessible to customers.
                </Text>
              </BlockStack>

              <Divider />

              {/* Product Discovery Buttons */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Product Discovery
                </Text>
                <Box paddingInlineStart="200">
                  <BlockStack gap="200">
                    <Checkbox
                      label="Best Sellers"
                      helpText="Show popular products button"
                      checked={settings.bestSellersVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, bestSellersVisible: checked }))
                      }
                    />
                    <Checkbox
                      label="New Arrivals"
                      helpText="Show new products button"
                      checked={settings.newArrivalsVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, newArrivalsVisible: checked }))
                      }
                    />
                    <Checkbox
                      label="On Sale"
                      helpText="Show discounted products button"
                      checked={settings.onSaleVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, onSaleVisible: checked }))
                      }
                    />
                    <Checkbox
                      label="Recommendations"
                      helpText="Show personalized recommendations button"
                      checked={settings.recommendationsVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, recommendationsVisible: checked }))
                      }
                    />
                  </BlockStack>
                </Box>
              </BlockStack>

              <Divider />

              {/* Support Buttons */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Customer Support
                </Text>
                <Box paddingInlineStart="200">
                  <BlockStack gap="200">
                    <Checkbox
                      label="Shipping"
                      helpText="Show shipping information button"
                      checked={settings.shippingVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, shippingVisible: checked }))
                      }
                    />
                    <Checkbox
                      label="Returns"
                      helpText="Show return policy button"
                      checked={settings.returnsVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, returnsVisible: checked }))
                      }
                    />
                    <Checkbox
                      label="Track Order"
                      helpText="Show order tracking button"
                      checked={settings.trackOrderVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, trackOrderVisible: checked }))
                      }
                    />
                    <Checkbox
                      label="Help"
                      helpText="Show general help button"
                      checked={settings.helpVisible ?? true}
                      onChange={(checked) =>
                        setSettings((prev) => ({ ...prev, helpVisible: checked }))
                      }
                    />
                  </BlockStack>
                </Box>
              </BlockStack>

              {/* Warning when all buttons are hidden */}
              {!(settings.bestSellersVisible ?? true) &&
               !(settings.newArrivalsVisible ?? true) &&
               !(settings.onSaleVisible ?? true) &&
               !(settings.recommendationsVisible ?? true) &&
               !(settings.shippingVisible ?? true) &&
               !(settings.returnsVisible ?? true) &&
               !(settings.trackOrderVisible ?? true) &&
               !(settings.helpVisible ?? true) && (
                <Banner tone="warning">
                  <Text variant="bodyMd" as="p">
                    All quick action buttons are hidden. Customers will only see the welcome message with the chat input. Consider enabling at least one button for better user experience.
                  </Text>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Pricing Plan Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">
                  {t("settings.pricingPlan")}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("settings.pricingPlanDesc")}
                </Text>
              </BlockStack>

              <Select
                label={t("settings.pricingPlan")}
                value={settings.plan}
                options={getPlanOptions().map(opt => ({
                  label: opt.label,
                  value: opt.value
                }))}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    plan: normalizePlanCode(value),
                    // Clear API key if switching away from BYOK
                    openaiApiKey: value === PlanCode.BYOK ? prev.openaiApiKey : ""
                  }))
                }
              />

              {settings.plan === PlanCode.BYOK && (
                <>
                  <Divider />

                  <BlockStack gap="400">
                    <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h3">
                          {t("settings.byokInfo")}
                        </Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          {t("settings.byokInfoDesc")}
                        </Text>
                        <Button
                          variant="plain"
                          url="https://platform.openai.com/api-keys"
                          external
                        >
                          {t("settings.getApiKeyLink")} →
                        </Button>
                      </BlockStack>
                    </Box>

                    <TextField
                      label={t("settings.openaiApiKey")}
                      value={settings.openaiApiKey || ""}
                      onChange={(value) => {
                        setSettings((prev: any) => ({ ...prev, openaiApiKey: value }));
                        setKeyTestResult(null); // Clear test result when key changes
                      }}
                      type="password"
                      placeholder={t("settings.openaiApiKeyPlaceholder")}
                      helpText={t("settings.openaiApiKeyHelp")}
                      autoComplete="off"
                      connectedRight={
                        <Button
                          onClick={handleTestConnection}
                          loading={isTestingKey}
                          disabled={!settings.openaiApiKey || settings.openaiApiKey.trim() === ""}
                        >
                          {t("settings.testConnection")}
                        </Button>
                      }
                    />

                    {keyTestResult && (
                      <Box
                        padding="300"
                        background={keyTestResult.valid ? "bg-surface-success" : "bg-surface-critical"}
                        borderRadius="200"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={keyTestResult.valid ? CheckCircleIcon : AlertCircleIcon} />
                          <Text variant="bodyMd" as="p">{keyTestResult.message}</Text>
                        </InlineStack>
                      </Box>
                    )}

                    {settings.apiKeyLastTested && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Last tested: {new Date(settings.apiKeyLastTested).toLocaleString()}
                        {settings.apiKeyStatus && ` • Status: ${settings.apiKeyStatus}`}
                      </Text>
                    )}
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Conversation Usage Display */}
        {conversationUsage && !conversationUsage.isUnlimited && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {t("settings.conversationUsage")}
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("settings.trackConversationUsage")}
                  </Text>
                </BlockStack>

                <BlockStack gap="400">
                  {/* Usage Stats */}
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <Text variant="headingLg" as="p" fontWeight="bold">
                      {conversationUsage.used?.toLocaleString() ?? 0} / {conversationUsage.limit?.toLocaleString() ?? 0}
                    </Text>
                    <Badge tone={getUsageTone(conversationUsage.percentUsed ?? 0)}>
                      {`${conversationUsage.percentUsed ?? 0}% Used`}
                    </Badge>
                  </InlineStack>

                  {/* Progress Bar */}
                  <Box
                    background={(conversationUsage.percentUsed ?? 0) >= 100 ? "bg-fill-critical" : "bg-fill"}
                    borderRadius="100"
                    padding="050"
                  >
                    <Box
                      background={getProgressColor(conversationUsage.percentUsed ?? 0)}
                      borderRadius="100"
                      padding="050"
                      width={`${Math.min(conversationUsage.percentUsed ?? 0, 100)}%`}
                    />
                  </Box>

                  {/* Warning Messages */}
                  {(conversationUsage.percentUsed ?? 0) >= 100 && (
                    <Banner tone="critical">
                      <BlockStack gap="300">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          Monthly limit reached
                        </Text>
                        <Text variant="bodyMd" as="p">
                          You've reached your {conversationUsage.limit?.toLocaleString() ?? 0} conversation limit for this month.
                          Upgrade to BYOK Plan ($5/month) or Professional Plan ($79/month) for unlimited conversations.
                        </Text>
                        <InlineStack gap="200">
                          <Button
                            variant="primary"
                            onClick={() => navigate('/app/billing')}
                          >
                            Upgrade Now
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Banner>
                  )}

                  {(conversationUsage.percentUsed ?? 0) >= 90 && (conversationUsage.percentUsed ?? 0) < 100 && (
                    <Banner tone="warning">
                      <Text variant="bodyMd" as="p">
                        You're approaching your monthly limit ({conversationUsage.percentUsed ?? 0}% used).
                        Consider upgrading to avoid service interruption.
                      </Text>
                    </Banner>
                  )}

                  {conversationUsage.percentUsed < 90 && (
                    <Text variant="bodySm" as="p" tone="subdued">
                      {t("settings.resetConversationUsage")}
                    </Text>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Unlimited Conversations Badge */}
        {conversationUsage && conversationUsage.isUnlimited && (
          <Layout.Section>
            <Card>
              <Box
                background="bg-surface-success"
                padding="400"
                borderRadius="200"
              >
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="headingMd" as="h2">
                        Unlimited Conversations
                      </Text>
                      <Badge tone="success">Active</Badge>
                    </InlineStack>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {conversationUsage.used.toLocaleString()} conversations this month — no limits with your current plan
                    </Text>
                  </BlockStack>
                  <Icon source={CheckCircleIcon} tone="success" />
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>
        )}

        {/* BYOK Usage Tracking */}
        {settings.plan === PlanCode.BYOK && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {t("settings.usageTracking")}
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("settings.usageTrackingDesc")}
                  </Text>
                </BlockStack>

                {loadingUsage ? (
                  <InlineStack align="center" gap="200">
                    <Spinner size="small" />
                    <Text as="p" tone="subdued">Loading usage data...</Text>
                  </InlineStack>
                ) : usageData ? (
                  <>
                    <Divider />

                    {/* Today's Usage */}
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">
                        {t("settings.todayUsage")}
                      </Text>
                      <InlineStack gap="400" wrap>
                        <Box minWidth="120px">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalApiCalls")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.today.totalApiCalls.toLocaleString()}
                            </Text>
                          </BlockStack>
                        </Box>
                        <Box minWidth="120px">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalTokensUsed")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.today.totalTokensUsed.toLocaleString()}
                            </Text>
                          </BlockStack>
                        </Box>
                        <Box minWidth="120px">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.estimatedCost")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              ${usageData.today.estimatedCost.toFixed(4)}
                            </Text>
                          </BlockStack>
                        </Box>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    {/* This Month's Usage */}
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">
                        {t("settings.thisMonthUsage")}
                      </Text>
                      <InlineStack gap="400" wrap>
                        <Box minWidth="120px">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalApiCalls")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.thisMonth.totalApiCalls.toLocaleString()}
                            </Text>
                          </BlockStack>
                        </Box>
                        <Box minWidth="120px">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalTokensUsed")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.thisMonth.totalTokensUsed.toLocaleString()}
                            </Text>
                          </BlockStack>
                        </Box>
                        <Box minWidth="120px">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.estimatedCost")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              ${usageData.thisMonth.estimatedCost.toFixed(4)}
                            </Text>
                          </BlockStack>
                        </Box>
                      </InlineStack>
                    </BlockStack>
                  </>
                ) : (
                  <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                    <Text as="p" tone="subdued">{t("settings.noUsageData")}</Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* AI Workflow Settings - Only for Professional Plan */}
        {planLimits && planLimits.hasCustomWebhook && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {t("settings.aiWorkflow")}
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    {t("settings.aiWorkflowDesc")}
                  </Text>
                </BlockStack>

                <Select
                  label={t("settings.workflowType")}
                  value={(() => {
                    const url = settings.webhookUrl;
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
                  value={settings.webhookUrl || ""}
                  onChange={(value) =>
                    setSettings((prev: any) => ({ ...prev, webhookUrl: value }))
                  }
                  placeholder={t("settings.webhookPlaceholder")}
                  helpText={(() => {
                    const url = settings.webhookUrl;
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

                <Divider />

                <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                  <BlockStack gap="200">
                    <Text variant="bodySm" as="p">
                      <strong>{t("settings.workflowInfoDefault").split(':')[0]}:</strong> {t("settings.workflowInfoDefault").split(':')[1]}
                    </Text>
                    <Text variant="bodySm" as="p">
                      <strong>{t("settings.workflowInfoCustom").split(':')[0]}:</strong> {t("settings.workflowInfoCustom").split(':')[1]}
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Upgrade Banner for BYOK/Starter Plans */}
        {planLimits && !planLimits.hasCustomWebhook && (
          <Layout.Section>
            <Banner tone="info">
              <BlockStack gap="300">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Custom AI workflows available on Professional Plan
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Connect your own n8n workflow or custom AI endpoint to fully customize the chatbot behavior.
                </Text>
                <InlineStack gap="200">
                  <Button onClick={() => navigate('/app/billing')}>
                    Upgrade to Professional
                  </Button>
                </InlineStack>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}