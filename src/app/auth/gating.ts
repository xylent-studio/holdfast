interface AuthLandingGateInput {
  authConfigured: boolean;
  authReady: boolean;
  hasLocalData: boolean;
  hasSession: boolean;
  shouldShowSessionRecovery: boolean;
  snapshotReady: boolean;
}

export function shouldShowAuthLanding({
  authConfigured,
  authReady,
  hasLocalData,
  hasSession,
  shouldShowSessionRecovery,
  snapshotReady,
}: AuthLandingGateInput): boolean {
  return (
    snapshotReady &&
    authConfigured &&
    authReady &&
    !hasSession &&
    !hasLocalData &&
    !shouldShowSessionRecovery
  );
}
