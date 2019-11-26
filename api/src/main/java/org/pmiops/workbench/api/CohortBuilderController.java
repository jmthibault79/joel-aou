package org.pmiops.workbench.api;

import com.google.cloud.bigquery.FieldValue;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import com.google.common.base.Strings;
import com.google.common.collect.ArrayListMultimap;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Iterables;
import com.google.common.collect.ListMultimap;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import javax.inject.Provider;
import org.pmiops.workbench.cdr.CdrVersionService;
import org.pmiops.workbench.cdr.dao.CBCriteriaAttributeDao;
import org.pmiops.workbench.cdr.dao.CBCriteriaDao;
import org.pmiops.workbench.cdr.model.DbCriteria;
import org.pmiops.workbench.cdr.model.DbCriteriaAttribute;
import org.pmiops.workbench.cdr.model.DbMenuOption;
import org.pmiops.workbench.cohortbuilder.CohortQueryBuilder;
import org.pmiops.workbench.cohortbuilder.ParticipantCriteria;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.db.model.DbCdrVersion;
import org.pmiops.workbench.elasticsearch.ElasticSearchService;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.model.ConceptIdName;
import org.pmiops.workbench.model.Criteria;
import org.pmiops.workbench.model.CriteriaAttribute;
import org.pmiops.workbench.model.CriteriaAttributeListResponse;
import org.pmiops.workbench.model.CriteriaListResponse;
import org.pmiops.workbench.model.CriteriaMenuOption;
import org.pmiops.workbench.model.CriteriaMenuOptionsListResponse;
import org.pmiops.workbench.model.CriteriaMenuSubOption;
import org.pmiops.workbench.model.CriteriaSubType;
import org.pmiops.workbench.model.CriteriaType;
import org.pmiops.workbench.model.DemoChartInfo;
import org.pmiops.workbench.model.DemoChartInfoListResponse;
import org.pmiops.workbench.model.DomainType;
import org.pmiops.workbench.model.FilterColumns;
import org.pmiops.workbench.model.ParticipantDemographics;
import org.pmiops.workbench.model.SearchGroup;
import org.pmiops.workbench.model.SearchParameter;
import org.pmiops.workbench.model.SearchRequest;
import org.pmiops.workbench.model.StandardFlag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CohortBuilderController implements CohortBuilderApiDelegate {

  private static final Logger log = Logger.getLogger(CohortBuilderController.class.getName());
  private static final Long DEFAULT_TREE_SEARCH_LIMIT = 100L;
  private static final Long DEFAULT_CRITERIA_SEARCH_LIMIT = 250L;
  private static final String BAD_REQUEST_MESSAGE =
      "Bad Request: Please provide a valid %s. %s is not valid.";

  private BigQueryService bigQueryService;
  private CohortQueryBuilder cohortQueryBuilder;
  private CBCriteriaDao cbCriteriaDao;
  private CBCriteriaAttributeDao cbCriteriaAttributeDao;
  private CdrVersionService cdrVersionService;
  private ElasticSearchService elasticSearchService;
  private Provider<WorkbenchConfig> configProvider;

  /**
   * Converter function from backend representation (used with Hibernate) to client representation
   * (generated by Swagger).
   */
  private static final Function<DbCriteria, Criteria> TO_CLIENT_CBCRITERIA =
      cbCriteria ->
          new Criteria()
              .id(cbCriteria.getId())
              .parentId(cbCriteria.getParentId())
              .type(cbCriteria.getType())
              .subtype(cbCriteria.getSubtype())
              .code(cbCriteria.getCode())
              .name(cbCriteria.getName())
              .count(
                  StringUtils.isEmpty(cbCriteria.getCount())
                      ? null
                      : new Long(cbCriteria.getCount()))
              .group(cbCriteria.getGroup())
              .selectable(cbCriteria.getSelectable())
              .conceptId(
                  StringUtils.isEmpty(cbCriteria.getConceptId())
                      ? null
                      : new Long(cbCriteria.getConceptId()))
              .domainId(cbCriteria.getDomainId())
              .hasAttributes(cbCriteria.getAttribute())
              .path(cbCriteria.getPath())
              .hasAncestorData(cbCriteria.getAncestorData())
              .hasHierarchy(cbCriteria.getHierarchy())
              .isStandard(cbCriteria.getStandard())
              .value(cbCriteria.getValue());

  /**
   * Converter function from backend representation (used with Hibernate) to client representation
   * (generated by Swagger).
   */
  private static final Function<DbCriteriaAttribute, CriteriaAttribute>
      TO_CLIENT_CBCRITERIA_ATTRIBUTE =
          cbCriteria ->
              new CriteriaAttribute()
                  .id(cbCriteria.getId())
                  .valueAsConceptId(cbCriteria.getValueAsConceptId())
                  .conceptName(cbCriteria.getConceptName())
                  .type(cbCriteria.getType())
                  .estCount(cbCriteria.getEstCount());

  /**
   * Converter function from backend representation (used with Hibernate) to client representation
   * (generated by Swagger).
   */
  private static final BiFunction<String, List<CriteriaMenuSubOption>, CriteriaMenuOption>
      TO_CLIENT_MENU_OPTIONS =
          (domain, types) -> new CriteriaMenuOption().domain(domain).types(types);

  /**
   * Converter function from backend representation (used with Hibernate) to client representation
   * (generated by Swagger).
   */
  private static final BiFunction<String, List<Boolean>, CriteriaMenuSubOption>
      TO_CLIENT_MENU_SUB_OPTIONS =
          (type, standards) ->
              new CriteriaMenuSubOption()
                  .type(type)
                  .standardFlags(
                      standards.stream()
                          .map(s -> new StandardFlag().standard(s))
                          .collect(Collectors.toList()));

  @Autowired
  CohortBuilderController(
      BigQueryService bigQueryService,
      CohortQueryBuilder cohortQueryBuilder,
      CBCriteriaDao cbCriteriaDao,
      CBCriteriaAttributeDao cbCriteriaAttributeDao,
      CdrVersionService cdrVersionService,
      ElasticSearchService elasticSearchService,
      Provider<WorkbenchConfig> configProvider) {
    this.bigQueryService = bigQueryService;
    this.cohortQueryBuilder = cohortQueryBuilder;
    this.cbCriteriaDao = cbCriteriaDao;
    this.cbCriteriaAttributeDao = cbCriteriaAttributeDao;
    this.cdrVersionService = cdrVersionService;
    this.elasticSearchService = elasticSearchService;
    this.configProvider = configProvider;
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getCriteriaAutoComplete(
      Long cdrVersionId, String domain, String term, String type, Boolean standard, Long limit) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    Long resultLimit = Optional.ofNullable(limit).orElse(DEFAULT_TREE_SEARCH_LIMIT);
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    validateDomainAndType(domain, type);
    String matchExp = modifyTermMatch(term);
    List<DbCriteria> criteriaList =
        cbCriteriaDao.findCriteriaByDomainAndTypeAndStandardAndSynonyms(
            domain, type, standard, matchExp, new PageRequest(0, resultLimit.intValue()));
    if (criteriaList.isEmpty()) {
      criteriaList =
          cbCriteriaDao.findCriteriaByDomainAndTypeAndStandardAndCode(
              domain, type, standard, term, new PageRequest(0, resultLimit.intValue()));
    }
    criteriaResponse.setItems(
        criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));

    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getDrugBrandOrIngredientByValue(
      Long cdrVersionId, String value, Long limit) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    Long resultLimit = Optional.ofNullable(limit).orElse(DEFAULT_TREE_SEARCH_LIMIT);
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    final List<DbCriteria> criteriaList =
        cbCriteriaDao.findDrugBrandOrIngredientByValue(value, resultLimit);
    criteriaResponse.setItems(
        criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getDrugIngredientByConceptId(
      Long cdrVersionId, Long conceptId) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    final List<DbCriteria> criteriaList =
        cbCriteriaDao.findDrugIngredientByConceptId(String.valueOf(conceptId));
    criteriaResponse.setItems(
        criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    return ResponseEntity.ok(criteriaResponse);
  }

  /**
   * This method will return a count of unique subjects defined by the provided {@link
   * SearchRequest}.
   */
  @Override
  public ResponseEntity<Long> countParticipants(Long cdrVersionId, SearchRequest request) {
    DbCdrVersion cdrVersion = cdrVersionService.findAndSetCdrVersion(cdrVersionId);
    if (configProvider.get().elasticsearch.enableElasticsearchBackend
        && !Strings.isNullOrEmpty(cdrVersion.getElasticIndexBaseName())
        && !isApproximate(request)) {
      try {
        return ResponseEntity.ok(elasticSearchService.count(request));
      } catch (IOException e) {
        log.log(Level.SEVERE, "Elastic request failed, falling back to BigQuery", e);
      }
    }
    QueryJobConfiguration qjc =
        bigQueryService.filterBigQueryConfig(
            cohortQueryBuilder.buildParticipantCounterQuery(new ParticipantCriteria(request)));
    TableResult result = bigQueryService.executeQuery(qjc);
    Map<String, Integer> rm = bigQueryService.getResultMapper(result);
    List<FieldValue> row = result.iterateAll().iterator().next();
    Long count = bigQueryService.getLong(row, rm.get("count"));
    return ResponseEntity.ok(count);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> findCriteriaByDomainAndSearchTerm(
      Long cdrVersionId, String domain, String term, Long limit) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    List<DbCriteria> criteriaList;
    int resultLimit = Optional.ofNullable(limit).orElse(DEFAULT_CRITERIA_SEARCH_LIMIT).intValue();
    List<DbCriteria> exactMatchByCode = cbCriteriaDao.findExactMatchByCode(domain, term);
    boolean isStandard = exactMatchByCode.isEmpty() || exactMatchByCode.get(0).getStandard();

    if (!isStandard) {
      criteriaList =
          cbCriteriaDao.findCriteriaByDomainAndTypeAndCode(
              domain,
              exactMatchByCode.get(0).getType(),
              isStandard,
              term,
              new PageRequest(0, resultLimit));

      Map<Boolean, List<DbCriteria>> groups =
          criteriaList.stream().collect(Collectors.partitioningBy(c -> c.getCode().equals(term)));
      criteriaList = groups.get(true);
      criteriaList.addAll(groups.get(false));

    } else {
      criteriaList =
          cbCriteriaDao.findCriteriaByDomainAndCode(
              domain, isStandard, term, new PageRequest(0, resultLimit));
      if (criteriaList.isEmpty() && !term.contains(".")) {
        String modTerm = modifyTermMatch(term);
        criteriaList =
            cbCriteriaDao.findCriteriaByDomainAndSynonyms(
                domain, isStandard, modTerm, new PageRequest(0, resultLimit));
      }
      if (criteriaList.isEmpty() && !term.contains(".")) {
        String modTerm = modifyTermMatch(term);
        criteriaList =
            cbCriteriaDao.findCriteriaByDomainAndSynonyms(
                domain, !isStandard, modTerm, new PageRequest(0, resultLimit));
      }
    }
    CriteriaListResponse criteriaResponse =
        new CriteriaListResponse()
            .items(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));

    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<CriteriaMenuOptionsListResponse> findCriteriaMenuOptions(
      Long cdrVersionId) {
    ListMultimap<String, Boolean> typeToStandardOptionsMap = ArrayListMultimap.create();
    ListMultimap<String, String> domainToTypeOptionsMap = ArrayListMultimap.create();
    List<CriteriaMenuSubOption> returnMenuSubOptions = new ArrayList<>();
    List<CriteriaMenuOption> returnMenuOptions = new ArrayList<>();

    cdrVersionService.setCdrVersion(cdrVersionId);
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
            TO_CLIENT_MENU_SUB_OPTIONS.apply(typeKey, typeToStandardOptionsMap.get(typeKey)));
      }
      returnMenuOptions.add(
          TO_CLIENT_MENU_OPTIONS.apply(
              domainKey,
              returnMenuSubOptions.stream()
                  .sorted(Comparator.comparing(CriteriaMenuSubOption::getType))
                  .collect(Collectors.toList())));
      returnMenuSubOptions.clear();
    }
    CriteriaMenuOptionsListResponse response =
        new CriteriaMenuOptionsListResponse()
            .items(
                returnMenuOptions.stream()
                    .sorted(Comparator.comparing(CriteriaMenuOption::getDomain))
                    .collect(Collectors.toList()));
    return ResponseEntity.ok(response);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getStandardCriteriaByDomainAndConceptId(
      Long cdrVersionId, String domain, Long conceptId) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    // These look ups can be done as one dao call but to make this code testable with the mysql
    // fulltext search match function and H2 in memory database, it's split into 2 separate calls
    // Each call is sub second, so having 2 calls and being testable is better than having one call
    // and it being non-testable.
    List<String> conceptIds =
        cbCriteriaDao.findConceptId2ByConceptId1(conceptId).stream()
            .map(c -> String.valueOf(c))
            .collect(Collectors.toList());
    List<DbCriteria> criteriaList = new ArrayList<>();
    if (!conceptIds.isEmpty()) {
      criteriaList =
          cbCriteriaDao.findStandardCriteriaByDomainAndConceptId(domain, true, conceptIds);
    }
    CriteriaListResponse criteriaResponse =
        new CriteriaListResponse()
            .items(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<DemoChartInfoListResponse> getDemoChartInfo(
      Long cdrVersionId, SearchRequest request) {
    DemoChartInfoListResponse response = new DemoChartInfoListResponse();
    if (request.getIncludes().isEmpty()) {
      return ResponseEntity.ok(response);
    }
    DbCdrVersion cdrVersion = cdrVersionService.findAndSetCdrVersion(cdrVersionId);
    if (configProvider.get().elasticsearch.enableElasticsearchBackend
        && !Strings.isNullOrEmpty(cdrVersion.getElasticIndexBaseName())
        && !isApproximate(request)) {
      try {
        return ResponseEntity.ok(response.items(elasticSearchService.demoChartInfo(request)));
      } catch (IOException e) {
        log.log(Level.SEVERE, "Elastic request failed, falling back to BigQuery", e);
      }
    }
    QueryJobConfiguration qjc =
        bigQueryService.filterBigQueryConfig(
            cohortQueryBuilder.buildDemoChartInfoCounterQuery(new ParticipantCriteria(request)));
    TableResult result = bigQueryService.executeQuery(qjc);
    Map<String, Integer> rm = bigQueryService.getResultMapper(result);

    for (List<FieldValue> row : result.iterateAll()) {
      response.addItemsItem(
          new DemoChartInfo()
              .gender(bigQueryService.getString(row, rm.get("gender")))
              .race(bigQueryService.getString(row, rm.get("race")))
              .ageRange(bigQueryService.getString(row, rm.get("ageRange")))
              .count(bigQueryService.getLong(row, rm.get("count"))));
    }
    return ResponseEntity.ok(response);
  }

  @Override
  public ResponseEntity<CriteriaAttributeListResponse> getCriteriaAttributeByConceptId(
      Long cdrVersionId, Long conceptId) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    CriteriaAttributeListResponse criteriaAttributeResponse = new CriteriaAttributeListResponse();
    final List<DbCriteriaAttribute> criteriaAttributeList =
        cbCriteriaAttributeDao.findCriteriaAttributeByConceptId(conceptId);
    criteriaAttributeResponse.setItems(
        criteriaAttributeList.stream()
            .map(TO_CLIENT_CBCRITERIA_ATTRIBUTE)
            .collect(Collectors.toList()));
    return ResponseEntity.ok(criteriaAttributeResponse);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getCriteriaBy(
      Long cdrVersionId, String domain, String type, Boolean standard, Long parentId) {
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    cdrVersionService.setCdrVersion(cdrVersionId);

    validateDomainAndType(domain, type);

    List<DbCriteria> criteriaList;
    if (parentId != null) {
      criteriaList =
          cbCriteriaDao.findCriteriaByDomainIdAndTypeAndParentIdOrderByIdAsc(
              domain, type, standard, parentId);
    } else {
      criteriaList = cbCriteriaDao.findCriteriaByDomainAndTypeOrderByIdAsc(domain, type);
    }
    criteriaResponse.setItems(
        criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));

    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<ParticipantDemographics> getParticipantDemographics(Long cdrVersionId) {
    cdrVersionService.setCdrVersion(cdrVersionId);
    List<DbCriteria> criteriaList = cbCriteriaDao.findGenderRaceEthnicity();
    List<ConceptIdName> genderList =
        criteriaList.stream()
            .filter(c -> c.getType().equals(FilterColumns.GENDER.toString()))
            .map(
                c ->
                    new ConceptIdName()
                        .conceptId(new Long(c.getConceptId()))
                        .conceptName(c.getName()))
            .collect(Collectors.toList());
    List<ConceptIdName> raceList =
        criteriaList.stream()
            .filter(c -> c.getType().equals(FilterColumns.RACE.toString()))
            .map(
                c ->
                    new ConceptIdName()
                        .conceptId(new Long(c.getConceptId()))
                        .conceptName(c.getName()))
            .collect(Collectors.toList());
    List<ConceptIdName> ethnicityList =
        criteriaList.stream()
            .filter(c -> c.getType().equals(FilterColumns.ETHNICITY.toString()))
            .map(
                c ->
                    new ConceptIdName()
                        .conceptId(new Long(c.getConceptId()))
                        .conceptName(c.getName()))
            .collect(Collectors.toList());

    ParticipantDemographics participantDemographics =
        new ParticipantDemographics()
            .genderList(genderList)
            .raceList(raceList)
            .ethnicityList(ethnicityList);
    return ResponseEntity.ok(participantDemographics);
  }

  /**
   * This method helps determine what request can only be approximated by elasticsearch and must
   * fallback to the BQ implementation.
   *
   * @param request
   * @return
   */
  protected boolean isApproximate(SearchRequest request) {
    List<SearchGroup> allGroups =
        ImmutableList.copyOf(Iterables.concat(request.getIncludes(), request.getExcludes()));
    List<SearchParameter> allParams =
        allGroups.stream()
            .flatMap(sg -> sg.getItems().stream())
            .flatMap(sgi -> sgi.getSearchParameters().stream())
            .collect(Collectors.toList());
    return allGroups.stream().anyMatch(sg -> sg.getTemporal())
        || allParams.stream().anyMatch(sp -> CriteriaSubType.BP.toString().equals(sp.getSubtype()));
  }

  private String modifyTermMatch(String term) {
    if (term == null || term.trim().isEmpty()) {
      throw new BadRequestException(
          String.format(
              "Bad Request: Please provide a valid search term: \"%s\" is not valid.", term));
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

  private void validateDomainAndType(String domain, String type) {
    Optional.ofNullable(domain)
        .orElseThrow(
            () -> new BadRequestException(String.format(BAD_REQUEST_MESSAGE, "domain", domain)));
    Optional.ofNullable(type)
        .orElseThrow(
            () -> new BadRequestException(String.format(BAD_REQUEST_MESSAGE, "type", type)));
    Arrays.stream(DomainType.values())
        .filter(domainType -> domainType.toString().equalsIgnoreCase(domain))
        .findFirst()
        .orElseThrow(
            () -> new BadRequestException(String.format(BAD_REQUEST_MESSAGE, "domain", domain)));
    Optional.ofNullable(type)
        .ifPresent(
            t ->
                Arrays.stream(CriteriaType.values())
                    .filter(critType -> critType.toString().equalsIgnoreCase(t))
                    .findFirst()
                    .orElseThrow(
                        () ->
                            new BadRequestException(
                                String.format(BAD_REQUEST_MESSAGE, "type", t))));
  }
}
