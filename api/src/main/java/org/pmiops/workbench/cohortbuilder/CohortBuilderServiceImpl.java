package org.pmiops.workbench.cohortbuilder;

import static org.pmiops.workbench.model.FilterColumns.ETHNICITY;
import static org.pmiops.workbench.model.FilterColumns.GENDER;
import static org.pmiops.workbench.model.FilterColumns.RACE;
import static org.pmiops.workbench.model.FilterColumns.SEXATBIRTH;

import com.google.cloud.bigquery.FieldValue;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import com.google.common.collect.ArrayListMultimap;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ListMultimap;
import com.google.common.collect.Ordering;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;
import org.apache.commons.lang3.StringUtils;
import org.jetbrains.annotations.NotNull;
import org.pmiops.workbench.api.BigQueryService;
import org.pmiops.workbench.cdr.dao.CBCriteriaAttributeDao;
import org.pmiops.workbench.cdr.dao.CBCriteriaDao;
import org.pmiops.workbench.cdr.dao.CBDataFilterDao;
import org.pmiops.workbench.cdr.dao.DomainInfoDao;
import org.pmiops.workbench.cdr.dao.PersonDao;
import org.pmiops.workbench.cdr.dao.SurveyModuleDao;
import org.pmiops.workbench.cdr.model.DbCriteria;
import org.pmiops.workbench.cdr.model.DbCriteriaAttribute;
import org.pmiops.workbench.cdr.model.DbMenuOption;
import org.pmiops.workbench.cohortbuilder.mapper.CohortBuilderMapper;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.model.AgeType;
import org.pmiops.workbench.model.AgeTypeCount;
import org.pmiops.workbench.model.ConceptIdName;
import org.pmiops.workbench.model.Criteria;
import org.pmiops.workbench.model.CriteriaAttribute;
import org.pmiops.workbench.model.CriteriaListWithCountResponse;
import org.pmiops.workbench.model.CriteriaMenuOption;
import org.pmiops.workbench.model.CriteriaMenuSubOption;
import org.pmiops.workbench.model.DataFilter;
import org.pmiops.workbench.model.DemoChartInfo;
import org.pmiops.workbench.model.DomainInfo;
import org.pmiops.workbench.model.DomainType;
import org.pmiops.workbench.model.FilterColumns;
import org.pmiops.workbench.model.GenderOrSexType;
import org.pmiops.workbench.model.ParticipantDemographics;
import org.pmiops.workbench.model.SearchRequest;
import org.pmiops.workbench.model.StandardFlag;
import org.pmiops.workbench.model.SurveyModule;
import org.pmiops.workbench.model.SurveyVersion;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class CohortBuilderServiceImpl implements CohortBuilderService {

  private static final Integer DEFAULT_TREE_SEARCH_LIMIT = 100;
  private static final Integer DEFAULT_CRITERIA_SEARCH_LIMIT = 250;
  private static final ImmutableList<String> MYSQL_FULL_TEXT_CHARS =
      ImmutableList.of("\"", "+", "-", "*", "(", ")");

  private BigQueryService bigQueryService;
  private CohortQueryBuilder cohortQueryBuilder;
  private CBCriteriaAttributeDao cbCriteriaAttributeDao;
  private CBCriteriaDao cbCriteriaDao;
  private CBDataFilterDao cbDataFilterDao;
  private DomainInfoDao domainInfoDao;
  private PersonDao personDao;
  private SurveyModuleDao surveyModuleDao;
  private CohortBuilderMapper cohortBuilderMapper;

  @Autowired
  public CohortBuilderServiceImpl(
      BigQueryService bigQueryService,
      CohortQueryBuilder cohortQueryBuilder,
      CBCriteriaAttributeDao cbCriteriaAttributeDao,
      CBCriteriaDao cbCriteriaDao,
      CBDataFilterDao cbDataFilterDao,
      DomainInfoDao domainInfoDao,
      PersonDao personDao,
      SurveyModuleDao surveyModuleDao,
      CohortBuilderMapper cohortBuilderMapper) {
    this.bigQueryService = bigQueryService;
    this.cohortQueryBuilder = cohortQueryBuilder;
    this.cbCriteriaAttributeDao = cbCriteriaAttributeDao;
    this.cbCriteriaDao = cbCriteriaDao;
    this.cbDataFilterDao = cbDataFilterDao;
    this.domainInfoDao = domainInfoDao;
    this.personDao = personDao;
    this.surveyModuleDao = surveyModuleDao;
    this.cohortBuilderMapper = cohortBuilderMapper;
  }

  @Override
  public List<Criteria> findCriteriaByDomainIdAndConceptIds(
      String domainId, Collection<String> conceptIds) {
    return cbCriteriaDao.findCriteriaByDomainIdAndConceptIds(domainId, conceptIds).stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .sorted(Ordering.from(String.CASE_INSENSITIVE_ORDER).onResultOf(Criteria::getName))
        .collect(Collectors.toList());
  }

  @Override
  public Long countParticipants(SearchRequest request) {
    QueryJobConfiguration qjc =
        bigQueryService.filterBigQueryConfig(
            cohortQueryBuilder.buildParticipantCounterQuery(new ParticipantCriteria(request)));
    TableResult result = bigQueryService.executeQuery(qjc);
    Map<String, Integer> rm = bigQueryService.getResultMapper(result);
    List<FieldValue> row = result.iterateAll().iterator().next();
    return bigQueryService.getLong(row, rm.get("count"));
  }

  @Override
  public List<AgeTypeCount> findAgeTypeCounts() {
    return personDao.findAgeTypeCounts().stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public List<CriteriaAttribute> findCriteriaAttributeByConceptId(Long conceptId) {
    List<DbCriteriaAttribute> attributeList =
        cbCriteriaAttributeDao.findCriteriaAttributeByConceptId(conceptId);
    return attributeList.stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public List<Criteria> findCriteriaAutoComplete(
      String domain, String term, String type, Boolean standard, Integer limit) {
    validateSearchTerm(term);
    PageRequest pageRequest =
        new PageRequest(0, Optional.ofNullable(limit).orElse(DEFAULT_TREE_SEARCH_LIMIT));
    List<DbCriteria> criteriaList =
        cbCriteriaDao.findCriteriaByDomainAndTypeAndStandardAndSynonyms(
            domain, type, standard, modifyTermMatch(term), pageRequest);
    if (criteriaList.isEmpty()) {
      criteriaList =
          cbCriteriaDao.findCriteriaByDomainAndTypeAndStandardAndCode(
              domain, type, standard, term, pageRequest);
    }
    return criteriaList.stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public List<Criteria> findCriteriaBy(
      String domain, String type, Boolean standard, Long parentId) {
    List<DbCriteria> criteriaList;
    if (parentId != null) {
      criteriaList =
          cbCriteriaDao.findCriteriaByDomainIdAndTypeAndParentIdOrderByIdAsc(
              domain, type, standard, parentId);
    } else {
      criteriaList = cbCriteriaDao.findCriteriaByDomainAndTypeOrderByIdAsc(domain, type);
    }
    return criteriaList.stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public CriteriaListWithCountResponse findCriteriaByDomainAndSearchTerm(
      String domain, String term, Integer limit) {
    validateSearchTerm(term);
    Page<DbCriteria> dbCriteriaPage;
    PageRequest pageRequest =
        new PageRequest(0, Optional.ofNullable(limit).orElse(DEFAULT_CRITERIA_SEARCH_LIMIT));
    List<DbCriteria> exactMatchByCode = cbCriteriaDao.findExactMatchByCode(domain, term);
    boolean isStandard = exactMatchByCode.isEmpty() || exactMatchByCode.get(0).getStandard();

    if (!isStandard) {
      // source search
      dbCriteriaPage =
          cbCriteriaDao.findCriteriaByDomainAndTypeAndCode(
              domain, exactMatchByCode.get(0).getType(), isStandard, term, pageRequest);
      Map<Boolean, List<DbCriteria>> groups =
          dbCriteriaPage.getContent().stream()
              .collect(Collectors.partitioningBy(c -> c.getCode().equals(term)));
      List<DbCriteria> dbCriteriaList = groups.get(true);
      dbCriteriaList.addAll(groups.get(false));
      return new CriteriaListWithCountResponse()
          .items(
              dbCriteriaList.stream()
                  .map(cohortBuilderMapper::dbModelToClient)
                  .collect(Collectors.toList()))
          .totalCount(dbCriteriaPage.getTotalElements());
    }

    // standard search
    dbCriteriaPage =
        cbCriteriaDao.findCriteriaByDomainAndCode(domain, isStandard, term, pageRequest);
    if (dbCriteriaPage.getContent().isEmpty() && !term.contains(".")) {
      dbCriteriaPage =
          cbCriteriaDao.findCriteriaByDomainAndSynonyms(
              domain, isStandard, modifyTermMatch(term), pageRequest);
    }
    if (dbCriteriaPage.getContent().isEmpty() && !term.contains(".")) {
      dbCriteriaPage =
          cbCriteriaDao.findCriteriaByDomainAndSynonyms(
              domain, !isStandard, modifyTermMatch(term), pageRequest);
    }
    return new CriteriaListWithCountResponse()
        .items(
            dbCriteriaPage.getContent().stream()
                .map(cohortBuilderMapper::dbModelToClient)
                .collect(Collectors.toList()))
        .totalCount(dbCriteriaPage.getTotalElements());
  }

  @Override
  public List<CriteriaMenuOption> findCriteriaMenuOptions() {
    ListMultimap<String, Boolean> typeToStandardOptionsMap = ArrayListMultimap.create();
    ListMultimap<String, String> domainToTypeOptionsMap = ArrayListMultimap.create();
    List<CriteriaMenuSubOption> returnMenuSubOptions = new ArrayList<>();
    List<CriteriaMenuOption> returnMenuOptions = new ArrayList<>();

    List<DbMenuOption> options = cbCriteriaDao.findMenuOptions();

    options.forEach(
        o -> {
          typeToStandardOptionsMap.put(o.getType(), o.getStandard());
          domainToTypeOptionsMap.put(o.getDomain(), o.getType());
        });
    for (String domainKey : domainToTypeOptionsMap.keySet()) {
      List<String> typeList =
          domainToTypeOptionsMap.get(domainKey).stream().distinct().collect(Collectors.toList());
      for (String typeKey : typeList) {
        returnMenuSubOptions.add(
            toClientMenuSubOptions(typeKey, new HashSet<>(typeToStandardOptionsMap.get(typeKey))));
      }
      returnMenuOptions.add(
          toClientMenuOptions(
              domainKey,
              returnMenuSubOptions.stream()
                  .sorted(Comparator.comparing(CriteriaMenuSubOption::getType))
                  .collect(Collectors.toList())));
      returnMenuSubOptions.clear();
    }
    return returnMenuOptions.stream()
        .sorted(Comparator.comparing(CriteriaMenuOption::getDomain))
        .collect(Collectors.toList());
  }

  @Override
  public List<DataFilter> findDataFilters() {
    return StreamSupport.stream(cbDataFilterDao.findAll().spliterator(), false)
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public List<DemoChartInfo> findDemoChartInfo(
      GenderOrSexType genderOrSexType, AgeType ageType, SearchRequest request) {
    QueryJobConfiguration qjc =
        bigQueryService.filterBigQueryConfig(
            cohortQueryBuilder.buildDemoChartInfoCounterQuery(
                new ParticipantCriteria(request, genderOrSexType, ageType)));
    TableResult result = bigQueryService.executeQuery(qjc);
    Map<String, Integer> rm = bigQueryService.getResultMapper(result);

    List<DemoChartInfo> demoChartInfos = new ArrayList<>();
    for (List<FieldValue> row : result.iterateAll()) {
      demoChartInfos.add(
          new DemoChartInfo()
              .name(bigQueryService.getString(row, rm.get("name")))
              .race(bigQueryService.getString(row, rm.get("race")))
              .ageRange(bigQueryService.getString(row, rm.get("ageRange")))
              .count(bigQueryService.getLong(row, rm.get("count"))));
    }
    return demoChartInfos;
  }

  @Override
  public List<DomainInfo> findDomainInfos(String term) {
    ImmutableList<Boolean> standard = ImmutableList.of(true);
    ImmutableList<Boolean> all = ImmutableList.of(true, false);
    String searchTerm = modifyTermMatch(term);
    // read domain infos
    List<DomainInfo> domainInfos =
        domainInfoDao.findByOrderByDomainId().stream()
            .map(cohortBuilderMapper::dbModelToClient)
            .collect(Collectors.toList());
    // read standard concept count
    domainInfos.forEach(
        di ->
            di.setAllConceptCount(
                cbCriteriaDao.findCountByDomainAndStandardAndTerm(
                    di.getDomain().toString(), standard, searchTerm)));
    // read all concept count
    domainInfos.forEach(
        di ->
            di.setAllConceptCount(
                cbCriteriaDao.findCountByDomainAndStandardAndTerm(
                    di.getDomain().toString(), all, searchTerm)));
    return domainInfos;
  }

  @Override
  public List<Criteria> findDrugBrandOrIngredientByValue(String value, Integer limit) {
    List<DbCriteria> criteriaList =
        cbCriteriaDao.findDrugBrandOrIngredientByValue(
            value, Optional.ofNullable(limit).orElse(DEFAULT_TREE_SEARCH_LIMIT));
    return criteriaList.stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public List<Criteria> findDrugIngredientByConceptId(Long conceptId) {
    List<DbCriteria> criteriaList = cbCriteriaDao.findDrugIngredientByConceptId(conceptId);
    return criteriaList.stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public ParticipantDemographics findParticipantDemographics() {
    List<DbCriteria> criteriaList = cbCriteriaDao.findAllDemographics();
    return new ParticipantDemographics()
        .genderList(buildConceptIdNameList(criteriaList, GENDER))
        .raceList(buildConceptIdNameList(criteriaList, RACE))
        .ethnicityList(buildConceptIdNameList(criteriaList, ETHNICITY))
        .sexAtBirthList(buildConceptIdNameList(criteriaList, SEXATBIRTH));
  }

  @Override
  public List<Criteria> findStandardCriteriaByDomainAndConceptId(String domain, Long conceptId) {
    // These look ups can be done as one dao call but to make this code testable with the mysql
    // fulltext search match function and H2 in memory database, it's split into 2 separate calls
    // Each call is sub second, so having 2 calls and being testable is better than having one call
    // and it being non-testable.
    List<String> conceptIds =
        cbCriteriaDao.findConceptId2ByConceptId1(conceptId).stream()
            .map(String::valueOf)
            .collect(Collectors.toList());
    List<DbCriteria> criteriaList = new ArrayList<>();
    if (!conceptIds.isEmpty()) {
      criteriaList =
          cbCriteriaDao.findStandardCriteriaByDomainAndConceptId(domain, true, conceptIds);
    }
    return criteriaList.stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  @Override
  public Map<Long, String> findAllDemographicsMap() {
    return cbCriteriaDao.findAllDemographics().stream()
        .collect(
            Collectors.toMap(
                DbCriteria::getLongConceptId,
                DbCriteria::getName,
                (oldValue, newValue) -> oldValue));
  }

  @Override
  public List<String> findSortedConceptIdsByDomainIdAndTypeAndParentIdNotIn(
      String domainId, Long parentId, String sortColumn, String sortName) {
    Sort sort =
        sortName.equalsIgnoreCase(Sort.Direction.ASC.toString())
            ? new Sort(Sort.Direction.ASC, "name")
            : new Sort(Sort.Direction.DESC, "name");
    List<DbCriteria> criteriaList =
        cbCriteriaDao.findByDomainIdAndTypeAndParentIdNotIn(
            DomainType.PERSON.toString(), sortColumn, 0L, sort);
    List<String> demoList =
        criteriaList.stream()
            .map(
                c ->
                    new ConceptIdName()
                        .conceptId(new Long(c.getConceptId()))
                        .conceptName(c.getName()))
            .sorted(Comparator.comparing(ConceptIdName::getConceptName))
            .map(c -> c.getConceptId().toString())
            .collect(Collectors.toList());
    return demoList;
  }

  @Override
  public List<SurveyModule> findSurveyModules(String term) {
    List<SurveyModule> surveyModules =
        surveyModuleDao.findByParticipantCountNotOrderByOrderNumberAsc(0L).stream()
            .map(cohortBuilderMapper::dbModelToClient)
            .collect(Collectors.toList());
    // read question counts
    surveyModules.forEach(
        sm -> {
          Long criteriaId =
              cbCriteriaDao.findIdByDomainAndConceptIdAndName(
                  DomainType.SURVEY.toString(), sm.getConceptId().toString(), sm.getName());
          sm.setQuestionCount(
              cbCriteriaDao.findQuestionCountByDomainAndIdAndTerm(
                  criteriaId, modifyTermMatch(term)));
        });
    // remove any with zero question counts
    return surveyModules.stream()
        .filter(sm -> sm.getQuestionCount() > 0)
        .collect(Collectors.toList());
  }

  @Override
  public List<SurveyVersion> findSurveyVersionByQuestionConceptId(
      Long surveyConceptId, Long questionConceptId) {
    return findSurveyVersionByQuestionConceptIdAndAnswerConceptId(
        surveyConceptId, questionConceptId, 0L);
  }

  @Override
  public List<SurveyVersion> findSurveyVersionByQuestionConceptIdAndAnswerConceptId(
      Long surveyConceptId, Long questionConceptId, Long answerConceptId) {
    return cbCriteriaDao
        .findSurveyVersionByQuestionConceptIdAndAnswerConceptId(
            surveyConceptId, questionConceptId, answerConceptId)
        .stream()
        .map(cohortBuilderMapper::dbModelToClient)
        .collect(Collectors.toList());
  }

  private void validateSearchTerm(String term) {
    if (StringUtils.isEmpty(term)) {
      throw new BadRequestException(
          String.format(
              "Bad Request: Please provide a valid search term: \"%s\" is not valid.", term));
    }
  }

  private String modifyTermMatch(String term) {
    if (!MYSQL_FULL_TEXT_CHARS.stream()
        .filter(term::contains)
        .collect(Collectors.toList())
        .isEmpty()) {
      return term;
    }

    String[] keywords = term.split("\\W+");
    if (keywords.length == 1 && keywords[0].length() <= 3) {
      return "+\"" + keywords[0];
    }

    return IntStream.range(0, keywords.length)
        .filter(i -> keywords[i].length() > 2)
        .mapToObj(
            i -> {
              if ((i + 1) != keywords.length) {
                return "+\"" + keywords[i] + "\"";
              }
              return "+" + keywords[i] + "*";
            })
        .collect(Collectors.joining());
  }

  @NotNull
  private List<ConceptIdName> buildConceptIdNameList(
      List<DbCriteria> criteriaList, FilterColumns columnName) {
    return criteriaList.stream()
        .filter(c -> columnName.toString().startsWith(c.getType()))
        .map(
            c -> new ConceptIdName().conceptId(new Long(c.getConceptId())).conceptName(c.getName()))
        .collect(Collectors.toList());
  }

  private CriteriaMenuOption toClientMenuOptions(String domain, List<CriteriaMenuSubOption> types) {
    return new CriteriaMenuOption().domain(domain).types(types);
  }

  private CriteriaMenuSubOption toClientMenuSubOptions(String type, Set<Boolean> standards) {
    return new CriteriaMenuSubOption()
        .type(type)
        .standardFlags(
            standards.stream()
                .map(s -> new StandardFlag().standard(s))
                .collect(Collectors.toList()));
  }
}
