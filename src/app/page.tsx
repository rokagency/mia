import { ChatWindow } from "@/components/chat-window";
import { getActiveBusiness } from "@/lib/active-business";

// Force dynamic rendering — this page queries the DB via getActiveBusiness(),
// which isn't reachable at build time inside the Docker builder.
export const dynamic = "force-dynamic";

/**
 * Server component: resolves the active business at request time and
 * passes the shape ChatWindow needs as a prop. Keeps the client bundle
 * lean — no business config travels in the JS bundle, only the bits
 * the UI actually displays.
 */
export default async function Home() {
  const { business } = await getActiveBusiness();
  return (
    <ChatWindow
      name={business.name}
      language={business.language}
      greeting={business.greeting}
      quickActions={business.quickActions}
      branding={business.branding}
      logoUrl={business.logoUrl}
    />
  );
}
