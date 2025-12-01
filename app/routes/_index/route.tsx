import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import { Hero } from "../../components/Hero";
import { Features } from "../../components/Features";
import { Stats } from "../../components/Stats";
import { Pricing } from "../../components/Pricing";
import { Testimonials } from "../../components/Testimonials";
import { TrustSection } from "../../components/TrustSection";
import { AIAssistants } from "../../components/AIAssistants";
import { Footer } from "../../components/Footer";
import { FloatingCTA } from "../../components/FloatingCTA";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

const testimonials = [
  {
    name: 'Sarah Johnson',
    jobtitle: 'Founder, EcoStyle',
    image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
    text: 'ShopiBot transformed our customer service. We saw a 3x increase in conversions within the first month. The AI understands our products better than some of our staff!',
    rating: 5,
    metric: '+300% conversions',
  },
  {
    name: 'Michael Chen',
    jobtitle: 'CEO, TechGear Pro',
    image: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200',
    text: 'Installation took literally 3 minutes. The ROI was immediate. Our support tickets dropped by 70% while customer satisfaction went through the roof.',
    rating: 5,
    metric: '-70% support tickets',
  },
  {
    name: 'Emily Rodriguez',
    jobtitle: 'Owner, Bella Boutique',
    image: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200',
    text: 'The personalized recommendations are incredible. Customers love getting instant answers at 2 AM. It\'s like having a 24/7 sales team without the overhead.',
    rating: 5,
    metric: '+180% night sales',
  },
  {
    name: 'David Park',
    jobtitle: 'Director, Urban Essentials',
    image: 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=200',
    text: 'Best Shopify app we\'ve installed. The AI learns fast and the analytics dashboard gives us insights we never had before. Game changer for our business.',
    rating: 5,
    metric: '5-star must-have',
  },
  {
    name: 'Jessica Williams',
    jobtitle: 'Marketing Lead, FitLife',
    image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=200',
    text: 'Our cart abandonment rate dropped significantly. The AI engages customers at the perfect moment with the right message. It\'s like magic.',
    rating: 5,
    metric: '-45% cart abandonment',
  },
  {
    name: 'Alex Thompson',
    jobtitle: 'Founder, Craft & Co',
    image: 'https://images.pexels.com/photos/1212984/pexels-photo-1212984.jpeg?auto=compress&cs=tinysrgb&w=200',
    text: 'We scaled our store 5x without hiring more support staff. ShopiBot handles everything from product questions to order tracking seamlessly.',
    rating: 5,
    metric: '5x scale achieved',
  },
];

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className="landing-page">
      <Hero />
      <Features />
      <AIAssistants />
      <Stats />
      <Pricing />
      <Testimonials testimonials={testimonials} />
      <TrustSection />
      <Footer
        leftLinks={[]}
        rightLinks={[
          { href: '/privacy-policy', label: 'Privacy Policy' },
          { href: '/terms-of-service', label: 'Terms of Service' },
          { href: '/cookie-policy', label: 'Cookie Policy' },
          { href: '/ai-compliance', label: 'AI Compliance' },
        ]}
        copyrightText="© 2025 ShopiBot by Welcome Middle East FZ-LLC. All rights reserved."
      />
      <FloatingCTA />

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: white;
        }

        /* Global styles */
        :global(body) {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        :global(*) {
          box-sizing: border-box;
        }

        :global(html) {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
