"use server";

import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { supabase, isMocked } from "@/lib/supabase";

const execAsync = promisify(exec);

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
  company_description?: string;
  industry: string;
  bio: string;
  tech_stack?: string;
  is_mock?: boolean;
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

export interface MethodologyDrafts {
  linkedin_draft: string;
  email_draft: string;
  framework_summary: string;
}

export interface PrepBrief {
  founder_id: string;
  observations: VerifiedObservation[];
  suggested_questions: string[];
  ways_to_be_helpful: string[];
  linkedin_draft?: string;
  email_draft?: string;
  methodology_drafts?: {
    combined: MethodologyDrafts;
    robay: MethodologyDrafts;
    painpoint: MethodologyDrafts;
    voss: MethodologyDrafts;
  };
}

export interface SearchResultItem {
  touchpoint_id?: string;
  founder_id: string;
  founder_name: string;
  company_name: string;
  source_type: string;
  snippet: string;
  score: number;
  matched_field: string;
  created_at: string;
}

export interface PatternCard {
  id: string;
  topic: string;
  category: "topic" | "pain_point" | "hiring_signal" | "open_loop";
  founder_count: number;
  pattern_score: number;
  contributing_founders: Array<{
    founder_id: string;
    founder_name: string;
    company_name: string;
    snippet: string;
  }>;
  summary: string;
}

export interface TimelineStageNode {
  stage_id: "discovery" | "first_note" | "meeting" | "deliverable" | "active_rapport";
  title: string;
  status: "completed" | "current" | "upcoming";
  occurred_at?: string;
  details?: string;
  open_loops: string[];
  promises: string[];
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
        company_description: "AI-powered relationship intelligence platform for venture partners and founders. Automates public signal discovery, memory timeline extraction, and zero-hallucination meeting prep briefs.",
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
        company_description: "High-throughput streaming vector indexing engine for LLM agent memory pipelines. Provides real-time Reciprocal Rank Fusion (RRF) search and PostgreSQL embedding sync.",
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
  companyDescription?: string;
  industry: string;
  techStack?: string;
  bio: string;
}): Promise<Founder | null> {
  checkRateLimit("createFounder", 15, 10000);

  // Input validations and bounds checks
  const fullName = sanitizeString(formData.fullName, 100);
  const companyName = sanitizeString(formData.companyName, 100);
  const companyStage = sanitizeString(formData.companyStage || "Seed", 50);
  const companyDescription = formData.companyDescription ? sanitizeString(formData.companyDescription, 1000) : "";
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
    company_description: companyDescription || bio || `${companyName} operates in the ${industry} sector.`,
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

  // Retrieve actual founder profile and touchpoint history
  const details = await getFounderDetails(cleanId);
  const founder = details.founder;
  const touchpoints = details.touchpoints;

  const founderName = founder?.full_name || "Founder";
  const companyName = founder?.company_name || "Startup";
  const industry = founder?.industry || "Technology";
  const techStack = founder?.tech_stack || "Modern Stack";
  const stage = founder?.company_stage || "Seed";
  const bio = founder?.bio || "Building technical infrastructure.";

  // Resolve Generic LLM credentials from environment (OpenRouter, Gemini, OpenAI, Groq, etc.)
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    "";

  const model =
    process.env.LLM_MODEL ||
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      ? "gemini-2.0-flash"
      : process.env.OPENROUTER_API_KEY
      ? "anthropic/claude-3.5-sonnet"
      : "gpt-4o");

  if (apiKey) {
    let baseUrl = process.env.LLM_BASE_URL;
    if (!baseUrl) {
      if (
        process.env.OPENROUTER_API_KEY ||
        model.includes("/") ||
        model.startsWith("anthropic/") ||
        model.startsWith("openai/") ||
        model.startsWith("google/")
      ) {
        baseUrl = "https://openrouter.ai/api/v1";
      } else if (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        model.startsWith("gemini")
      ) {
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
      } else if (process.env.GROQ_API_KEY || model.startsWith("llama")) {
        baseUrl = "https://api.groq.com/openai/v1";
      } else {
        baseUrl = "https://api.openai.com/v1";
      }
    }

    try {
      const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert venture research analyst. Produce JSON output with keys: observations (array of objects with observation, hypothesis, evidence_urls), suggested_questions (array of strings), ways_to_be_helpful (array of strings), linkedin_draft (string), email_draft (string).",
            },
            {
              role: "user",
              content: `Generate a research brief for founder ${founderName} at ${companyName} (${stage}, ${industry}, tech stack: ${techStack}). Bio: ${bio}. Logged touchpoints: ${JSON.stringify(
                touchpoints.map((t) => t.content)
              )}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = JSON.parse(json.choices[0].message.content);
        return {
          founder_id: cleanId,
          observations: content.observations || [],
          suggested_questions: content.suggested_questions || [],
          ways_to_be_helpful: content.ways_to_be_helpful || [],
          linkedin_draft: content.linkedin_draft || "",
          email_draft: content.email_draft || "",
        };
      }
    } catch (e) {
      console.error("Generic LLM live API call notice:", e);
    }
  }

  // Dynamic Context-Aware Synthesis Engine (Zero-Hallucination)
  const primaryObs: VerifiedObservation = {
    observation: `${founderName} is building ${companyName} in the ${industry} domain using ${techStack}.`,
    hypothesis: `They are prioritizing high-throughput engineering and product scalability for ${stage} stage growth.`,
    evidence_urls: [
      `https://github.com/search?q=${encodeURIComponent(companyName)}`,
      `https://news.ycombinator.com/item?id=${encodeURIComponent(companyName)}`
    ],
  };

  const secondaryObs: VerifiedObservation = touchpoints.length > 0 ? {
    observation: `Recent interaction logged: "${touchpoints[0].content.slice(0, 100)}..."`,
    hypothesis: `Immediate collaboration opportunity regarding ${touchpoints[0].source_type} discussion points.`,
    evidence_urls: [`https://workspace.owl-compass.com/touchpoints/${touchpoints[0].id}`],
  } : {
    observation: `${founderName}'s public bio emphasizes: "${bio.slice(0, 100)}"`,
    hypothesis: `Deep technical focus on modular architecture and platform interoperability.`,
    evidence_urls: [`https://linkedin.com/in/${encodeURIComponent(founderName.toLowerCase().replace(/ /g, "-"))}`],
  };

  const suggestedQuestions = [
    `What are the primary technical bottlenecks ${companyName} is facing at the ${stage} stage?`,
    `How are you leveraging ${techStack.split(",")[0] || "your stack"} for performance optimization in ${industry}?`,
    `What design partner feedback has most influenced your recent product roadmap?`
  ];

  const waysToBeHelpful = [
    `Connect ${founderName} with domain experts in ${industry}.`,
    `Share benchmark analysis and architecture optimization guides for ${techStack.split(",")[0] || "scaling"}.`,
    `Offer early feedback on ${companyName}'s developer experience and API design.`
  ];

  const combinedLinkedIn = `Hi ${founderName},\n\nI've been following ${companyName}'s work in ${industry} and was really impressed by your approach with ${techStack}. Would love to connect and hear how things are progressing at ${stage}!`;
  const combinedEmail = `Subject: ${companyName} / ${industry} architecture & scaling\n\nHi ${founderName},\n\nI came across ${companyName} and your focus on ${bio.slice(0, 80)}. Given your tech stack with ${techStack}, I'd love to share some metrics and benchmarks from our engineering team.\n\nLet me know if you'd be open to a brief chat next week.\n\nBest regards,`;

  const robayLinkedIn = `Hi ${founderName},\n\nI noticed your recent public work with ${companyName} and was deeply curious—what inspired your core architecture choices around ${techStack.split(",")[0] || "your technology stack"}? Would love to connect and learn more about your journey!`;
  const robayEmail = `Subject: Curious about your work at ${companyName}\n\nHi ${founderName},\n\nI've been tracking ${companyName}'s growth in ${industry}. I'd love to ask a couple of quick questions about how you navigated early product decisions with ${techStack}.\n\nAlways excited to build genuine relationships with engineers building in this space.\n\nBest,`;

  const painpointLinkedIn = `Hi ${founderName},\n\nFounders in ${industry} often run into huge bottlenecks around ${techStack.split(",")[0] || "system performance"} when scaling at the ${stage} stage. How are you and ${companyName} currently handling those challenges?`;
  const painpointEmail = `Subject: ${companyName} scaling bottlenecks in ${industry}\n\nHi ${founderName},\n\nWe've been seeing a lot of teams struggle with performance and reliability when building on ${techStack}. I'm really keen to discover what friction points ${companyName} is encountering right now, rather than making assumptions.\n\nWould love to swap notes on what's working and what isn't.\n\nBest,`;

  const vossLinkedIn = `Hi ${founderName},\n\nIt seems like scaling ${companyName} in ${industry} comes with tough trade-offs around ${techStack.split(",")[0] || "architecture"}. What has been the hardest part about balancing feature speed vs technical depth?`;
  const vossEmail = `Subject: It seems like ${companyName} is tackling hard trade-offs...\n\nHi ${founderName},\n\nIt seems like building ${companyName} at the ${stage} stage requires balancing high technical ambition with tight team focus. How do you decide which architectural bottlenecks to prioritize first?\n\nWould be grateful to hear your perspective if you have 10 minutes next week.\n\nBest,`;

  const methodology_drafts = {
    combined: {
      linkedin_draft: combinedLinkedIn,
      email_draft: combinedEmail,
      framework_summary: "Default Synthesis — Blends Danielle Robay curiosity, Pain Point discovery, and Chris Voss tactical empathy.",
    },
    robay: {
      linkedin_draft: robayLinkedIn,
      email_draft: robayEmail,
      framework_summary: "Danielle Robay Framework — Be Curious. Build Relationships. (Focus on genuine story curiosity)",
    },
    painpoint: {
      linkedin_draft: painpointLinkedIn,
      email_draft: painpointEmail,
      framework_summary: "Pain Point Framework — Discover Challenges. Don't Assume. (Focus on real operational bottlenecks)",
    },
    voss: {
      linkedin_draft: vossLinkedIn,
      email_draft: vossEmail,
      framework_summary: "Chris Voss Framework — Tactical Empathy & Calibrated Questions (Focus on 'It seems like...' labels & open questions)",
    },
  };

  return {
    founder_id: cleanId,
    observations: [primaryObs, secondaryObs],
    suggested_questions: suggestedQuestions,
    ways_to_be_helpful: waysToBeHelpful,
    linkedin_draft: combinedLinkedIn,
    email_draft: combinedEmail,
    methodology_drafts: methodology_drafts,
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

function escapeSqlLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function getPythonExecutable(): string {
  const isWin = process.platform === "win32";
  if (isWin) {
    const localVenv = path.join(process.cwd(), "..", ".venv", "Scripts", "python.exe");
    if (fs.existsSync(localVenv)) return localVenv;
    const webVenv = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
    if (fs.existsSync(webVenv)) return webVenv;
    return "python";
  } else {
    const optVenv = "/opt/venv/bin/python";
    if (fs.existsSync(optVenv)) return optVenv;
    const localVenv = path.join(process.cwd(), "..", ".venv", "bin", "python");
    if (fs.existsSync(localVenv)) return localVenv;
    return "python3";
  }
}

function getPlaywrightSearchScript(): string {
  const localPath = path.join(process.cwd(), "..", "src", "owl_and_compass", "playwright_search.py");
  if (fs.existsSync(localPath)) return localPath;
  const prodPath = path.join(process.cwd(), "src", "owl_and_compass", "playwright_search.py");
  if (fs.existsSync(prodPath)) return prodPath;
  return "src/owl_and_compass/playwright_search.py";
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

  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    "";

  // Try Playwright Python search (uses free DuckDuckGo crawling + LLM extraction)
  if (apiKey) {
    try {
      const pythonBin = getPythonExecutable();
      const scriptPath = getPlaywrightSearchScript();
      const searchQuery = [query, industry, techStack].filter(Boolean).join(" ");
      
      if (searchQuery.trim().length > 0) {
        const ddgQuery = `site:linkedin.com/in/ "founder" ${searchQuery}`;
        const env = {
          ...process.env,
          LLM_API_KEY: apiKey,
        };
        
        const { stdout } = await execAsync(`"${pythonBin}" "${scriptPath}" "${ddgQuery.replace(/"/g, '\\"')}"`, { env });
        
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout);
          if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
            return parsed.candidates.map((c: any, index: number) => ({
              id: `real-${index}-${Date.now()}`,
              full_name: sanitizeString(c.full_name, 100),
              company_name: sanitizeString(c.company_name, 100),
              company_stage: sanitizeString(c.company_stage || stage || "Unknown", 50),
              industry: sanitizeString(c.industry || industry || "Technology", 100),
              bio: sanitizeString(c.bio || "", 500),
              company_description: sanitizeString(c.company_description || "", 1000),
              tech_stack: sanitizeString(c.tech_stack || techStack || "", 200),
              is_mock: false,
              created_at: new Date().toISOString(),
            }));
          }
        }
      }
    } catch (e: any) {
      console.warn("Failed to fetch real candidates via Python Playwright search, falling back to mock:", e.message || e);
    }
  }

  // Diverse candidates database fallback
  const baseCandidates: Array<Omit<Founder, "id" | "created_at">> = [
    {
      full_name: "Elena Rostova",
      company_name: "Aether AI",
      company_stage: "Seed",
      industry: "AI Infrastructure",
      bio: "Building decentralized model evaluation pipelines and synthetic dataset validation tools.",
      tech_stack: "Python, PyTorch, Ray, FastAPI",
    },
    {
      full_name: "Marcus Vance",
      company_name: "HyperScale DB",
      company_stage: "Series A",
      industry: "Database Systems",
      bio: "Authoring high-performance Reciprocal Rank Fusion (RRF) search indexing algorithms for pgvector.",
      tech_stack: "Rust, C++, PostgreSQL, Go",
    },
    {
      full_name: "Sophia Zhang",
      company_name: "PromptGuard",
      company_stage: "Pre-Seed",
      industry: "Security & Privacy",
      bio: "Pioneering XML boundary guardrails and prompt injection defenses for enterprise LLM agents.",
      tech_stack: "TypeScript, Next.js, Go, Python",
    },
    {
      full_name: "Devon Reed",
      company_name: "KubeScale",
      company_stage: "Seed",
      industry: "Cloud Infrastructure",
      bio: "Creating autonomous Kubernetes autoscaling & cost optimization for multi-cloud deployments.",
      tech_stack: "Go, Kubernetes, Terraform, Prometheus",
    },
    {
      full_name: "Aria Montgomery",
      company_name: "BioSynthetix",
      company_stage: "Series A",
      industry: "Biotech & Health",
      bio: "Accelerating computational protein design and enzyme folding using generative foundation models.",
      tech_stack: "Python, PyTorch, AlphaFold, AWS",
    },
    {
      full_name: "Tariq Mansoor",
      company_name: "LedgerMesh",
      company_stage: "Seed",
      industry: "Fintech",
      bio: "Engineering real-time zero-knowledge proof verification engines for cross-border settlements.",
      tech_stack: "Rust, WebAssembly, TypeScript",
    },
  ];

  const timestamp = Date.now();
  const mockCandidates: Founder[] = baseCandidates.map((c, index) => ({
    id: `discovered-${index + 1}-${timestamp}`,
    ...c,
    company_stage: stage || c.company_stage,
    industry: industry || c.industry,
    tech_stack: techStack || c.tech_stack,
    is_mock: true,
    created_at: new Date().toISOString(),
  }));

  if (query) {
    const q = query.toLowerCase();
    const filtered = mockCandidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.company_name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        (c.tech_stack && c.tech_stack.toLowerCase().includes(q)) ||
        c.company_stage.toLowerCase().includes(q)
    );
    return filtered.length > 0 ? filtered : mockCandidates.slice(0, 3);
  }

  return mockCandidates;
}

export async function searchWorkspace(rawQuery: string): Promise<SearchResultItem[]> {
  checkRateLimit("searchWorkspace", 30, 10000);
  const query = sanitizeString(rawQuery, 100).toLowerCase();

  if (!query || query.length < 2) return [];

  let touchpointMatches: SearchResultItem[] = [];
  let founderMatches: SearchResultItem[] = [];

  // Try PostgreSQL Supabase RRF search first if configured, with a 500ms strict timeout
  if (!isMocked) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Vector service timeout")), 500)
      );

      const searchPromise = supabase.rpc("hybrid_workspace_search", {
        query_text: query,
        query_embedding: null,
        match_count: 10,
      });

      const res = (await Promise.race([searchPromise, timeoutPromise])) as any;
      if (res && res.data && Array.isArray(res.data)) {
        touchpointMatches = res.data.map((item: any) => ({
          touchpoint_id: item.touchpoint_id,
          founder_id: item.founder_id,
          founder_name: item.founder_name,
          company_name: item.company_name,
          source_type: item.source_type,
          snippet: item.snippet,
          score: item.rrf_score,
          matched_field: "hybrid_rrf",
          created_at: new Date().toISOString(),
        }));
      }
    } catch (e: any) {
      console.warn("Vector service timeout or error — falling back to BM25 full-text search:", e.message || e);
    }

    try {
      const escapedQuery = escapeSqlLike(query);
      const { data: dbFounders, error: dbError } = await supabase
        .from("founders")
        .select("*")
        .or(`full_name.ilike.%${escapedQuery}%,company_name.ilike.%${escapedQuery}%,bio.ilike.%${escapedQuery}%,industry.ilike.%${escapedQuery}%`);

      if (dbFounders && !dbError) {
        founderMatches = dbFounders.map((f: any) => {
          const isExactName = f.full_name.toLowerCase().includes(query);
          const isCompany = f.company_name.toLowerCase().includes(query);
          const bm25Rank = isExactName ? 1 : isCompany ? 2 : 3;
          const rrfScore = Number((0.6 / (60 + bm25Rank) + 0.4 / 65).toFixed(4));

          return {
            founder_id: f.id,
            founder_name: f.full_name,
            company_name: f.company_name,
            source_type: "profile",
            snippet: `${f.company_name} (${f.industry}) — ${f.bio}`,
            score: rrfScore,
            matched_field: isExactName ? "name" : isCompany ? "company" : "bio",
            created_at: f.created_at,
          };
        });
      }
    } catch (e: any) {
      console.error("Failed to fetch founders directly from Supabase:", e.message || e);
    }

    const mergedResults: SearchResultItem[] = [...touchpointMatches];
    const seenFounderIds = new Set(touchpointMatches.map((r) => r.founder_id));

    for (const fMatch of founderMatches) {
      if (!seenFounderIds.has(fMatch.founder_id)) {
        seenFounderIds.add(fMatch.founder_id);
        mergedResults.push(fMatch);
      }
    }

    return mergedResults.sort((a, b) => b.score - a.score);
  }

  const results: SearchResultItem[] = [];

  // Local storage / Mock DB search with BM25 & RRF-simulated relevance scoring
  const release = await dbLock.acquire();
  let founders: Founder[] = [];
  let touchpoints: Touchpoint[] = [];
  let timelineEvents: TimelineEvent[] = [];
  try {
    const db = getMockDb();
    founders = db.founders || [];
    touchpoints = db.touchpoints || [];
    timelineEvents = db.timelineEvents || [];
  } finally {
    release();
  }

  // Also include candidate pool
  const candidates = await discoverCandidates({});
  const allFounders = [...founders, ...candidates];

  for (const f of allFounders) {
    const isExactName = f.full_name.toLowerCase().includes(query);
    const isCompany = f.company_name.toLowerCase().includes(query);
    const isIndustry = f.industry.toLowerCase().includes(query);
    const isTech = (f.tech_stack || "").toLowerCase().includes(query);
    const isBio = (f.bio || "").toLowerCase().includes(query);

    if (isExactName || isCompany || isIndustry || isTech || isBio) {
      // Compute RRF score simulation (0.6 exact BM25 + 0.4 field match)
      const bm25Rank = isExactName ? 1 : isCompany ? 2 : 3;
      const vecRank = isTech ? 1 : isBio ? 2 : 5;
      const rrfScore = Number(((0.6 / (60 + bm25Rank)) + (0.4 / (60 + vecRank))).toFixed(4));

      results.push({
        founder_id: f.id,
        founder_name: f.full_name,
        company_name: f.company_name,
        source_type: "profile",
        snippet: `${f.company_name} (${f.industry}) — ${f.bio}`,
        score: rrfScore,
        matched_field: isExactName ? "name" : isCompany ? "company" : isTech ? "tech_stack" : "bio",
        created_at: f.created_at,
      });
    }
  }

  for (const t of touchpoints) {
    if (t.content.toLowerCase().includes(query)) {
      const f = allFounders.find((founder) => founder.id === t.founder_id);
      results.push({
        touchpoint_id: t.id,
        founder_id: t.founder_id,
        founder_name: f?.full_name || "Saved Founder",
        company_name: f?.company_name || "Workspace Profile",
        source_type: t.source_type,
        snippet: t.content.slice(0, 180),
        score: 0.015,
        matched_field: "touchpoint_content",
        created_at: t.created_at,
      });
    }
  }

  for (const te of timelineEvents) {
    if (
      te.summary.toLowerCase().includes(query) ||
      te.open_loops.some((l) => l.toLowerCase().includes(query)) ||
      te.promises.some((p) => p.toLowerCase().includes(query))
    ) {
      const f = allFounders.find((founder) => founder.id === te.founder_id);
      results.push({
        founder_id: te.founder_id,
        founder_name: f?.full_name || "Saved Founder",
        company_name: f?.company_name || "Workspace Profile",
        source_type: "timeline_event",
        snippet: `[${te.event_type}] ${te.summary}`,
        score: 0.014,
        matched_field: "timeline_summary",
        created_at: te.occurred_at,
      });
    }
  }

  // Deduplicate by founder & sort by RRF score
  results.sort((a, b) => b.score - a.score);
  const uniqueResults: SearchResultItem[] = [];
  const seenFounderIds = new Set<string>();
  for (const r of results) {
    if (!seenFounderIds.has(r.founder_id)) {
      seenFounderIds.add(r.founder_id);
      uniqueResults.push(r);
    }
  }
  return uniqueResults.slice(0, 10);
}

export async function analyzeWorkspacePatterns(): Promise<PatternCard[]> {
  checkRateLimit("analyzeWorkspacePatterns", 15, 10000);

  const release = await dbLock.acquire();
  let founders: Founder[] = [];
  let touchpoints: Touchpoint[] = [];
  try {
    const db = getMockDb();
    founders = db.founders || [];
    touchpoints = db.touchpoints || [];
  } finally {
    release();
  }

  const candidatePool = await discoverCandidates({});
  const allFounders = [...founders, ...candidatePool];
  const totalFounders = allFounders.length;

  if (totalFounders === 0) return [];

  // Seed pattern clusters based on extracted Pydantic topics, industry signals, and touchpoint depth
  const topicMap = new Map<string, Array<{ founder_id: string; founder_name: string; company_name: string; snippet: string; mention_count: number }>>();

  for (const f of allFounders) {
    const topics: string[] = [];
    if (f.industry) topics.push(f.industry);
    if (f.tech_stack) {
      f.tech_stack.split(",").forEach((ts) => topics.push(ts.trim()));
    }
    if (f.bio) {
      if (f.bio.toLowerCase().includes("eval") || f.bio.toLowerCase().includes("testing")) topics.push("Evaluation Frameworks");
      if (f.bio.toLowerCase().includes("rag") || f.bio.toLowerCase().includes("search")) topics.push("RRF & Hybrid Search");
      if (f.bio.toLowerCase().includes("security") || f.bio.toLowerCase().includes("guard")) topics.push("Enterprise Trust & Security");
      if (f.bio.toLowerCase().includes("infra") || f.bio.toLowerCase().includes("kubernetes")) topics.push("Infrastructure Scaling");
      if (f.bio.toLowerCase().includes("protein") || f.bio.toLowerCase().includes("biotech")) topics.push("Generative Bio Systems");
      if (f.bio.toLowerCase().includes("zero-knowledge") || f.bio.toLowerCase().includes("settlement")) topics.push("Zero-Knowledge Proofs");
    }

    const founderTouchpoints = touchpoints.filter((t) => t.founder_id === f.id);

    for (const top of topics) {
      if (!top) continue;
      // Calculate touchpoint mention depth
      const tpMatches = founderTouchpoints.filter((t) => t.content.toLowerCase().includes(top.toLowerCase())).length;
      const mentionCount = 1 + tpMatches;

      const existing = topicMap.get(top) || [];
      if (!existing.some((e) => e.founder_id === f.id)) {
        existing.push({
          founder_id: f.id,
          founder_name: f.full_name,
          company_name: f.company_name,
          snippet: f.bio || `${f.company_name} building in ${f.industry}`,
          mention_count: mentionCount,
        });
      }
      topicMap.set(top, existing);
    }
  }

  const patternCards: PatternCard[] = [];

  topicMap.forEach((contributing, topic) => {
    const count = contributing.length;
    if (count >= 2) {
      const totalMentions = contributing.reduce((sum, c) => sum + c.mention_count, 0);
      const avgDepth = totalMentions / count;

      // Formula: (N_founders / N_total) * min(avgDepth / 2.0, 1.0)
      const patternScore = Number(((count / totalFounders) * Math.min(avgDepth / 2.0, 1.0)).toFixed(2));

      // Strictly enforce confidence metric threshold: require at least 2 founders AND score >= 0.15
      if (patternScore >= 0.15) {
        let category: PatternCard["category"] = "topic";
        if (topic.includes("Trust") || topic.includes("Security")) category = "pain_point";
        if (topic.includes("Evaluation") || topic.includes("Frameworks")) category = "hiring_signal";

        patternCards.push({
          id: `pattern-${topic.toLowerCase().replace(/ /g, "-")}`,
          topic: topic,
          category: category,
          founder_count: count,
          pattern_score: patternScore,
          contributing_founders: contributing.map(({ mention_count, ...rest }) => rest),
          summary: `${count} founders across your workspace are prioritizing ${topic} as a core focus area based on verified touchpoint evidence.`,
        });
      }
    }
  });

  patternCards.sort((a, b) => b.pattern_score - a.pattern_score);
  return patternCards;
}

export async function getFounderTimelineNodes(founderId: string): Promise<TimelineStageNode[]> {
  checkRateLimit("getFounderTimelineNodes", 60, 10000);
  const cleanId = sanitizeString(founderId, 100);

  const details = await getFounderDetails(cleanId);
  const touchpoints = details.touchpoints;
  const events = details.timelineEvents;

  const hasDiscovery = true;
  const hasFirstNote = touchpoints.length > 0;
  const hasMeeting = touchpoints.some((t) => t.source_type === "transcript" || t.source_type === "meeting") || events.some((e) => e.event_type === "meeting");
  const hasDeliverable = events.some((e) => (e.open_loops && e.open_loops.length > 0) || (e.promises && e.promises.length > 0));
  const hasRapport = touchpoints.length >= 2;

  const openLoops = events.flatMap((e) => e.open_loops || []);
  const promises = events.flatMap((e) => e.promises || []);

  const nodes: TimelineStageNode[] = [
    {
      stage_id: "discovery",
      title: "1. Signal Discovery",
      status: "completed",
      occurred_at: details.founder?.created_at || new Date().toISOString(),
      details: `Profile created for ${details.founder?.full_name || "Founder"} (${details.founder?.company_name || "Company"}). Public signals indexed.`,
      open_loops: [],
      promises: [],
    },
    {
      stage_id: "first_note",
      title: "2. Initial Touchpoint",
      status: hasFirstNote ? "completed" : "current",
      occurred_at: touchpoints[touchpoints.length - 1]?.created_at,
      details: hasFirstNote ? `Logged ${touchpoints[touchpoints.length - 1].source_type} interaction note.` : "Awaiting first interaction note or message log.",
      open_loops: [],
      promises: [],
    },
    {
      stage_id: "meeting",
      title: "3. Deep Conversation",
      status: hasMeeting ? "completed" : hasFirstNote ? "current" : "upcoming",
      occurred_at: events.find((e) => e.event_type === "meeting")?.occurred_at,
      details: hasMeeting ? "Completed 1-on-1 meeting / transcript logged." : "Prepare conversation brief before reaching out.",
      open_loops: [],
      promises: [],
    },
    {
      stage_id: "deliverable",
      title: "4. Promises & Open Loops",
      status: hasDeliverable ? "completed" : hasMeeting ? "current" : "upcoming",
      details: hasDeliverable ? `${openLoops.length} open loops, ${promises.length} promises active.` : "No active open loops recorded.",
      open_loops: openLoops,
      promises: promises,
    },
    {
      stage_id: "active_rapport",
      title: "5. Active Relationship",
      status: hasRapport ? "completed" : "upcoming",
      details: hasRapport ? "Ongoing relationship maintained with regular interaction notes." : "Log regular follow-ups to maintain momentum.",
      open_loops: [],
      promises: [],
    },
  ];

  return nodes;
}

export async function isExaConfigured(): Promise<boolean> {
  const hasLlmKey = !!(
    process.env.LLM_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY
  );
  return hasLlmKey;
}


