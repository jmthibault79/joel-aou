import * as React from 'react';
import { CSSProperties } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import * as fp from 'lodash/fp';

import { WorkspaceResource } from 'generated/fetch';

import { Clickable } from 'app/components/buttons';
import { ResourceCardBase } from 'app/components/card';
import { FlexColumn, FlexRow } from 'app/components/flex';
import colors from 'app/styles/colors';
import { reactStyles } from 'app/utils';
import { AnalyticsTracker } from 'app/utils/analytics';
import { displayDateWithoutHours } from 'app/utils/dates';
import { stringifyUrl } from 'app/utils/navigation';
import {
  getDescription,
  getDisplayName,
  getResourceUrl,
  getTypeString,
  isCohort,
  isCohortReview,
  isConceptSet,
  isDataSet,
  isNotebook,
} from 'app/utils/resources';

import { Action, ResourceActionsMenu } from './resource-actions-menu';

const styles = reactStyles({
  card: {
    marginTop: '1rem',
    justifyContent: 'space-between',
    marginRight: '1rem',
    padding: '0.75rem 0.75rem 0rem 0.75rem',
    boxShadow: '0 0 0 0',
  },
  resourceName: {
    fontSize: '18px',
    fontWeight: 500,
    lineHeight: '22px',
    color: colors.accent,
    cursor: 'pointer',
    wordBreak: 'break-all',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    textDecoration: 'none',
  },
  resourceDescription: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    overflowWrap: 'anywhere',
  },
  lastModified: {
    color: colors.primary,
    fontSize: '11px',
    display: 'inline-block',
    lineHeight: '14px',
    fontWeight: 300,
    marginBottom: '0.2rem',
  },
  resourceType: {
    height: '22px',
    width: '6rem',
    paddingLeft: '10px',
    paddingRight: '10px',
    borderRadius: '2px',
    display: 'flex',
    justifyContent: 'left',
    color: colors.white,
    fontFamily: 'Montserrat, sans-serif',
    fontSize: '12px',
    fontWeight: 500,
  },
  cardFooter: {
    display: 'flex',
    flexDirection: 'column',
  },
});

const StyledResourceType = (props: { resource: WorkspaceResource }) => {
  const { resource } = props;

  function getColor(): string {
    return fp.cond([
      [isCohort, () => colors.resourceCardHighlights.cohort],
      [isCohortReview, () => colors.resourceCardHighlights.cohortReview],
      [isConceptSet, () => colors.resourceCardHighlights.conceptSet],
      [isDataSet, () => colors.resourceCardHighlights.dataSet],
      [isNotebook, () => colors.resourceCardHighlights.notebook],
    ])(resource);
  }
  return (
    <div
      data-test-id='card-type'
      style={{ ...styles.resourceType, backgroundColor: getColor() }}
    >
      {fp.startCase(fp.camelCase(getTypeString(resource)))}
    </div>
  );
};

function canWrite(resource: WorkspaceResource): boolean {
  return resource.permission === 'OWNER' || resource.permission === 'WRITER';
}

function canDelete(resource: WorkspaceResource): boolean {
  return resource.permission === 'OWNER' || resource.permission === 'WRITER';
}

interface NavProps {
  resource: WorkspaceResource;
  linkTestId?: string;
  style?: CSSProperties;
  children: string | React.ReactNode;
}

const ResourceNavigation = (props: NavProps) => {
  const {
    resource,
    resource: { adminLocked },
    linkTestId,
    style = styles.resourceName,
    children,
  } = props;
  const url = stringifyUrl(getResourceUrl(resource));

  function onNavigate() {
    if (isNotebook(resource)) {
      AnalyticsTracker.Notebooks.Preview();
    }
  }

  return (
    <div>
      {adminLocked ? (
        <div>{children}</div>
      ) : (
        <Clickable>
          <RouterLink
            to={url}
            style={style}
            data-test-id={linkTestId}
            onClick={() => onNavigate()}
          >
            {children}
          </RouterLink>
        </Clickable>
      )}
    </div>
  );
};

interface Props {
  actions: Action[];
  resource: WorkspaceResource;
}

class ResourceCard extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { actions, resource } = this.props;
    return (
      <ResourceCardBase style={styles.card} data-test-id='card'>
        <FlexColumn style={{ alignItems: 'flex-start' }}>
          <FlexRow style={{ alignItems: 'flex-start' }}>
            <ResourceActionsMenu actions={actions} />
            <ResourceNavigation resource={resource} linkTestId='card-name'>
              {getDisplayName(resource)}
            </ResourceNavigation>
          </FlexRow>
          <div style={styles.resourceDescription}>
            {getDescription(resource)}
          </div>
        </FlexColumn>
        <div style={styles.cardFooter}>
          <div style={styles.lastModified} data-test-id='last-modified'>
            Last Modified:{' '}
            {displayDateWithoutHours(resource.lastModifiedEpochMillis)}
          </div>
          <StyledResourceType resource={resource} />
        </div>
      </ResourceCardBase>
    );
  }
}

export {
  ResourceCard,
  ResourceNavigation,
  StyledResourceType,
  canDelete,
  canWrite,
};
