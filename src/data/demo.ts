/**
 * Static demo data for the homepage product preview only (not real users).
 */
import type {
  Club,
  MatchSuggestion,
  PlayerProfile,
  Vacancy,
} from "@/lib/domain";

/**
 * Fictional demo data used only for the landing page product previews.
 * Replace with real queries when the backend is connected.
 */

export const demoPlayer: PlayerProfile = {
  id: "player_demo_1",
  userId: "user_demo_1",
  name: "Jack Wilson",
  position: "ST",
  positionLabel: "Striker",
  location: "London",
  level: "Step 7",
  availability: "actively_looking",
  experience: "3 seasons at Step 8",
  bio: "Quick centre-forward, strong runner in behind. Available Saturdays.",
  stats: [
    { label: "Goals", value: "18" },
    { label: "Assists", value: "7" },
    { label: "Apps", value: "26" },
  ],
};

export const demoClub: Club = {
  id: "club_demo_1",
  userId: "user_demo_2",
  name: "Example FC",
  location: "London",
  league: "Example County League",
  level: "Step 7",
  description: "Ambitious Step 7 side building for promotion.",
};

export const demoVacancies: Vacancy[] = [
  {
    id: "vac_1",
    clubId: demoClub.id,
    position: "ST",
    positionLabel: "Striker",
    level: "Step 7",
    location: "London",
    status: "open",
    createdAt: "2026-08-01",
  },
  {
    id: "vac_2",
    clubId: demoClub.id,
    position: "CM",
    positionLabel: "Central Midfielder",
    level: "Step 7",
    location: "London",
    status: "open",
    createdAt: "2026-08-04",
  },
  {
    id: "vac_3",
    clubId: demoClub.id,
    position: "GK",
    positionLabel: "Goalkeeper",
    level: "Step 7",
    location: "London",
    status: "open",
    createdAt: "2026-08-09",
  },
];

export const demoMatch: MatchSuggestion = {
  playerId: demoPlayer.id,
  clubId: demoClub.id,
  vacancyId: "vac_1",
  score: 94,
  distanceMiles: 8,
};

export const demoCandidates: (PlayerProfile & { score: number; distanceMiles: number })[] =
  [
    { ...demoPlayer, score: 94, distanceMiles: 8 },
    {
      ...demoPlayer,
      id: "player_demo_2",
      name: "Marcus Reid",
      position: "CM",
      positionLabel: "Central Midfielder",
      availability: "open_to_offers",
      score: 88,
      distanceMiles: 12,
      level: "Step 7",
      location: "Croydon",
      stats: [
        { label: "Goals", value: "5" },
        { label: "Assists", value: "11" },
        { label: "Apps", value: "29" },
      ],
    },
    {
      ...demoPlayer,
      id: "player_demo_3",
      name: "Tobi Adeyemi",
      position: "GK",
      positionLabel: "Goalkeeper",
      availability: "actively_looking",
      score: 81,
      distanceMiles: 15,
      level: "Step 8",
      location: "Ilford",
      stats: [
        { label: "Clean sheets", value: "9" },
        { label: "Saves", value: "74" },
        { label: "Apps", value: "24" },
      ],
    },
  ];

export const demoClubRecommendations = [
  { club: demoClub, score: 94, distanceMiles: 8, position: "Striker" },
  {
    club: { ...demoClub, id: "club_2", name: "Northside Athletic", level: "Step 7" },
    score: 87,
    distanceMiles: 11,
    position: "Striker",
  },
  {
    club: { ...demoClub, id: "club_3", name: "Riverford Town", level: "Step 8" },
    score: 79,
    distanceMiles: 14,
    position: "Winger",
  },
];
