import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CustomCursor } from "../components/site/custom-cursor";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quickupp AI Studio | AI Video Production, UGC & Digital Avatars" },
      {
        name: "description",
        content:
          "AI video production services for businesses: AI UGC, avatar, cartoon, hyper-realistic and digital twin videos.",
      },
      {
        name: "keywords",
        content:
          "AI video production, AI video production studio, AI UGC videos, AI avatar videos, digital twin videos, AI cartoon animation, hyper-realistic AI video, Quickupp AI Studio",
      },
      { name: "author", content: "Quickupp AI Studio" },
      { name: "publisher", content: "Quickupp AI Studio" },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { property: "og:site_name", content: "Quickupp AI Studio" },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Quickupp AI Studio | AI Video Production, UGC & Digital Avatars",
      },
      {
        property: "og:description",
        content:
          "AI video production services for businesses: AI UGC, avatar, cartoon, hyper-realistic and digital twin videos.",
      },
      { property: "og:url", content: "https://quickuppaistudio.com/" },
      { property: "og:image", content: "https://quickuppaistudio.com/images/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Quickupp AI Studio | AI Video Production, UGC & Digital Avatars",
      },
      {
        name: "twitter:description",
        content:
          "AI video production services for businesses: AI UGC, avatar, cartoon, hyper-realistic and digital twin videos.",
      },
      { name: "twitter:image", content: "https://quickuppaistudio.com/images/logo.png" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://quickuppaistudio.com/",
      },
      {
        rel: "publisher",
        href: "https://quickuppaistudio.com/",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Product+Sans:wght@700;800&family=Plus+Jakarta+Sans:wght@700;800&family=Space+Grotesk:wght@500;600;700;800&family=EB+Garamond:ital,wght@1,700;1,800&family=Cormorant+Garamond:ital,wght@1,700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Product+Sans:wght@700;800&family=Plus+Jakarta+Sans:wght@700;800&family=Space+Grotesk:wght@500;600;700;800&family=EB+Garamond:ital,wght@1,700;1,800&family=Cormorant+Garamond:ital,wght@1,700&display=swap",
        media: "print",
        onLoad: "this.media='all'",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=="undefined"&&window.location.hostname==="www.quickuppaistudio.com"){window.location.replace("https://quickuppaistudio.com"+window.location.pathname+window.location.search+window.location.hash);}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Quickupp AI Studio",
              url: "https://quickuppaistudio.com/",
              description:
                "AI video production services for businesses: AI UGC, avatar, cartoon, hyper-realistic and digital twin videos.",
              publisher: {
                "@type": "Organization",
                name: "Quickupp AI Studio",
                url: "https://quickuppaistudio.com/",
                logo: "https://quickuppaistudio.com/images/logo.png",
              },
            }),
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hostname === "www.quickuppaistudio.com") {
        window.location.replace(
          `https://quickuppaistudio.com${window.location.pathname}${window.location.search}${window.location.hash}`,
        );
        return;
      }
      const path = window.location.pathname === "/" ? "" : window.location.pathname;
      const canonicalUrl = `https://quickuppaistudio.com${path}`;
      const canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonicalTag) {
        canonicalTag.href = canonicalUrl;
      }
      const ogUrlTag = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      if (ogUrlTag) {
        ogUrlTag.content = canonicalUrl;
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CustomCursor />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
