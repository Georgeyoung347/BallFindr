/**
 * Cookie policy page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { LegalEmail, LegalList, LegalPage, LegalSection } from "@/components/site/LegalPage";

const title = "Cookie Notice | BallFindr";
const description =
  "How BallFindr uses cookies and similar technologies. BallFindr does not intentionally use analytics, advertising or behavioural tracking cookies.";

export const Route = createFileRoute("/cookies")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Notice"
      updated="22 September 2026"
      intro="BallFindr currently does not intentionally use analytics, advertising or behavioural tracking cookies. We may use cookies and similar technologies that are strictly necessary to operate the website and provide requested functionality."
    >
      <LegalSection heading="1. Strictly necessary technologies">
        <p>Some technologies may be necessary for BallFindr to:</p>
        <LegalList
          items={[
            "Keep users signed in",
            "Authenticate accounts",
            "Protect accounts from unauthorised access",
            "Maintain security",
            "Remember essential settings",
            "Provide core website functionality",
          ]}
        />
      </LegalSection>

      <LegalSection heading="2. Analytics and non-essential tracking">
        <p>
          BallFindr does not currently intentionally use Google Analytics, Google Tag Manager,
          Hotjar, Microsoft Clarity, advertising pixels or similar non-essential tracking services.
        </p>
        <p>
          If BallFindr introduces analytics, advertising or other non-essential tracking
          technologies in the future, this notice will be updated and any required consent
          mechanism will be implemented.
        </p>
      </LegalSection>

      <LegalSection heading="3. Third-party services">
        <p>
          BallFindr uses third-party infrastructure and services where necessary to operate the
          platform. This currently includes Supabase for backend, database and authentication
          functionality.
        </p>
      </LegalSection>

      <LegalSection heading="4. Changes">
        <p>As BallFindr develops, technologies used by the website may change.</p>
        <p>
          If non-essential cookies or tracking technologies are introduced, this notice will be
          updated and any legally required consent mechanism will be implemented.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>
          For questions about cookies or similar technologies: <LegalEmail />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
