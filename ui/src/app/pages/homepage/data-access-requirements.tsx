import * as fp from 'lodash/fp';
import * as React from 'react';
import {useEffect, useState} from 'react';

import {Button, Clickable} from 'app/components/buttons';
import {FadeBox} from 'app/components/containers';
import {FlexColumn, FlexRow} from 'app/components/flex';
import {Header} from 'app/components/headers';
import {
  ArrowRight,
  CheckCircle,
  ControlledTierBadge,
  MinusCircle,
  RegisteredTierBadge,
  Repeat
} from 'app/components/icons';
import {withErrorModal} from 'app/components/modals';
import {AoU} from 'app/components/text-wrappers';
import {withProfileErrorModal} from 'app/components/with-error-modal';
import {WithSpinnerOverlayProps} from 'app/components/with-spinner-overlay';
import {profileApi} from 'app/services/swagger-fetch-clients';
import colors, {colorWithWhiteness} from 'app/styles/colors';
import {cond, displayDateWithoutHours, reactStyles, switchCase} from 'app/utils';
import {
  buildRasRedirectUrl,
  bypassAll,
  getAccessModuleConfig,
  getAccessModuleStatusByName,
  GetStartedButton,
  redirectToNiH,
  redirectToRas,
  redirectToTraining,
} from 'app/utils/access-utils';
import {useNavigation} from 'app/utils/navigation';
import {profileStore, serverConfigStore, useStore} from 'app/utils/stores';
import {AccessModule, AccessModuleStatus, Profile} from 'generated/fetch';
import {TwoFactorAuthModal} from './two-factor-auth-modal';
import {AnalyticsTracker} from 'app/utils/analytics';
import {ReactComponent as additional} from 'assets/icons/DAR/additional.svg';
import {ReactComponent as electronic} from 'assets/icons/DAR/electronic.svg';
import {ReactComponent as genomic} from 'assets/icons/DAR/genomic.svg';
import {ReactComponent as identifying} from 'assets/icons/DAR/identifying.svg';
import {ReactComponent as individual} from 'assets/icons/DAR/individual.svg';
import {ReactComponent as physical} from 'assets/icons/DAR/physical.svg';
import {ReactComponent as survey} from 'assets/icons/DAR/survey.svg';
import {ReactComponent as wearable} from 'assets/icons/DAR/wearable.svg';
import {AccessTierShortNames} from 'app/utils/access-tiers';
import {environment} from 'environments/environment';
import {useQuery} from 'app/components/app-router';
import {openZendeskWidget} from 'app/utils/zendesk';

const styles = reactStyles({
  headerFlexColumn: {
    marginLeft: '3%',
    width: '50%',
  },
  completed: {
    height: '87px',
    padding: '1em',
    marginLeft: '3%',
    marginRight: '3%',
    borderRadius: '5px',
    color: colors.primary,
    backgroundColor: colorWithWhiteness(colors.success, 0.82),
  },
  completedHeader: {
    fontSize: '18px',
    fontWeight: 600,
  },
  completedText: {
    fontSize: '14px',
  },
  selfBypass: {
    height: '87px',
    padding: '1em',
    marginLeft: '3%',
    marginRight: '3%',
    borderRadius: '5px',
    borderColor: colors.primary,
    justifyContent: 'center',
  },
  selfBypassText: {
    alignSelf: 'center',
    color: colors.primary,
    fontSize: '18px',
    fontWeight: 600,
  },
  headerRW: {
    textTransform: 'uppercase',
    margin: '1em 0 0 0',
  },
  headerDAR: {
    height: '30px',
    width: '302px',
    fontFamily: 'Montserrat',
    fontSize: '22px',
    fontWeight: 500,
    letterSpacing: 0,
    margin: '0.5em 0 0 0',
  },
  pageWrapper: {
    marginLeft: '-1rem',
    marginRight: '-0.6rem',
    justifyContent: 'space-between',
    fontSize: '1.2em',
  },
  fadeBox: {
    margin: '0.5rem 0 0 3%',
    width: '95%',
    padding: '0 0.1rem',
  },
  pleaseComplete: {
    fontSize: '14px',
    color: colors.primary,
  },
  card: {
    height: '375px',
    width: '1195px',
    borderRadius: '0.4rem',
    marginTop: '0.7rem',
    marginBottom: '1.7rem',
    color: colors.primary,
    backgroundColor: colorWithWhiteness(colors.accent, 0.9),
    padding: '1em',
    fontWeight: 500,
  },
  cardStep: {
    height: '19px',
    marginBottom: '0.5em',
  },
  cardHeader: {
    fontSize: '24px',
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: '22px',
    marginBottom: '0.5em',
  },
  dataHeader: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '0.5em',
    marginLeft: '0.5em',
  },
  ctDataOptional: {
    fontSize: '16px',
    fontStyle: 'italic',
    fontWeight: 'normal',
    marginBottom: '0.5em'
  },
  dataDetailsIcon: {
    marginRight: '0.5em',
  },
  dataDetails: {
    fontSize: '14px',
    fontWeight: 100,
    marginBottom: '0.5em',
  },
  modulesContainer: {
    marginLeft: 'auto',
  },
  moduleCTA: {
    fontSize: '10px',
    width: '100px',
    alignSelf: 'center',
    paddingRight: '0.5em',
  },
  foregroundModuleBox: {
    padding: '0.5em',
    margin: '0.2em',
    width: '593px',
    borderRadius: '0.2rem',
    backgroundColor: colors.white,
    border: '1px solid',
    borderColor: colors.accent,
  },
  backgroundModuleBox: {
    padding: '0.5em',
    margin: '0.2em',
    width: '593px',
    borderRadius: '0.2rem',
    backgroundColor: colorWithWhiteness(colors.accent, 0.95),
  },
  moduleIcon: {
    marginLeft: '0.2em',
    marginRight: '1em',
  },
  activeModuleText: {
    color: colors.primary,
  },
  inactiveModuleText: {
    opacity: '0.5',
  },
  moduleDate: {
    opacity: '0.5',
    fontSize: '12px',
  },
  nextElement: {
    marginLeft: 'auto',
  },
  nextText: {
    marginLeft: 'auto',
    alignSelf: 'center',
    paddingRight: '0.5em',
  },
  nextIcon: {
    fontSize: '18px',
    color: colors.white,
    background: colors.success,
    paddingRight: '0.2em',
    paddingLeft: '0.2em',
    alignSelf: 'center',
  },
  refreshButton: {
    height: '25px',
    width: '81px',
    fontSize: '10px',
    borderRadius: '3px',
    marginLeft: 'auto',
  },
  refreshIcon: {
    fontSize: '18px',
    paddingRight: '4px',
  },
  link: {
    color: colors.accent,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  loginGovHelp: {
    opacity: '0.5',
    fontSize: '12px',
    lineHeight: '22px',
  },
});

// in display order
const rtModules = [
  AccessModule.TWOFACTORAUTH,
  AccessModule.RASLINKLOGINGOV,
  AccessModule.ERACOMMONS,
  AccessModule.COMPLIANCETRAINING,
];

const duccModule = AccessModule.DATAUSERCODEOFCONDUCT;

// in display order
// exported for test
export const allModules: AccessModule[] = [
  ...rtModules,
  duccModule,
];

const isCompleted = (status: AccessModuleStatus) => status && !!status.completionEpochMillis
const isBypassed = (status: AccessModuleStatus) => status && !!status.bypassEpochMillis
const isCompliant = (status: AccessModuleStatus) => isCompleted(status) || isBypassed(status)

const getStatusText = (status: AccessModuleStatus) => {
  console.assert(isCompliant(status), 'Cannot provide status text for incomplete module')
  const {completionEpochMillis, bypassEpochMillis}: AccessModuleStatus = status || {};
  return isCompleted(status)
    ? `Completed on: ${displayDateWithoutHours(status.completionEpochMillis)}`
    : `Bypassed on: ${displayDateWithoutHours(status.bypassEpochMillis)}`
};

const handleTerraShibbolethCallback = (token: string, spinnerProps: WithSpinnerOverlayProps, reloadProfile: Function) => {
  const handler = withErrorModal({
    title: 'Error saving NIH Authentication status.',
    message: 'An error occurred trying to save your NIH Authentication status. Please try again.',
    onDismiss: () => {
      spinnerProps.hideSpinner();
    }
  })(async() => {
    spinnerProps.showSpinner();
    await profileApi().updateNihToken({jwt: token});
    spinnerProps.hideSpinner();
    reloadProfile();
  });

  return handler();
};

const handleRasCallback = (code: string, spinnerProps: WithSpinnerOverlayProps, reloadProfile: Function) => {
  const handler = withErrorModal({
    title: 'Error saving RAS Login.Gov linkage status.',
    message: 'An error occurred trying to save your RAS Login.Gov linkage status. Please try again.',
    onDismiss: () => {
      spinnerProps.hideSpinner();
    }
  })(async() => {
    spinnerProps.showSpinner();
    await profileApi().linkRasAccount({ authCode: code, redirectUrl: buildRasRedirectUrl() });
    spinnerProps.hideSpinner();
    reloadProfile();

    // Cleanup parameter from URL after linking.
    window.history.replaceState({}, '', '/');
  });

  return handler();
};

const selfBypass = async(spinnerProps: WithSpinnerOverlayProps, reloadProfile: Function) => {
  spinnerProps.showSpinner();
  await bypassAll(allModules, true);
  spinnerProps.hideSpinner();
  reloadProfile();
};
const getVisibleRTModules = (profile: Profile): AccessModule[] => {
  return fp.filter(module=> isEraCommonsModuleRequiredByInstitution(profile, module),rtModules);
}

const isEraCommonsModuleRequiredByInstitution = (profile: Profile, moduleNames: AccessModule): boolean => {
  // Remove the eRA Commons module when the flag to enable RAS is set and the user's
  // institution does not require eRA Commons for RT.

  if (moduleNames !== AccessModule.ERACOMMONS) { return true;}
  const {enableRasLoginGovLinking} = serverConfigStore.get().config;
  if (!enableRasLoginGovLinking) { return true; }

  return fp.flow(
      fp.filter({accessTierShortName: AccessTierShortNames.Registered}),
      fp.some('eraRequired')
  )(profile.tierEligibilities);
}

// exported for test
export const getVisibleModules = (modules: AccessModule[], profile: Profile): AccessModule[] => fp.flow(
    fp.map(getAccessModuleConfig),
    fp.filter(moduleConfig => moduleConfig.isEnabledInEnvironment),
    fp.filter(moduleConfig => isEraCommonsModuleRequiredByInstitution(profile, moduleConfig.moduleName)),
    fp.map(moduleConfig => moduleConfig.moduleName)
)(modules);

const incompleteModules = (modules: AccessModule[], profile: Profile): AccessModule[] =>
  modules.filter(moduleName => !isCompliant(getAccessModuleStatusByName(profile, moduleName)));

const syncIncompleteModules = (modules: AccessModule[], profile: Profile, reloadProfile: Function) => {
  incompleteModules(modules, profile).map(async moduleName => {
    const {externalSyncAction} = getAccessModuleConfig(moduleName);
    if (externalSyncAction) {
      await externalSyncAction();
    }
  });
  reloadProfile();
}

// exported for test
export const getActiveModule = (modules: AccessModule[], profile: Profile): AccessModule => incompleteModules(modules, profile)[0];

const Refresh = (props: { showSpinner: Function; refreshAction: Function }) => {
  const {showSpinner, refreshAction} = props;
  return <Button
      type='primary'
      style={styles.refreshButton}
      onClick={async() => {
        showSpinner();
        await refreshAction();
        location.reload(); // also hides spinner
      }} >
    <Repeat style={styles.refreshIcon}/> Refresh
  </Button>;
}

const Next = () => <FlexRow style={styles.nextElement}>
  <span style={styles.nextText}>NEXT</span> <ArrowRight style={styles.nextIcon}/>
</FlexRow>;

const ModuleIcon = (props: {moduleName: AccessModule, completedOrBypassed: boolean, eligible?: boolean}) => {
  const {moduleName, completedOrBypassed, eligible = true} = props;

  return <div style={styles.moduleIcon}>
    {cond(
      [!eligible,
        () => <MinusCircle data-test-id={`module-${moduleName}-ineligible`} style={{color: colors.disabled}}/>],
      [eligible && completedOrBypassed,
        () => <CheckCircle data-test-id={`module-${moduleName}-complete`} style={{color: colors.success}}/>],
      [eligible && !completedOrBypassed,
        () => <CheckCircle data-test-id={`module-${moduleName}-incomplete`} style={{color: colors.disabled}}/>])}
  </div>;
};

// Sep 16 hack while we work out some RAS bugs
const TemporaryRASModule = () => {
  const moduleName = AccessModule.RASLINKLOGINGOV;
  const {DARTitleComponent} = getAccessModuleConfig(moduleName);
  return <FlexRow data-test-id={`module-${moduleName}`}>
    <FlexRow style={styles.moduleCTA}/>
    <FlexRow style={styles.backgroundModuleBox}>
      <ModuleIcon moduleName={moduleName} completedOrBypassed={false} eligible={false}/>
      <FlexColumn style={styles.inactiveModuleText}>
        <DARTitleComponent/>
        <div style={{fontSize: '14px', marginTop: '0.5em'}}>
          <b>Temporarily disabled.</b> Due to technical difficulties, this step is disabled.
          In the future, you'll be prompted to complete identity verification to continue using the workbench.
        </div>
     </FlexColumn>
    </FlexRow>
  </FlexRow>;
};

const ContactUs = (props: {profile: Profile}) => {
  const {profile: {givenName, familyName, username, contactEmail}} = props;
  return <div data-test-id='contact-us'>
        <span style={styles.link} onClick={(e) => {
          openZendeskWidget(givenName, familyName, username, contactEmail);
          // prevents the enclosing Clickable's onClick() from triggering instead
          e.stopPropagation();
        }}>Contact us</span> if you’re having trouble completing this step.
  </div>;
}

const LoginGovHelpText = (props: {profile: Profile, afterInitialClick: boolean}) => {
  const {profile, afterInitialClick} = props;

  // don't return help text if complete or bypassed
  const needsHelp = !isCompliant(getAccessModuleStatusByName(profile, AccessModule.RASLINKLOGINGOV));

  return needsHelp &&
    (afterInitialClick
      ? <div style={styles.loginGovHelp}>
        <div>
          Looks like you still need to complete this action, please try again.
        </div>
        <ContactUs profile={profile}/>
      </div>
      : <div style={styles.loginGovHelp}>
        <div>
          Verifying your identity helps us keep participant data safe.
          You’ll need to provide your state ID, social security number, and phone number.
        </div>
        <ContactUs profile={profile}/>
      </div>);
}

const ModuleBox = (props: {foreground: boolean, action: Function, children}) => {
  const {foreground, action, children} = props;
  return foreground
    ? <Clickable onClick={() => action()}>
      <FlexRow style={styles.foregroundModuleBox}>{children}</FlexRow>
    </Clickable>
    : <FlexRow style={styles.backgroundModuleBox}>{children}</FlexRow>;
};

interface ModuleProps {
  profile: Profile,
  moduleName: AccessModule;
  active: boolean;    // is this the currently-active module that the user should complete

  // TODO RW-7059
  // eligible: boolean;  // is the user eligible to complete this module (does the inst. allow it)
  spinnerProps: WithSpinnerOverlayProps;
}

// Renders a module when it's enabled via feature flags.  Returns null if not.
const MaybeModule = ({profile, moduleName, active, spinnerProps}: ModuleProps): JSX.Element => {
  // whether to show the refresh button: this module has been clicked
  const [showRefresh, setShowRefresh] = useState(false);

  // whether to show the Two Factor Auth Modal
  const [showTwoFactorAuthModal, setShowTwoFactorAuthModal] = useState(false);
  const [navigate, ] = useNavigation();

  // outside of the main getAccessModuleConfig() so that function doesn't have to deal with navigate
  const moduleAction: Function = switchCase(moduleName,
    [AccessModule.TWOFACTORAUTH, () => () => setShowTwoFactorAuthModal(true)],
    [AccessModule.RASLINKLOGINGOV, () => redirectToRas],
    [AccessModule.ERACOMMONS, () => redirectToNiH],
    [AccessModule.COMPLIANCETRAINING, () => redirectToTraining],
    [AccessModule.DATAUSERCODEOFCONDUCT, () => () => {
      AnalyticsTracker.Registration.EnterDUCC();
      navigate(['data-code-of-conduct']);
    }]);

  const {DARTitleComponent, refreshAction, isEnabledInEnvironment} = getAccessModuleConfig(moduleName);

  const Module = ({profile}) => {
    const status = getAccessModuleStatusByName(profile, moduleName)

    return <FlexRow data-test-id={`module-${moduleName}`}>
      <FlexRow style={styles.moduleCTA}>
        {active && ((showRefresh && refreshAction)
            ? <Refresh
                refreshAction={refreshAction}
                showSpinner={spinnerProps.showSpinner}/>
            : <Next/>)}
      </FlexRow>
      <ModuleBox foreground={active} action={() => { setShowRefresh(true); moduleAction(); }}>
        <ModuleIcon moduleName={moduleName} completedOrBypassed={isCompliant(status)}/>
        <FlexColumn>
          <div style={active ? styles.activeModuleText : styles.inactiveModuleText}>
            <DARTitleComponent/>
            {(moduleName === AccessModule.RASLINKLOGINGOV) && <LoginGovHelpText profile={profile} afterInitialClick={showRefresh}/>}
          </div>
          {isCompliant(status) && <div style={styles.moduleDate}>{getStatusText(status)}</div>}
        </FlexColumn>
      </ModuleBox>
      {showTwoFactorAuthModal && <TwoFactorAuthModal
          onClick={() => setShowTwoFactorAuthModal(false)}
          onCancel={() => setShowTwoFactorAuthModal(false)}/>}
    </FlexRow>;
  };

  // temp hack Sep 16: render a special temporary RAS module if disabled
  if (moduleName === AccessModule.RASLINKLOGINGOV) {
    const {enableRasLoginGovLinking} = serverConfigStore.get().config;
    if (!enableRasLoginGovLinking) {
      return <TemporaryRASModule/>;
    }
  }
  return isEnabledInEnvironment ? <Module profile={profile}/> : null;
};

const ControlledTierEraModule = ({profile, spinnerProps}): JSX.Element => {
  // whether to show the refresh button: this module has been clicked
  const [showRefresh, setShowRefresh] = useState(false);
  const moduleName = AccessModule.ERACOMMONS;
  const {DARTitleComponent, refreshAction, isEnabledInEnvironment} = getAccessModuleConfig(moduleName);
  const status = getAccessModuleStatusByName(profile, moduleName)

  const Module = () => {
    return <FlexRow data-test-id={`module-${moduleName}`}>
      <FlexRow style={styles.moduleCTA}>
        {showRefresh && refreshAction
          && <Refresh refreshAction={refreshAction} showSpinner={spinnerProps.showSpinner}/>}
      </FlexRow>
      <ModuleBox foreground={!isCompliant(status)} action={() => { setShowRefresh(true); redirectToNiH(); }}>
        <ModuleIcon moduleName={moduleName} completedOrBypassed={isCompliant(status)}/>
        <FlexColumn>
          <div style={isCompliant(status) ? styles.inactiveModuleText : styles.activeModuleText}>
            <DARTitleComponent/>
          </div>
          {isCompliant(status) && <div style={styles.moduleDate}>{getStatusText(status)}</div>}
        </FlexColumn>
      </ModuleBox>
    </FlexRow>;
  };

  return isEnabledInEnvironment ? <Module data-test-id={`module-${AccessModule.ERACOMMONS}`} /> : null;
};

const DARHeader = () => <FlexColumn style={styles.headerFlexColumn}>
  <Header style={styles.headerRW}>Researcher Workbench</Header>
  <Header style={styles.headerDAR}>Data Access Requirements</Header>
</FlexColumn>;

const Completed = () => <FlexRow data-test-id='dar-completed' style={styles.completed}>
  <FlexColumn>
    <div style={styles.completedHeader}>Thank you for completing all the necessary steps</div>
    <div style={styles.completedText}>Researcher Workbench data access is complete.</div>
  </FlexColumn>
  <GetStartedButton style={{marginLeft: 'auto'}}/>
</FlexRow>;

interface CardProps {
  profile: Profile,
  modules: Array<AccessModule>,
  activeModule: AccessModule,
  spinnerProps: WithSpinnerOverlayProps
}
const ModulesForCard = (props: CardProps) => {
  const {profile, modules, activeModule, spinnerProps} = props;
  return <FlexColumn style={styles.modulesContainer}>
    {modules.map(moduleName =>
        <MaybeModule
            key={moduleName}
            moduleName={moduleName}
            profile={profile}
            active={moduleName === activeModule}
            spinnerProps={spinnerProps}/>
    )}
  </FlexColumn>;
};

// TODO is there a better way?

const Additional = additional;
const Electronic = electronic;
const Genomic = genomic;
const Identifying = identifying;
const Individual = individual;
const Physical = physical;
const Survey = survey;
const Wearable = wearable;

const renderIcon = (iconName: string) => switchCase(iconName,
    ['additional', () => <Additional style={styles.dataDetailsIcon}/>],
    ['electronic', () => <Electronic style={styles.dataDetailsIcon}/>],
    ['genomic', () => <Genomic style={styles.dataDetailsIcon}/>],
    ['identifying', () => <Identifying style={styles.dataDetailsIcon}/>],
    ['individual', () => <Individual style={styles.dataDetailsIcon}/>],
    ['physical', () => <Physical style={styles.dataDetailsIcon}/>],
    ['survey', () => <Survey style={styles.dataDetailsIcon}/>],
    ['wearable', () => <Wearable style={styles.dataDetailsIcon}/>],
);

const DataDetail = (props: {icon: string, text: string}) => {
  const {icon, text} = props;
  return <FlexRow>
    {renderIcon(icon)}
    <div style={styles.dataDetails}>{text}</div>
  </FlexRow>;
};

const RegisteredTierCard = (props: {profile: Profile, activeModule: AccessModule, spinnerProps: WithSpinnerOverlayProps}) => {
  const {profile, activeModule, spinnerProps} = props;
  return <FlexRow style={styles.card}>
    <FlexColumn>
      <div style={styles.cardStep}>Step 1</div>
      <div style={styles.cardHeader}>Complete Registration</div>
      <FlexRow>
        <RegisteredTierBadge/>
        <div style={styles.dataHeader}>Registered Tier data</div>
      </FlexRow>
      <div style={styles.dataDetails}>Once registered, you’ll have access to:</div>
      <DataDetail icon='individual' text='Individual (not aggregated) data'/>
      <DataDetail icon='identifying' text='Identifying information removed'/>
      <DataDetail icon='electronic' text='Electronic health records'/>
      <DataDetail icon='survey' text='Survey responses'/>
      <DataDetail icon='physical' text='Physical measurements'/>
      <DataDetail icon='wearable' text='Wearable devices'/>
    </FlexColumn>
    <ModulesForCard profile={profile} modules={getVisibleRTModules(profile)} activeModule={activeModule} spinnerProps={spinnerProps}/>
  </FlexRow>;
};

const ControlledTierCard = (props: {profile: Profile, spinnerProps: WithSpinnerOverlayProps}) => {
  const {profile, spinnerProps} = props;
  const controlledTierEligibility = profile.tierEligibilities.find(tier=> tier.accessTierShortName === AccessTierShortNames.Controlled);
  const registeredTierEligibility = profile.tierEligibilities.find(tier=> tier.accessTierShortName === AccessTierShortNames.Registered);
  const isSigned = !!controlledTierEligibility;
  const isEligible = isSigned && controlledTierEligibility.eligible;
  const {verifiedInstitutionalAffiliation: {institutionDisplayName}} = profile;
  // Display era in CT if:
  // 1) Institution has signed the CT institution agreement,
  // 2) Registered Tier DOES NOT require era
  // 3) CT Requirement DOES require era
  const displayEraCommons = isSigned && !registeredTierEligibility?.eraRequired && controlledTierEligibility.eraRequired;
  return <FlexRow data-test-id='controlled-card' style={{...styles.card, height: 300}}>
    <FlexColumn>
      <div style={styles.cardStep}>Step 2</div>
      <div style={styles.cardHeader}>Additional Data Access</div>
      <FlexRow>
        <ControlledTierBadge/>
        <div style={styles.dataHeader}>Controlled Tier data - </div>
        <div style={styles.ctDataOptional}>&nbsp;Optional</div>
      </FlexRow>
      <div style={styles.dataDetails}>You are eligible to access Controlled Tier Data</div>
      <div style={styles.dataDetails}>In addition to Registered Tier data, the Controlled Tier curated dataset contains:</div>
      <DataDetail icon='genomic' text='Genomic data'/>
      <DataDetail icon='additional' text='Additional demographic details'/>
    </FlexColumn>
    <FlexColumn style={styles.modulesContainer}>
      <ControlledTierStep data-test-id='controlled-signed'
                          enable={isSigned}
                          text={`${institutionDisplayName} must sign an institutional agreement`}/>
      <ControlledTierStep data-test-id='controlled-user-email'
                          enable={isEligible}
                          text={`${institutionDisplayName} must allow you to access controlled tier data`}/>
      {displayEraCommons &&
         <ControlledTierEraModule profile={profile} spinnerProps={spinnerProps}/>}
    </FlexColumn>
  </FlexRow>
};

const ControlledTierStep = (props: {enable: boolean, text: String}) => {
  return <FlexRow>
    <FlexRow style={styles.moduleCTA}/>
    {/* Since Institution access steps does not require user interaction, will display them as inactive*/}
    <FlexRow style={styles.backgroundModuleBox}>
      <div style={styles.moduleIcon}>
        {props.enable
          ? <CheckCircle data-test-id='eligible' style={{color: colors.success}}/>
          : <MinusCircle data-test-id='ineligible' style={{color: colors.disabled}}/>}
      </div>
      <FlexColumn style={styles.inactiveModuleText}>
        <div>{props.text}
        </div>
       </FlexColumn>
      </FlexRow>
     </FlexRow>;
}

const DuccCard = (props: {profile: Profile, activeModule: AccessModule, spinnerProps: WithSpinnerOverlayProps, stepNumber: Number}) => {
  const {profile, activeModule, spinnerProps, stepNumber} = props;
  return <FlexRow style={{...styles.card, height: '125px'}}>
    <FlexColumn>
      <div style={styles.cardStep}>Step {stepNumber}</div>
      <div style={styles.cardHeader}>Sign the code of conduct</div>
    </FlexColumn>
    <ModulesForCard profile={profile} modules={[duccModule]} activeModule={activeModule} spinnerProps={spinnerProps}/>
  </FlexRow>;
};

export const DataAccessRequirements = fp.flow(withProfileErrorModal)((spinnerProps: WithSpinnerOverlayProps) => {
  const {profile, reload} = useStore(profileStore);
  const {config: {unsafeAllowSelfBypass}} = useStore(serverConfigStore);
  const visibleModules = getVisibleModules(allModules, profile);

  useEffect(() => {
    syncIncompleteModules(visibleModules, profile, reload);
    spinnerProps.hideSpinner();
  }, []);

  // handle the route /nih-callback?token=<token>
  // handle the route /ras-callback?code=<code>
  const query = useQuery();
  const token = query.get('token');
  const code = query.get('code');
  useEffect(() => {
    if (token) {
      handleTerraShibbolethCallback(token, spinnerProps, reload);
    }
  }, [token] );
  useEffect(() => {
    if (code) {
      handleRasCallback(code, spinnerProps, reload);
    }
  }, [code]);


  // which module are we currently guiding the user to complete?
  const [activeModule, setActiveModule] = useState(null);

  // whenever the profile changes, setActiveModule(the first incomplete enabled module)
  useEffect(() => {
    setActiveModule(getActiveModule(visibleModules, profile));
  }, [profile]);

  const showCtCard = environment.accessTiersVisibleToUsers.includes(AccessTierShortNames.Controlled)

  const rtCard = <RegisteredTierCard key='rt' profile={profile} activeModule={activeModule} spinnerProps={spinnerProps}/>
  const ctCard = showCtCard ? <ControlledTierCard key='ct' profile={profile} spinnerProps={spinnerProps}/> : null
  const dCard = <DuccCard
    key='dt'
    profile={profile}
    activeModule={activeModule}
    spinnerProps={spinnerProps}
    stepNumber={showCtCard ? 3 : 2}/>

  const cards = showCtCard ? [rtCard, ctCard, dCard] : [rtCard, dCard];

  return <FlexColumn style={styles.pageWrapper}>
      <DARHeader/>
      {profile && !activeModule && <Completed/>}
      {unsafeAllowSelfBypass && activeModule && <FlexRow data-test-id='self-bypass' style={styles.selfBypass}>
        <div style={styles.selfBypassText}>[Test environment] Self-service bypass is enabled</div>
        <Button
            style={{marginLeft: '0.5rem'}}
            onClick={async() => await selfBypass(spinnerProps, reload)}>Bypass all</Button>
      </FlexRow>}
      <FadeBox style={styles.fadeBox}>
        <div style={styles.pleaseComplete}>
          Please complete the necessary steps to gain access to the <AoU/> datasets.
        </div>
        <React.Fragment>{cards}</React.Fragment>
      </FadeBox>
    </FlexColumn>;
});
