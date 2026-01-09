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
  Button,
  Spinner,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { requireBilling, getPlanLimits, checkBillingStatus } from "../lib/billing.server";
import { prisma as db } from "../db.server";
import { useTranslation } from "react-i18next";
import { encryptApiKey, decryptApiKey, isValidOpenAIKey } from "../lib/encryption.server";

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
  plan: "BASIC",
  openaiApiKey: "",
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
    let decryptedSettings = { ...settings };
    if ((settings as any).openaiApiKey) {
      try {
        (decryptedSettings as any).openaiApiKey = decryptApiKey((settings as any).openaiApiKey);
      } catch (error) {
        logger.error(error, "Failed to decrypt OpenAI API key");
        // If decryption fails, clear the key to avoid showing corrupted data
        (decryptedSettings as any).openaiApiKey = "";
      }
    }

    // ✅ NEW: Fetch conversation usage for current month
    let conversationUsage = null;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

      const conversationCount = await db.conversation.count({
        where: {
          shop: session.shop,
          timestamp: {
            gte: startOfMonth
          }
        }
      });

      // Get billing status to determine plan
      const billingStatus = await checkBillingStatus(billing);
      const planLimits = getPlanLimits(billingStatus.activePlan);

      conversationUsage = {
        used: conversationCount,
        limit: planLimits.maxConversations,
        percentUsed: planLimits.maxConversations === Infinity
          ? 0
          : Math.round((conversationCount / planLimits.maxConversations) * 100),
        isUnlimited: planLimits.maxConversations === Infinity,
        currentPlan: billingStatus.activePlan
      };

      logger.debug({
        shop: session.shop,
        conversationUsage
      }, 'Fetched conversation usage');
    } catch (usageError) {
      logger.warn({
        error: usageError instanceof Error ? usageError.message : String(usageError),
        shop: session.shop
      }, 'Failed to fetch conversation usage (non-blocking)');
      // Continue without usage data
    }

    return json({ settings: decryptedSettings, conversationUsage });
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
  const plan = (formData.get("plan") as string) || "BASIC";
  const openaiApiKey = formData.get("openaiApiKey") as string | null;

  // Validation: If plan is BYOK, openaiApiKey must be provided
  if (plan === "BYOK") {
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
  const { settings: initialSettings, conversationUsage } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const { t } = useTranslation();

  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Show success banner when settings are saved
  useEffect(() => {
    if (actionData?.success) {
      setShowSuccessBanner(true);
    }
  }, [actionData]);

  // Fetch usage data for BYOK plan
  useEffect(() => {
    if ((settings as any).plan === "BYOK") {
      const fetchUsage = async () => {
        setLoadingUsage(true);
        try {
          const response = await fetch(`/api/byok-usage?shop=${encodeURIComponent((settings as any).shop)}`);
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
  }, [(settings as any).plan, (settings as any).shop]);

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

  const handleTestConnection = useCallback(async () => {
    const apiKey = (settings as any).openaiApiKey;
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
          shop: (settings as any).shop,
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

        {/* Pricing Plan Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                {t("settings.pricingPlan")}
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                {t("settings.pricingPlanDesc")}
              </Text>

              <FormLayout>
                <Select
                  label={t("settings.pricingPlan")}
                  value={(settings as any).plan || "BASIC"}
                  options={[
                    { label: t("settings.planBYOK") + " ($5/month)", value: "BYOK" },
                    { label: t("settings.planBasic") + " ($25/month)", value: "BASIC" },
                    { label: t("settings.planUnlimited") + " ($79/month)", value: "UNLIMITED" }
                  ]}
                  onChange={(value) =>
                    setSettings((prev: any) => ({
                      ...prev,
                      plan: value,
                      // Clear API key if switching away from BYOK
                      openaiApiKey: value === "BYOK" ? prev.openaiApiKey : ""
                    }))
                  }
                />

                {(settings as any).plan === "BYOK" && (
                  <>
                    <Banner tone="info">
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {t("settings.byokInfo")}
                        </Text>
                        <Text variant="bodyMd" as="p">
                          {t("settings.byokInfoDesc")}
                        </Text>
                        <Text variant="bodyMd" as="p">
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#4c71d6", textDecoration: "underline" }}
                          >
                            {t("settings.getApiKeyLink")}
                          </a>
                        </Text>
                      </BlockStack>
                    </Banner>

                    <TextField
                      label={t("settings.openaiApiKey")}
                      value={(settings as any).openaiApiKey || ""}
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
                          disabled={!(settings as any).openaiApiKey || (settings as any).openaiApiKey.trim() === ""}
                        >
                          {t("settings.testConnection")}
                        </Button>
                      }
                    />

                    {keyTestResult && (
                      <Banner
                        tone={keyTestResult.valid ? "success" : "critical"}
                        onDismiss={() => setKeyTestResult(null)}
                      >
                        <InlineStack gap="200" align="start">
                          <Icon source={keyTestResult.valid ? CheckCircleIcon : AlertCircleIcon} />
                          <Text as="p">{keyTestResult.message}</Text>
                        </InlineStack>
                      </Banner>
                    )}

                    {(settings as any).apiKeyLastTested && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Last tested: {new Date((settings as any).apiKeyLastTested).toLocaleString()}
                        {(settings as any).apiKeyStatus && ` • Status: ${(settings as any).apiKeyStatus}`}
                      </Text>
                    )}
                  </>
                )}
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Conversation Usage Display */}
        {conversationUsage && !conversationUsage.isUnlimited && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Conversation Usage
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Track your monthly conversation usage and stay within your plan limits.
                </Text>

                <BlockStack gap="300">
                  {/* Usage Stats */}
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingLg" as="p" fontWeight="bold">
                      {conversationUsage.used.toLocaleString()} / {conversationUsage.limit.toLocaleString()}
                    </Text>
                    <Badge tone={
                      conversationUsage.percentUsed >= 100 ? "critical" :
                      conversationUsage.percentUsed >= 90 ? "warning" :
                      conversationUsage.percentUsed >= 75 ? "attention" :
                      "success"
                    }>
                      {conversationUsage.percentUsed}% Used
                    </Badge>
                  </InlineStack>

                  {/* Progress Bar */}
                  <Box
                    background={conversationUsage.percentUsed >= 100 ? "bg-fill-critical" : "bg-fill"}
                    borderRadius="100"
                    paddingBlock="050"
                  >
                    <Box
                      background={
                        conversationUsage.percentUsed >= 100 ? "bg-fill-critical-active" :
                        conversationUsage.percentUsed >= 90 ? "bg-fill-warning-active" :
                        conversationUsage.percentUsed >= 75 ? "bg-fill-caution-active" :
                        "bg-fill-success-active"
                      }
                      borderRadius="100"
                      paddingBlock="050"
                      width={`${Math.min(conversationUsage.percentUsed, 100)}%`}
                    />
                  </Box>

                  {/* Warning Messages */}
                  {conversationUsage.percentUsed >= 100 && (
                    <Banner tone="critical">
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          🚫 Monthly limit reached!
                        </Text>
                        <Text variant="bodyMd" as="p">
                          You've reached your {conversationUsage.limit.toLocaleString()} conversation limit for this month.
                          Upgrade to Professional Plan for unlimited conversations.
                        </Text>
                        <Button
                          variant="primary"
                          tone="critical"
                          onClick={() => window.location.href = '/app/billing'}
                        >
                          Upgrade Now
                        </Button>
                      </BlockStack>
                    </Banner>
                  )}

                  {conversationUsage.percentUsed >= 90 && conversationUsage.percentUsed < 100 && (
                    <Banner tone="warning">
                      <Text variant="bodyMd" as="p">
                        ⚠️ You're approaching your monthly limit ({conversationUsage.percentUsed}% used).
                        Consider upgrading to avoid service interruption.
                      </Text>
                    </Banner>
                  )}

                  {conversationUsage.percentUsed < 90 && (
                    <Text variant="bodySm" as="p" tone="subdued">
                      Resets on the 1st of each month. Upgrade to Professional Plan ($79/month) for unlimited conversations.
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
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2">
                      Conversation Usage
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      You have unlimited conversations with your current plan.
                    </Text>
                  </BlockStack>
                  <Badge tone="success" size="large">✓ Unlimited</Badge>
                </InlineStack>

                <Text variant="bodySm" as="p" tone="subdued">
                  This month: {conversationUsage.used.toLocaleString()} conversations (no limit)
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* BYOK Usage Tracking */}
        {(settings as any).plan === "BYOK" && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  {t("settings.usageTracking")}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t("settings.usageTrackingDesc")}
                </Text>

                {loadingUsage ? (
                  <InlineStack align="center">
                    <Spinner size="small" />
                    <Text as="p">Loading usage data...</Text>
                  </InlineStack>
                ) : usageData ? (
                  <BlockStack gap="400">
                    {/* Today's Usage */}
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h3">
                          {t("settings.todayUsage")}
                        </Text>
                        <InlineStack gap="600">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalApiCalls")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.today.totalApiCalls.toLocaleString()}
                            </Text>
                          </BlockStack>
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalTokensUsed")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.today.totalTokensUsed.toLocaleString()}
                            </Text>
                          </BlockStack>
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.estimatedCost")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              ${usageData.today.estimatedCost.toFixed(4)}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </BlockStack>
                    </Card>

                    {/* This Month's Usage */}
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h3">
                          {t("settings.thisMonthUsage")}
                        </Text>
                        <InlineStack gap="600">
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalApiCalls")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.thisMonth.totalApiCalls.toLocaleString()}
                            </Text>
                          </BlockStack>
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.totalTokensUsed")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              {usageData.thisMonth.totalTokensUsed.toLocaleString()}
                            </Text>
                          </BlockStack>
                          <BlockStack gap="100">
                            <Text variant="bodySm" as="p" tone="subdued">
                              {t("settings.estimatedCost")}
                            </Text>
                            <Text variant="headingLg" as="p">
                              ${usageData.thisMonth.estimatedCost.toFixed(4)}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </BlockStack>
                ) : (
                  <Banner tone="info">
                    <Text as="p">{t("settings.noUsageData")}</Text>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

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