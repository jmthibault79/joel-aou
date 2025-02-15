import { AccessModule, Profile } from 'generated/fetch';

import { Guard } from 'app/components/app-router';
import { cond } from 'app/utils';
import {
  AccessTierShortNames,
  hasRegisteredTierAccess,
} from 'app/utils/access-tiers';
import {
  ACCESS_RENEWAL_PATH,
  DATA_ACCESS_REQUIREMENTS_PATH,
  eligibleForTier,
  getAccessModuleStatusByNameOrEmpty,
  hasRtExpired,
} from 'app/utils/access-utils';
import {
  AuthorityGuardedAction,
  hasAuthorityForAction,
} from 'app/utils/authorities';
import { currentWorkspaceStore } from 'app/utils/navigation';
import { authStore, profileStore, serverConfigStore } from 'app/utils/stores';

import { AuthorityMissing } from './authority-missing';

export const signInGuard: Guard = {
  allowed: (): boolean => {
    return authStore.get().isSignedIn;
  },
  redirectPath: '/login',
};

export const userIsDisabled = (userDisabledInDb: boolean) =>
  userDisabledInDb ||
  !eligibleForTier(profileStore.get().profile, AccessTierShortNames.Registered);

export const disabledGuard = (userDisabledInDb: boolean): Guard => ({
  // Show disabled screen when user account is disabled by admin or removed from institution registered tier requirement.
  allowed: (): boolean => !userIsDisabled(userDisabledInDb),
  redirectPath: '/user-disabled',
});

export const userDisabledPageGuard = (userDisabledInDb: boolean): Guard => ({
  // enabled users should be redirected to the homepage if they visit the /user-disabled page
  allowed: (): boolean => userIsDisabled(userDisabledInDb),
  redirectPath: '/',
});

const allCompleteOrBypassed = (
  profile: Profile,
  moduleNames: AccessModule[]
) => {
  const modules = profile?.accessModules?.modules;
  return moduleNames.every((moduleName) => {
    const status = getAccessModuleStatusByNameOrEmpty(modules, moduleName);
    return !!status?.completionEpochMillis || !!status?.bypassEpochMillis;
  });
};

// use this for all access-module routing decisions, to ensure only one routing is chosen
export const shouldRedirectToMaybe = (profile: Profile): string | undefined => {
  return cond(
    [hasRtExpired(profile), () => ACCESS_RENEWAL_PATH],
    // not a common scenario (mainly test users) but AAR is the only way to recover if these modules are missing
    [
      !allCompleteOrBypassed(profile, [
        AccessModule.PROFILECONFIRMATION,
        AccessModule.PUBLICATIONCONFIRMATION,
      ]),
      () => ACCESS_RENEWAL_PATH,
    ],
    [!hasRegisteredTierAccess(profile), () => DATA_ACCESS_REQUIREMENTS_PATH]
    // by default: no redirect
  );
};

// use this for all access-module routing decisions, to ensure only one routing is chosen
export const getAccessModuleGuard = (): Guard => {
  const redirectPath = shouldRedirectToMaybe(profileStore.get().profile);
  return {
    allowed: () => !redirectPath,
    redirectPath,
  };
};

export const adminLockedGuard = (ns: string, wsid: string): Guard => {
  return {
    allowed: (): boolean => !currentWorkspaceStore.getValue().adminLocked,
    redirectPath: `/workspaces/${ns}/${wsid}/about`,
  };
};

// Temp: Since the new analysis page is not ready yet, use the guard to prevent users to go to
// new analysis page, if the flag is off
export const tempAppsAnalysisGuard = (ns: string, wsid: string): Guard => {
  return {
    allowed: (): boolean => serverConfigStore.get().config.enableGkeApp,
    redirectPath: `/workspaces/${ns}/${wsid}/data`,
  };
};

export const authorityGuard = (
  guardedAction: AuthorityGuardedAction
): Guard => ({
  allowed: () =>
    hasAuthorityForAction(profileStore.get().profile, guardedAction),
  renderBlocked: () => <AuthorityMissing action={guardedAction} />,
});
