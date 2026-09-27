import type { BoardSettings, Card, CardMap, LinkMap, Link } from "@/lib/engine";

export type Role = "owner" | "editor" | "viewer";

export interface Me {
  id: string;
  name: string;
  email?: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  role: Role;
  updatedAt: number;
}

export interface BoardMeta {
  id: string;
  name: string;
  settings: BoardSettings;
  role: Role;
}

export interface PlanInfo {
  id: string;
  name: string;
  isMain: boolean;
  createdAt: number;
}

export interface ActivityEntry {
  id: string;
  planId: string | null;
  userId: string | null;
  text: string;
  at: number;
}

export interface PeerState {
  /** One per open tab. */
  key: string;
  userId: string;
  name: string;
  color: number;
  planId?: string;
  cx?: number | null;
  cy?: number | null;
  sel?: string | null;
  edit?: string | null;
}

export interface PresenceHandle {
  update(patch: Partial<Omit<PeerState, "key" | "userId">>): void;
  onPeers(cb: (peers: PeerState[]) => void): () => void;
  leave(): void;
}

export type Unsubscribe = () => void;

/** Everything the app reads and writes. Implemented by the Supabase store and the browser-only store. */
export interface Store {
  readonly mode: "cloud" | "local";
  me(): Promise<Me | null>;
  signOut(): Promise<void>;

  listBoards(): Promise<BoardSummary[]>;
  createBoard(name: string, settings: BoardSettings): Promise<{ boardId: string; planId: string }>;
  renameBoard(boardId: string, name: string): Promise<void>;
  deleteBoard(boardId: string): Promise<void>;
  updateSettings(boardId: string, settings: BoardSettings): Promise<void>;
  watchBoard(boardId: string, cb: { meta(m: BoardMeta | null): void; plans(p: PlanInfo[]): void }): Unsubscribe;

  watchPlan(boardId: string, planId: string, cb: { data(cards: CardMap, links: LinkMap): void; ready(): void }): Unsubscribe;
  loadPlan(planId: string): Promise<{ cards: CardMap; links: LinkMap }>;
  createPlan(fromPlanId: string, name: string): Promise<string>;
  renamePlan(planId: string, name: string): Promise<void>;
  deletePlan(planId: string): Promise<void>;

  addCards(boardId: string, planId: string, cards: Card[], links?: Link[]): Promise<void>;
  patchCard(cardId: string, patch: Partial<Card>): Promise<void>;
  deleteCard(cardId: string): Promise<void>;
  addLink(boardId: string, planId: string, link: Link): Promise<void>;
  deleteLink(linkId: string): Promise<void>;

  log(boardId: string, planId: string | null, text: string): Promise<void>;
  watchActivity(boardId: string, cb: (entries: ActivityEntry[]) => void): Unsubscribe;
  profiles(ids: string[]): Promise<Record<string, string>>;

  uploadFile(boardId: string, file: File): Promise<{ path: string; size: number; type: string }>;
  fileUrl(path: string): Promise<string | null>;

  presence(boardId: string, me: Me, color: number): PresenceHandle | null;
  createInvite(boardId: string, role: Exclude<Role, "owner">): Promise<string>;
  acceptInvite(token: string): Promise<string>;
}

/** Errors shown to people. `message` is already written for them. */
export class StoreError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}
