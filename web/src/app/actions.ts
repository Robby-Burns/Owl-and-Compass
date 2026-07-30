"use server";

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

// In-memory mock storage for development/fallback if Supabase envs are not defined
let mockFounders: Founder[] = [
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
];

let mockTouchpoints: Touchpoint[] = [];
let mockTimelineEvents: TimelineEvent[] = [
  {
    id: "event-1",
    founder_id: "maya-lin-id",
    event_type: "research",
    summary: "Discovered v2 release post with MCP protocol support on their GitHub blog.",
    open_loops: ["Review MCP benchmark performance metrics"],
    promises: [],
    occurred_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export async function getFounders(): Promise<Founder[]> {
  if (isMocked) {
    return mockFounders;
  }

  const { data, error } = await supabase
    .from("founders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching founders:", error);
    return mockFounders; // Fallback
  }
  return data || [];
}

export async function getFounderDetails(founderId: string): Promise<{
  founder: Founder | null;
  touchpoints: Touchpoint[];
  timelineEvents: TimelineEvent[];
}> {
  if (isMocked) {
    const founder = mockFounders.find((f) => f.id === founderId) || null;
    const touchpoints = mockTouchpoints.filter((t) => t.founder_id === founderId);
    const timelineEvents = mockTimelineEvents.filter((te) => te.founder_id === founderId);
    return { founder, touchpoints, timelineEvents };
  }

  const { data: founder, error: founderError } = await supabase
    .from("founders")
    .select("*")
    .eq("id", founderId)
    .single();

  if (founderError) {
    console.error("Error fetching founder details:", founderError);
    return { founder: null, touchpoints: [], timelineEvents: [] };
  }

  const { data: touchpoints } = await supabase
    .from("workspace_touchpoints")
    .select("*")
    .eq("founder_id", founderId)
    .order("created_at", { ascending: false });

  const { data: timelineEvents } = await supabase
    .from("founder_timeline_events")
    .select("*")
    .eq("founder_id", founderId)
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
  const newFounder = {
    full_name: formData.fullName,
    company_name: formData.companyName,
    company_stage: formData.companyStage,
    industry: formData.industry,
    tech_stack: formData.techStack,
    bio: formData.bio,
  };

  if (isMocked) {
    const created: Founder = {
      id: `founder-${Math.random().toString(36).substr(2, 9)}`,
      ...newFounder,
      created_at: new Date().toISOString(),
    };
    mockFounders.unshift(created);
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
  const newTouchpoint = {
    founder_id: formData.founderId,
    content: formData.content,
    source_type: formData.sourceType,
  };

  if (isMocked) {
    const created: Touchpoint = {
      id: `touchpoint-${Math.random().toString(36).substr(2, 9)}`,
      ...newTouchpoint,
      created_at: new Date().toISOString(),
    };
    mockTouchpoints.unshift(created);

    // Auto-create a parsed timeline event from the touchpoint text simulation
    const simulatedEvent: TimelineEvent = {
      id: `event-${Math.random().toString(36).substr(2, 9)}`,
      founder_id: formData.founderId,
      event_type: "meeting",
      summary: `Logged ${formData.sourceType} touchpoint: ${formData.content.slice(0, 80)}...`,
      open_loops: formData.content.includes("promise") ? ["Review next steps promised in meeting"] : [],
      promises: formData.content.includes("follow up") ? ["Follow up on discussed topics"] : [],
      occurred_at: new Date().toISOString(),
    };
    mockTimelineEvents.unshift(simulatedEvent);

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
    founder_id: founderId,
    observations,
    suggested_questions: suggestedQuestions,
    ways_to_be_helpful: waysToBeHelpful,
    linkedin_draft: "Hi! Heard your recent podcast episode on vector database migrations and was really impressed by your approach to RRF tuning. Let's catch up!",
    email_draft: "Subject: Compass Labs / Vector Search scaling feedback\n\nHi,\n\nI was reviewing your open-source v2 release post and noticed your transition to Pydantic v2 contracts. Would love to share some benchmark metrics we collected on RRF search optimization if you are open to it.\n\nBest,\nUser",
  };
}
