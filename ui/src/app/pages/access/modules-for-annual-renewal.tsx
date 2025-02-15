import * as React from 'react';
import { CSSProperties, useState } from 'react';
import * as fp from 'lodash/fp';

import { AccessModule, AccessModuleStatus, Profile } from 'generated/fetch';

import { Button } from 'app/components/buttons';
import { FlexColumn } from 'app/components/flex';
import { CheckCircle, Circle, Clock, ClrIcon } from 'app/components/icons';
import { RadioButton } from 'app/components/inputs';
import { withErrorModal, withSuccessModal } from 'app/components/modals';
import { SupportMailto } from 'app/components/support';
import { AoU } from 'app/components/text-wrappers';
import { profileApi } from 'app/services/swagger-fetch-clients';
import colors, { addOpacity, colorWithWhiteness } from 'app/styles/colors';
import { switchCase, useId } from 'app/utils';
import {
  computeRenewalDisplayDates,
  getAccessModuleConfig,
  getAccessModuleStatusByNameOrEmpty,
  isRenewalCompleteForModule,
  redirectToControlledTraining,
  redirectToRegisteredTraining,
} from 'app/utils/access-utils';
import { useNavigation } from 'app/utils/navigation';
import { profileStore } from 'app/utils/stores';

import { styles } from './data-access-requirements';

const REDCAP_PUBLICATIONS_SURVEY =
  'https://redcap.pmi-ops.org/surveys/?s=MKYL8MRD4N';

const reloadProfile = withErrorModal(
  {
    title: 'Could Not Load Profile',
    message:
      'Profile could not be reloaded. Please refresh the page to get your updated profile',
  },
  profileStore.get().reload
);

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

interface RenewalCardProps {
  profile: Profile;
  modules: AccessModule[];
}

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
    gridTemplateColumns: 'auto auto',
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
  moduleContainer: {
    display: 'grid',
    gridTemplateAreas: `'checkbox title .'
      '. content action'
    `,
  },
};

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

export const RenewalCardBody = (props: {
  moduleStatus: AccessModuleStatus;
  setLoading: (boolean) => void;
  hide?: boolean;
  textStyle?: CSSProperties;
  radioButtonStyle?: CSSProperties;
  showTimeEstimate?: boolean;
}) => {
  const {
    moduleStatus,
    setLoading,
    hide,
    textStyle,
    radioButtonStyle,
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
      <FlexColumn style={{ alignItems: 'center' }}>
        <Clock style={{ color: colors.disabled, width: '5em' }} />
        {renewalTimeEstimate} min
      </FlexColumn>
    ) : null;

  const Dates = () => (
    <div style={{ ...renewalStyle.dates, ...textStyle, fontWeight: 500 }}>
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
          <div style={{ paddingRight: '1.4em', gridArea: 'content' }}>
            <Dates />
            <div
              style={{ marginBottom: '0.5rem', ...textStyle, fontWeight: 500 }}
            >
              Please update your profile information if any of it has changed
              recently.
            </div>
            <div style={textStyle}>
              Note that you are obliged by the Terms of Use of the Workbench to
              keep your profile information up-to-date at all times.
            </div>
          </div>
          <FlexColumn
            style={{
              alignSelf: 'end',
              alignItems: 'center',
              gridArea: 'action',
            }}
          >
            <TimeEstimate />
            <ActionButton
              actionButtonText='Review'
              completedButtonText='Confirmed'
              moduleStatus={moduleStatus}
              onClick={() =>
                navigateByUrl('profile', { queryParams: { renewal: 1 } })
              }
            />
          </FlexColumn>
        </React.Fragment>
      ),
    ],
    [
      AccessModule.PUBLICATIONCONFIRMATION,
      () => {
        return (
          <React.Fragment>
            <div style={{ gridArea: 'content' }}>
              <Dates />
              <div style={textStyle}>
                The <AoU /> Publication and Presentation Policy requires that
                you report any upcoming publication or presentation resulting
                from the use of <AoU /> Research Program Data at least two weeks
                before the date of publication. If you are lead on or part of a
                publication or presentation that hasn’t been reported to the
                program,{' '}
                <a
                  target='_blank'
                  style={{ textDecoration: 'underline' }}
                  href={REDCAP_PUBLICATIONS_SURVEY}
                >
                  please report it now.
                </a>{' '}
                For any questions, please contact <SupportMailto />
              </div>

              <div>
                <RadioButton
                  data-test-id='nothing-to-report'
                  id={noReportId}
                  disabled={isRenewalCompleteForModule(moduleStatus)}
                  style={radioButtonStyle}
                  checked={publications === true}
                  onChange={() => setPublications(true)}
                />
                <label htmlFor={noReportId} style={textStyle}>
                  At this time, I have nothing to report
                </label>
              </div>
              <div>
                <RadioButton
                  data-test-id='report-submitted'
                  id={reportId}
                  disabled={isRenewalCompleteForModule(moduleStatus)}
                  style={radioButtonStyle}
                  checked={publications === false}
                  onChange={() => setPublications(false)}
                />
                <label htmlFor={reportId} style={textStyle}>
                  Report submitted
                </label>
              </div>
            </div>
            <FlexColumn
              style={{
                alignSelf: 'end',
                alignItems: 'center',
                gridArea: 'action',
              }}
            >
              <TimeEstimate />
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
            </FlexColumn>
          </React.Fragment>
        );
      },
    ],
    [
      AccessModule.COMPLIANCETRAINING,
      () => (
        <React.Fragment>
          <div style={{ paddingRight: '1.4em', gridArea: 'content' }}>
            <Dates />
            <div style={textStyle}>
              You are required to complete the refreshed ethics training courses
              to understand the privacy safeguards and the compliance
              requirements for using the <AoU /> Registered Tier Dataset.
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
          </div>
          <FlexColumn
            style={{
              alignSelf: 'end',
              alignItems: 'center',
              gridArea: 'action',
            }}
          >
            <TimeEstimate />
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
                  width: 'max-content',
                  marginTop: '0.7em',
                }}
              >
                Refresh
              </Button>
            )}
          </FlexColumn>
        </React.Fragment>
      ),
    ],
    [
      AccessModule.CTCOMPLIANCETRAINING,
      () => (
        <React.Fragment>
          <div style={{ paddingRight: '1.4em', gridArea: 'content' }}>
            <Dates />
            <div style={textStyle}>
              You are required to complete the refreshed ethics training courses
              to understand the privacy safeguards and the compliance
              requirements for using the <AoU /> Controlled Tier Dataset.
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
          </div>
          <FlexColumn
            style={{
              alignSelf: 'end',
              alignItems: 'center',
              gridArea: 'action',
            }}
          >
            <TimeEstimate />
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
                  width: 'max-content',
                  marginTop: '0.7em',
                }}
              >
                Refresh
              </Button>
            )}
          </FlexColumn>
        </React.Fragment>
      ),
    ],
    [
      AccessModule.DATAUSERCODEOFCONDUCT,
      () => (
        <React.Fragment>
          <div style={{ gridArea: 'content' }}>
            <Dates />
            <div style={textStyle}>
              Please review and sign the data user code of conduct consenting to
              the <AoU /> data use policy.
            </div>
          </div>
          <FlexColumn
            style={{
              alignSelf: 'end',
              alignItems: 'center',
              gridArea: 'action',
            }}
          >
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
          </FlexColumn>
        </React.Fragment>
      ),
    ]
  );

  return (
    <div style={renewalStyle.moduleContainer}>
      <div style={{ gridArea: 'checkbox' }}>
        {isRenewalCompleteForModule(moduleStatus) ? (
          <CheckCircle color={colors.success} style={styles.renewalStatus} />
        ) : (
          <Circle color={'#cbcbcb'} style={styles.renewalStatus} />
        )}
      </div>
      <div style={{ gridArea: 'title', fontWeight: 500 }}>
        <AARTitleComponent />
      </div>
      {!hide && module}
    </div>
  );
};

export const ModulesForAnnualRenewal = (props: RenewalCardProps) => {
  const { profile, modules } = props;
  const showingStyle = {
    ...styles.clickableModuleBox,
    ...styles.clickableModuleText,
  };
  const hiddenStyle = {
    ...styles.backgroundModuleBox,
    ...styles.backgroundModuleText,
  };
  return (
    <FlexColumn style={styles.modulesContainer}>
      {modules.map((moduleName, index) => {
        // TODO RW-7797.  Until then, hardcode
        const showModule = true;
        return (
          <FlexColumn
            data-test-id={`module-${moduleName}`}
            key={moduleName}
            style={{
              ...(showModule ? showingStyle : hiddenStyle),
              ...{
                marginTop:
                  index > 0 || moduleName === AccessModule.CTCOMPLIANCETRAINING
                    ? '1.9em'
                    : '0em',
              },
            }}
          >
            <RenewalCardBody
              moduleStatus={getAccessModuleStatusByNameOrEmpty(
                profile.accessModules.modules,
                moduleName
              )}
              setLoading={() => {}}
              textStyle={{ fontSize: '0.6rem' }}
              radioButtonStyle={{ marginRight: '0.5em' }}
              hide={!showModule}
              showTimeEstimate={true}
            />
          </FlexColumn>
        );
      })}
    </FlexColumn>
  );
};
