import { bindApiClients as notebooksBindApiClients } from 'app/services/notebooks-swagger-fetch-clients';
import * as fp from 'lodash/fp';
import { useEffect, useState } from 'react';
import * as React from 'react';
import { Switch, useHistory } from 'react-router-dom';
import { StackdriverErrorReporter } from 'stackdriver-errors-js';

import { AppRoute, AppRouter, withRouteData } from 'app/components/app-router';
import { NotificationModal } from 'app/components/modals';
import { withRoutingSpinner } from 'app/components/with-routing-spinner';
import { CookiePolicy } from 'app/pages/cookie-policy';
import { SignIn } from 'app/pages/login/sign-in';
import { NotFound } from 'app/pages/not-found';
import { SessionExpired } from 'app/pages/session-expired';
import { SignInAgain } from 'app/pages/sign-in-again';
import { SignedIn } from 'app/pages/signed-in/signed-in';
import { UserDisabled } from 'app/pages/user-disabled';
import {
  disabledGuard,
  signInGuard,
  userDisabledPageGuard,
} from 'app/routing/guards';
import {
  bindApiClients,
  configApi,
  getApiBaseUrl,
} from 'app/services/swagger-fetch-clients';
import { useIsUserDisabled } from 'app/utils/access-utils';
import { initializeAnalytics } from 'app/utils/analytics';
import { useAuthentication } from 'app/utils/authentication';
import {
  cookiesEnabled,
  LOCAL_STORAGE_API_OVERRIDE_KEY,
  LOCAL_STORAGE_KEY_TEST_ACCESS_TOKEN,
} from 'app/utils/cookies';
import {
  authStore,
  serverConfigStore,
  stackdriverErrorReporterStore,
  useStore,
} from 'app/utils/stores';
import { environment } from 'environments/environment';
import { Configuration } from 'generated/fetch';
import 'rxjs/Rx';

import logo from 'assets/images/all-of-us-logo.svg';

declare const gapi: any;

const CookiePolicyPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(CookiePolicy);
const NotFoundPage = fp.flow(withRouteData, withRoutingSpinner)(NotFound);
const SessionExpiredPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(SessionExpired);
const SignedInPage = fp.flow(withRouteData, withRoutingSpinner)(SignedIn);
const SignInAgainPage = fp.flow(withRouteData, withRoutingSpinner)(SignInAgain);
const SignInPage = fp.flow(withRouteData, withRoutingSpinner)(SignIn);
const UserDisabledPage = fp.flow(
  withRouteData,
  withRoutingSpinner
)(UserDisabled);

interface RoutingProps {
  onSignIn: () => void;
  signIn: () => void;
  subscribeToInactivitySignOut: () => void;
  signOut: () => void;
}

const currentAccessToken = () => {
  const tokenOverride = window.localStorage.getItem(
    LOCAL_STORAGE_KEY_TEST_ACCESS_TOKEN
  );

  if (tokenOverride) {
    return tokenOverride;
  } else if (!gapi.auth2) {
    return null;
  } else {
    const authResponse = gapi.auth2
      .getAuthInstance()
      .currentUser.get()
      .getAuthResponse(true);
    if (authResponse !== null) {
      return authResponse.access_token;
    } else {
      return null;
    }
  }
};

const bindClients = () => {
  bindApiClients(
    new Configuration({
      basePath: getApiBaseUrl(),
      accessToken: () => currentAccessToken(),
    })
  );
  notebooksBindApiClients(
    new Configuration({
      basePath: environment.leoApiUrl,
      accessToken: () => currentAccessToken(),
    })
  );
};

const loadErrorReporter = () => {
  // We don't report to stackdriver on local servers.
  if (environment.debug) {
    return;
  }
  const reporter = new StackdriverErrorReporter();
  const { config } = serverConfigStore.get();
  if (!config.publicApiKeyForErrorReports) {
    return;
  }
  reporter.start({
    key: config.publicApiKeyForErrorReports,
    projectId: config.projectId,
  });

  stackdriverErrorReporterStore.set(reporter);
};

const ScrollToTop = () => {
  const { location } = useHistory();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return <React.Fragment />;
};

const useServerConfig = () => {
  const { config } = useStore(serverConfigStore);

  useEffect(() => {
    const load = async () => {
      const serverConfig = await configApi().getConfig();
      serverConfigStore.set({ config: serverConfig });
    };

    load();
  }, []);

  return config;
};

const useOverriddenApiUrl = () => {
  const [overriddenUrl, setOverriddenUrl] = useState('');

  useEffect(() => {
    if (cookiesEnabled()) {
      try {
        setOverriddenUrl(localStorage.getItem(LOCAL_STORAGE_API_OVERRIDE_KEY));

        // Property 'setAllOfUsApiUrl' does not exist on type 'Window & typeof globalThis'
        // TODO RW-5572 confirm proper behavior and fix
        // eslint-disable-next-line @typescript-eslint/dot-notation
        window['setAllOfUsApiUrl'] = (url: string) => {
          if (url) {
            if (!url.match(/^https?:[/][/][a-z0-9.:-]+$/)) {
              throw new Error(
                'URL should be of the form "http[s]://host.example.com[:port]"'
              );
            }
            setOverriddenUrl(url);
            localStorage.setItem(LOCAL_STORAGE_API_OVERRIDE_KEY, url);
          } else {
            setOverriddenUrl(null);
            localStorage.removeItem(LOCAL_STORAGE_API_OVERRIDE_KEY);
          }
          window.location.reload();
        };
        console.log(
          'To override the API URLs, try:\n' +
            "setAllOfUsApiUrl('https://host.example.com:1234')"
        );
      } catch (err) {
        console.log('Error setting urls: ' + err);
      }
    }
  }, []);

  return overriddenUrl;
};

export const AppRoutingComponent: React.FunctionComponent<RoutingProps> =
  () => {
    const config = useServerConfig();
    const { authLoaded, authError } = useAuthentication();
    const isUserDisabledInDb = useIsUserDisabled();
    const overriddenUrl = useOverriddenApiUrl();

    const loadLocalStorageAccessToken = () => {
      // Ordinarily this sort of thing would go in authentication.tsx - but setting authStore in there causes
      // an infinite loop
      // Enable test access token override via local storage. Intended to support
      // Puppeteer testing flows. This is handled in the server config callback
      // for signin timing consistency. Normally we cannot sign in until we've
      // loaded the oauth client ID from the config service.
      if (config && environment.allowTestAccessTokenOverride && !authLoaded) {
        const localStorageTestAccessToken = window.localStorage.getItem(
          LOCAL_STORAGE_KEY_TEST_ACCESS_TOKEN
        );
        if (localStorageTestAccessToken) {
          // The client has already configured an access token override. Skip the normal oauth flow.
          authStore.set({
            ...authStore.get(),
            authLoaded: true,
            isSignedIn: true,
          });
        }
      }
    };

    useEffect(() => {
      if (config) {
        // Bootstrapping that requires server config
        bindClients();
        loadErrorReporter();
        initializeAnalytics();
        loadLocalStorageAccessToken();
      }
    }, [config]);

    const firstPartyCookiesEnabled = cookiesEnabled();
    const thirdPartyCookiesEnabled = !(
      authError &&
      authError.length > 0 &&
      authError.includes('Cookies')
    );

    return (
      <React.Fragment>
        {authLoaded && isUserDisabledInDb !== undefined && (
          <React.Fragment>
            {/* Once Angular is removed the app structure will change and we can put this in a more appropriate place */}
            <NotificationModal />
            {firstPartyCookiesEnabled && thirdPartyCookiesEnabled && (
              <AppRouter>
                <ScrollToTop />
                {/* Previously, using a top-level Switch with AppRoute and ProtectedRoute has caused bugs: */}
                {/* see https://github.com/all-of-us/workbench/pull/3917 for details. */}
                {/* It should be noted that the reason this is currently working is because Switch only */}
                {/* duck-types its children; it cares about them having a 'path' prop but doesn't validate */}
                {/* that they are a Route or a subclass of Route. */}
                <Switch>
                  <AppRoute exact path='/cookie-policy'>
                    <CookiePolicyPage routeData={{ title: 'Cookie Policy' }} />
                  </AppRoute>
                  <AppRoute exact path='/login'>
                    <SignInPage routeData={{ title: 'Sign In' }} />
                  </AppRoute>
                  <AppRoute exact path='/session-expired'>
                    <SessionExpiredPage
                      routeData={{ title: 'You have been signed out' }}
                    />
                  </AppRoute>
                  <AppRoute exact path='/sign-in-again'>
                    <SignInAgainPage
                      routeData={{ title: 'You have been signed out' }}
                    />
                  </AppRoute>
                  <AppRoute
                    exact
                    path='/user-disabled'
                    guards={[userDisabledPageGuard(isUserDisabledInDb)]}
                  >
                    <UserDisabledPage routeData={{ title: 'Disabled' }} />
                  </AppRoute>
                  <AppRoute exact path='/not-found'>
                    <NotFoundPage routeData={{ title: 'Not Found' }} />
                  </AppRoute>
                  <AppRoute
                    path=''
                    exact={false}
                    guards={[signInGuard, disabledGuard(isUserDisabledInDb)]}
                  >
                    <SignedInPage intermediaryRoute={true} routeData={{}} />
                  </AppRoute>
                </Switch>
              </AppRouter>
            )}
            {overriddenUrl && (
              <div style={{ position: 'absolute', top: 0, left: '1rem' }}>
                <span style={{ fontSize: '80%', color: 'darkred' }}>
                  API URL: {overriddenUrl}
                </span>
              </div>
            )}
            <div id='outdated' /> {/* for outdated-browser-rework */}
          </React.Fragment>
        )}
        {!firstPartyCookiesEnabled ||
          (!thirdPartyCookiesEnabled && (
            <div>
              <div
                style={{
                  maxWidth: '500px',
                  margin: '1rem',
                  fontFamily: 'Montserrat',
                }}
              >
                <div>
                  <img alt='logo' src={logo} width='155px' />
                </div>
                <div
                  style={{
                    fontSize: '20pt',
                    color: '#2F2E7E',
                    padding: '1rem 0 1rem 0',
                  }}
                >
                  Cookies are Disabled
                </div>
                <div style={{ fontSize: '14pt', color: '#000000' }}>
                  For full functionality of this site it is necessary to enable
                  cookies. Here are the{' '}
                  <a
                    href='https://support.google.com/accounts/answer/61416'
                    style={{ color: '#2691D0' }}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    instructions how to enable cookies in your web browser
                  </a>
                  .
                </div>
              </div>
            </div>
          ))}
      </React.Fragment>
    );
  };
