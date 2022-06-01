import * as React from 'react';
import { useParams } from 'react-router';
import * as fp from 'lodash/fp';

const { useEffect, useState } = React;

import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';

import {
  CriteriaType,
  Domain,
  FilterColumns as Columns,
  PageFilterRequest as Request,
  SortOrder,
  WorkspaceAccessLevel,
} from 'generated/fetch';

import { Button, Clickable } from 'app/components/buttons';
import { FadeBox } from 'app/components/containers';
import { ClrIcon } from 'app/components/icons';
import { SpinnerOverlay } from 'app/components/spinners';
import { withSpinnerOverlay } from 'app/components/with-spinner-overlay';
import { CohortReviewListItem } from 'app/pages/data/cohort-review/cohort-review-list-item';
import { CreateReviewModal } from 'app/pages/data/cohort-review/create-review-modal';
import { visitsFilterOptions } from 'app/services/review-state.service';
import {
  cohortBuilderApi,
  cohortReviewApi,
  cohortsApi,
} from 'app/services/swagger-fetch-clients';
import colors, { colorWithWhiteness } from 'app/styles/colors';
import { datatableStyles } from 'app/styles/datatable';
import { reactStyles, withCurrentWorkspace } from 'app/utils';
import { currentCohortReviewStore, useNavigation } from 'app/utils/navigation';
import { MatchParams } from 'app/utils/stores';

const styles = reactStyles({
  backBtn: {
    padding: 0,
    border: 0,
    fontSize: '14px',
    color: colors.accent,
    background: 'transparent',
    cursor: 'pointer',
  },
  title: {
    marginTop: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: colors.primary,
    overflow: 'auto',
  },
  description: {
    margin: '0 0 0.25rem',
    color: '#000000',
  },
  columnHeader: {
    background: '#f4f4f4',
    color: colors.primary,
    fontWeight: 600,
  },
  columnBody: {
    background: '#ffffff',
    padding: '0.5rem 0.5rem 0.3rem 0.75rem',
    verticalAlign: 'top',
    textAlign: 'left',
    borderLeft: 0,
    borderRight: 0,
    borderBottom: 'none',
    lineHeight: '0.6rem',
    cursor: 'pointer',
  },
  sortIcon: {
    marginTop: '4px',
    color: '#2691D0',
    fontSize: '0.5rem',
    float: 'right',
  },
  tableBody: {
    textAlign: 'left',
    lineHeight: '0.75rem',
  },
});
const reverseColumnEnum = {
  participantId: Columns.PARTICIPANTID,
  sexAtBirth: Columns.SEXATBIRTH,
  gender: Columns.GENDER,
  race: Columns.RACE,
  ethnicity: Columns.ETHNICITY,
  birthDate: Columns.BIRTHDATE,
  deceased: Columns.DECEASED,
  status: Columns.STATUS,
};
const fields = [
  { field: 'participantId', name: 'Participant ID' },
  { field: 'birthDate', name: 'Date of Birth' },
  { field: 'deceased', name: 'Deceased' },
  { field: 'sexAtBirth', name: 'Sex at Birth' },
  { field: 'gender', name: 'Gender' },
  { field: 'race', name: 'Race' },
  { field: 'ethnicity', name: 'Ethnicity' },
  { field: 'status', name: 'Status' },
];
const rows = 25;

export const CohortReviewPage = fp.flow(
  withCurrentWorkspace(),
  withSpinnerOverlay()
)(({ hideSpinner, showSpinner, workspace }) => {
  const { ns, wsid, cid } = useParams<MatchParams>();
  const [navigate, navigateByUrl] = useNavigation();
  const [cohort, setCohort] = useState(undefined);
  const [cohortReviews, setCohortReviews] = useState(undefined);
  const [activeReview, setActiveReview] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const readOnly = workspace.accessLevel === WorkspaceAccessLevel.READER;

  const getParticipantData = (newReview?: boolean) => {
    showSpinner();
    const query = {
      page: 0,
      pageSize: rows,
      sortColumn: reverseColumnEnum.participantId,
      sortOrder: SortOrder.Asc,
      filters: { items: [] },
    } as Request;
    cohortReviewApi()
      .getParticipantCohortStatusesOld(ns, wsid, +cid, query)
      .then(({ cohortReview }) => {
        setActiveReview(cohortReview);
        if (newReview) {
          currentCohortReviewStore.next(cohortReview);
          setShowCreateModal(true);
        }
        hideSpinner();
      });
  };

  const loadCohortAndReviews = async () => {
    const [cohortResponse, cohortReviewResponse] = await Promise.all([
      cohortsApi().getCohort(ns, wsid, +cid),
      cohortReviewApi().getCohortReviewsByCohortId(ns, wsid, +cid),
    ]);
    setCohort(cohortResponse);
    setCohortReviews(cohortReviewResponse.items);
    if (cohortReviewResponse.items.length > 0) {
      setActiveReview(cohortReviewResponse.items[0]);
      getParticipantData();
    } else {
      hideSpinner();
    }
    setLoading(false);
  };

  const getVisitsFilterOptions = () => {
    cohortBuilderApi()
      .findCriteriaBy(
        ns,
        wsid,
        Domain[Domain.VISIT],
        CriteriaType[CriteriaType.VISIT]
      )
      .then((response) => {
        visitsFilterOptions.next([
          { value: null, label: 'Any' },
          ...response.items.map((option) => {
            return { value: option.name, label: option.name };
          }),
        ]);
      });
  };

  useEffect(() => {
    loadCohortAndReviews();
    if (!visitsFilterOptions.getValue()) {
      getVisitsFilterOptions();
    }
  }, []);

  const columns = fields.map((col) => {
    const header = (
      <React.Fragment>
        <span style={styles.columnHeader}>{col.name}</span>
      </React.Fragment>
    );
    return (
      <Column
        style={styles.tableBody}
        bodyStyle={styles.columnBody}
        key={col.field}
        field={col.field}
        header={header}
        sortable
      />
    );
  });

  return (
    <FadeBox style={{ margin: 'auto', paddingTop: '1rem', width: '95.7%' }}>
      {loading ? (
        <SpinnerOverlay />
      ) : (
        <React.Fragment>
          <style>{datatableStyles}</style>
          <div>
            <button
              style={styles.backBtn}
              type='button'
              onClick={() =>
                navigateByUrl(`workspaces/${ns}/${wsid}/data/cohorts/build`, {
                  queryParams: { cohortId: cid },
                })
              }
            >
              Back to cohort
            </button>
            <h4 style={styles.title}>
              Review Sets for {cohort.name}
              <Button
                style={{ float: 'right', height: '1.3rem' }}
                disabled={loading}
                onClick={() =>
                  navigate([
                    'workspaces',
                    ns,
                    wsid,
                    'data',
                    'cohorts',
                    cid,
                    'review',
                    'cohort-description',
                  ])
                }
              >
                Cohort Description
              </Button>
            </h4>
            <div style={styles.description}>{cohort.description}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div
              style={{
                border: `1px solid ${colorWithWhiteness(colors.black, 0.8)}`,
                borderRadius: '3px',
                flex: '0 0 20%',
              }}
            >
              <div
                style={{
                  borderBottom: `1px solid ${colorWithWhiteness(
                    colors.black,
                    0.8
                  )}`,
                  color: colors.primary,
                  fontSize: '16px',
                  fontWeight: 600,
                  padding: '0.5rem',
                }}
              >
                Review Sets
                <Clickable
                  style={{ display: 'inline-block', marginLeft: '0.5rem' }}
                  disabled={readOnly}
                  onClick={() => getParticipantData(true)}
                >
                  <ClrIcon shape='plus-circle' class='is-solid' size={18} />
                </Clickable>
              </div>
              <div style={{ minHeight: '10rem', padding: '0.25rem' }}>
                {cohortReviews.map((cohortReview, cr) => (
                  <CohortReviewListItem
                    key={cr}
                    cohortReview={cohortReview}
                    onUpdate={() => loadCohortAndReviews()}
                    onSelect={() => {
                      setActiveReview(cohortReview);
                      getParticipantData();
                    }}
                    selected={
                      activeReview.cohortReviewId ===
                      cohortReview.cohortReviewId
                    }
                  />
                ))}
              </div>
            </div>
            <div style={{ flex: '0 0 80%', marginLeft: '0.25rem' }}>
              {!cohortReviews.length ? (
                <div
                  style={{
                    color: colorWithWhiteness(colors.dark, 0.6),
                    fontSize: '20px',
                    fontWeight: 400,
                    padding: '1rem',
                  }}
                >
                  There are no review sets for this cohort. Click the plus icon
                  to create a review set.
                </div>
              ) : (
                !!activeReview?.participantCohortStatuses && (
                  <DataTable
                    style={{ fontSize: '12px' }}
                    value={activeReview.participantCohortStatuses}
                    first={0}
                    lazy
                    rows={rows}
                    scrollable
                    scrollHeight='calc(100vh - 350px)'
                  >
                    {columns}
                  </DataTable>
                )
              )}
            </div>
          </div>
        </React.Fragment>
      )}
      {showCreateModal && (
        <CreateReviewModal
          canceled={() => setShowCreateModal(false)}
          cohort={cohort}
          created={(review) => {
            setCohortReviews([...cohortReviews, review]);
            setActiveReview(review);
            setShowCreateModal(false);
          }}
        />
      )}
    </FadeBox>
  );
});
