export type TopFile = {
  path: string;
  module: string;
  additions: number;
  uniqueAuthors: number;
};

export type InfluenceFile = {
  path: string;
  module: string;
  laterAuthors: number;
  earlyRank: number;   // 1 = first contributor, 2 = second, 3 = third
  totalAuthors: number;
};

export type TopPR = {
  title: string;
  files: number;
  loc: number;
  weight: number;
};

export type ModuleContrib = {
  module: string;
  fileCount: number;
  additions: number;
};

export type ModuleScore = {
  centralityScore: number;
  influenceScore:  number;
  breadthScore:    number;
  shippingScore:   number;
  reviewingScore:  number;
  impactScore:     number;
};

export type Engineer = {
  login: string;
  avatarUrl: string;
  prCount: number;
  filesCount: number;
  uniqueModules: number;
  centralityScore: number;
  influenceScore:  number;
  breadthScore:    number;
  shippingScore:   number;
  reviewingScore:  number;
  impactScore: number;
  samplePRTitles: string[];
  topFiles: TopFile[];
  moduleList?: string[];
  influenceFiles?: InfluenceFile[];
  topPRsByWeight?: TopPR[];
  reviewComments?: number;
  reviewApprovals?: number;
  moduleContribs?: ModuleContrib[];
  weeklyShipping?: { week: string; weight: number }[];
  weeklyReviewing?: { week: string; comments: number; approvals: number; total: number }[];
  moduleScores?: Record<string, ModuleScore>;
};

// Each dimension scores 0–20; total impact = sum of all five (0–100)
// Palette: all colors at the same perceived lightness (medium-saturation),
// cool → teal bridge → warm so adjacent bars never clash.
export const DIM = {
  centrality: { label: "Centrality", color: "#5284E8" },   // blue
  influence:  { label: "Influence",  color: "#8B6FE6" },   // violet
  breadth:    { label: "Breadth",    color: "#2FBDAA" },   // teal
  shipping:   { label: "Shipping",   color: "#F0A93E" },   // amber
  reviewing:  { label: "Reviewing",  color: "#E8687A" },   // soft rose
} as const;

export const cardSx = {
  bgcolor: "background.paper",
  borderRadius: 2,
  overflow: "hidden",
} as const;
