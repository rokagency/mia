// Allow the onboarding action up to 60s — it crawls ~20 pages + calls AI.
export const maxDuration = 60;

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
