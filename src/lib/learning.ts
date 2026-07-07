// SO-Learn client. Owns the contract with the n8n SO-Learn workflow.
//
// Convention here differs from the rest of lib/: a single LearningService class
// instead of free functions. Rationale — learning operations are more cohesive
// (they share endpoint config, error handling, and response envelope) and the
// surface is growing; a class keeps the seams clean for future additions
// (e.g. offline cache, optimistic dialogue updates, streaming Socratic replies).

import { postJson } from './webhookClient';

// ---------------------------------------------------------------------------
// Types — the contract with the n8n workflow.
// ---------------------------------------------------------------------------

// Mirrors learning_topics.status in Postgres. `active` is the default value
// set when a topic moves from roadmap-accepted into live Socratic work.
export type TopicStatus =
  | 'roadmap-draft'
  | 'roadmap-accepted'
  | 'active'
  | 'in-progress'
  | 'apex-defended';

export type Level = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type TopicSummary = {
  slug: string;
  title: string;
  apex: string;
  status: TopicStatus;
  current_module: number;
  current_concept: string | null;
};

export type RoadmapModule = {
  module_num: number;
  name: string;
  why: string;
  spine_preview: string;
  status: 'not started' | 'in progress' | 'done';
};

export type TopicDetail = TopicSummary & {
  advance_threshold: Level;
  roadmap: RoadmapModule[];
  tangents: string[];
  open_prompt: string | null;
  open_prompt_set_at: string | null;
};

export type ConceptState = {
  module_num: number;
  concept_slug: string;
  level: Level | null;
  last_tested: string | null; // ISO timestamp
  evidence: string | null;
  diagnosis: string | null;
  ref_note: string | null;
};

export type TranscriptEntry = {
  exchanged_at: string;
  module_num: number | null;
  concept_slug: string | null;
  surface: 'pwa' | 'claude-code';
  claude_prompt: string;
  user_response: string;
  assessed_level: Level | null;
  diagnosis: string | null;
  action: string | null;
  evidence_quote: string | null;
  claude_message: string | null;
};

export type ResourceCategory =
  | 'foundational'
  | 'core'
  | 'applied'
  | 'critiques'
  | 'tangents';

export type ResourceStatus = 'queued' | 'reading' | 'digested' | 'parked';

export type ResourceEntry = {
  id: number;
  category: ResourceCategory;
  title: string;
  url: string | null;
  resource_type: string | null;
  supports_module: string | null;
  added_at: string;
  added_by: 'user' | 'claude';
  status: ResourceStatus;
  why_relevant: string | null;
  note: string | null;
};

export type DialogueRequest = {
  topic_slug: string;
  user_response: string;
  surface: 'pwa';
  client_id: string;
  // 1..5 self-rated confidence collected just before submit. Drives the
  // SM-2 quality calibration so high-confidence wrong-answers get re-tested
  // sooner (hypercorrection) and low-confidence correct ones stretch out.
  confidence: number;
};

export type DialogueResponse = {
  next_prompt: string;
  current_concept: string | null;
  current_module: number;
  // Free prose the Socratic prompt emits before the fenced JSON block —
  // mirrors what the user sees when running /so-learn in Claude Code.
  claude_message: string | null;
  last_assessment: {
    level: Level | null;
    evidence_quote: string | null;
    diagnosis: string | null;
    action: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Response envelope from the workflow — `{ok: true, payload: T} | {ok: false, reason}`.
// ---------------------------------------------------------------------------

type Envelope<T> = { ok: true; payload: T } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Endpoint config — passed in once at construction so tests can inject mocks
// and so a future second instance (e.g. against a staging workflow) doesn't
// require rewriting the class.
// ---------------------------------------------------------------------------

export type LearningEndpoints = {
  topicsList: string;
  topic: string;
  state: string;
  transcript: string;
  resources: string;
  answer: string;
};

// ---------------------------------------------------------------------------
// LearningService — single class, single responsibility per method.
// ---------------------------------------------------------------------------

export class LearningService {
  constructor(private readonly endpoints: LearningEndpoints) {}

  listTopics(): Promise<TopicSummary[]> {
    return this.call<TopicSummary[]>(this.endpoints.topicsList, {});
  }

  getTopic(slug: string): Promise<TopicDetail> {
    return this.call<TopicDetail>(this.endpoints.topic, { slug });
  }

  getState(slug: string): Promise<ConceptState[]> {
    return this.call<ConceptState[]>(this.endpoints.state, { slug });
  }

  getTranscript(slug: string, limit = 20): Promise<TranscriptEntry[]> {
    return this.call<TranscriptEntry[]>(this.endpoints.transcript, { slug, limit });
  }

  getResources(slug: string): Promise<ResourceEntry[]> {
    return this.call<ResourceEntry[]>(this.endpoints.resources, { slug });
  }

  submitAnswer(request: DialogueRequest): Promise<DialogueResponse> {
    // Claude Sonnet on the answer endpoint typically takes 20–40s but a tail
    // of the distribution stretches past 90s on cold-start or long context.
    // The PWA carries an idempotency client_id, so even if the user retries
    // after a timeout the server dedupes; the timeout is just for UX.
    // 180s is long enough to ride out a slow turn without prompting retry.
    return this.call<DialogueResponse>(this.endpoints.answer, request, { timeoutMs: 180_000 });
  }

  private async call<T>(url: string, body: unknown, options?: { timeoutMs?: number }): Promise<T> {
    if (!url) throw new Error('SO-Learn endpoint URL is empty — check VITE_WEBHOOK_LEARN_*');
    const res = await postJson(url, body, options);
    const data = (await res.json()) as Envelope<T>;
    if (!data.ok) throw new Error(data.reason || 'SO-Learn request failed');
    return data.payload;
  }
}

// Singleton wired to env. Components import this; tests construct their own.
export const learningService = new LearningService({
  topicsList: import.meta.env.VITE_WEBHOOK_LEARN_TOPICS_URL,
  topic:      import.meta.env.VITE_WEBHOOK_LEARN_TOPIC_URL,
  state:      import.meta.env.VITE_WEBHOOK_LEARN_STATE_URL,
  transcript: import.meta.env.VITE_WEBHOOK_LEARN_TRANSCRIPT_URL,
  resources:  import.meta.env.VITE_WEBHOOK_LEARN_RESOURCES_URL,
  answer:     import.meta.env.VITE_WEBHOOK_LEARN_ANSWER_URL,
});
