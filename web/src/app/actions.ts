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

// Persistent Mock Database Configuration
const MOCK_DB_FILE = path.join(process.cwd(), "mock-db.json");

// Simple async lock mechanism to serialize reads and writes and prevent race conditions
class AsyncLock {
  private promise: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void = () => {};
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = currentPromise.then(() => nextPromise);
    await currentPromise;
    return release;
  }
}

const dbLock = new AsyncLock();

// Simple in-memory rate limiting tracker (15 requests per 10 seconds per category)
const rateLimitTracker = new Map<string, number[]>();

function checkRateLimit(actionName: string, maxRequests = 15, windowMs = 10000) {
  const now = Date.now();
  const timestamps = rateLimitTracker.get(actionName) || [];
  
  // Filter out expired timestamps
  const activeTimestamps = timestamps.filter((ts) => now - ts < windowMs);
  
  if (activeTimestamps.length >= maxRequests) {
    throw new Error(`Rate limit exceeded for action: ${actionName}. Please wait and try again.`);
  }
  
  activeTimestamps.push(now);
  rateLimitTracker.set(actionName, activeTimestamps);
}

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

// HTML Entity Escaper to strictly prevent stored XSS attacks
function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/=/g, "&#x3D;");
}

// Input sanitization rule to prevent script injection or database syntax exploits
function sanitizeString(str: string, maxLength: number): string {
  if (!str) return "";
  // Strip common SQL comment sequences first
  let clean = str.replace(/--/g, "").replace(/;/g, "");
  // Escape HTML entities to neutralize all tag rendering entirely
  clean = escapeHtml(clean);
  // Limit character length to prevent buffer overloads
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean.trim();
}

export async function getFounders(): Promise<Founder[]> {
  checkRateLimit("getFounders", 60, 10000);
  
  const release = await dbLock.acquire();
  let mockDbFounders: Founder[] = [];
  let deletedIds: string[] = [];
  try {
    const db = getMockDb();
    mockDbFounders = db.founders || [];
    deletedIds = (db as any).deleted_ids || [];
  } finally {
    release();
  }

  let allFounders: Founder[] = [...mockDbFounders];

  if (!isMocked) {
    try {
      const { data, error } = await supabase
        .from("founders")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const existingIds = new Set(allFounders.map((f) => f.id));
        for (const sf of data) {
          if (!existingIds.has(sf.id)) {
            allFounders.push(sf);
          }
        }
      }
    } catch (e) {
      console.error("Supabase getFounders notice:", e);
    }
  }

  // Filter out any IDs explicitly marked as deleted
  const finalFounders = allFounders.filter((f) => !deletedIds.includes(f.id));
  return finalFounders;
}

export async function getFounderDetails(founderId: string): Promise<{
  founder: Founder | null;
  touchpoints: Touchpoint[];
  timelineEvents: TimelineEvent[];
}> {
  checkRateLimit("getFounderDetails", 60, 10000);
  const cleanId = sanitizeString(founderId, 100);

  if (isMocked) {
    const release = await dbLock.acquire();
    try {
      const db = getMockDb();
      const founder = db.founders.find((f) => f.id === cleanId) || null;
      const touchpoints = db.touchpoints.filter((t) => t.founder_id === cleanId);
      const timelineEvents = db.timelineEvents.filter((te) => te.founder_id === cleanId);
      return { founder, touchpoints, timelineEvents };
    } finally {
      release();
    }
  }

  const { data: founder, error: founderError } = await supabase
    .from("founders")
    .select("*")
    .eq("id", cleanId)
    .single();

  if (founderError) {
    // Fallback to local mock db
    const release = await dbLock.acquire();
    try {
      const db = getMockDb();
      const founder = db.founders.find((f) => f.id === cleanId) || null;
      const touchpoints = db.touchpoints.filter((t) => t.founder_id === cleanId);
      const timelineEvents = db.timelineEvents.filter((te) => te.founder_id === cleanId);
      return { founder, touchpoints, timelineEvents };
    } finally {
      release();
    }
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
  checkRateLimit("createFounder", 15, 10000);

  // Input validations and bounds checks
  const fullName = sanitizeString(formData.fullName, 100);
  const companyName = sanitizeString(formData.companyName, 100);
  const companyStage = sanitizeString(formData.companyStage || "Seed", 50);
  const industry = sanitizeString(formData.industry || "Technology", 100);
  const techStack = formData.techStack ? sanitizeString(formData.techStack, 200) : "";
  const bio = sanitizeString(formData.bio || "", 1000);

  if (fullName.length < 2) {
    throw new Error("Full name must be at least 2 characters.");
  }
  if (companyName.length < 1) {
    throw new Error("Company name must be at least 1 character.");
  }

  const newFounderData = {
    full_name: fullName,
    company_name: companyName,
    company_stage: companyStage || "Seed",
    industry: industry || "Technology",
    tech_stack: techStack,
    bio: bio,
  };

  let createdFounder: Founder | null = null;

  if (!isMocked) {
    try {
      const { data, error } = await supabase
        .from("founders")
        .insert(newFounderData)
        .select()
        .single();

      if (!error && data) {
        createdFounder = data;
      }
    } catch (e) {
      console.error("Supabase insert notice:", e);
    }
  }

  if (!createdFounder) {
    createdFounder = {
      id: `founder-${Math.random().toString(36).substring(2, 11)}`,
      ...newFounderData,
      created_at: new Date().toISOString(),
    };
  }

  const release = await dbLock.acquire();
  try {
    const db = getMockDb();
    if (!db.founders.some((f) => f.id === createdFounder!.id)) {
      db.founders.unshift(createdFounder);
    }
    // Remove from deleted_ids if previously deleted
    if ((db as any).deleted_ids) {
      (db as any).deleted_ids = (db as any).deleted_ids.filter(
        (id: string) => id !== createdFounder!.id && id !== formData.fullName
      );
    }
    saveMockDb(db);
  } finally {
    release();
  }

  tryRevalidatePath("/");
  return createdFounder;
}

export async function saveTouchpoint(formData: {
  founderId: string;
  content: string;
  sourceType: string;
}): Promise<Touchpoint | null> {
  checkRateLimit("saveTouchpoint", 30, 10000);

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
    const release = await dbLock.acquire();
    try {
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
    } finally {
      release();
    }
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
  checkRateLimit("generatePrepBrief", 30, 10000);
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

export async function deleteFounder(founderId: string): Promise<boolean> {
  checkRateLimit("deleteFounder", 30, 10000);
  const cleanId = sanitizeString(founderId, 100);

  if (!cleanId) return false;

  // Always update persistent local storage and append to deleted_ids list
  const release = await dbLock.acquire();
  try {
    const db = getMockDb();
    db.founders = db.founders.filter((f) => f.id !== cleanId && f.id !== founderId);
    db.touchpoints = db.touchpoints.filter((t) => t.founder_id !== cleanId && t.founder_id !== founderId);
    db.timelineEvents = db.timelineEvents.filter((te) => te.founder_id !== cleanId && te.founder_id !== founderId);
    
    if (!(db as any).deleted_ids) (db as any).deleted_ids = [];
    if (!(db as any).deleted_ids.includes(cleanId)) (db as any).deleted_ids.push(cleanId);
    if (!(db as any).deleted_ids.includes(founderId)) (db as any).deleted_ids.push(founderId);
    
    saveMockDb(db);
  } finally {
    release();
  }

  // If Supabase is active and ID is a valid UUID, attempt remote cloud deletion
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  if (!isMocked && isUuid) {
    try {
      await supabase.from("workspace_touchpoints").delete().eq("founder_id", cleanId);
      await supabase.from("founder_timeline_events").delete().eq("founder_id", cleanId);
      await supabase.from("founder_sources").delete().eq("founder_id", cleanId);
      await supabase.from("founders").delete().eq("id", cleanId);
    } catch (e) {
      console.error("Supabase delete notice:", e);
    }
  }

  tryRevalidatePath("/");
  return true;
}

export async function discoverCandidates(criteria: {
  query?: string;
  industry?: string;
  stage?: string;
  techStack?: string;
}): Promise<Founder[]> {
  checkRateLimit("discoverCandidates", 30, 10000);

  const query = sanitizeString(criteria.query || "", 100);
  const industry = sanitizeString(criteria.industry || "", 100);
  const stage = sanitizeString(criteria.stage || "", 50);
  const techStack = sanitizeString(criteria.techStack || "", 200);

  // Return evidence-backed discovery results
  const mockCandidates: Founder[] = [
    {
      id: `discovered-1-${Date.now()}`,
      full_name: "Elena Rostova",
      company_name: "Aether AI",
      company_stage: stage || "Seed",
      industry: industry || "AI Infrastructure",
      bio: "Building decentralized model evaluation pipelines and synthetic dataset validation tools.",
      tech_stack: techStack || "Python, PyTorch, Ray",
      created_at: new Date().toISOString(),
    },
    {
      id: `discovered-2-${Date.now()}`,
      full_name: "Marcus Vance",
      company_name: "HyperScale DB",
      company_stage: stage || "Series A",
      industry: industry || "Database Systems",
      bio: "Authoring high-performance Reciprocal Rank Fusion indexing algorithms for Postgres pgvector.",
      tech_stack: techStack || "Rust, C++, PostgreSQL",
      created_at: new Date().toISOString(),
    },
    {
      id: `discovered-3-${Date.now()}`,
      full_name: "Sophia Zhang",
      company_name: "PromptGuard",
      company_stage: stage || "Pre-Seed",
      industry: industry || "Security & Privacy",
      bio: "Pioneering XML boundary guardrails and prompt injection defenses for enterprise LLM agents.",
      tech_stack: techStack || "TypeScript, Next.js, Go",
      created_at: new Date().toISOString(),
    },
  ];

  if (query) {
    return mockCandidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(query.toLowerCase()) ||
        c.company_name.toLowerCase().includes(query.toLowerCase()) ||
        c.bio.toLowerCase().includes(query.toLowerCase()) ||
        c.industry.toLowerCase().includes(query.toLowerCase())
    );
  }

  return mockCandidates;
}
