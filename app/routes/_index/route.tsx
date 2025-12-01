import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logo}>Shopibot</div>
        </header>

        <main className={styles.main}>
          <div className={styles.hero}>
            <h1 className={styles.heading}>
              Engage Shoppers. Automate Support. <span>Zero Code.</span>
            </h1>
            <p className={styles.subheading}>
              The only Shopify chatbot built for beauty & wellness brands—fluent in French, privacy-first, and ready in 60 seconds.
            </p>

            {showForm ? (
              <Form className={styles.form} method="post" action="/auth/login">
                <div className={styles.inputGroup}>
                  <input
                    className={styles.input}
                    type="text"
                    name="shop"
                    placeholder="your-store.myshopify.com"
                    required
                  />
                  <button className={styles.submitButton} type="submit">
                    Add to Shopify
                  </button>
                </div>
                <p className={styles.hint}>
                  e.g., your-shop.myshopify.com
                </p>
              </Form>
            ) : (
              <a
                href="https://apps.shopify.com/your-chatbot-app"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryButton}
              >
                Install on Shopify →
              </a>
            )}
          </div>

          <div className={styles.featuresGrid}>
            {[
              {
                title: "No-Code Setup",
                desc: "Activate in your Shopify admin. Customize colors, language, and behavior—no dev needed.",
              },
              {
                title: "Native French Support",
                desc: "Speak your customers’ language with natural, contextual French responses.",
              },
              {
                title: "Respects Your Stack",
                desc: "Works with Google Analytics, Meta Pixel & Shopify cookies. Never touches inventory.",
              },
            ].map((feature, i) => (
              <div key={i} className={styles.featureCard}>
                <div className={styles.featureIcon}>✓</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}