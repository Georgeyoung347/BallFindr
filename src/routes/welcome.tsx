/**
 * Post-signup setup: core profile details (required for new accounts, skippable for existing ones).
 */
import { ClubStatusChoice, FREE_AGENT, isFreeAgent } from "@/components/profile/ClubStatusChoice";
import { takeReturnTo } from "@/lib/share";
/**
 * Optional post-signup setup screen.
 *
 * The player/club record already exists (created by handle_new_user on signup),
 * so this screen only ever UPDATES that row - it never inserts a second record.
 * Players must complete their required Core Information (all but secondary
 * positions); clubs' fields stay optional with "Skip for now". Anything left blank can be completed later from Edit profile.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { OnboardingShell } from "@/components/site/OnboardingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProfileImageField } from "@/components/profile/ProfileImageField";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { resolveProfileImage } from "@/lib/profile-images";
import {
  dbPositions,
  usePlayerLevels,
  MAX_HEIGHT_INCHES,
  MIN_HEIGHT_INCHES,
  savePlayerImage,
  dbAvailabilityOptions,
  type DbAvailability,
  type DbPosition,
} from "@/lib/player-profile";
import { availabilityLabels, trainingDayOptions, type TrainingDay } from "@/data/app-config";
import { saveClubImage } from "@/lib/club-profile";

const title = "Finish setting up your BallFindr profile";
const description = "Add a few optional details now, or skip and complete your profile later.";

export const Route = createFileRoute("/welcome")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const feetOptions = [4, 5, 6, 7];
const inchOptions = Array.from({ length: 12 }, (_, i) => i);

const fieldClass =
  "w-full rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-base text-foreground md:text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

interface SetupContext {
  userId: string;
  accountType: "player" | "club";
  location: string;
  levelId: number | null;
  primaryPosition: DbPosition | null;
  heightInches: number | null;
  dateOfBirth: string;
  displayName: string;
  matchDay: string;
  currentClubName: string;
  preferredLevelId: number | null;
  availability: DbAvailability | null;
  trainingDays: TrainingDay[];
  secondaryPositions: DbPosition[];
  badgePath: string | null;
  badgeUrl: string | null;
}

/** Reads the member's existing record so the screen pre-fills what is there. */
async function fetchSetupContext(): Promise<SetupContext | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("account_type, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const accountType = profile?.account_type === "club" ? "club" : "player";

  if (accountType === "club") {
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("location, badge_path, level_id, training_days, match_day")
      .eq("id", user.id)
      .maybeSingle();
    if (clubError) throw clubError;
    return {
      userId: user.id,
      accountType,
      location: club?.location ?? "",
      levelId: club?.level_id ?? null,
      primaryPosition: null,
      heightInches: null,
      dateOfBirth: "",
      displayName: profile?.display_name ?? "",
      matchDay: club?.match_day ?? "",
      currentClubName: "",
      preferredLevelId: null,
      availability: null,
      trainingDays: ((club?.training_days ?? []) as TrainingDay[]).filter(Boolean),
      secondaryPositions: [],
      badgePath: club?.badge_path ?? null,
      badgeUrl: await resolveProfileImage(club?.badge_path),
    };
  }

  const [{ data: player, error: playerError }, dobRes] = await Promise.all([
    supabase
      .from("players")
      .select(
        "level_id, primary_position, height_inches, current_club_name, preferred_level_id, availability, secondary_positions",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("my_player_private"),
  ]);
  if (playerError) throw playerError;
  const dob = (dobRes.data as { date_of_birth: string | null }[] | null)?.[0]?.date_of_birth ?? "";
  // location lives behind the gated player_details() read path
  const { data: details } = await supabase.rpc("player_details", { _player_id: user.id });
  const detailRow = (details as { location: string | null; preferred_training_days: string[] | null }[] | null)?.[0];
  const location = detailRow?.location ?? "";

  return {
    userId: user.id,
    accountType,
    location,
    levelId: player?.level_id ?? null,
    primaryPosition: (player?.primary_position as DbPosition | null) ?? null,
    heightInches: player?.height_inches ?? null,
    dateOfBirth: dob,
    displayName: profile?.display_name ?? "",
    matchDay: "",
    currentClubName: player?.current_club_name ?? "",
    preferredLevelId: player?.preferred_level_id ?? null,
    availability: (player?.availability as DbAvailability | null) ?? null,
    trainingDays: ((detailRow?.preferred_training_days ?? []) as TrainingDay[]).filter(Boolean),
    secondaryPositions: ((player?.secondary_positions ?? []) as DbPosition[]).filter(Boolean),
    badgePath: null,
    badgeUrl: null,
  };
}

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function WelcomePage() {
  const navigate = useNavigate();
  const { data: context, isPending, error } = useQuery({
    queryKey: ["profile-setup"],
    queryFn: fetchSetupContext,
    staleTime: 0,
  });
  const { data: levels = [] } = usePlayerLevels();

  const [location, setLocation] = useState("");
  const [levelId, setLevelId] = useState<number | null>(null);
  const [position, setPosition] = useState<DbPosition | null>(null);
  const [heightInches, setHeightInches] = useState<number | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [matchDay, setMatchDay] = useState("");
  const [currentClubName, setCurrentClubName] = useState("");
  const [hasClub, setHasClub] = useState<boolean | null>(null);
  const [preferredLevelId, setPreferredLevelId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<DbAvailability | null>(null);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [secondary, setSecondary] = useState<DbPosition[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [badgePath, setBadgePath] = useState<string | null>(null);
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!context) return;
    setLocation(context.location);
    setLevelId(context.levelId);
    setPosition(context.primaryPosition);
    setHeightInches(context.heightInches);
    setDateOfBirth(context.dateOfBirth);
    setDisplayName(context.displayName);
    setCurrentClubName(isFreeAgent(context.currentClubName) ? "" : context.currentClubName);
    setHasClub(isFreeAgent(context.currentClubName) ? false : context.currentClubName.trim() ? true : null);
    setMatchDay(context.matchDay);
    setPreferredLevelId(context.preferredLevelId);
    setAvailability(context.availability);
    setTrainingDays(context.trainingDays);
    setSecondary(context.secondaryPositions);
    setBadgePath(context.badgePath);
    setBadgeUrl(context.badgeUrl);
  }, [context]);

  useEffect(() => {
    if (!isPending && context === null) {
      void navigate({ to: "/auth", search: { type: "player", mode: "signin" } });
    }
  }, [isPending, context, navigate]);

  const goToApp = () => {
    const back = takeReturnTo();
    if (back) return void navigate({ href: back });
    void navigate({ to: context?.accountType === "club" ? "/club" : "/player" });
  };

  const clubMissing = [
    !badgePath && "club badge",
    !location.trim() && "location",
    levelId === null && "current level",
    trainingDays.length === 0 && "training days",
    !matchDay.trim() && "match days",
  ].filter(Boolean) as string[];
  const playerMissing = [
    !displayName.trim() && "name",
    ageFrom(dateOfBirth) === null && "age",
    heightInches === null && "height",
    !location.trim() && "location",
    hasClub === null && "whether you currently have a club",
    hasClub === true && !currentClubName.trim() && "current club",
    hasClub === true && levelId === null && "current level",
    position === null && "primary position",
    preferredLevelId === null && "preferred playing level",
    availability === null && "availability",
    trainingDays.length === 0 && "preferred training days",
  ].filter(Boolean) as string[];
  const missing = context?.accountType === "club" ? clubMissing : playerMissing;

  const feet = heightInches ? Math.floor(heightInches / 12) : null;
  const inches = heightInches ? heightInches % 12 : null;

  function setHeight(nextFeet: number | null, nextInches: number | null) {
    if (nextFeet === null) {
      setHeightInches(null);
      return;
    }
    const total = nextFeet * 12 + (nextInches ?? 0);
    setHeightInches(total >= MIN_HEIGHT_INCHES && total <= MAX_HEIGHT_INCHES ? total : null);
  }

  async function onSave() {
    if (!context) return;
    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(`Please complete: ${missing.join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      if (context.accountType === "club") {
        // Updates the club record created at signup - never inserts a new one.
        const { error: clubError } = await supabase
          .from("clubs")
          .update({
            location: location.trim(),
            level_id: levelId,
            training_days: trainingDays,
            match_day: matchDay.trim(),
          })
          .eq("id", context.userId);
        if (clubError) throw clubError;
      } else {
        const { error: playerError } = await supabase
          .from("players")
          .update({
            location: location.trim(),
            level_id: hasClub ? levelId : null,
            primary_position: position,
            height_inches: heightInches,
            current_club_name: hasClub ? currentClubName.trim() : FREE_AGENT,
            has_club: hasClub === true,
            preferred_level_id: preferredLevelId,
            availability: availability!,
            preferred_training_days: trainingDays,
            secondary_positions: secondary.filter((s) => s !== position),
          })
          .eq("id", context.userId);
        if (playerError) throw playerError;

        const { error: nameError } = await supabase
          .from("profiles")
          .update({ display_name: displayName.trim() })
          .eq("id", context.userId);
        if (nameError) throw nameError;

        if (dateOfBirth && dateOfBirth !== context.dateOfBirth) {
          const { error: dobError } = await supabase
            .from("player_private")
            .upsert({ player_id: context.userId, date_of_birth: dateOfBirth }, { onConflict: "player_id" });
          if (dobError) throw dobError;
        }
      }
      toast.success("Profile updated");
      goToApp();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending || !context) {
    return (
      <OnboardingShell eyebrow="Setup" title="Setting things up…" description="One moment.">
        <p className="text-sm text-muted-foreground">
          {error ? "We couldn't load your account. You can continue and edit your profile later." : "Loading…"}
        </p>
      </OnboardingShell>
    );
  }

  const isClub = context.accountType === "club";
  const age = ageFrom(dateOfBirth);
  const errCls = (bad: boolean) => (showErrors && bad ? "text-destructive" : undefined);

  return (
    <OnboardingShell
      eyebrow="Welcome to BallFindr"
      title={isClub ? "Complete your club profile" : "Complete your player profile"}
      description={
        isClub
          ? "Before your club can be discovered by players, complete your Core Information. This gives players the key information they need to understand your club."
          : "Before your profile can be discovered by clubs, complete your Core Information. This gives clubs the key information they need to understand what you're looking for."
      }
    >
      <div className="w-full space-y-5 text-left">
        {isClub ? (
          <>
            <p className="text-xs text-muted-foreground">All five fields are required. Everything else can be added later from Edit profile.</p>
            <ProfileImageField
              label="Club badge *"
              hint="Required. Square images work best."
              imageUrl={badgeUrl}
              shape="avatar"
              onChange={async (file) => {
                const next = await saveClubImage("badge", file, badgePath);
                setBadgePath(next.path);
                setBadgeUrl(next.url);
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="setup-location" className={errCls(!location.trim())}>Location *</Label>
              <Input
                id="setup-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Chingford, London"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-club-level" className={errCls(levelId === null)}>Current level *</Label>
              <select id="setup-club-level" className={fieldClass} value={levelId ?? ""}
                onChange={(e) => setLevelId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select level</option>
                {levels.map((level) => (<option key={level.id} value={level.id}>{level.name}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={errCls(trainingDays.length === 0)}>Training days *</Label>
              <div className="flex flex-wrap gap-2">
                {trainingDayOptions.map((d) => (
                  <Chip key={d} active={trainingDays.includes(d)} onClick={() =>
                    setTrainingDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
                  }>{d}</Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-match-day" className={errCls(!matchDay.trim())}>Match days *</Label>
              <Input id="setup-match-day" value={matchDay} onChange={(e) => setMatchDay(e.target.value)}
                placeholder="e.g. Saturday" maxLength={60} />
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">All fields are required except secondary positions.</p>
            <div className="space-y-1.5">
              <Label htmlFor="setup-name" className={errCls(!displayName.trim())}>Name *</Label>
              <Input id="setup-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="setup-dob" className={errCls(age === null)}>Age (date of birth) *</Label>
              <Input id="setup-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {age !== null
                  ? `Clubs see your age (${age}), never your date of birth.`
                  : "Clubs only ever see your age, never your date of birth."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className={errCls(heightInches === null)}>Height *</Label>
              <div className="flex gap-2">
                <select className={fieldClass} aria-label="Feet" value={feet ?? ""}
                  onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : null, inches)}>
                  <option value="">ft</option>
                  {feetOptions.map((f) => (<option key={f} value={f}>{f} ft</option>))}
                </select>
                <select className={fieldClass} aria-label="Inches" value={inches ?? ""}
                  onChange={(e) => setHeight(feet, e.target.value ? Number(e.target.value) : 0)} disabled={feet === null}>
                  <option value="">in</option>
                  {inchOptions.map((i) => (<option key={i} value={i}>{i} in</option>))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="setup-location" className={errCls(!location.trim())}>Location *</Label>
              <Input id="setup-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Walthamstow, London" maxLength={120} />
            </div>

            <ClubStatusChoice required value={hasClub} error={showErrors && hasClub === null}
              onChange={(v) => { setHasClub(v); if (!v) { setCurrentClubName(""); setLevelId(null); } }} />

            {hasClub ? (<>
            <div className="space-y-1.5">
              <Label htmlFor="setup-club" className={errCls(!currentClubName.trim())}>Current club *</Label>
              <Input id="setup-club" value={currentClubName} onChange={(e) => setCurrentClubName(e.target.value)} placeholder="Your club's name" maxLength={120} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="setup-level" className={errCls(levelId === null)}>Current level *</Label>
              <select id="setup-level" className={fieldClass} value={levelId ?? ""}
                onChange={(e) => setLevelId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select level</option>
                {levels.map((level) => (<option key={level.id} value={level.id}>{level.name}</option>))}
              </select>
            </div>
            </>) : null}

            <div className="space-y-1.5">
              <Label className={errCls(position === null)}>Primary position *</Label>
              <div className="flex flex-wrap gap-2">
                {dbPositions.map((pos) => (
                  <Chip key={pos} active={position === pos} onClick={() => {
                    setPosition(position === pos ? null : pos);
                    setSecondary((cur) => cur.filter((s) => s !== pos));
                  }}>{pos}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Secondary positions (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {dbPositions.filter((p) => p !== position).map((pos) => (
                  <Chip key={pos} active={secondary.includes(pos)} onClick={() =>
                    setSecondary((cur) => (cur.includes(pos) ? cur.filter((s) => s !== pos) : [...cur, pos]))
                  }>{pos}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="setup-pref-level" className={errCls(preferredLevelId === null)}>Preferred playing level *</Label>
              <select id="setup-pref-level" className={fieldClass} value={preferredLevelId ?? ""}
                onChange={(e) => setPreferredLevelId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select level</option>
                {levels.map((level) => (<option key={level.id} value={level.id}>{level.name}</option>))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className={errCls(availability === null)}>Availability *</Label>
              <div className="flex flex-wrap gap-2">
                {dbAvailabilityOptions.map((a) => (
                  <Chip key={a} active={availability === a} onClick={() => setAvailability(a)}>{availabilityLabels[a]}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={errCls(trainingDays.length === 0)}>Preferred training days *</Label>
              <div className="flex flex-wrap gap-2">
                {trainingDayOptions.map((d) => (
                  <Chip key={d} active={trainingDays.includes(d)} onClick={() =>
                    setTrainingDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
                  }>{d}</Chip>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button variant="volt" size="lg" onClick={onSave} disabled={busy} className="sm:flex-1">
            {busy ? "Saving…" : "Complete and continue"}
          </Button>
          <Button variant="voltOutline" size="lg" onClick={() => setConfirmSkip(true)} disabled={busy} className="sm:flex-1">
            Skip for now
          </Button>
        </div>
      </div>
      <AlertDialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {isClub
                ? "Your club profile will not be discoverable by players until you complete your Core Information. You can complete it later from your profile."
                : "Your profile will not be discoverable by clubs until you complete your Core Information. You can complete it later from your profile."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue setup</AlertDialogCancel>
            <AlertDialogAction onClick={goToApp}>Skip for now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OnboardingShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-elevated/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
