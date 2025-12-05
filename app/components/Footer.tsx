import { Icons } from "./../components/ui/icons"

interface FooterLink {
  href: string;
  label: string;
}

interface FooterProps {
  leftLinks?: FooterLink[];
  rightLinks?: FooterLink[];
  copyrightText?: string;
}

// Default links if none are provided
const defaultLeftLinks: FooterLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

const defaultRightLinks: FooterLink[] = [
 
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/refund", label: "Refund Policy" },
];

function Footer({ 
  leftLinks = defaultLeftLinks, 
  rightLinks = defaultRightLinks, 
  copyrightText = "© 2025 Shopibot. All rights reserved." 
}: FooterProps) {
  return (
    <footer className="bg-background py-12 border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center space-y-8">
          {/* Logo */}
          <div className="rounded-full bg-primary/10 p-8">
            <Icons.logo className="w-20 h-20" />
          </div>

          {/* Links - Single Line */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            {/* Left Links (Product) */}
            {leftLinks && leftLinks.length > 0 && leftLinks.map((link, index) => (
              <a 
                key={`left-${index}`}
                href={link.href} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}

            {/* Separator */}
            {leftLinks && leftLinks.length > 0 && rightLinks && rightLinks.length > 0 && (
              <span className="text-muted-foreground">•</span>
            )}

            {/* Right Links (Legal) */}
            {rightLinks && rightLinks.length > 0 && rightLinks.map((link, index) => (
              <a 
                key={`right-${index}`}
                href={link.href} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <div className="text-center pt-8 border-t w-full">
            <p className="text-sm text-muted-foreground">
              {copyrightText}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export { Footer }