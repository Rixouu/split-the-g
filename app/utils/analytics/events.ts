export const analyticsEventNames = {
  pageView: "page_view",
  pourCaptureStarted: "pour_capture_started",
  pourSubmitted: "pour_submitted",
  pourSaved: "pour_saved",
  pourProcessingFailed: "pour_processing_failed",
  offlinePourQueued: "offline_pour_queued",
  offlinePourSynced: "offline_pour_synced",
  pourClaimStarted: "pour_claim_started",
  pourClaimSucceeded: "pour_claim_succeeded",
  pourClaimFailed: "pour_claim_failed",
  venueDetailsSaved: "venue_details_saved",
  competitionAttachSucceeded: "competition_attach_succeeded",
  competitionAttachFailed: "competition_attach_failed",
  competitionJoined: "competition_joined",
  competitionLeft: "competition_left",
  competitionCreated: "competition_created",
  authGoogleSignInStarted: "auth_google_signin_started",
  authGoogleSignInSucceeded: "auth_google_signin_succeeded",
  authGoogleSignInFailed: "auth_google_signin_failed",
  authUserRegistered: "auth_user_registered",
  authUserSignedIn: "auth_user_signed_in",
  profileSaved: "profile_saved",
} as const;

export interface AttributionContext {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface AnalyticsEventPayloads {
  [analyticsEventNames.pageView]: {
    path: string;
    title?: string;
    lang?: string;
    referrer?: string;
    attribution?: AttributionContext;
  };
  [analyticsEventNames.pourCaptureStarted]: {
    source: "camera";
  };
  [analyticsEventNames.pourSubmitted]: {
    source: "camera" | "upload";
    hasCompetition: boolean;
  };
  [analyticsEventNames.pourSaved]: {
    hasCompetition: boolean;
    scoreId?: string;
  };
  [analyticsEventNames.pourProcessingFailed]: {
    code: string;
    source?: "camera" | "upload";
  };
  [analyticsEventNames.offlinePourQueued]: {
    hasCompetition: boolean;
  };
  [analyticsEventNames.offlinePourSynced]: {
    batchSize?: number;
  };
  [analyticsEventNames.pourClaimStarted]: {
    scoreId: string;
  };
  [analyticsEventNames.pourClaimSucceeded]: {
    scoreId: string;
  };
  [analyticsEventNames.pourClaimFailed]: {
    scoreId: string;
    reason?: string;
  };
  [analyticsEventNames.venueDetailsSaved]: {
    scoreId: string;
    hasPrice: boolean;
    hasPlaceId: boolean;
  };
  [analyticsEventNames.competitionAttachSucceeded]: {
    scoreId?: string;
    competitionId: string;
  };
  [analyticsEventNames.competitionAttachFailed]: {
    scoreId?: string;
    competitionId: string;
    reason?: string;
  };
  [analyticsEventNames.competitionJoined]: {
    competitionId: string;
  };
  [analyticsEventNames.competitionLeft]: {
    competitionId: string;
  };
  [analyticsEventNames.competitionCreated]: {
    competitionId: string;
    visibility: "public" | "private";
    winRule: string;
  };
  [analyticsEventNames.authGoogleSignInStarted]: {
    source: "profile" | "score";
  };
  [analyticsEventNames.authGoogleSignInSucceeded]: {
    source: "profile" | "score";
  };
  [analyticsEventNames.authGoogleSignInFailed]: {
    source: "profile" | "score";
    reason?: string;
  };
  [analyticsEventNames.authUserRegistered]: {
    method: "google";
  };
  [analyticsEventNames.authUserSignedIn]: {
    method: "google";
    isNewUser: boolean;
  };
  [analyticsEventNames.profileSaved]: {
    hasNickname: boolean;
    hasCountryCode: boolean;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventPayloads;

export type AnalyticsPayloadFor<TEvent extends AnalyticsEventName> =
  AnalyticsEventPayloads[TEvent];
