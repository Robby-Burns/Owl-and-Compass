"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { supabase, isMocked } from "@/lib/supabase";

function tryRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (e) {
    // Revalidation only works in live Next.js context; safe to bypass in unit tests
  }
}

export interface Founder {
  id: string;
  full_name: string;
  company_name: string;
  company_stage: string;
  industry: string;
  bio: string;
  tech_stack?: string;
  created_at: string;
}

export interface Touchpoint {
  id: string;
  founder_id: string;
  content: string;
  source_type: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  founder_id: string;
  event_type: string;
  summary: string;
  open_loops: string[];
  promises: string[];
  occurred_at: string;
}

export interface VerifiedObservation {
  observation: string;
  hypothesis: string;
  evidence_urls: string[];
}

export interface PrepBrief {
  founder_id: string;
  observations: VerifiedObservation[];
  suggested_questions: string[];
  ways_to_be_helpful: string[];
  linkedin_draft?: string;
  email_draft?: string;
}

// Persisted Mock Database JSON Configuration
const MOCK_DB_FILE = path.join(process.cwd(), "mock-db.json");

function getMockDb(): {
  founders: Founder[];
  touchpoints: Touchpoint[];
  timelineEvents: TimelineEvent[];
} {
  try {
    if (fs.existsSync(MOCK_DB_FILE)) {
      const rawData = fs.readFileSync(MOCK_DB_FILE, "utf8");
      return JSON.parse(rawData);
    }
  } catch (e) {
    console.error("Failed to read mock-db.json file persistence:", e);
  }

  // Initial seed structures
  const initialData = {
    founders: [
      {
        id: "maya-lin-id",
        full_name: "Maya Lin",
        company_name: "Compass Labs",
        company_stage: "Seed",
        industry: "Developer Tools",
        bio: "Developing open-source agent evaluation and testing frameworks.",
        tech_stack: "TypeScript, Python, FastAPI",
        created_at: new Date().toISOString(),
      },
      {
        id: "alex-chen-id",
        full_name: "Alex Chen",
        company_name: "Owl Search",
        company_stage: "Series A",
        industry: "Developer Infrastructure",
        bio: "Building RRF search engines and pgvector index optimizations.",
        tech_stack: "Rust, PostgreSQL, Go",
        created_at: new Date().toISOString(),
      }
    ],
    touchpoints: [],
    timelineEvents: [
      {
        id: "event-1",
        founder_id: "maya-lin-id",
        event_type: "research",
        summary: "Discovered v2 release post with MCP protocol support on their GitHub blog.",
        open_loops: ["Review MCP benchmark performance metrics"],
        promises: [],
        occurred_at: new Date(Date.now() - 86400000).toISOString(),
      }
    ]
  };

  saveMockDb(initialData);
  return initialData;
}

function saveMockDb(data: {
  founders: Founder[];
  touchpoints: Touchpoint[];
  timelineEvents: TimelineEvent[];
}) {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write mock-db.json file persistence:", e);
  }
}

// Input sanitization rule to prevent script injection or database syntax exploits
function sanitizeString(str: string, maxLength: number): string {
  if (!str) return "";
  // Strip HTML / script tags
  let clean = str.replace(/<[^>]*>/g, "");
  // Strip common SQL comment sequences
  clean = clean.replace(/--/g, "").replace(/;/g, "");
  // Limit character length to prevent buffer overloads
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean.trim();
}

export async function getFounders(): Promise<Founder[]> {
  if (isMocked) {
    return getMockDb().founders;
  }

  const { data, error } = await supabase
    .from("founders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching founders:", error);
    return getMockDb().founders; // Fallback
  }
  return data || [];
}

export async function getFounderDetails(founderId: string): Promise<{
  founder: Founder | null;
  touchpoints: Touchpoint[];
  timelineEvents: TimelineEvent[];
}> {
  const cleanId = sanitizeString(founderId, 100);

  if (isMocked) {
    const db = getMockDb();
    const founder = db.founders.find((f) => f.id === cleanId) || null;
    const touchpoints = db.touchpoints.filter((t) => t.founder_id === cleanId);
    const timelineEvents = db.timelineEvents.filter((te) => te.founder_id === cleanId);
    return { founder, touchpoints, timelineEvents };
  }

  const { data: founder, error: founderError } = await supabase
    .from("founders")
    .select("*")
    .eq("id", cleanId)
    .single();

  if (founderError) {
    console.error("Error fetching founder details:", founderError);
    return { founder: null, touchpoints: [], timelineEvents: [] };
  }

  const { data: touchpoints } = await supabase
    .from("workspace_touchpoints")
    .select("*")
    .eq("founder_id", cleanId)
    .order("created_at", { ascending: false });

  const { data: timelineEvents } = await supabase
    .from("founder_timeline_events")
    .select("*")
    .eq("founder_id", cleanId)
    .order("occurred_at", { ascending: false });

  return {
    founder,
    touchpoints: touchpoints || [],
    timelineEvents: timelineEvents || [],
  };
}

export async function createFounder(formData: {
  fullName: string;
  companyName: string;
  companyStage: string;
  industry: string;
  techStack?: string;
  bio: string;
}): Promise<Founder | null> {
  // Input validations and bounds checks
  const fullName = sanitizeString(formData.fullName, 100);
  const companyName = sanitizeString(formData.companyName, 100);
  const companyStage = sanitizeString(formData.companyStage, 50);
  const industry = sanitizeString(formData.industry, 100);
  const techStack = formData.techStack ? sanitizeString(formData.techStack, 200) : "";
  const bio = sanitizeString(formData.bio, 1000);

  if (fullName.length < 2) {
    throw new Error("Full name must be at least 2 characters.");
  }
  if (companyName.length < 1) {
    throw new Error("Company name must be at least 1 character.");
  }
  const allowedStages = ["Pre-Seed", "Seed", "Series A", "Series B+"];
  if (!allowedStages.includes(companyStage)) {
    throw new Error("Invalid company stage.");
  }

  const newFounder = {
    full_name: fullName,
    company_name: companyName,
    company_stage: companyStage,
    industry: industry,
    tech_stack: techStack,
    bio: bio,
  };

  if (isMocked) {
    const db = getMockDb();
    const created: Founder = {
      id: `founder-${Math.random().toString(36).substr(2, 9)}`,
      ...newFounder,
      created_at: new Date().toISOString(),
    };
    db.founders.unshift(created);
    saveMockDb(db);
    tryRevalidatePath("/");
    return created;
  }

  const { data, error } = await supabase
    .from("founders")
    .insert(newFounder)
    .select()
    .single();

  if (error) {
    console.error("Error creating founder:", error);
    return null;
  }

  tryRevalidatePath("/");
  return data;
}

export async function saveTouchpoint(formData: {
  founderId: string;
  content: string;
  sourceType: string;
}): Promise<Touchpoint | null> {
  const founderId = sanitizeString(formData.founderId, 100);
  const content = sanitizeString(formData.content, 50000);
  const sourceType = sanitizeString(formData.sourceType, 50);

  if (!content) {
    throw new Error("Touchpoint content cannot be empty.");
  }

  const newTouchpoint = {
    founder_id: founderId,
    content: content,
    source_type: sourceType,
  };

  if (isMocked) {
    const db = getMockDb();
    const created: Touchpoint = {
      id: `touchpoint-${Math.random().toString(36).substr(2, 9)}`,
      ...newTouchpoint,
      created_at: new Date().toISOString(),
    };
    db.touchpoints.unshift(created);

    // Auto-create a parsed timeline event from the touchpoint text simulation
    const simulatedEvent: TimelineEvent = {
      id: `event-${Math.random().toString(36).substr(2, 9)}`,
      founder_id: founderId,
      event_type: "meeting",
      summary: `Logged ${sourceType} touchpoint: ${content.slice(0, 80)}...`,
      open_loops: content.includes("promise") ? ["Review next steps promised in meeting"] : [],
      promises: content.includes("follow up") ? ["Follow up on discussed topics"] : [],
      occurred_at: new Date().toISOString(),
    };
    db.timelineEvents.unshift(simulatedEvent);
    saveMockDb(db);

    tryRevalidatePath("/");
    return created;
  }

  const { data, error } = await supabase
    .from("workspace_touchpoints")
    .insert(newTouchpoint)
    .select()
    .single();

  if (error) {
    console.error("Error saving touchpoint:", error);
    return null;
  }

  tryRevalidatePath("/");
  return data;
}

export async function generatePrepBrief(founderId: string): Promise<PrepBrief> {
  const cleanId = sanitizeString(founderId, 100);

  // Simulates a structured conversation prep brief generation
  const observations: VerifiedObservation[] = [
    {
      observation: "Founder mentioned active migrations to vector databases on their podcast.",
      hypothesis: "They are focusing on low-latency hybrid search index patterns for open source components.",
      evidence_urls: ["https://podcast.com/episode/42", "https://github.com/compass-labs/releases"],
    },
    {
      observation: "GitHub blog outlines transition from raw schemas to Pydantic v2 contract bindings.",
      hypothesis: "Resilience in prompt output parsing is a current focus for their core system agents.",
      evidence_urls: ["https://example.com/blog/contract-validation-migration"],
    }
  ];

  const suggestedQuestions = [
    "How have you structured your hybrid RRF ranking values to optimize query recall?",
    "What has been the biggest challenge during the Pydantic v2 contract migration?",
    "How are you testing prompt injection resilience on untrusted scraped inputs?"
  ];

  const waysToBeHelpful = [
    "Introduce to vector indexing benchmarks lead at Stanford.",
    "Share index tuning config samples for Supabase vector lists."
  ];

  return {
    founder_id: cleanId,
    observations,
    suggested_questions: suggestedQuestions,
    ways_to_be_helpful: waysToBeHelpful,
    linkedin_draft: "Hi! Heard your recent podcast episode on vector database migrations and was really impressed by your approach to RRF tuning. Let's catch up!",
    email_draft: "Subject: Compass Labs / Vector Search scaling feedback\n\nHi,\n\nI was reviewing your open-source v2 release post and noticed your transition to Pydantic v2 contracts. Would love to share some benchmark metrics we collected on RRF search optimization if you are open to it.\n\nBest,\nUser",
  };
}
