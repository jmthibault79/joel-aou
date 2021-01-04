import {Growl} from 'primereact/growl';
import * as React from 'react';
import {Subscription} from 'rxjs/Subscription';

import {Demographics} from 'app/cohort-search/demographics/demographics.component';
import {searchRequestStore} from 'app/cohort-search/search-state.service';
import {Selection} from 'app/cohort-search/selection-list/selection-list.component';
import {generateId, typeToTitle} from 'app/cohort-search/utils';
import {Button, Clickable} from 'app/components/buttons';
import {FlexRowWrap} from 'app/components/flex';
import {CriteriaSearch, growlCSS} from 'app/pages/data/criteria-search';
import colors, {addOpacity} from 'app/styles/colors';
import {reactStyles, withCurrentCohortSearchContext} from 'app/utils';
import {triggerEvent} from 'app/utils/analytics';
import {
  attributesSelectionStore,
  currentCohortCriteriaStore,
  currentCohortSearchContextStore,
  setSidebarActiveIconStore,
} from 'app/utils/navigation';
import {CriteriaType, Domain, TemporalMention, TemporalTime} from 'generated/fetch';

const styles = reactStyles({
  arrowIcon: {
    height: '21px',
    marginTop: '-0.2rem',
    width: '18px'
  },
  backArrow: {
    background: `${addOpacity(colors.accent, 0.15)}`,
    borderRadius: '50%',
    display: 'inline-block',
    height: '1.5rem',
    lineHeight: '1.6rem',
    textAlign: 'center',
    width: '1.5rem',
  },
  finishButton: {
    marginTop: '1.5rem',
    borderRadius: '5px',
    bottom: '1rem',
    position: 'absolute',
    right: '3rem',
  },
  growl: {
    position: 'absolute',
    right: '0',
    top: 0
  },
  searchContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    height: '70vh',
    position: 'relative',
    width: '100%',
  },
  searchContent: {
    height: '100%',
    padding: '0 0.5rem',
    position: 'relative',
    width: '100%'
  },
  titleBar: {
    color: colors.primary,
    display: 'table',
    margin: '1rem 0 0.25rem',
    width: '65%',
    height: '1.5rem',
  },
  titleHeader: {
    display: 'inline-block',
    lineHeight: '1.5rem',
    margin: '0 0 0 0.75rem'
  }
});

const arrowIcon = '/assets/icons/arrow-left-regular.svg';

function initGroup(role: string, item: any) {
  return {
    id: generateId(role),
    items: [item],
    count: null,
    temporal: false,
    mention: TemporalMention.ANYMENTION,
    time: TemporalTime.DURINGSAMEENCOUNTERAS,
    timeValue: '',
    timeFrame: '',
    isRequesting: false,
    status: 'active'
  };
}

export function saveCriteria(selections?: Array<Selection>) {
  const {domain, groupId, item, role, type} = currentCohortSearchContextStore.getValue();
  if (domain === Domain.PERSON) {
    triggerEvent('Cohort Builder Search', 'Click', `Demo - ${typeToTitle(type)} - Finish`);
  }
  const searchRequest = searchRequestStore.getValue();
  item.searchParameters = selections || currentCohortCriteriaStore.getValue();
  if (groupId) {
    const groupIndex = searchRequest[role].findIndex(grp => grp.id === groupId);
    if (groupIndex > -1) {
      const itemIndex = searchRequest[role][groupIndex].items.findIndex(it => it.id === item.id);
      if (itemIndex > -1) {
        searchRequest[role][groupIndex].items[itemIndex] = item;
      } else {
        searchRequest[role][groupIndex].items.push(item);
      }
    }
  } else {
    searchRequest[role].push(initGroup(role, item));
  }
  searchRequestStore.next(searchRequest);
  currentCohortSearchContextStore.next(undefined);
  currentCohortCriteriaStore.next(undefined);
}

interface Props {
  cohortContext: any;
  selections?: Array<Selection>;
}

interface State {
  growlVisible: boolean;
  selectedIds: Array<string>;
  selections: Array<Selection>;
}

export const CohortSearch = withCurrentCohortSearchContext()(class extends React.Component<Props, State> {
  growl: any;
  growlTimer: NodeJS.Timer;
  subscription: Subscription;
  constructor(props: Props) {
    super(props);
    this.state = {
      growlVisible: false,
      selectedIds: [],
      selections: [],
    };
  }

  componentDidMount(): void {
    const {cohortContext: {domain, item, type}} = this.props;
    // JSON stringify and parse prevents changes to selections from being passed to the cohortContext
    const selections = JSON.parse(JSON.stringify(item.searchParameters));
    if (type === CriteriaType.DECEASED) {
      this.selectDeceased();
    } else if (domain === Domain.FITBIT) {
      this.selectFitbit();
    }
    currentCohortCriteriaStore.next(selections);
    this.subscription = currentCohortCriteriaStore.subscribe(newSelections => {
      if (!!newSelections) {
        this.setState({
          selectedIds: newSelections.map(s => s.parameterId),
          selections: newSelections
        });
      }
    });
  }

  componentWillUnmount() {
    this.subscription.unsubscribe();
    currentCohortCriteriaStore.next(undefined);
  }

  closeSearch() {
    currentCohortSearchContextStore.next(undefined);
    currentCohortCriteriaStore.next(undefined);
    // Delay hiding attributes page until sidebar is closed
    setTimeout(() => attributesSelectionStore.next(undefined), 500);
  }

  addSelection = (param: any) => {
    let {selectedIds, selections} = this.state;
    if (selectedIds.includes(param.parameterId)) {
      selections = selections.filter(p => p.parameterId !== param.parameterId);
    } else {
      selectedIds = [...selectedIds, param.parameterId];
    }
    selections = [...selections, param];
    currentCohortCriteriaStore.next(selections);
    this.setState({selections, selectedIds});
    this.growl.show({severity: 'success', detail: 'Criteria Added', closable: false, life: 2000});
    if (!!this.growlTimer) {
      clearTimeout(this.growlTimer);
    }
    // This is to set style display: 'none' on the growl so it doesn't block the nav icons in the sidebar
    this.growlTimer = setTimeout(() => this.setState({growlVisible: false}), 2500);
    this.setState({growlVisible: true});
  }

  selectDeceased() {
    const param = {
      id: null,
      parentId: null,
      parameterId: '',
      type: CriteriaType.DECEASED.toString(),
      name: 'Deceased',
      group: false,
      domainId: Domain.PERSON.toString(),
      hasAttributes: false,
      selectable: true,
      attributes: []
    } as Selection;
    saveCriteria([param]);
  }

  selectFitbit() {
    const param = {
      id: null,
      parentId: null,
      parameterId: '',
      type: CriteriaType.PPI.toString(),
      name: 'Has any Fitbit data',
      group: false,
      domainId: Domain.FITBIT.toString(),
      hasAttributes: false,
      selectable: true,
      attributes: []
    } as Selection;
    saveCriteria([param]);
  }

  render() {
    const {cohortContext, cohortContext: {domain, type}} = this.props;
    const {growlVisible, selectedIds, selections} = this.state;
    return !!cohortContext && <FlexRowWrap style={styles.searchContainer}>
      <style>{growlCSS}</style>
      <Growl ref={(el) => this.growl = el} style={!growlVisible ? {...styles.growl, display: 'none'} : styles.growl}/>
      <div id='cohort-search-container' style={styles.searchContent}>
        {domain === Domain.PERSON && <div style={styles.titleBar}>
          <Clickable style={styles.backArrow} onClick={() => this.closeSearch()}>
            <img src={arrowIcon} style={styles.arrowIcon} alt='Go back' />
          </Clickable>
          <h2 style={styles.titleHeader}>{typeToTitle(type)}</h2>
        </div>}
        <div style={
          (domain === Domain.PERSON && type !== CriteriaType.AGE)
            ? {marginBottom: '3.5rem'}
            : {height: 'calc(100% - 3.5rem)'}
        }>
          {domain === Domain.PERSON ? <div style={{flex: 1, overflow: 'auto'}}>
              <Demographics
                criteriaType={type}
                select={this.addSelection}
                selectedIds={selectedIds}
                selections={selections}/>
            </div>
            : <CriteriaSearch backFn={() => this.closeSearch()}
                              cohortContext={cohortContext}/>}
        </div>
      </div>
      <Button type='primary'
              style={styles.finishButton}
              disabled={!!selectedIds && selectedIds.length === 0}
              onClick={() => setSidebarActiveIconStore.next('criteria')}>
        Finish & Review
      </Button>
    </FlexRowWrap>;
  }
});
