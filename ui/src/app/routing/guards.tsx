import {Guard} from 'app/components/app-router';
import {hasRegisteredTierAccess} from 'app/utils/access-tiers';
import {authStore, profileStore} from 'app/utils/stores';
import {eligibleForRegisteredTier} from 'app/utils/access-utils';

export const signInGuard: Guard = {
  allowed: (): boolean => {
    return authStore.get().isSignedIn;
  },
  redirectPath: '/login'
};

export const disabledGuard = (userDisabled: boolean): Guard => ({
  // Show disabled screen when user account is disabled or removed from institution registered tier requirement.
  allowed: (): boolean => (!userDisabled && eligibleForRegisteredTier(profileStore.get().profile.tierEligibilities)),
  redirectPath: '/user-disabled'
});

export const registrationGuard: Guard = {
  allowed: (): boolean => hasRegisteredTierAccess(profileStore.get().profile),
  redirectPath: '/data-access-requirements'
};

export const expiredGuard: Guard = {
  allowed: (): boolean => !profileStore.get().profile.accessModules.anyModuleHasExpired,
  redirectPath: '/access-renewal'
};
