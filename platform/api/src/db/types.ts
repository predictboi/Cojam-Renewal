// Kysely table types for every table in src/db/migrations. Keep in step with the SQL.
// int8 (bigint, bigserial) columns are parsed to JS number (see src/db/index.ts): every id, block, day, week,
// market id and point amount fits in 2^53. numeric(78,0) token amounts stay strings (wei).

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type DefaultTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
/** numeric(78,0): read as string, written as string, bigint or number. */
type Wei = ColumnType<string, string | bigint | number, string | bigint | number>;
type WeiDefault = ColumnType<string, string | bigint | number | undefined, string | bigint | number>;
type Json<T = unknown> = ColumnType<T, T | string, T | string>;
type JsonDefault<T = unknown> = ColumnType<T, T | string | undefined, T | string>;

export type Language = "en" | "ko" | "ja";
export type Registration = "pending" | "registered" | "refused";

export interface UsersTable {
  id: Generated<number>;
  privy_user_id: string;
  wallet: string | null;
  email_domain: string | null;
  email_hash: string | null;
  device_id_first: string | null;
  ip_hash_first: string | null;
  language: ColumnType<Language, Language | undefined, Language>;
  onboarded: ColumnType<boolean, boolean | undefined, boolean>;
  display_name: string | null;
  registration: ColumnType<Registration, Registration | undefined, Registration>;
  refusal_reason: string | null;
  registered_tx: string | null;
  registered_at: Timestamp | null;
  frozen: ColumnType<boolean, boolean | undefined, boolean>;
  frozen_reason: string | null;
  risk_score: ColumnType<number, number | undefined, number>;
  risk_clear_until: Timestamp | null;
  pending_invite_code: string | null;
  /** Keyed hash of the email local part shape (worker migration 0900), for the look alike risk rule. */
  email_shape_hash: string | null;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export type RequestStatus = "queued" | "sent" | "mined" | "failed" | "cancelled";

export interface RegistrationRequestsTable {
  id: Generated<number>;
  kind: "register" | "set_referrer";
  wallet: string;
  referrer: string | null;
  invite_code: string | null;
  status: ColumnType<RequestStatus, RequestStatus | undefined, RequestStatus>;
  attempts: ColumnType<number, number | undefined, number>;
  tx_hash: string | null;
  error: string | null;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export interface InvitesTable {
  code: string;
  wallet: string;
  enabled: ColumnType<boolean, boolean | undefined, boolean>;
  links_today: ColumnType<number, number | undefined, number>;
  links_day: number | null;
  created_at: DefaultTimestamp;
}

export interface ReferralsTable {
  invitee: string;
  inviter: string;
  code: string | null;
  source: "session" | "first_run" | "profile";
  requested_at: DefaultTimestamp;
  bound_tx: string | null;
  bound_at: Timestamp | null;
  first_day_at: Timestamp | null;
  welcome_tx: string | null;
  welcome_points: ColumnType<number, number | undefined, number>;
  bonus_points: ColumnType<number, number | undefined, number>;
}

export interface FreezesTable {
  id: Generated<number>;
  wallet: string;
  action: "freeze" | "unfreeze" | "clear";
  actor: string;
  reason_code: string | null;
  reason: string | null;
  rules: Json | null;
  status: ColumnType<"queued" | "sent" | "mined" | "failed" | "done", "queued" | "sent" | "mined" | "failed" | "done" | undefined, "queued" | "sent" | "mined" | "failed" | "done">;
  tx_hash: string | null;
  created_at: DefaultTimestamp;
}

export interface PlayKeysTable {
  key: string;
  wallet: string;
  expires_at: Timestamp;
  set_tx: string | null;
  revoked_tx: string | null;
  replaced_by: string | null;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export type EmailRule = "gmail" | "plus" | "none";

export interface EmailDomainsTable {
  domain: string;
  display_name: string;
  rule: ColumnType<EmailRule, EmailRule | undefined, EmailRule>;
  enabled: ColumnType<boolean, boolean | undefined, boolean>;
  added_by: ColumnType<string, string | undefined, string>;
  added_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export interface AuthChecksTable {
  id: Generated<number>;
  email_hash: string | null;
  domain: string | null;
  ip_hash: string | null;
  device_id: string | null;
  result: string;
  created_at: DefaultTimestamp;
}

/** One language's text of a question. */
export interface MarketText {
  title: string;
  left: string;
  right: string;
  rule: string;
  settle: string;
}
export interface MarketContent {
  en: MarketText;
  ko: MarketText;
  ja: MarketText;
}
export interface MarketSource {
  name: string;
  url: string;
  role?: "primary" | "secondary";
}
export type MarketStatus = "draft" | "scheduled" | "cancelled" | "published" | "closed" | "resolved" | "voided" | "corrected";
export type ImageState = "generated" | "fallback" | "replaced" | "rejected" | "pending";

export interface MarketsTable {
  market_id: number;
  day_id: number;
  slot: number;
  category: string;
  content: Json<MarketContent>;
  closes_at: Timestamp;
  resolves_at: Timestamp;
  sources: JsonDefault<MarketSource[]>;
  criteria: string | null;
  rationale: string | null;
  content_hash: string | null;
  image_key: string | null;
  image_url: string | null;
  image_sha256: string | null;
  image_state: ColumnType<ImageState, ImageState | undefined, ImageState>;
  image_prompt: string | null;
  image_model: string | null;
  status: ColumnType<MarketStatus, MarketStatus | undefined, MarketStatus>;
  outcome: number | null;
  corrected_outcome: number | null;
  resolved_at: Timestamp | null;
  settles_at: Timestamp | null;
  create_tx: string | null;
  outcome_tx: string | null;
  replaced_by: number | null;
  draft_id: number | null;
  /** Worker migration 0900: when the deciding fact is observed, and discrete or continuous. */
  observes_at: Timestamp | null;
  kind: string | null;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export interface AiRunsTable {
  id: Generated<number>;
  job: string;
  model: string;
  prompt_version: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: string | null;
  stop_reason: string | null;
  error: string | null;
  created_at: DefaultTimestamp;
}

export interface MarketDraftsTable {
  id: Generated<number>;
  target_day: number;
  payload: Json;
  validator_result: Json | null;
  selected: ColumnType<boolean, boolean | undefined, boolean>;
  rejected_reason: string | null;
  ai_run_id: number | null;
  created_at: DefaultTimestamp;
}

export interface ImageRunsTable {
  id: Generated<number>;
  market_id: number;
  model: string | null;
  prompt: string | null;
  result: "accepted" | "rejected" | "error";
  reject_reasons: Json | null;
  cost_usd: string | null;
  created_at: DefaultTimestamp;
}

export interface ResolutionsTable {
  id: Generated<number>;
  market_id: number;
  run: "1" | "2" | "3" | "adapter" | "admin";
  outcome: "A" | "B" | "undeterminable" | "void";
  confidence: string | null;
  reasoning: string | null;
  ai_run_id: number | null;
  created_at: DefaultTimestamp;
}

export interface EvidenceTable {
  id: Generated<number>;
  resolution_id: number;
  url: string;
  quote: string | null;
  observed_at: Timestamp | null;
  fetched_text_sha256: string | null;
  fetched_text: Buffer | null;
}

export interface PredictionsTable {
  wallet: string;
  market_id: number;
  day_id: number;
  choice: number;
  answered: number | null;
  tx_hash: string;
  block: number;
  block_time: Timestamp | null;
  status: ColumnType<string, string | undefined, string>;
}

export interface UserDaysTable {
  wallet: string;
  day_id: number;
  answered: ColumnType<number, number | undefined, number>;
  completed: ColumnType<boolean, boolean | undefined, boolean>;
  completed_at: Timestamp | null;
  settled_mask: ColumnType<number, number | undefined, number>;
  hits: ColumnType<number, number | undefined, number>;
  completion_points: ColumnType<number, number | undefined, number>;
  hit_points: ColumnType<number, number | undefined, number>;
}

export type PointsKind = "completion" | "hits" | "compensation" | "referral" | "welcome" | "convert";

export interface PointsLedgerTable {
  id: Generated<number>;
  wallet: string;
  kind: PointsKind;
  amount: number;
  source_wallet: string | null;
  day_id: number | null;
  week_id: number | null;
  ranked: ColumnType<boolean, boolean | undefined, boolean>;
  tx_hash: string;
  log_index: number;
  block: number | null;
  block_time: Timestamp | null;
}

export interface WeekTotalsTable {
  week_id: number;
  wallet: string;
  points: ColumnType<number, number | undefined, number>;
  last_completion_at: Timestamp | null;
  last_credit_block: number | null;
}

export interface WeeksTable {
  week_id: number;
  qualified_players: number | null;
  pool: Wei | null;
  airdrop_tx: string | null;
  status: ColumnType<"open" | "closed" | "airdrop_pending" | "airdropped" | "failed", "open" | "closed" | "airdrop_pending" | "airdropped" | "failed" | undefined, "open" | "closed" | "airdrop_pending" | "airdropped" | "failed">;
  closed_at: Timestamp | null;
  updated_at: DefaultTimestamp;
}

export interface AirdropRowsTable {
  week_id: number;
  rank: number;
  wallet: string;
  points: number;
  amount: Wei | null;
  skipped_reason: string | null;
  tx_hash: string | null;
}

export interface ConversionsTable {
  tx_hash: string;
  wallet: string;
  points: number;
  ct: Wei;
  block: number | null;
  block_time: Timestamp | null;
}

export interface StakesTable {
  wallet: string;
  position_id: number;
  principal: Wei;
  lock_index: number;
  lock_days: number;
  apr_bps: number;
  max_interest: Wei;
  start_at: Timestamp;
  end_at: Timestamp;
  claimed: WeiDefault;
  closed: ColumnType<boolean, boolean | undefined, boolean>;
  stake_tx: string | null;
  withdraw_tx: string | null;
}

export interface WalletTransfersTable {
  tx_hash: string;
  log_index: number;
  wallet: string;
  direction: "in" | "out";
  counterparty: string;
  amount: Wei;
  kind: ColumnType<string, string | undefined, string>;
  block: number | null;
  block_time: Timestamp | null;
}

export interface ChainCursorTable {
  name: string;
  block: number;
  updated_at: DefaultTimestamp;
}

export type SponsoredStatus = "reserved" | "broadcast" | "uncertain" | "mined" | "reverted" | "released" | "rejected";

export interface SponsoredTxsTable {
  sender_tx_hash: string;
  sender: string;
  wallet: string | null;
  privy_user_id: string | null;
  action: string;
  target: string | null;
  market_id: number | null;
  choice: ColumnType<number | null, number | null | undefined, number | null>;
  nonce: number | null;
  tx_hash: string | null;
  status: SponsoredStatus;
  reserved_wei: WeiDefault;
  actual_wei: Wei | null;
  error_code: string | null;
  ip_hash: string | null;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export interface UsageDailyTable {
  day: string;
  key: string;
  count: ColumnType<number, number | undefined, number>;
  spent_wei: WeiDefault;
}

export interface RiskFlagsTable {
  id: Generated<number>;
  wallet: string;
  rule: string;
  score: number;
  details: Json | null;
  run: ColumnType<"hourly" | "signup" | "manual", "hourly" | "signup" | "manual" | undefined, "hourly" | "signup" | "manual">;
  status: ColumnType<"open" | "blocked" | "cleared", "open" | "blocked" | "cleared" | undefined, "open" | "blocked" | "cleared">;
  created_at: DefaultTimestamp;
}

export type AdminRole = "viewer" | "operator" | "owner";

export interface AdminUsersTable {
  privy_user_id: string;
  email: string;
  role: AdminRole;
  added_by: string;
  created_at: DefaultTimestamp;
}

export interface AuditLogTable {
  id: Generated<number>;
  actor: string;
  action: string;
  target: string | null;
  payload: Json | null;
  tx_hash: string | null;
  created_at: DefaultTimestamp;
}

export type OperatorRequestStatus = "queued" | "running" | "sent" | "done" | "failed" | "cancelled";

export interface OperatorRequestsTable {
  id: Generated<number>;
  kind: string;
  target: string | null;
  payload: JsonDefault<Record<string, unknown>>;
  status: ColumnType<OperatorRequestStatus, OperatorRequestStatus | undefined, OperatorRequestStatus>;
  result: Json | null;
  tx_hash: string | null;
  requested_by: string;
  created_at: DefaultTimestamp;
  updated_at: DefaultTimestamp;
}

export interface AppStateTable {
  key: string;
  value: Json;
  updated_at: DefaultTimestamp;
}

export interface SchemaMigrationsTable {
  name: string;
  applied_at: DefaultTimestamp;
}

export interface Database {
  users: UsersTable;
  registration_requests: RegistrationRequestsTable;
  invites: InvitesTable;
  referrals: ReferralsTable;
  freezes: FreezesTable;
  play_keys: PlayKeysTable;
  email_domains: EmailDomainsTable;
  auth_checks: AuthChecksTable;
  markets: MarketsTable;
  ai_runs: AiRunsTable;
  market_drafts: MarketDraftsTable;
  image_runs: ImageRunsTable;
  resolutions: ResolutionsTable;
  evidence: EvidenceTable;
  predictions: PredictionsTable;
  user_days: UserDaysTable;
  points_ledger: PointsLedgerTable;
  week_totals: WeekTotalsTable;
  weeks: WeeksTable;
  airdrop_rows: AirdropRowsTable;
  conversions: ConversionsTable;
  stakes: StakesTable;
  wallet_transfers: WalletTransfersTable;
  chain_cursor: ChainCursorTable;
  sponsored_txs: SponsoredTxsTable;
  usage_daily: UsageDailyTable;
  risk_flags: RiskFlagsTable;
  admin_users: AdminUsersTable;
  audit_log: AuditLogTable;
  operator_requests: OperatorRequestsTable;
  app_state: AppStateTable;
  schema_migrations: SchemaMigrationsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Market = Selectable<MarketsTable>;
export type NewMarket = Insertable<MarketsTable>;
export type SponsoredTx = Selectable<SponsoredTxsTable>;
export type AdminUser = Selectable<AdminUsersTable>;
