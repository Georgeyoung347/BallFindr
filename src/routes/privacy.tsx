/**
 * Privacy policy page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { LegalEmail, LegalList, LegalPage, LegalSection } from "@/components/site/LegalPage";

const title = "Privacy Notice | BallFindr";
const description =
  "How BallFindr collects, uses, stores and protects personal information for players and clubs using the platform.";

export const Route = createFileRoute("/privacy")({
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
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      updated="22 September 2026"
      intro="BallFindr (“BallFindr”, “we”, “us” or “our”) operates the BallFindr football recruitment platform, available at https://ballfindr.co.uk/. This Privacy Notice explains how we collect, use, store and protect personal information when you use BallFindr. We want BallFindr to be a straightforward and useful way for players and clubs to connect, while also being clear about how personal information is handled."
    >
      <LegalSection heading="1. Who is responsible for your information?">
        <p>BallFindr is currently operated by its two founders.</p>
        <p>
          For privacy and data protection enquiries, please contact: <LegalEmail />
        </p>
        <p>BallFindr is responsible for the personal information described in this Privacy Notice.</p>
        <p>We do not publish the founders' home or residential addresses on the BallFindr website.</p>
      </LegalSection>

      <LegalSection heading="2. What information do we collect?">
        <p>Depending on how you use BallFindr, we may collect:</p>
        <p className="font-semibold text-foreground">Account information</p>
        <LegalList
          items={[
            "Name",
            "Email address",
            "Password or authentication information",
            "Account type, such as player or club",
            "Account creation date",
            "Account status",
            "Information required to keep your account secure",
          ]}
        />
        <p className="font-semibold text-foreground">Player profile information</p>
        <LegalList
          items={[
            "Name",
            "Profile photograph",
            "Position",
            "Football level/step",
            "Age",
            "Height",
            "Location",
            "Current club",
            "Previous clubs",
            "Football history",
            "Football statistics",
            "Playing preferences",
            "Other information you choose to include in your profile",
          ]}
        />
        <p className="font-semibold text-foreground">Club profile information</p>
        <LegalList
          items={[
            "Club name",
            "Club badge",
            "Club location",
            "League or level",
            "Club description",
            "Facilities",
            "Fees",
            "Contact information supplied through the platform",
            "Other information you choose to include in your profile",
          ]}
        />
        <p className="font-semibold text-foreground">Messages</p>
        <p>
          If you use BallFindr's messaging functionality, we process messages and related
          information necessary to provide the messaging service.
        </p>
        <p>
          Authorised BallFindr administrators may access relevant messages where reasonably
          necessary to investigate reports, suspected abuse, security issues, breaches of our Terms
          and Conditions, or other platform-safety concerns.
        </p>
        <p className="font-semibold text-foreground">Reports and moderation information</p>
        <p>
          If you report a profile, message or other activity, we may collect and process:
        </p>
        <LegalList
          items={[
            "The report you submit",
            "The reason for the report",
            "Relevant account information",
            "Relevant profile or message information",
            "Information about any action taken as a result of the report",
          ]}
        />
        <p>
          We may also maintain moderation and security records relating to restrictions,
          suspensions, bans and other enforcement actions.
        </p>
        <p className="font-semibold text-foreground">Technical and security information</p>
        <p>We may collect information needed to operate and secure the platform, such as:</p>
        <LegalList
          items={[
            "IP address",
            "Device or browser information",
            "Login and authentication information",
            "Security logs",
            "Information about activity on the platform",
          ]}
        />
        <p>We use this information where necessary to operate, protect and secure BallFindr.</p>
      </LegalSection>

      <LegalSection heading="3. Age information">
        <p>BallFindr is intended for users aged 16 and over.</p>
        <p>
          We may process age or date-of-birth information where necessary to determine whether a
          user meets the minimum age requirement.
        </p>
        <p>A user's full date of birth is not intended to be displayed publicly.</p>
        <p>We do not knowingly allow users under 16 to create BallFindr accounts.</p>
      </LegalSection>

      <LegalSection heading="4. How we use your information">
        <p>We may use personal information to:</p>
        <LegalList
          items={[
            "Create and manage your BallFindr account",
            "Provide BallFindr's player and club recruitment services",
            "Display information that you have chosen to make visible on your profile",
            "Allow players and clubs to find one another",
            "Provide messaging between users",
            "Respond to enquiries",
            "Verify accounts or profiles where applicable",
            "Investigate reports",
            "Prevent spam, fraud, abuse and misuse",
            "Protect the security of BallFindr",
            "Restrict or remove accounts that breach our rules",
            "Maintain records relating to moderation and security",
            "Improve the operation of the platform",
            "Diagnose technical problems",
            "Comply with legal obligations",
            "Establish, exercise or defend legal claims where necessary",
          ]}
        />
        <p>
          We will not use personal information for a new and unrelated purpose unless we have a
          lawful basis to do so and, where required, provide appropriate information to users.
        </p>
      </LegalSection>

      <LegalSection heading="5. Our lawful bases for processing">
        <p>Depending on the circumstances, BallFindr may rely on:</p>
        <p className="font-semibold text-foreground">Contract</p>
        <p>
          We may process information where necessary to provide the BallFindr service you have
          requested. This includes creating accounts, maintaining profiles, providing messaging and
          providing core BallFindr functionality.
        </p>
        <p className="font-semibold text-foreground">Legitimate interests</p>
        <p>
          We may process information where necessary for legitimate interests that are not
          overridden by users' rights and freedoms. This may include:
        </p>
        <LegalList
          items={[
            "Operating and improving BallFindr",
            "Maintaining platform security",
            "Preventing abuse and fraud",
            "Investigating reports",
            "Moderating the platform",
            "Protecting users and BallFindr",
            "Maintaining appropriate records",
          ]}
        />
        <p className="font-semibold text-foreground">Legal obligation</p>
        <p>We may process information where necessary to comply with a legal obligation.</p>
        <p className="font-semibold text-foreground">Consent</p>
        <p>
          Where BallFindr relies on consent, consent will be requested separately and clearly.
          Consent can be withdrawn where applicable.
        </p>
      </LegalSection>

      <LegalSection heading="6. Information displayed on your profile">
        <p>BallFindr is a football recruitment platform.</p>
        <p>
          Some information you choose to add to your profile is intended to be visible to other
          users. Depending on profile settings and current BallFindr functionality, this may
          include:
        </p>
        <LegalList
          items={[
            "Name",
            "Position",
            "Football level",
            "General location",
            "Football history",
            "Football statistics",
            "Profile photograph",
            "Other football-related information you choose to publish",
          ]}
        />
        <p>
          Your email address, password, full date of birth and other private account/security
          information are not intended to be displayed publicly.
        </p>
        <p>
          You should only publish information that you are comfortable sharing with other BallFindr
          users.
        </p>
      </LegalSection>

      <LegalSection heading="7. Who do we share your information with?">
        <p>We may share personal information where necessary to operate BallFindr.</p>
        <p className="font-semibold text-foreground">Other BallFindr users</p>
        <p>Information you choose to publish on your profile may be visible to other users.</p>
        <p className="font-semibold text-foreground">Service providers</p>
        <p>We may use trusted third-party providers for:</p>
        <LegalList
          items={[
            "Database hosting",
            "Authentication",
            "Website infrastructure",
            "Email",
            "Security",
            "Other technical infrastructure",
          ]}
        />
        <p>One infrastructure provider used by BallFindr is Supabase.</p>
        <p>We do not sell personal information to third parties.</p>
        <p className="font-semibold text-foreground">Legal and regulatory purposes</p>
        <p>We may disclose information where reasonably necessary to:</p>
        <LegalList
          items={[
            "Comply with a legal obligation",
            "Respond to lawful requests",
            "Protect the rights, property or safety of BallFindr or others",
            "Investigate fraud, abuse or security issues",
            "Establish, exercise or defend legal claims",
          ]}
        />
      </LegalSection>

      <LegalSection heading="8. International transfers">
        <p>
          Some service providers used by BallFindr may process information outside the United
          Kingdom.
        </p>
        <p>
          Where personal information is transferred internationally, we will take appropriate steps
          required by applicable data protection law to ensure appropriate protection.
        </p>
      </LegalSection>

      <LegalSection heading="9. How long do we keep your information?">
        <p>
          We keep personal information only for as long as reasonably necessary for the purposes
          described in this Privacy Notice.
        </p>
        <p>Generally:</p>
        <LegalList
          items={[
            "Account information is retained while your account remains active.",
            "Profile information is retained while you maintain a profile.",
            "Information associated with a deleted account will be deleted or anonymised where reasonably possible.",
            "Security, fraud and moderation records may be retained for an appropriate period where necessary to protect BallFindr and its users.",
            "Some information may remain temporarily in backups before being overwritten in the normal backup cycle.",
          ]}
        />
        <p>
          We will periodically review information we hold and delete or anonymise information that
          is no longer required, where appropriate.
        </p>
      </LegalSection>

      <LegalSection heading="10. Account deletion">
        <p>BallFindr currently allows users to delete their own accounts.</p>
        <p>Users can use the account deletion functionality available within BallFindr.</p>
        <p>
          Users can also contact: <LegalEmail />
        </p>
        <p>
          When an account is deleted, we will delete or anonymise personal information where
          appropriate.
        </p>
        <p>
          We may retain limited information where necessary for legal obligations, fraud prevention,
          security, abuse prevention, dispute resolution, or legal claims.
        </p>
      </LegalSection>

      <LegalSection heading="11. Your data protection rights">
        <p>
          Depending on the circumstances, you may have rights under UK data protection law,
          including rights to:
        </p>
        <LegalList
          items={[
            "Request access to personal information",
            "Ask us to correct inaccurate information",
            "Ask us to delete personal information",
            "Ask us to restrict processing",
            "Object to certain processing",
            "Request portability of certain information",
            "Withdraw consent where processing is based on consent",
          ]}
        />
        <p>
          Contact: <LegalEmail />
        </p>
        <p>We may need to verify identity before completing certain requests.</p>
      </LegalSection>

      <LegalSection heading="12. Complaints">
        <p>
          If you are unhappy with how BallFindr has handled your personal information, please
          contact: <LegalEmail />
        </p>
        <p>
          You also have the right to complain to the Information Commissioner's Office (ICO).
        </p>
      </LegalSection>

      <LegalSection heading="13. Security">
        <p>
          We take reasonable technical and organisational measures to protect personal information
          against unauthorised access, loss, misuse, alteration or disclosure.
        </p>
        <p>However, no internet-based service can guarantee absolute security.</p>
        <p>
          Users should keep their login credentials confidential and contact us if they believe
          their account has been compromised.
        </p>
      </LegalSection>

      <LegalSection heading="14. Under-18 users">
        <p>BallFindr allows users aged 16 and 17 to use the service.</p>
        <p>
          We recognise that users under 18 require appropriate protection of their personal
          information.
        </p>
        <p>
          BallFindr will take privacy and safety considerations into account when processing
          information belonging to users aged 16 and 17.
        </p>
        <p>We do not knowingly allow anyone under 16 to create a BallFindr account.</p>
      </LegalSection>

      <LegalSection heading="15. Changes to this Privacy Notice">
        <p>
          We may update this Privacy Notice when BallFindr changes, when our use of personal
          information changes, or when applicable legal requirements change.
        </p>
        <p>The latest version will be published on the BallFindr website.</p>
        <p>
          Where changes are significant, we may take additional steps to bring them to users'
          attention where appropriate.
        </p>
      </LegalSection>

      <LegalSection heading="16. Contact">
        <p>
          For privacy and data protection enquiries: <LegalEmail />
        </p>
        <p>This Privacy Notice was last updated on 22 September 2026.</p>
      </LegalSection>
    </LegalPage>
  );
}
