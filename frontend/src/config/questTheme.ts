/**
 * KOS Quest Mythological Theme Configuration
 *
 * Maps technical assessment categories to Greek mythology themes,
 * creating an engaging and memorable experience for candidates.
 */

export interface QuestCategory {
  id: string;
  name: string;
  deity: string;
  title: string;
  description: string;
  shortDescription: string;
  icon: string; // Lucide icon name
  color: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: string;
  };
  mythology: string;
}

export const QUEST_CATEGORIES: Record<string, QuestCategory> = {
  brain_teaser: {
    id: "brain_teaser",
    name: "Brain Teaser",
    deity: "Sibyl",
    title: "The Sibyl's Riddles",
    description: "Channel the wisdom of the ancient Sibyl, oracle of Apollo, as you unravel prophetic puzzles that test your logical reasoning and creative problem-solving abilities.",
    shortDescription: "Prophetic riddles testing logic and reasoning",
    icon: "Scroll",
    color: {
      primary: "#9333EA", // Purple
      secondary: "#A855F7",
      accent: "#C084FC",
      gradient: "from-purple-600 to-violet-500",
    },
    mythology: "The Sibyl was a legendary prophetess who spoke in riddles and prophecies, guiding heroes through impossible choices.",
  },
  coding: {
    id: "coding",
    name: "Coding",
    deity: "Hephaestus",
    title: "Hephaestus' Forge",
    description: "Enter the divine forge of Hephaestus, god of craftsmanship, where you'll shape elegant solutions from raw logic, crafting code as the god crafted armor for the Olympians.",
    shortDescription: "Forging elegant code solutions",
    icon: "Hammer",
    color: {
      primary: "#EA580C", // Orange
      secondary: "#F97316",
      accent: "#FB923C",
      gradient: "from-orange-600 to-amber-500",
    },
    mythology: "Hephaestus, the divine blacksmith, forged legendary artifacts including Achilles' armor and Hermes' winged sandals.",
  },
  code_review: {
    id: "code_review",
    name: "Code Review",
    deity: "Prometheus",
    title: "Prometheus' Gift",
    description: "Embrace the knowledge Prometheus brought to humanity. Analyze code with the same foresight that allowed Prometheus to see what others could not, identifying hidden flaws and vulnerabilities.",
    shortDescription: "Bringing light to hidden code issues",
    icon: "Flame",
    color: {
      primary: "#DC2626", // Red
      secondary: "#EF4444",
      accent: "#F87171",
      gradient: "from-red-600 to-orange-500",
    },
    mythology: "Prometheus stole fire from the gods to give humanity knowledge and foresight, seeing truths others missed.",
  },
  system_design: {
    id: "system_design",
    name: "System Design",
    deity: "Athena",
    title: "Athena's Architecture",
    description: "Draw upon the strategic brilliance of Athena, goddess of wisdom and warfare. Design systems with the same architectural genius that built the Parthenon and won countless battles.",
    shortDescription: "Strategic wisdom in system architecture",
    icon: "Building2",
    color: {
      primary: "#2563EB", // Blue
      secondary: "#3B82F6",
      accent: "#60A5FA",
      gradient: "from-blue-600 to-cyan-500",
    },
    mythology: "Athena, born from Zeus's head fully armored, embodies wisdom, strategic thinking, and the art of civilization.",
  },
  signal_processing: {
    id: "signal_processing",
    name: "Signal Processing",
    deity: "Asclepius",
    title: "Asclepius' Healing Arts",
    description: "Walk the path of Asclepius, god of medicine, as you process and interpret signals that reveal hidden patterns. Your work bridges the gap between data and healing insights.",
    shortDescription: "Processing signals for biomedical insights",
    icon: "Activity",
    color: {
      primary: "#059669", // Emerald
      secondary: "#10B981",
      accent: "#34D399",
      gradient: "from-emerald-600 to-teal-500",
    },
    mythology: "Asclepius could heal any ailment and even resurrect the dead, his rod entwined with a serpent remains the symbol of medicine.",
  },
  ml_algo: {
    id: "ml_algo",
    name: "ML & Algorithms",
    deity: "Prometheus",
    title: "Prometheus' Foresight",
    description: "Harness Prometheus' gift of foresight through machine learning. Train models that predict the future, bringing the fire of artificial intelligence to solve complex problems.",
    shortDescription: "Machine learning and predictive algorithms",
    icon: "Brain",
    color: {
      primary: "#7C3AED", // Violet
      secondary: "#8B5CF6",
      accent: "#A78BFA",
      gradient: "from-violet-600 to-purple-500",
    },
    mythology: "Prometheus, whose name means 'forethought', could see the future and gave humanity the tools to shape their destiny.",
  },
  general_engineering: {
    id: "general_engineering",
    name: "General Engineering",
    deity: "Daedalus",
    title: "Daedalus' Workshop",
    description: "Enter the legendary workshop of Daedalus, the master craftsman who built the Labyrinth and crafted wings to escape it. Demonstrate your foundational engineering knowledge across algorithms, design patterns, and software craftsmanship.",
    shortDescription: "Foundational engineering concepts and practices",
    icon: "Wrench",
    color: {
      primary: "#0891B2", // Cyan
      secondary: "#06B6D4",
      accent: "#22D3EE",
      gradient: "from-cyan-600 to-sky-500",
    },
    mythology: "Daedalus was the greatest inventor and craftsman, whose works included the Labyrinth of Crete and the wings of Icarus.",
  },
};

// Helper function to get quest category by ID
export function getQuestCategory(categoryId: string): QuestCategory | undefined {
  return QUEST_CATEGORIES[categoryId];
}

// Helper function to get themed category name
export function getQuestName(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.title : categoryId;
}

// Helper function to get deity name
export function getDeityName(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.deity : categoryId;
}

// Helper function to get short themed name
export function getQuestShortName(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? `${category.deity}'s Challenge` : categoryId;
}

// KOS Quest branding configuration
export const QUEST_BRANDING = {
  name: "KOS Quest",
  tagline: "Forge Your Legend",
  subtitle: "A Mythological Engineering Assessment",
  description: "Embark on an epic journey through the challenges of the Greek gods. Each trial tests a different aspect of your engineering prowess, guided by the wisdom of ancient deities.",
  welcome: {
    title: "Welcome, Challenger",
    intro: "You stand at the threshold of KOS Quest, where the ancient wisdom of Greek mythology meets modern engineering excellence.",
    instructions: [
      "Each challenge is inspired by a Greek deity who embodies the skills being tested.",
      "Take your time to craft thoughtful solutions worthy of the gods.",
      "Your journey will be evaluated by our AI oracle, providing detailed feedback.",
      "Remember: heroes are forged through trials, not born."
    ],
  },
  colors: {
    primary: "#1E1B4B", // Deep indigo
    secondary: "#312E81",
    accent: "#C9A227", // Gold
    background: "from-slate-900 via-indigo-950 to-slate-900",
  },
  // Placeholder for logo - will be replaced with actual logo
  logo: {
    placeholder: true,
    width: 120,
    height: 40,
    alt: "KOS Quest Logo",
  },
};

// Difficulty levels with mythological flavor
export const QUEST_DIFFICULTY = {
  junior: {
    name: "Initiate",
    description: "Begin your journey as a promising initiate",
    icon: "Sparkles",
  },
  mid: {
    name: "Hero",
    description: "Prove yourself as a capable hero",
    icon: "Shield",
  },
  senior: {
    name: "Champion",
    description: "Face trials worthy of Olympian champions",
    icon: "Crown",
  },
};

// Recommendation levels with mythological flavor
export const QUEST_RECOMMENDATIONS = {
  strong_hire: {
    name: "Olympian",
    description: "Worthy of a seat among the gods",
    color: "#22C55E",
    icon: "Trophy",
  },
  hire: {
    name: "Hero",
    description: "A true hero ready for great deeds",
    color: "#3B82F6",
    icon: "Medal",
  },
  maybe: {
    name: "Aspirant",
    description: "Shows promise, needs more trials",
    color: "#EAB308",
    icon: "Target",
  },
  no_hire: {
    name: "Mortal",
    description: "Not yet ready for this quest",
    color: "#EF4444",
    icon: "XCircle",
  },
};
