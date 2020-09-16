import {Growl} from 'primereact/growl';
import * as React from 'react';
import {Subscription} from 'rxjs/Subscription';

import {DemographicsV2} from 'app/cohort-search/demographics/demographics-v2.component';
import {ListSearchV2} from 'app/cohort-search/list-search-v2/list-search-v2.component';
import {searchRequestStore} from 'app/cohort-search/search-state.service';
import {Selection} from 'app/cohort-search/selection-list/selection-list.component';
import {CriteriaTree} from 'app/cohort-search/tree/tree.component';
import {domainToTitle, generateId, typeToTitle} from 'app/cohort-search/utils';
import {Button, Clickable, StyledAnchorTag} from 'app/components/buttons';
import {FlexRowWrap} from 'app/components/flex';
import {SpinnerOverlay} from 'app/components/spinners';
import {AoU} from 'app/components/text-wrappers';
import colors, {addOpacity, colorWithWhiteness} from 'app/styles/colors';
import {reactStyles, withCurrentCohortSearchContext} from 'app/utils';
import {triggerEvent} from 'app/utils/analytics';
import {
  attributesSelectionStore,
  currentCohortCriteriaStore,
  currentCohortSearchContextStore,
  serverConfigStore,
  setSidebarActiveIconStore,
} from 'app/utils/navigation';
import {environment} from 'environments/environment';
import {Criteria, CriteriaType, DomainType, TemporalMention, TemporalTime} from 'generated/fetch';

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
  externalLinks: {
    display: 'table-cell',
    lineHeight: '0.75rem',
    textAlign: 'right',
    verticalAlign: 'middle'
  },
  finishButton: {
    borderRadius: '5px',
    bottom: '1rem',
    position: 'absolute',
    right: '3rem',
  },
  footer: {
    marginTop: '0.5rem',
    padding: '0.45rem 0rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  footerButton: {
    height: '1.5rem',
    margin: '0.25rem 0.5rem'
  },
  growl: {
    position: 'absolute',
    right: '0',
    top: 0
  },
  panelLeft: {
    display: 'none',
    flex: 1,
    minWidth: '14rem',
    overflowY: 'auto',
    overflowX: 'hidden',
    width: '100%',
    height: '100%',
    padding: '0 0.4rem 0 1rem',
  },
  searchContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    height: '70vh',
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
  if (domain === DomainType.PERSON) {
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
  autocompleteSelection: Criteria;
  backMode: string;
  count: number;
  disableFinish: boolean;
  groupSelections: Array<number>;
  growlVisible: boolean;
  hierarchyNode: Criteria;
  loadingSubtree: boolean;
  mode: string;
  selectedIds: Array<string>;
  selections: Array<Selection>;
  title: string;
  treeSearchTerms: string;
}

const css = `
  .p-growl {
    position: sticky;
  }
  .p-growl.p-growl-topright {
    height: 1rem;
    width: 6.4rem;
    line-height: 0.7rem;
  }
  .p-growl .p-growl-item-container .p-growl-item .p-growl-image {
    font-size: 1rem !important;
    margin-top: 0.19rem
  }
  .p-growl-item-container:after {
    content:"";
    position: absolute;
    left: 97.5%;
    top: 0.1rem;
    width: 0px;
    height: 0px;
    border-top: 0.5rem solid transparent;
    border-left: 0.5rem solid ` + colorWithWhiteness(colors.success, 0.6) + `;
    border-bottom: 0.5rem solid transparent;
  }
  .p-growl-item-container {
    background-color: ` + colorWithWhiteness(colors.success, 0.6) + `!important;
  }
  .p-growl-item {
    padding: 0rem !important;
    background-color: ` + colorWithWhiteness(colors.success, 0.6) + `!important;
    margin-left: 0.3rem;
  }
  .p-growl-message {
    margin-left: 0.5em
  }
  .p-growl-details {
    margin-top: 0.1rem;
  }
 `;

export const CohortSearch = withCurrentCohortSearchContext()(class extends React.Component<Props, State> {
  subscription: Subscription;
  growl: any;
  growlTimer: NodeJS.Timer;
  constructor(props: Props) {
    super(props);
    this.state = {
      autocompleteSelection: undefined,
      backMode: 'list',
      count: 0,
      disableFinish: false,
      groupSelections: [],
      growlVisible: false,
      hierarchyNode: undefined,
      loadingSubtree: false,
      mode: 'list',
      selectedIds: [],
      selections: [],
      title: '',
      treeSearchTerms: '',
    };
  }

  componentWillUnmount() {
    if (serverConfigStore.getValue().enableCohortBuilderV2) {
      this.subscription.unsubscribe();
      currentCohortCriteriaStore.next(undefined);
    }
  }

  componentDidMount(): void {
    const {cohortContext: {domain, item, standard, type}} = this.props;
    const selections = item.searchParameters;
    const selectedIds = selections.map(s => s.parameterId);
    if (type === CriteriaType.DECEASED) {
      this.selectDeceased();
    } else {
      const title = domain === DomainType.PERSON ? typeToTitle(type) : domainToTitle(domain);
      let {backMode, mode} = this.state;
      let hierarchyNode;
      if (this.initTree) {
        hierarchyNode = {
          domainId: domain,
          type: type,
          isStandard: standard,
          id: 0,
        };
        backMode = 'tree';
        mode = 'tree';
      }
      this.setState({backMode, hierarchyNode, mode, selectedIds, selections, title});
    }
    if (serverConfigStore.getValue().enableCohortBuilderV2) {
      currentCohortCriteriaStore.next(selections);
      this.subscription = currentCohortCriteriaStore.subscribe(newSelections => {
        if (!!newSelections) {
          this.setState({
            groupSelections: newSelections.filter(s => s.group).map(s => s.id),
            selectedIds: newSelections.map(s => s.parameterId),
            selections: newSelections
          });
        }
      });
    }
  }

  setScroll = (id: string) => {
    const nodeId = `node${id}`;
    const node = document.getElementById(nodeId);
    if (node) {
      setTimeout(() => node.scrollIntoView({behavior: 'smooth', block: 'center'}), 200);
    }
    this.setState({loadingSubtree: false});
  }

  back = () => {
    if (this.state.mode === 'tree') {
      this.setState({autocompleteSelection: undefined, backMode: 'list', hierarchyNode: undefined, mode: 'list'});
    } else {
      attributesSelectionStore.next(undefined);
      this.setState({mode: this.state.backMode});
    }
  }

  closeSearch() {
    currentCohortSearchContextStore.next(undefined);
    currentCohortCriteriaStore.next(undefined);
    // Delay hiding attributes page until sidebar is closed
    setTimeout(() => attributesSelectionStore.next(undefined), 500);
  }

  get initTree() {
    const {cohortContext: {domain}} = this.props;
    return domain === DomainType.PHYSICALMEASUREMENT
      || domain === DomainType.SURVEY
      || domain === DomainType.VISIT;
  }

  searchContentStyle(mode: string) {
    let style = {
      display: 'none',
      flex: 1,
      minWidth: '14rem',
      overflowY: 'auto',
      overflowX: 'hidden',
      width: '100%',
      height: '100%',
    } as React.CSSProperties;
    if (this.state.mode === mode) {
      style = {...style, display: 'block', animation: 'fadeEffect 1s'};
    }
    return style;
  }

  showHierarchy = (criterion: Criteria) => {
    this.setState({
      autocompleteSelection: criterion,
      backMode: 'tree',
      hierarchyNode: {...criterion, id: 0},
      mode: 'tree',
      loadingSubtree: true,
      treeSearchTerms: criterion.name
    });
  }

  modifiersFlag = (disabled: boolean) => {
    this.setState({disableFinish: disabled});
  }

  setTreeSearchTerms = (input: string) => {
    this.setState({treeSearchTerms: input});
  }

  setAutocompleteSelection = (selection: any) => {
    this.setState({loadingSubtree: true, autocompleteSelection: selection});
  }

  addSelection = (param: any) => {
    let {groupSelections, selectedIds, selections} = this.state;
    if (selectedIds.includes(param.parameterId)) {
      selections = selections.filter(p => p.parameterId !== param.parameterId);
    } else {
      selectedIds = [...selectedIds, param.parameterId];
      if (param.group) {
        groupSelections = [...groupSelections, param.id];
      }
    }
    selections = [...selections, param];
    this.growl.show({severity: 'success', detail: 'Criteria Added', closable: false, life: 2000});
    if (!!this.growlTimer) {
      clearTimeout(this.growlTimer);
    }
    // This is to set style display: 'none' on the growl so it doesn't block the nav icons in the sidebar
    this.growlTimer = setTimeout(() => this.setState({growlVisible: false}), 2500);
    currentCohortCriteriaStore.next(selections);
    this.setState({groupSelections, growlVisible: true, selections, selectedIds});
  }

  selectDeceased() {
    const param = {
      id: null,
      parentId: null,
      parameterId: '',
      type: CriteriaType.DECEASED.toString(),
      name: 'Deceased',
      group: false,
      domainId: DomainType.PERSON.toString(),
      hasAttributes: false,
      selectable: true,
      attributes: []
    } as Selection;
    saveCriteria([param]);
  }

  get showDataBrowserLink() {
    return [DomainType.CONDITION, DomainType.PROCEDURE, DomainType.MEASUREMENT, DomainType.DRUG]
    .includes(this.props.cohortContext.domain);
  }

  render() {
    const {cohortContext} = this.props;
    const {autocompleteSelection, count, groupSelections, growlVisible, hierarchyNode, loadingSubtree, selectedIds, selections, title,
      treeSearchTerms} = this.state;
    return !!cohortContext && <FlexRowWrap style={styles.searchContainer}>
      <style>
        {css}
      </style>
      <div id='cohort-search-container' style={styles.searchContent}>
        <Growl ref={(el) => this.growl = el} style={!growlVisible ? {...styles.growl, display: 'none'} : styles.growl}/>
        <div style={styles.titleBar}>
          <Clickable style={styles.backArrow} onClick={() => this.closeSearch()}>
            <img src={arrowIcon} style={styles.arrowIcon} alt='Go back' />
          </Clickable>
          <h2 style={styles.titleHeader}>{title}</h2>
          <div style={styles.externalLinks}>
            {cohortContext.domain === DomainType.DRUG && <div>
              <StyledAnchorTag
                  href='https://mor.nlm.nih.gov/RxNav/'
                  target='_blank'
                  rel='noopener noreferrer'>
                Explore
              </StyledAnchorTag>
              &nbsp;drugs by brand names outside of <AoU/>.
            </div>}
            {this.showDataBrowserLink && <div>
              Explore Source information on the&nbsp;
              <StyledAnchorTag
                  href={environment.publicUiUrl}
                  target='_blank'
                  rel='noopener noreferrer'>
                Data Browser.
              </StyledAnchorTag>
            </div>}
          </div>
        </div>
        <div style={
          (cohortContext.domain === DomainType.PERSON && cohortContext.type !== CriteriaType.AGE)
            ? {marginBottom: '3.5rem'}
            : {height: 'calc(100% - 3.5rem)'}
        }>
          {cohortContext.domain === DomainType.PERSON ? <div style={{flex: 1, overflow: 'auto'}}>
              <DemographicsV2
                count={count}
                criteriaType={cohortContext.type}
                select={this.addSelection}
                selectedIds={selectedIds}
                selections={selections}/>
            </div>
            : <React.Fragment>
              {loadingSubtree && <SpinnerOverlay/>}
              <div style={loadingSubtree ? {height: '100%', pointerEvents: 'none', opacity: 0.3} : {height: '100%'}}>
                {/* Tree View */}
                <div style={this.searchContentStyle('tree')}>
                  {hierarchyNode && <CriteriaTree
                      autocompleteSelection={autocompleteSelection}
                      back={this.back}
                      groupSelections={groupSelections}
                      node={hierarchyNode}
                      scrollToMatch={this.setScroll}
                      searchTerms={treeSearchTerms}
                      select={this.addSelection}
                      selectedIds={selectedIds}
                      selectOption={this.setAutocompleteSelection}
                      setSearchTerms={this.setTreeSearchTerms}/>}
                </div>
                {/* List View (using duplicated version of ListSearch) */}
                <div style={this.searchContentStyle('list')}>
                  <ListSearchV2 hierarchy={this.showHierarchy}
                              searchContext={cohortContext}
                              select={this.addSelection}
                              selectedIds={selectedIds}/>
                </div>
              </div>
            </React.Fragment>}
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
