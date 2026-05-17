import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The root URL of mia.agenciarok.es is infrastructure, not a destination.
 * Every business lives at /[slug] and is meant to be embedded via iframe
 * on the business's own website. Anything that lands here is either us
 * during testing or a stray visitor — send them to the agency site.
 */
export default function Home() {
  redirect("https://agenciarok.es");
}
