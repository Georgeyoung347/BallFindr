/**
 * Terms of use page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { LegalEmail, LegalList, LegalPage, LegalSection } from "@/components/site/LegalPage";

const title = "Terms & Conditions | BallFindr";
const description =
  "The terms that govern use of BallFindr, the football recruitment platform connecting players and clubs.";

export const Route = createFileRoute("/terms")({
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
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="22 September 2026"
      intro="These Terms and Conditions (“Terms”) govern your use of BallFindr, available at https://ballfindr.co.uk/. By creating an account or using BallFindr, you agree to these Terms. If you do not agree with these Terms, you should not use BallFindr."
    >
      <LegalSection heading="1. About BallFindr">
        <p>
          BallFindr is a football recruitment platform designed to help players and clubs discover
          and connect with one another.
        </p>
        <p>
          BallFindr provides a platform for users to create profiles, search for players or clubs
          and communicate with other users.
        </p>
        <p>
          BallFindr does not employ players, represent clubs or guarantee that a player will be
          offered a position or that a club will recruit a particular player.
        </p>
        <p>
          Any agreement, trial, signing, payment, employment arrangement or other relationship
          between a player and a club is between those parties.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>BallFindr is intended for people aged 16 and over.</p>
        <p>By creating an account, you confirm that:</p>
        <LegalList
          items={[
            "You are at least 16 years old.",
            "The information you provide is accurate to the best of your knowledge.",
            "You are legally able to enter into these Terms.",
          ]}
        />
        <p>Users under 16 are not permitted to use BallFindr.</p>
      </LegalSection>

      <LegalSection heading="3. Creating an account">
        <p>You agree to:</p>
        <LegalList
          items={[
            "Provide accurate information.",
            "Keep account information up to date.",
            "Keep login details secure.",
            "Not allow another person to use your account.",
            "Notify BallFindr if you believe your account has been compromised.",
          ]}
        />
        <p>
          You must not create an account using another person's identity or information without
          permission.
        </p>
      </LegalSection>

      <LegalSection heading="4. Player profiles">
        <p>Players are responsible for information they publish.</p>
        <p>You must not deliberately provide false or misleading information about:</p>
        <LegalList
          items={[
            "Identity",
            "Age",
            "Playing position",
            "Football history",
            "Playing level",
            "Statistics",
            "Qualifications",
            "Availability",
            "Other material information",
          ]}
        />
        <p>BallFindr does not guarantee that information supplied by users is accurate.</p>
      </LegalSection>

      <LegalSection heading="5. Club profiles">
        <p>Clubs are responsible for information they publish.</p>
        <p>Clubs must not deliberately provide false or misleading information about:</p>
        <LegalList
          items={[
            "Club identity",
            "Location",
            "League or level",
            "Fees",
            "Facilities",
            "Recruitment opportunities",
            "Club representatives",
            "Other material information",
          ]}
        />
        <p>BallFindr may request additional information when verifying a club.</p>
      </LegalSection>

      <LegalSection heading="6. User content">
        <p>You retain responsibility for content submitted to BallFindr.</p>
        <p>
          By submitting content, you grant BallFindr a non-exclusive, worldwide, royalty-free
          licence to host, store, reproduce and display that content as reasonably necessary to
          operate and promote the BallFindr service.
        </p>
        <p>You confirm that you have the right to submit the content.</p>
        <p>You must not upload content that:</p>
        <LegalList
          items={[
            "Infringes intellectual property rights",
            "Contains unlawful material",
            "Impersonates another person or organisation",
            "Is deliberately misleading",
            "Is abusive or threatening",
            "Contains hateful or discriminatory abuse",
            "Is sexually explicit",
            "Promotes illegal activity",
            "Is intended to scam or defraud",
            "Contains malicious software",
            "Unreasonably invades another person's privacy",
          ]}
        />
      </LegalSection>

      <LegalSection heading="7. Messaging">
        <p>Messaging must be used for legitimate football-related communication.</p>
        <p>You must not use BallFindr messaging to:</p>
        <LegalList
          items={[
            "Harass another user",
            "Threaten another user",
            "Send spam",
            "Send scams or fraudulent offers",
            "Repeatedly contact someone who has asked you to stop",
            "Send unlawful or inappropriate material",
            "Attempt to obtain passwords or financial information fraudulently",
            "Promote unrelated commercial services without permission",
          ]}
        />
      </LegalSection>

      <LegalSection heading="8. Reporting">
        <p>
          Users can report profiles, messages or other activity they believe breaches these Terms.
        </p>
        <p>Reports should be made honestly and in good faith.</p>
        <p>Deliberately false or malicious reports may result in action against an account.</p>
        <p>
          BallFindr may investigate reports and review relevant information where reasonably
          necessary.
        </p>
      </LegalSection>

      <LegalSection heading="9. Moderation and safety">
        <p>
          BallFindr may take action where we believe an account or activity breaches these Terms or
          presents a risk to users or the platform.
        </p>
        <p>Possible actions include:</p>
        <LegalList
          items={[
            "Warning a user",
            "Removing content",
            "Restricting an account",
            "Temporarily suspending an account",
            "Permanently banning an account",
            "Removing a profile",
            "Preventing use of certain features",
          ]}
        />
        <p>
          BallFindr may retain records of moderation actions for security, legal and
          platform-management purposes.
        </p>
      </LegalSection>

      <LegalSection heading="10. Founder and verification badges">
        <p>BallFindr may provide verification, Founder Club or other platform badges.</p>
        <p>
          A badge does not guarantee the accuracy of every piece of information on a profile and
          does not constitute an endorsement, employment relationship or guarantee of a player or
          club.
        </p>
      </LegalSection>

      <LegalSection heading="11. Prohibited use">
        <p>You must not:</p>
        <LegalList
          items={[
            "Use BallFindr for unlawful purposes.",
            "Attempt unauthorised access to another account.",
            "Attempt to bypass security measures.",
            "Interfere with BallFindr's operation.",
            "Scrape or systematically collect user information without permission.",
            "Use automated systems to abuse or overload the platform.",
            "Reverse engineer or compromise the service.",
            "Create accounts to evade restrictions or bans.",
            "Impersonate BallFindr, a club, a player or another person.",
            "Distribute malware or malicious code.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="12. Privacy and under-18 users">
        <p>BallFindr allows users aged 16 and 17 to use the platform.</p>
        <p>
          BallFindr takes appropriate account of the privacy and safety needs of users under 18.
        </p>
        <p>The Privacy Notice explains how BallFindr handles personal information.</p>
      </LegalSection>

      <LegalSection heading="13. Availability">
        <p>
          We aim to keep BallFindr available and functioning but cannot guarantee uninterrupted or
          error-free service.
        </p>
        <p>
          We may temporarily suspend or restrict the service for maintenance, security, technical
          problems, updates, emergencies or other operational reasons.
        </p>
      </LegalSection>

      <LegalSection heading="14. Third-party services">
        <p>BallFindr may rely on third-party services and infrastructure.</p>
        <p>
          We are not responsible for failures caused by third-party services outside our reasonable
          control.
        </p>
      </LegalSection>

      <LegalSection heading="15. Recruitment disclaimer">
        <p>BallFindr is a platform for connecting football players and clubs.</p>
        <p>We do not guarantee:</p>
        <LegalList
          items={[
            "That a player will find a club.",
            "That a club will find a player.",
            "That a club will offer a trial.",
            "That a player will be selected.",
            "That information supplied by another user is accurate.",
            "That a particular opportunity will remain available.",
          ]}
        />
        <p>
          Users should make appropriate checks before entering into arrangements with another user
          or club.
        </p>
      </LegalSection>

      <LegalSection heading="16. Payments and financial arrangements">
        <p>BallFindr does not currently process player-club payments through the platform.</p>
        <p>
          If a player and club agree to any payment, fee, membership, subscription, match fee,
          expenses or other financial arrangement, that arrangement is between those parties unless
          BallFindr expressly states otherwise.
        </p>
        <p>Users should exercise appropriate caution before sending money to another user.</p>
      </LegalSection>

      <LegalSection heading="17. Intellectual property">
        <p>
          The BallFindr name, branding, logos, website design, software and other BallFindr-owned
          materials belong to BallFindr or its licensors unless stated otherwise.
        </p>
        <p>
          You must not copy, reproduce, modify, distribute or commercially exploit BallFindr-owned
          materials without permission.
        </p>
      </LegalSection>

      <LegalSection heading="18. Account suspension and termination">
        <p>You may stop using BallFindr at any time.</p>
        <p>
          BallFindr may suspend or terminate an account where reasonably necessary, including where:
        </p>
        <LegalList
          items={[
            "These Terms have been breached.",
            "The account presents a security risk.",
            "The account is involved in fraud or abuse.",
            "The account is being used unlawfully.",
            "The account is being used to evade a previous restriction.",
            "We are required to do so for legal or regulatory reasons.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="19. Limitation of liability">
        <p>
          Nothing in these Terms excludes or limits liability that cannot legally be excluded or
          limited, including liability for death or personal injury caused by negligence, fraud or
          fraudulent misrepresentation, or any other liability that cannot lawfully be excluded.
        </p>
        <p>
          Subject to the above, BallFindr will not be responsible for losses that are not reasonably
          foreseeable or that arise from users' interactions with one another.
        </p>
        <p>
          BallFindr does not accept responsibility for the actions, statements, conduct or omissions
          of individual users or clubs.
        </p>
      </LegalSection>

      <LegalSection heading="20. Changes to these Terms">
        <p>We may update these Terms from time to time.</p>
        <p>Where changes are made, the updated version will be published on BallFindr.</p>
        <p>Where appropriate, significant changes will be brought to users' attention.</p>
      </LegalSection>

      <LegalSection heading="21. Governing law">
        <p>These Terms are governed by the laws of England and Wales.</p>
        <p>
          The courts of England and Wales will have jurisdiction over disputes relating to these
          Terms, subject to any mandatory rights available under applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="22. Contact">
        <p>
          For questions about these Terms: <LegalEmail />
        </p>
        <p>These Terms were last updated on 22 September 2026.</p>
      </LegalSection>
    </LegalPage>
  );
}
