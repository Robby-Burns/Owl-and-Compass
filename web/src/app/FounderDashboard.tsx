"use client";

import React, { useState, useTransition } from "react";
import {
  Compass,
  Plus,
  User,
  Terminal,
  ExternalLink,
  MessageSquare,
  Mail,
  Copy,
  Check,
  Loader2,
  Calendar,
  Layers,
  HelpCircle,
  FileText,
  AlertCircle,
  X,
  Trash2,
  Search,
  Sparkles
} from "lucide-react";
import {
  Founder,
  Touchpoint,
  TimelineEvent,
  PrepBrief,
  createFounder,
  saveTouchpoint,
  getFounderDetails,
  generatePrepBrief,
  deleteFounder,
  discoverCandidates
} from "@/app/actions";

interface FounderDashboardProps {
  initialFounders: Founder[];
}

export default function FounderDashboard({ initialFounders }: FounderDashboardProps) {
  const [founders, setFounders] = useState<Founder[]>(initialFounders);
  const [selectedFounderId, setSelectedFounderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "brief">("timeline");
  
  // Discovery and Filter States
  const [sidebarTab, setSidebarTab] = useState<"saved" | "discover">("saved");
  const [searchFilter, setSearchFilter] = useState("");
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveredCandidates, setDiscoveredCandidates] = useState<Founder[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Selected founder detailed data
  const [selectedFounder, setSelectedFounder] = useState<Founder | null>(null);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [prepBrief, setPrepBrief] = useState<PrepBrief | null>(null);

  // Selected candidate preview detailed data (for right-side panel)
  const [selectedCandidate, setSelectedCandidate] = useState<Founder | null>(null);
  const [selectedCandidateBrief, setSelectedCandidateBrief] = useState<PrepBrief | null>(null);
  const [loadingCandidateBrief, setLoadingCandidateBrief] = useState(false);

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFounderData, setNewFounderData] = useState({
    fullName: "",
    companyName: "",
    companyStage: "Seed",
    industry: "",
    techStack: "",
    bio: "",
  });

  const [newTouchpointData, setNewTouchpointData] = useState({
    content: "",
    sourceType: "note",
  });

  const [isPending, startTransition] = useTransition();
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Handlers
  const handleSelectFounder = async (id: string) => {
    setSelectedFounderId(id);
    setSelectedCandidate(null);
    setSelectedCandidateBrief(null);
    setLoadingDetails(true);
    setPrepBrief(null); // Clear previous brief
    setActiveTab("timeline");

    try {
      const details = await getFounderDetails(id);
      setSelectedFounder(details.founder);
      setTouchpoints(details.touchpoints);
      setTimelineEvents(details.timelineEvents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectCandidate = async (cand: Founder) => {
    setSelectedCandidate(cand);
    setSelectedFounderId(null);
    setSelectedFounder(null);
    setLoadingCandidateBrief(true);
    try {
      const brief = await generatePrepBrief(cand.id);
      setSelectedCandidateBrief(brief);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCandidateBrief(false);
    }
  };

  const handleCreateFounder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFounderData.fullName || !newFounderData.companyName) return;

    startTransition(async () => {
      try {
        const created = await createFounder(newFounderData);
        if (created) {
          setFounders([created, ...founders]);
          setShowAddModal(false);
          setNewFounderData({
            fullName: "",
            companyName: "",
            companyStage: "Seed",
            industry: "",
            techStack: "",
            bio: "",
          });
          handleSelectFounder(created.id);
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleSaveTouchpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFounderId || !newTouchpointData.content) return;

    startTransition(async () => {
      try {
        const created = await saveTouchpoint({
          founderId: selectedFounderId,
          content: newTouchpointData.content,
          sourceType: newTouchpointData.sourceType,
        });

        if (created) {
          setNewTouchpointData({ ...newTouchpointData, content: "" });
          // Re-fetch details to sync timeline
          const details = await getFounderDetails(selectedFounderId);
          setTouchpoints(details.touchpoints);
          setTimelineEvents(details.timelineEvents);
        }
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleGenerateBrief = async () => {
    if (!selectedFounderId) return;
    setLoadingBrief(true);
    try {
      const brief = await generatePrepBrief(selectedFounderId);
      setPrepBrief(brief);
      setActiveTab("brief");
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleDeleteFounder = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFounder(id);
      setFounders((prev) => prev.filter((f) => f.id !== id));
      if (selectedFounderId === id) {
        setSelectedFounderId(null);
        setSelectedFounder(null);
      }
      if (selectedCandidate?.id === id) {
        setSelectedCandidate(null);
        setSelectedCandidateBrief(null);
      }
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("Delete failed:", e);
      setFounders((prev) => prev.filter((f) => f.id !== id));
      if (selectedFounderId === id) {
        setSelectedFounderId(null);
        setSelectedFounder(null);
      }
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearchCandidates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsDiscovering(true);
    try {
      const results = await discoverCandidates({ query: discoveryQuery });
      setDiscoveredCandidates(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleImportCandidate = async (candidate: Founder) => {
    try {
      const created = await createFounder({
        fullName: candidate.full_name,
        companyName: candidate.company_name,
        companyStage: candidate.company_stage || "Seed",
        industry: candidate.industry || "Technology",
        techStack: candidate.tech_stack || "",
        bio: candidate.bio || "",
      });
      if (created) {
        setFounders((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
        setSelectedCandidate(null);
        setSelectedCandidateBrief(null);
        setSidebarTab("saved");
        handleSelectFounder(created.id);
      }
    } catch (e) {
      console.error("Failed to import candidate:", e);
    }
  };

  const handleCopyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen w-full lg:flex-row">
      {/* Sidebar List */}
      <aside className="w-full lg:w-96 flex flex-col glass-panel border-r border-slate-800 shrink-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass className="w-8 h-8 text-blue-500 animate-pulse glow-text" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white glow-text">Owl & Compass</h1>
              <p className="text-xs text-slate-200">Founder Intelligence System</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white transition-all cursor-pointer"
            title="Add New Founder"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation Tabs */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-slate-800">
          <button
            onClick={() => setSidebarTab("saved")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              sidebarTab === "saved"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-900/60 text-slate-300 hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Saved Profiles ({founders.length})
          </button>
          <button
            onClick={() => {
              setSidebarTab("discover");
              if (discoveredCandidates.length === 0) handleSearchCandidates();
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              sidebarTab === "discover"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-900/60 text-slate-300 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            Find Candidates
          </button>
        </div>

        {/* Founder Lists or Candidate Discovery */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sidebarTab === "saved" ? (
            <>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter saved founders..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {founders
                .filter(
                  (f) =>
                    f.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    f.company_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    f.industry.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleSelectFounder(f.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all flex flex-col gap-1 relative group ${
                      selectedFounderId === f.id
                        ? "bg-blue-600/10 border border-blue-500/30 shadow-lg shadow-blue-500/5"
                        : "bg-slate-900/40 border border-slate-800 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{f.full_name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium">
                          {f.company_stage}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(f.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                          title="Delete Founder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-slate-300 font-medium">{f.company_name}</div>
                    <div className="text-xs text-slate-200 flex items-center gap-2 mt-1">
                      <span className="truncate">{f.industry}</span>
                    </div>

                    {confirmDeleteId === f.id && (
                      <div className="mt-2 p-2 rounded-lg bg-red-950/80 border border-red-800/80 flex items-center justify-between gap-2 text-xs">
                        <span className="text-red-200 font-medium">Delete profile?</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFounder(f.id);
                            }}
                            disabled={deletingId === f.id}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium cursor-pointer"
                          >
                            {deletingId === f.id ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-white rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleSearchCandidates} className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by topic, stage, tech..."
                    value={discoveryQuery}
                    onChange={(e) => setDiscoveryQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isDiscovering}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDiscovering ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching Signals...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Search Public Signals
                    </>
                  )}
                </button>
              </form>

              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Discovered Candidates</p>
                {discoveredCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    onClick={() => handleSelectCandidate(cand)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border space-y-2 group ${
                      selectedCandidate?.id === cand.id
                        ? "bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/30"
                        : "bg-slate-900/60 border-slate-800 hover:bg-slate-900/90"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">{cand.full_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-600/10 text-blue-400 border border-blue-500/20">
                        {cand.company_stage}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-medium">{cand.company_name} · {cand.industry}</div>
                    <p className="text-xs text-slate-400 line-clamp-2">{cand.bio}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-blue-400 font-medium flex items-center gap-1 group-hover:underline">
                        View Prep & Brief →
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImportCandidate(cand);
                        }}
                        className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col overflow-y-auto min-h-screen">
        {selectedCandidate ? (
          loadingCandidateBrief ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-200">Analyzing public signals & generating candidate brief...</p>
            </div>
          ) : (
            <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
              {/* Discovered Candidate Profile Header Card */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                      Discovered Candidate Signal
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {selectedCandidate.company_stage}
                    </span>
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-white">{selectedCandidate.full_name}</h2>
                  <p className="text-lg text-slate-300 font-medium">{selectedCandidate.company_name} · {selectedCandidate.industry}</p>
                  <p className="text-sm text-slate-200 max-w-2xl">{selectedCandidate.bio}</p>
                </div>

                <div className="flex flex-col gap-3 justify-end shrink-0">
                  {selectedCandidate.tech_stack && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {selectedCandidate.tech_stack.split(",").map((tech) => (
                        <span key={tech} className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {tech.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleImportCandidate(selectedCandidate)}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Candidate to Workspace
                  </button>
                </div>
              </div>

              {/* Candidate Evidence-Backed Observations & Conversation Prep Brief */}
              {selectedCandidateBrief && (
                <div className="space-y-6">
                  {/* Evidence-Backed Observations */}
                  <div className="glass-panel p-6 rounded-2xl space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-400" />
                      Evidence-Backed Observations (Zero Hallucination)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCandidateBrief.observations.map((obs, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Observation #{idx + 1}</div>
                          <p className="text-sm text-white font-medium">{obs.observation}</p>
                          <div className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                            <span className="font-semibold text-slate-200">Hypothesis: </span>
                            {obs.hypothesis}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {obs.evidence_urls.map((url, uidx) => (
                              <a
                                key={uidx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 hover:text-blue-300 border border-blue-800/80 flex items-center gap-1 transition-all"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Source Link
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Questions & Ways to be Helpful */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-2xl space-y-3">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-blue-400" />
                        Tailored Conversation Questions
                      </h3>
                      <ul className="space-y-2.5">
                        {selectedCandidateBrief.suggested_questions.map((q, idx) => (
                          <li key={idx} className="text-sm text-slate-200 p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl space-y-3">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-400" />
                        Ways to Be Helpful
                      </h3>
                      <ul className="space-y-2.5">
                        {selectedCandidateBrief.ways_to_be_helpful.map((h, idx) => (
                          <li key={idx} className="text-sm text-slate-200 p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Outreach Generation Drafts */}
                  <div className="glass-panel p-6 rounded-2xl space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-400" />
                      Tailored Outreach Drafts
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCandidateBrief.linkedin_draft && (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                              LinkedIn InMail Draft
                            </span>
                            <button
                              onClick={() => handleCopyText(selectedCandidateBrief.linkedin_draft || "", "cand_linkedin")}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === "cand_linkedin" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              {copiedField === "cand_linkedin" ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap font-mono">{selectedCandidateBrief.linkedin_draft}</p>
                        </div>
                      )}

                      {selectedCandidateBrief.email_draft && (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" />
                              Email Outreach Draft
                            </span>
                            <button
                              onClick={() => handleCopyText(selectedCandidateBrief.email_draft || "", "cand_email")}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === "cand_email" ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              {copiedField === "cand_email" ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap font-mono">{selectedCandidateBrief.email_draft}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        ) : selectedFounderId ? (
          loadingDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-200">Loading founder workspace details...</p>
            </div>
          ) : (
            <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
              {/* Founder Header Profile card */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white">{selectedFounder?.full_name}</h2>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20">
                      {selectedFounder?.company_stage}
                    </span>
                    {selectedFounder && (
                      confirmDeleteId === selectedFounder.id ? (
                        <div className="flex items-center gap-2 bg-red-950/90 border border-red-800/80 px-3 py-1.5 rounded-lg text-xs ml-2">
                          <span className="text-red-200 font-medium">Delete profile?</span>
                          <button
                            onClick={() => handleDeleteFounder(selectedFounder.id)}
                            disabled={deletingId === selectedFounder.id}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium cursor-pointer"
                          >
                            {deletingId === selectedFounder.id ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-white rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(selectedFounder.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer ml-2"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-lg text-slate-300 font-medium">{selectedFounder?.company_name}</p>
                  <p className="text-sm text-slate-200 max-w-2xl">{selectedFounder?.bio}</p>
                </div>

                <div className="flex flex-col gap-3 justify-end shrink-0">
                  {selectedFounder?.tech_stack && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {selectedFounder.tech_stack.split(",").map((tech) => (
                        <span key={tech} className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {tech.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleGenerateBrief}
                    disabled={loadingBrief}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loadingBrief ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Brief...
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4" />
                        Generate Prep Brief
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b border-slate-800 gap-4">
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`pb-3 font-semibold text-sm transition-all cursor-pointer border-b-2 px-2 ${
                    activeTab === "timeline"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-slate-200 hover:text-slate-100"
                  }`}
                >
                  Relationship Timeline
                </button>
                <button
                  onClick={handleGenerateBrief}
                  className={`pb-3 font-semibold text-sm transition-all cursor-pointer border-b-2 px-2 ${
                    activeTab === "brief"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-slate-200 hover:text-slate-100"
                  }`}
                >
                  Conversation Prep Brief
                </button>
              </div>

              {/* Tabs Content */}
              {activeTab === "timeline" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Form & Recent Touchpoints */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                        Add Touchpoint Note
                      </h3>
                      <form onSubmit={handleSaveTouchpoint} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-200 uppercase tracking-wider font-semibold">Source Type</label>
                          <select
                            value={newTouchpointData.sourceType}
                            onChange={(e) => setNewTouchpointData({ ...newTouchpointData, sourceType: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                          >
                            <option value="note">Interaction Note</option>
                            <option value="email">Email Thread</option>
                            <option value="linkedin">LinkedIn Message</option>
                            <option value="transcript">Meeting Transcript</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-200 uppercase tracking-wider font-semibold">Content</label>
                          <textarea
                            value={newTouchpointData.content}
                            onChange={(e) => setNewTouchpointData({ ...newTouchpointData, content: e.target.value })}
                            placeholder="Paste email, meeting notes, transcription excerpts (supports up to 50k chars)..."
                            rows={6}
                            required
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isPending}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Interaction Note"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: Timeline Chronology */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        Memory Timeline
                      </h3>

                      {timelineEvents.length === 0 ? (
                        <div className="text-center py-12 text-slate-300">
                          <FileText className="w-12 h-12 mx-auto stroke-1 mb-2 opacity-50" />
                          No timeline events logged yet. Save a touchpoint note to populate memory.
                        </div>
                      ) : (
                        <div className="relative border-l border-slate-800 ml-4 space-y-8 pb-4">
                          {timelineEvents.map((evt) => (
                            <div key={evt.id} className="relative pl-8 group">
                              {/* Timeline indicator node */}
                              <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-950 group-hover:scale-125 transition-transform" />

                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-200">
                                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 capitalize font-medium">
                                    {evt.event_type}
                                  </span>
                                  <span>{new Date(evt.occurred_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-200">{evt.summary}</p>

                                {/* Event metadata tags */}
                                {(evt.open_loops?.length > 0 || evt.promises?.length > 0) && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {evt.open_loops?.map((loop) => (
                                      <span key={loop} className="text-xs px-2 py-0.5 rounded bg-amber-600/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Open Loop: {loop}
                                      </span>
                                    ))}
                                    {evt.promises?.map((promise) => (
                                      <span key={promise} className="text-xs px-2 py-0.5 rounded bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5" />
                                        Promise: {promise}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Brief Tab Content */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Observations list */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl space-y-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-500" />
                        Evidence-Backed Observations
                      </h3>

                      {prepBrief?.observations.map((obs, idx) => (
                        <div key={idx} className="p-5 rounded-xl bg-slate-900/30 border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
                          <div className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Observation</span>
                            <p className="text-sm text-slate-200 font-medium">{obs.observation}</p>
                          </div>
                          
                          <div className="space-y-1 border-t border-slate-800/60 pt-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Hypothesis Takeaway</span>
                            <p className="text-sm text-slate-300 italic">{obs.hypothesis}</p>
                          </div>

                          <div className="flex flex-wrap gap-2 border-t border-slate-800/60 pt-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 w-full mb-1">Sources</span>
                            {obs.evidence_urls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {new URL(url).hostname}
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Suggested Prep Questions */}
                    <div className="glass-panel p-6 rounded-2xl space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-blue-500" />
                        Suggested Conversation Starters
                      </h3>
                      <ul className="space-y-3">
                        {prepBrief?.suggested_questions.map((q, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-slate-300 bg-slate-900/20 p-3.5 rounded-xl border border-slate-900">
                            <span className="font-extrabold text-blue-500">{idx + 1}.</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right Column: Helpful Actions & Copyable Drafts */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Ways to be helpful */}
                    <div className="glass-panel p-6 rounded-2xl space-y-4">
                      <h3 className="text-lg font-bold text-white">Ways to Be Helpful</h3>
                      <ul className="space-y-2.5">
                        {prepBrief?.ways_to_be_helpful.map((way, idx) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                            <span>{way}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Outreach Drafts */}
                    <div className="glass-panel p-6 rounded-2xl space-y-6">
                      <h3 className="text-lg font-bold text-white">Outreach Generation</h3>

                      {prepBrief?.linkedin_draft && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-200">
                            <span className="flex items-center gap-1.5 font-medium text-white">
                              <MessageSquare className="w-4 h-4 text-blue-400" />
                              LinkedIn InMail
                            </span>
                            <button
                              onClick={() => handleCopyText(prepBrief.linkedin_draft!, "linkedin")}
                              className="text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              {copiedField === "linkedin" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              Copy
                            </button>
                          </div>
                          <div className="bg-slate-950 border border-slate-900 p-3.5 rounded-xl text-sm text-slate-300 font-mono whitespace-pre-wrap select-all">
                            {prepBrief.linkedin_draft}
                          </div>
                        </div>
                      )}

                      {prepBrief?.email_draft && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-200">
                            <span className="flex items-center gap-1.5 font-medium text-white">
                              <Mail className="w-4 h-4 text-blue-400" />
                              Email Outline
                            </span>
                            <button
                              onClick={() => handleCopyText(prepBrief.email_draft!, "email")}
                              className="text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              {copiedField === "email" ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              Copy
                            </button>
                          </div>
                          <div className="bg-slate-950 border border-slate-900 p-3.5 rounded-xl text-sm text-slate-300 font-mono whitespace-pre-wrap select-all">
                            {prepBrief.email_draft}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* Blank state if no founder is active */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
            <Compass className="w-20 h-20 text-slate-300 stroke-1 mb-6 animate-pulse" />
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">No Founder Selected</h2>
            <p className="text-sm text-slate-200 leading-relaxed mb-6">
              Select an existing founder from the workspace list or add a new founder profile to log timeline notes and generate prep briefs.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Founder
            </button>
          </div>
        )}
      </main>

      {/* Add Founder Glassmorphism Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl glass-panel rounded-2xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Create Founder Profile</h3>
              <p className="text-xs text-slate-200">Initialize a new profile in your relationship workspace</p>
            </div>

            <form onSubmit={handleCreateFounder} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newFounderData.fullName}
                    onChange={(e) => setNewFounderData({ ...newFounderData, fullName: e.target.value })}
                    placeholder="e.g. Maya Lin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Company Name</label>
                  <input
                    type="text"
                    required
                    value={newFounderData.companyName}
                    onChange={(e) => setNewFounderData({ ...newFounderData, companyName: e.target.value })}
                    placeholder="e.g. Compass Labs"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Company Stage</label>
                  <select
                    value={newFounderData.companyStage}
                    onChange={(e) => setNewFounderData({ ...newFounderData, companyStage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="Pre-Seed">Pre-Seed</option>
                    <option value="Seed">Seed</option>
                    <option value="Series A">Series A</option>
                    <option value="Series B+">Series B+</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Industry</label>
                  <input
                    type="text"
                    value={newFounderData.industry}
                    onChange={(e) => setNewFounderData({ ...newFounderData, industry: e.target.value })}
                    placeholder="e.g. Developer Tools, AI"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Tech Stack</label>
                <input
                  type="text"
                  value={newFounderData.techStack}
                  onChange={(e) => setNewFounderData({ ...newFounderData, techStack: e.target.value })}
                  placeholder="e.g. Python, FastAPI, TypeScript, React"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Bio Excerpt</label>
                <textarea
                  value={newFounderData.bio}
                  onChange={(e) => setNewFounderData({ ...newFounderData, bio: e.target.value })}
                  placeholder="Briefly summarize their technical focus, project, or role..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-200 hover:text-white transition-all text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Founder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
