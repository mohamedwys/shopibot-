// app/routes/_index.tsx
import { lazy, Suspense } from "react";
import { useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Footer } from "../../components/Footer";
import { FloatingCTA } from "../../components/FloatingCTA";

// ✅ Lazy load heavy components to reduce initial bundle size
// Hero contains Spline 3D library (~2MB) - only load when needed
const Hero = lazy(() => import("../../components/Hero").then(m => ({ default: m.Hero })));
const Features = lazy(() => import("../../components/Features").then(m => ({ default: m.Features })));
const Stats = lazy(() => import("../../components/Stats").then(m => ({ default: m.Stats })));
const Pricing = lazy(() => import("../../components/Pricing").then(m => ({ default: m.Pricing })));
const Testimonials = lazy(() => import("../../components/Testimonials").then(m => ({ default: m.Testimonials })));
const TrustSection = lazy(() => import("../../components/TrustSection").then(m => ({ default: m.TrustSection })));

// ⚡ Keep Footer and FloatingCTA eager - they're small and needed immediately


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

const testimonials = [ {
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
  }, ];

// Simple loading skeleton for sections
const SectionLoader = () => (
  <div className="w-full min-h-[400px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      <p className="text-slate-600 text-sm">Loading...</p>
    </div>
  </div>
);

export default function LandingPage() {
  useLoaderData<typeof loader>();
  return (
    <>
      <Suspense fallback={<SectionLoader />}>
        <Hero />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <Features />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <Stats />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <Pricing />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <Testimonials testimonials={testimonials} />
      </Suspense>

      <Suspense fallback={<SectionLoader />}>
        <TrustSection />
      </Suspense>

      <Footer
        leftLinks={[]}
        rightLinks={[
          { href: '/privacy-policy', label: 'Privacy Policy' },
          { href: '/terms-of-service', label: 'Terms of Service' },
          { href: '/cookie-policy', label: 'Cookie Policy' },
          { href: '/gdpr-compliance', label: 'GDPR Compliance' },
          { href: '/ai-compliance', label: 'AI Compliance' },
        ]}
        copyrightText="© 2025 ShopiBot by Welcome Middle East FZ-LLC. All rights reserved."
      />
      <FloatingCTA />
    </>
  );
}
