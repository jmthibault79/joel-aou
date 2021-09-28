import {AnalyticsTracker, setLoggedInState} from 'app/utils/analytics';
import {LOCAL_STORAGE_KEY_TEST_ACCESS_TOKEN} from 'app/utils/cookies';
import {authStore, serverConfigStore, useStore} from 'app/utils/stores';
import {delay} from 'app/utils/subscribable';
import {environment} from 'environments/environment';
import {ConfigResponse} from 'generated/fetch';
import {useEffect, useState} from 'react';

declare const gapi: any;

// for e2e tests: provide your own oauth token to obviate Google's oauth UI
// flow, thereby avoiding inevitable challenges as Google identifies Puppeteer
// as non-human.
declare global {
  interface Window { setTestAccessTokenOverride: (token: string) => void; }
}

/** Returns true if use access token, this is used by Puppeteer test. */
const isTestAccessTokenActive = () => {
  return environment.allowTestAccessTokenOverride && window.localStorage.getItem(LOCAL_STORAGE_KEY_TEST_ACCESS_TOKEN);
};

const makeAuth2 = (config: ConfigResponse): Promise<any> => {
  return new Promise((resolve, reject) => {
    gapi.load('auth2', () => {
      gapi.auth2.init({
        client_id: environment.clientId,
        hosted_domain: config.gsuiteDomain,
        scope: 'https://www.googleapis.com/auth/plus.login openid profile'
      }).then(
        // onInit
        () => {
          authStore.set({
            ...authStore.get(),
            authLoaded: true,
            isSignedIn: gapi.auth2.getAuthInstance().isSignedIn.get()
          });

          gapi.auth2.getAuthInstance().isSignedIn.listen((nextIsSignedIn: boolean) => {
            authStore.set({...authStore.get(), isSignedIn: nextIsSignedIn});
          });
        },
        // onError
        ({error, details}) => {
          const authError = `${error}: ${details}`;
          authStore.set({...authStore.get(), authError: authError});
          reject(authError);
        }
      );
      resolve(gapi.auth2);
    });
  });
};

export const signIn = (): void => {
  AnalyticsTracker.Registration.SignIn();

  gapi.load('auth2', () => {
    gapi.auth2.getAuthInstance().signIn({
      'prompt': 'select_account',
      'ux_mode': 'redirect',
      'redirect_uri': `${window.location.protocol}//${window.location.host}`
    });
  });
};

export const signOut = (): void => {
  authStore.set({...authStore.get(), isSignedIn: false});
};

function clearIdToken(): void {
  // Using the full page redirect puts a long "id_token" parameter in the
  // window hash; clear this after gapi has consumed it.
  window.location.hash = '';
}

/**
 * @name useAuthentication
 * @description React hook that provides the user with the signed-in status of the current user and
 *              handles redirect, etc. as appropriate when that state changes
 */
export function useAuthentication() {
  const {authLoaded, isSignedIn, authError} = useStore(authStore);
  const {config} = useStore(serverConfigStore);

  useEffect(() => {
    if (config && !(isTestAccessTokenActive())) {
      makeAuth2(config);
    }
  }, [config]);

  useEffect(() => {
    if (isSignedIn) {
      clearIdToken();
    } else if (authLoaded) {
      // If we're in puppeteer, we never call gapi.auth2.init, so we can't sign out normally.
      // Instead, we revoke all the access tokens and reset all the state.
      if (isTestAccessTokenActive()) {
        window.setTestAccessTokenOverride('');
      } else {
        gapi.auth2.getAuthInstance().signOut();
      }
    }
    setLoggedInState(isSignedIn);
  }, [isSignedIn, authLoaded]);

  return {authLoaded, isSignedIn, authError};
}

// The delay before continuing to avoid errors due to delays in applying the new scope grant
const BILLING_SCOPE_DELAY_MS = 2000;

const getAuthInstance = () => {
  return gapi.auth2.getAuthInstance();
};

export const hasBillingScope = () => {
  // If uses access token, assume users always have billing scope. The token generated by GenerateImpersonatedUserTokens tool sets billing
  // scope.
  return isTestAccessTokenActive() || getAuthInstance().currentUser.get().hasGrantedScopes('https://www.googleapis.com/auth/cloud-billing');
};

/*
 * Request Google Cloud Billing scope if necessary.
 *
 * NOTE: Requesting additional scopes may invoke a browser pop-up which the browser might block.
 * If you use ensureBillingScope during page load and the pop-up is blocked, a rejected promise will
 * be returned. In this case, you'll need to provide something for the user to deliberately click on
 * and retry ensureBillingScope in reaction to the click.
 */
export const ensureBillingScope = async() => {
  if (!hasBillingScope()) {
    const options = new gapi.auth2.SigninOptionsBuilder();
    options.setScope('https://www.googleapis.com/auth/cloud-billing');
    await getAuthInstance().currentUser.get().grant(options);
    // Wait 250ms before continuing to avoid errors due to delays in applying the new scope grant
    await delay(BILLING_SCOPE_DELAY_MS);
  }
};
