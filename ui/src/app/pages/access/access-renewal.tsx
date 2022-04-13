import * as React from 'react';
import { CSSProperties } from 'react';
import * as fp from 'lodash/fp';

import { AccessModule, AccessModuleStatus } from 'generated/fetch';

import { Button, Clickable } from 'app/components/buttons';
import { FadeBox } from 'app/components/containers';
import { FlexColumn, FlexRow } from 'app/components/flex';
import {
  Arrow,
  Clock,
  ClrIcon,
  ExclamationTriangle,
  withCircleBackground,
} from 'app/components/icons';
import { RadioButton } from 'app/components/inputs';
import { withErrorModal, withSuccessModal } from 'app/components/modals';
import { SpinnerOverlay } from 'app/components/spinners';
import { SupportMailto } from 'app/components/support';
import { AoU } from 'app/components/text-wrappers';
import { withProfileErrorModal } from 'app/components/with-error-modal';
import { WithSpinnerOverlayProps } from 'app/components/with-spinner-overlay';
import { styles } from 'app/pages/profile/profile-styles';
import { profileApi } from 'app/services/swagger-fetch-clients';
import colors, { addOpacity, colorWithWhiteness } from 'app/styles/colors';
import { cond, switchCase, useId } from 'app/utils';
import {
  accessRenewalModules,
  computeRenewalDisplayDates,
  getAccessModuleConfig,
  getAccessModuleStatusByNameOrEmpty,
  isExpiringOrExpired,
  maybeDaysRemaining,
  redirectToControlledTraining,
  redirectToRegisteredTraining,
  syncModulesExternal,
} from 'app/utils/access-utils';
import { useNavigation } from 'app/utils/navigation';
import { profileStore, serverConfigStore, useStore } from 'app/utils/stores';

const { useState, useEffect } = React;

const REDCAP_PUBLICATIONS_SURVEY =
  'https://redcap.pmi-ops.org/surveys/?s=MKYL8MRD4N';

const renewalStyle = {
  h1: {
    fontSize: '0.83rem',
    fontWeight: 600,
    color: colors.primary,
  },
  h2: {
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  h3: {
    fontSize: '0.675rem',
    fontWeight: 600,
  },
  dates: {
    color: colors.primary,
    margin: '0.5rem 0',
    display: 'grid',
    columnGap: '1rem',
    gridTemplateColumns: 'auto 1fr',
  },
  completedButton: {
    height: '1.6rem',
    marginTop: 'auto',
    backgroundColor: colors.success,
    width: 'max-content',
    cursor: 'default',
  },
  completionBox: {
    height: '3.5rem',
    background: `${addOpacity(colors.accent, 0.15)}`,
    borderRadius: 5,
    marginTop: '0.5rem',
    padding: '0.75rem',
  },
  card: {
    backgroundColor: colors.white,
    border: `1px solid ${colorWithWhiteness(colors.dark, 0.8)}`,
    borderRadius: '0.2rem',
    display: 'flex',
    fontSize: '0.58rem',
    fontWeight: 500,
    height: '15.375rem',
    lineHeight: '22px',
    margin: 0,
    padding: '0.5rem',
    width: 560,
  },
  publicationConfirmation: {
    marginTop: 'auto',
    display: 'grid',
    columnGap: '0.25rem',
    gridTemplateColumns: 'auto 1rem 1fr',
    alignItems: 'center',
  },
  complianceTrainingExpiring: {
    borderTop: `1px solid ${colorWithWhiteness(colors.dark, 0.8)}`,
    marginTop: '0.5rem',
    paddingTop: '0.5rem',
  },
};

// Async Calls with error handling
const reloadProfile = withErrorModal(
  {
    title: 'Could Not Load Profile',
    message:
      'Profile could not be reloaded. Please refresh the page to get your updated profile',
  },
  profileStore.get().reload
);

const confirmPublications = fp.flow(
  withSuccessModal({
    title: 'Confirmed Publications',
    message: 'You have successfully reported your publications',
    onDismiss: reloadProfile,
  }),
  withErrorModal({
    title: 'Failed To Confirm Publications',
    message:
      'An error occurred trying to confirm your publications. Please try again.',
  })
)(async () => await profileApi().confirmPublications());

const syncAndReloadTraining = fp.flow(
  withSuccessModal({
    title: 'Compliance Status Refreshed',
    message:
      'Your compliance training has been refreshed. If you are not seeing the correct status, try again in a few minutes.',
    onDismiss: reloadProfile,
  }),
  withErrorModal({
    title: 'Failed To Refresh',
    message:
      'An error occurred trying to refresh your compliance training status. Please try again.',
  })
)(async () => {
  await profileApi().syncComplianceTrainingStatus();
});

export const RenewalRequirementsText = () => (
  <span>
    Researchers are required to complete a number of steps as part of the annual
    renewal to maintain access to <AoU /> data. Renewal of access will occur on
    a rolling basis annually (i.e. for each user, access renewal will be due 365
    days after the date of authorization to access <AoU /> data).
  </span>
);

// Helper Functions

// is the module "renewal complete" ?
// meaning (bypassed || (complete and not expiring))
const isRenewalCompleteForModule = (status: AccessModuleStatus) => {
  const isComplete = !!status?.completionEpochMillis;
  const wasBypassed = !!status?.bypassEpochMillis;
  return (
    wasBypassed ||
    (isComplete &&
      !isExpiringOrExpired(status?.expirationEpochMillis, status.moduleName))
  );
};

// Helper / Stateless Components
interface CompletedButtonInterface {
  completedText: string;
  wasBypassed: boolean;
  style?: React.CSSProperties;
}
const CompletedOrBypassedButton = ({
  completedText,
  wasBypassed,
  style,
}: CompletedButtonInterface) => (
  <Button
    disabled={true}
    data-test-id='completed-button'
    style={{ ...renewalStyle.completedButton, ...style }}
  >
    <ClrIcon shape='check' style={{ marginRight: '0.3rem' }} />
    {wasBypassed ? 'Bypassed' : completedText}
  </Button>
);

interface ActionButtonInterface {
  moduleStatus: AccessModuleStatus;
  actionButtonText: string;
  completedButtonText: string;
  onClick: Function;
  disabled?: boolean;
  style?: React.CSSProperties;
}
const ActionButton = ({
  moduleStatus,
  actionButtonText,
  completedButtonText,
  onClick,
  disabled,
  style,
}: ActionButtonInterface) => {
  const wasBypassed = !!moduleStatus?.bypassEpochMillis;
  return isRenewalCompleteForModule(moduleStatus) ? (
    <CompletedOrBypassedButton
      completedText={completedButtonText}
      wasBypassed={wasBypassed}
      style={style}
    />
  ) : (
    <Button
      onClick={onClick}
      disabled={disabled}
      style={{
        marginTop: 'auto',
        height: '1.6rem',
        width: 'max-content',
        ...style,
      }}
    >
      {actionButtonText}
    </Button>
  );
};

const BackArrow = withCircleBackground(() => (
  <Arrow style={{ height: 21, width: 18 }} />
));

export const RenewalCardBody = (props: {
  moduleStatus: AccessModuleStatus;
  setLoading: (boolean) => void;
  hide?: boolean;
  textStyle?: CSSProperties;
  showTimeEstimate?: boolean;
}) => {
  const {
    moduleStatus,
    setLoading,
    hide,
    textStyle,
    showTimeEstimate = false,
  } = props;

  const [, navigateByUrl] = useNavigation();
  const noReportId = useId();
  const reportId = useId();
  const [publications, setPublications] = useState<boolean>(null);
  const [trainingRefreshButtonDisabled, setTrainingRefreshButtonDisabled] =
    useState(true);

  const { AARTitleComponent, renewalTimeEstimate } = getAccessModuleConfig(
    moduleStatus.moduleName
  );
  const { lastConfirmedDate, nextReviewDate } =
    computeRenewalDisplayDates(moduleStatus);
  const TimeEstimate = () =>
    showTimeEstimate ? (
      <div>
        <span style={{ padding: 10 }}>
          <Clock style={{ color: colors.disabled }} />
        </span>
        {renewalTimeEstimate} min
      </div>
    ) : null;

  const Dates = () => (
    <div style={{ ...renewalStyle.dates, ...textStyle }}>
      <div>Last Updated On:</div>
      <div>Next Review:</div>
      <div>{lastConfirmedDate}</div>
      <div>{nextReviewDate}</div>
    </div>
  );

  const module = switchCase(
    moduleStatus.moduleName,
    [
      AccessModule.PROFILECONFIRMATION,
      () => (
        <React.Fragment>
          <Dates />
          <div style={{ marginBottom: '0.5rem', ...textStyle }}>
            Please update your profile information if any of it has changed
            recently.
          </div>
          <div style={textStyle}>
            Note that you are obliged by the Terms of Use of the Workbench to
            keep your profile information up-to-date at all times.
          </div>
          <TimeEstimate />
          <ActionButton
            actionButtonText='Review'
            completedButtonText='Confirmed'
            moduleStatus={moduleStatus}
            onClick={() =>
              navigateByUrl('profile', { queryParams: { renewal: 1 } })
            }
          />
        </React.Fragment>
      ),
    ],
    [
      AccessModule.PUBLICATIONCONFIRMATION,
      () => {
        const buttonsStyle = {
          ...renewalStyle.publicationConfirmation,
          ...textStyle,
          color: isRenewalCompleteForModule(moduleStatus)
            ? colors.disabled
            : colors.primary,
        };
        return (
          <React.Fragment>
            <Dates />
            <div style={textStyle}>
              The <AoU /> Publication and Presentation Policy requires that you
              report any upcoming publication or presentation resulting from the
              use of <AoU /> Research Program Data at least two weeks before the
              date of publication. If you are lead on or part of a publication
              or presentation that hasn’t been reported to the program,{' '}
              <a
                target='_blank'
                style={{ textDecoration: 'underline' }}
                href={REDCAP_PUBLICATIONS_SURVEY}
              >
                please report it now.
              </a>{' '}
              For any questions, please contact <SupportMailto />
            </div>
            <TimeEstimate />
            <div style={buttonsStyle}>
              <ActionButton
                actionButtonText='Confirm'
                completedButtonText='Confirmed'
                moduleStatus={moduleStatus}
                onClick={async () => {
                  setLoading(true);
                  await confirmPublications();
                  setLoading(false);
                }}
                disabled={publications === null}
                style={{ gridRow: '1 / span 2', marginRight: '0.25rem' }}
              />
              <RadioButton
                data-test-id='nothing-to-report'
                id={noReportId}
                disabled={isRenewalCompleteForModule(moduleStatus)}
                style={{ justifySelf: 'end' }}
                checked={publications === true}
                onChange={() => setPublications(true)}
              />
              <label htmlFor={noReportId}>
                At this time, I have nothing to report
              </label>
              <RadioButton
                data-test-id='report-submitted'
                id={reportId}
                disabled={isRenewalCompleteForModule(moduleStatus)}
                style={{ justifySelf: 'end' }}
                checked={publications === false}
                onChange={() => setPublications(false)}
              />
              <label htmlFor={reportId}>Report submitted</label>
            </div>
          </React.Fragment>
        );
      },
    ],
    [
      AccessModule.COMPLIANCETRAINING,
      () => (
        <React.Fragment>
          <Dates />
          <div style={textStyle}>
            You are required to complete the refreshed ethics training courses
            to understand the privacy safeguards and the compliance requirements
            for using the <AoU /> Registered Tier Dataset.
          </div>
          {!isRenewalCompleteForModule(moduleStatus) && (
            <div
              style={{
                ...renewalStyle.complianceTrainingExpiring,
                ...textStyle,
              }}
            >
              When you have completed the training click the refresh button or
              reload the page.
            </div>
          )}
          <TimeEstimate />
          <FlexRow style={{ marginTop: 'auto' }}>
            <ActionButton
              actionButtonText='Complete Training'
              completedButtonText='Completed'
              moduleStatus={moduleStatus}
              onClick={() => {
                setTrainingRefreshButtonDisabled(false);
                redirectToRegisteredTraining();
              }}
            />
            {!isRenewalCompleteForModule(moduleStatus) && (
              <Button
                disabled={trainingRefreshButtonDisabled}
                onClick={async () => {
                  setLoading(true);
                  await syncAndReloadTraining();
                  setLoading(false);
                }}
                style={{
                  height: '1.6rem',
                  marginLeft: '0.75rem',
                  width: 'max-content',
                }}
              >
                Refresh
              </Button>
            )}
          </FlexRow>
        </React.Fragment>
      ),
    ],
    [
      AccessModule.CTCOMPLIANCETRAINING,
      () => (
        <React.Fragment>
          <Dates />
          <div style={textStyle}>
            You are required to complete the refreshed ethics training courses
            to understand the privacy safeguards and the compliance requirements
            for using the <AoU /> Controlled Tier Dataset.
          </div>
          {!isRenewalCompleteForModule(moduleStatus) && (
            <div
              style={{
                ...renewalStyle.complianceTrainingExpiring,
                ...textStyle,
              }}
            >
              When you have completed the training click the refresh button or
              reload the page.
            </div>
          )}
          <TimeEstimate />
          <FlexRow style={{ marginTop: 'auto' }}>
            <ActionButton
              actionButtonText='Complete Training'
              completedButtonText='Completed'
              moduleStatus={moduleStatus}
              onClick={() => {
                setTrainingRefreshButtonDisabled(false);
                redirectToControlledTraining();
              }}
            />
            {!isRenewalCompleteForModule(moduleStatus) && (
              <Button
                disabled={trainingRefreshButtonDisabled}
                onClick={async () => {
                  setLoading(true);
                  await syncAndReloadTraining();
                  setLoading(false);
                }}
                style={{
                  height: '1.6rem',
                  marginLeft: '0.75rem',
                  width: 'max-content',
                }}
              >
                Refresh
              </Button>
            )}
          </FlexRow>
        </React.Fragment>
      ),
    ],
    [
      AccessModule.DATAUSERCODEOFCONDUCT,
      () => (
        <React.Fragment>
          <Dates />
          <div style={textStyle}>
            Please review and sign the data user code of conduct consenting to
            the <AoU /> data use policy.
          </div>
          <TimeEstimate />
          <ActionButton
            actionButtonText='View & Sign'
            completedButtonText='Completed'
            moduleStatus={moduleStatus}
            onClick={() =>
              navigateByUrl('data-code-of-conduct', {
                queryParams: { renewal: 1 },
              })
            }
          />
        </React.Fragment>
      ),
    ]
  );

  return (
    <React.Fragment>
      <div style={renewalStyle.h3}>
        <AARTitleComponent />
      </div>
      {!hide && module}
    </React.Fragment>
  );
};

interface CardProps {
  step: number;
  moduleName: AccessModule;
  modules: AccessModuleStatus[];
  setLoading: (boolean) => void;
}
const RenewalCard = ({ step, moduleName, modules, setLoading }: CardProps) => {
  return (
    <FlexColumn style={renewalStyle.card}>
      <div style={renewalStyle.h3}>STEP {step}</div>
      <RenewalCardBody
        moduleStatus={getAccessModuleStatusByNameOrEmpty(modules, moduleName)}
        setLoading={(v) => setLoading(v)}
      />
    </FlexColumn>
  );
};

// Page to render
export const AccessRenewal = fp.flow(withProfileErrorModal)(
  (spinnerProps: WithSpinnerOverlayProps) => {
    // State
    const {
      profile,
      profile: {
        accessModules: { modules },
      },
    } = useStore(profileStore);
    const {
      config: { enableComplianceTraining },
    } = useStore(serverConfigStore);
    const [loading, setLoading] = useState(false);

    const expirableModules = modules.filter((moduleStatus) =>
      accessRenewalModules.includes(moduleStatus.moduleName)
    );
    const accessRenewalCompleted = expirableModules.every(
      isRenewalCompleteForModule
    );

    // onMount - as we move between pages, let's make sure we have the latest profile and external module information
    useEffect(() => {
      const expiringModuleNames: AccessModule[] = expirableModules
        .filter((status) =>
          isExpiringOrExpired(status.expirationEpochMillis, status.moduleName)
        )
        .map((status) => status.moduleName);

      const onMount = async () => {
        setLoading(true);
        await syncModulesExternal(expiringModuleNames);
        await reloadProfile();
        setLoading(false);
        spinnerProps.hideSpinner();
      };

      onMount();
    }, []);

    const maybeHeader = cond(
      // Completed - no icon or button
      [accessRenewalCompleted, () => null],
      // Access expired icon
      [
        maybeDaysRemaining(profile) < 0,
        () => (
          <React.Fragment>
            <ExclamationTriangle
              color={colors.warning}
              style={{ height: '1.5rem', width: '1.5rem' }}
            />
            <div style={styles.h1}>
              Researcher workbench access has expired.
            </div>
          </React.Fragment>
        ),
      ],
      // Default - back button
      () => (
        <React.Fragment>
          <Clickable onClick={() => history.back()}>
            <BackArrow style={{ height: '1.5rem', width: '1.5rem' }} />
          </Clickable>
          <div style={styles.h1}>
            Yearly Researcher Workbench access renewal
          </div>
        </React.Fragment>
      )
    );

    // Render
    return (
      <FadeBox style={{ margin: '1rem auto 0', color: colors.primary }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5rem 1fr',
            alignItems: 'center',
            columnGap: '.675rem',
          }}
        >
          {maybeHeader}
          <div
            style={
              accessRenewalCompleted
                ? { gridColumn: '1 / span 2' }
                : { gridColumnStart: 2 }
            }
          >
            <RenewalRequirementsText />
          </div>
          {accessRenewalCompleted && (
            <div
              style={{
                ...renewalStyle.completionBox,
                gridColumn: '1 / span 2',
              }}
            >
              <div style={renewalStyle.h2}>
                Thank you for completing all the necessary steps
              </div>
              <div>
                Your yearly Researcher Workbench access renewal is complete. You
                can use the menu icon in the top left to continue your research.
              </div>
            </div>
          )}
        </div>
        <div style={{ ...renewalStyle.h2, margin: '1rem 0' }}>
          Please complete the following steps
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            marginBottom: '1rem',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <RenewalCard
            step={1}
            moduleName={AccessModule.PROFILECONFIRMATION}
            modules={modules}
            setLoading={(v: boolean) => setLoading(v)}
          />
          <RenewalCard
            step={2}
            moduleName={AccessModule.PUBLICATIONCONFIRMATION}
            modules={modules}
            setLoading={(v: boolean) => setLoading(v)}
          />
          {enableComplianceTraining && (
            <RenewalCard
              step={3}
              moduleName={AccessModule.COMPLIANCETRAINING}
              modules={modules}
              setLoading={(v: boolean) => setLoading(v)}
            />
          )}
          <RenewalCard
            step={enableComplianceTraining ? 4 : 3}
            moduleName={AccessModule.DATAUSERCODEOFCONDUCT}
            modules={modules}
            setLoading={(v: boolean) => setLoading(v)}
          />
        </div>
        {loading && <SpinnerOverlay dark={true} opacity={0.6} />}
      </FadeBox>
    );
  }
);
