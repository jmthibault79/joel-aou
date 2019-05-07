package org.pmiops.workbench.api;

import com.google.cloud.bigquery.FieldValue;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;
import com.google.common.base.Strings;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.Iterables;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import javax.inject.Provider;

import org.pmiops.workbench.cdr.CdrVersionService;
import org.pmiops.workbench.cdr.cache.GenderRaceEthnicityConcept;
import org.pmiops.workbench.cdr.dao.CBCriteriaAttributeDao;
import org.pmiops.workbench.cdr.dao.CBCriteriaDao;
import org.pmiops.workbench.cdr.dao.CriteriaAttributeDao;
import org.pmiops.workbench.cdr.dao.CriteriaDao;
import org.pmiops.workbench.cdr.model.CBCriteria;
import org.pmiops.workbench.cdr.model.CBCriteriaAttribute;
import org.pmiops.workbench.cdr.model.Criteria;
import org.pmiops.workbench.cdr.model.CriteriaAttribute;
import org.pmiops.workbench.cdr.model.StandardProjection;
import org.pmiops.workbench.cohortbuilder.ParticipantCounter;
import org.pmiops.workbench.cohortbuilder.ParticipantCriteria;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.db.dao.CdrVersionDao;
import org.pmiops.workbench.db.model.CdrVersion;
import org.pmiops.workbench.elasticsearch.ElasticSearchService;
import org.pmiops.workbench.exceptions.BadRequestException;
import org.pmiops.workbench.model.ConceptIdName;
import org.pmiops.workbench.model.CriteriaAttributeListResponse;
import org.pmiops.workbench.model.CriteriaListResponse;
import org.pmiops.workbench.model.CriteriaType;
import org.pmiops.workbench.model.DemoChartInfo;
import org.pmiops.workbench.model.DemoChartInfoListResponse;
import org.pmiops.workbench.model.DomainType;
import org.pmiops.workbench.model.ParticipantCohortStatusColumns;
import org.pmiops.workbench.model.ParticipantDemographics;
import org.pmiops.workbench.model.SearchGroup;
import org.pmiops.workbench.model.SearchParameter;
import org.pmiops.workbench.model.SearchRequest;
import org.pmiops.workbench.model.TreeSubType;
import org.pmiops.workbench.model.TreeType;
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
  private static final String DOMAIN_MESSAGE = "Bad Request: Please provide a valid criteria domain. %s is not valid.";
  private static final String TYPE_MESSAGE = "Bad Request: Please provide a valid criteria type. %s is not valid.";

  private BigQueryService bigQueryService;
  private ParticipantCounter participantCounter;
  private CriteriaDao criteriaDao;
  private CBCriteriaDao cbCriteriaDao;
  private CriteriaAttributeDao criteriaAttributeDao;
  private CBCriteriaAttributeDao cbCriteriaAttributeDao;
  private CdrVersionDao cdrVersionDao;
  private Provider<GenderRaceEthnicityConcept> genderRaceEthnicityConceptProvider;
  private CdrVersionService cdrVersionService;
  private ElasticSearchService elasticSearchService;
  private Provider<WorkbenchConfig> configProvider;

  /**
   * Converter function from backend representation (used with Hibernate) to
   * client representation (generated by Swagger).
   */
  //TODO:Remove freemabd
  private static final Function<Criteria, org.pmiops.workbench.model.Criteria>
    TO_CLIENT_CRITERIA =
    new Function<Criteria, org.pmiops.workbench.model.Criteria>() {
      @Override
      public org.pmiops.workbench.model.Criteria apply(Criteria criteria) {
        return new org.pmiops.workbench.model.Criteria()
          .id(criteria.getId())
          .parentId(criteria.getParentId())
          .type(criteria.getType())
          .subtype(criteria.getSubtype())
          .code(criteria.getCode())
          .name(criteria.getName())
          .count(StringUtils.isEmpty(criteria.getCount()) ? null : new Long(criteria.getCount()))
          .group(criteria.getGroup())
          .selectable(criteria.getSelectable())
          .conceptId(StringUtils.isEmpty(criteria.getConceptId()) ? null : new Long(criteria.getConceptId()))
          .domainId(criteria.getDomainId())
          .hasAttributes(criteria.getAttribute())
          .path(criteria.getPath());
      }
    };

  /**
   * Converter function from backend representation (used with Hibernate) to
   * client representation (generated by Swagger).
   */
  private static final Function<CBCriteria, org.pmiops.workbench.model.Criteria>
    TO_CLIENT_CBCRITERIA =
    new Function<CBCriteria, org.pmiops.workbench.model.Criteria>() {
      @Override
      public org.pmiops.workbench.model.Criteria apply(CBCriteria cbCriteria) {
        return new org.pmiops.workbench.model.Criteria()
          .id(cbCriteria.getId())
          .parentId(cbCriteria.getParentId())
          .type(cbCriteria.getType())
          .subtype(cbCriteria.getSubtype())
          .code(cbCriteria.getCode())
          .name(cbCriteria.getName())
          .count(StringUtils.isEmpty(cbCriteria.getCount()) ? null : new Long(cbCriteria.getCount()))
          .group(cbCriteria.getGroup())
          .selectable(cbCriteria.getSelectable())
          .conceptId(StringUtils.isEmpty(cbCriteria.getConceptId()) ? null : new Long(cbCriteria.getConceptId()))
          .domainId(cbCriteria.getDomainId())
          .hasAttributes(cbCriteria.getAttribute())
          .path(cbCriteria.getPath())
          .hasAncestorData(cbCriteria.getAncestorData())
          .hasHierarchy(cbCriteria.getHierarchy())
          .isStandard(cbCriteria.getStandard())
          .value(cbCriteria.getValue());
      }
    };

  /**
   * Converter function from backend representation (used with Hibernate) to
   * client representation (generated by Swagger).
   */
  //TODO:Remove freemabd
  private static final Function<CriteriaAttribute, org.pmiops.workbench.model.CriteriaAttribute>
    TO_CLIENT_CRITERIA_ATTRIBUTE =
    new Function<CriteriaAttribute, org.pmiops.workbench.model.CriteriaAttribute>() {
      @Override
      public org.pmiops.workbench.model.CriteriaAttribute apply(CriteriaAttribute criteria) {
        return new org.pmiops.workbench.model.CriteriaAttribute()
          .id(criteria.getId())
          .valueAsConceptId(criteria.getValueAsConceptId())
          .conceptName(criteria.getConceptName())
          .type(criteria.getType())
          .estCount(criteria.getEstCount());
      }
    };

  /**
   * Converter function from backend representation (used with Hibernate) to
   * client representation (generated by Swagger).
   */
  private static final Function<CBCriteriaAttribute, org.pmiops.workbench.model.CriteriaAttribute>
    TO_CLIENT_CBCRITERIA_ATTRIBUTE =
    new Function<CBCriteriaAttribute, org.pmiops.workbench.model.CriteriaAttribute>() {
      @Override
      public org.pmiops.workbench.model.CriteriaAttribute apply(CBCriteriaAttribute cbCriteria) {
        return new org.pmiops.workbench.model.CriteriaAttribute()
          .id(cbCriteria.getId())
          .valueAsConceptId(cbCriteria.getValueAsConceptId())
          .conceptName(cbCriteria.getConceptName())
          .type(cbCriteria.getType())
          .estCount(cbCriteria.getEstCount());
      }
    };

  @Autowired
  CohortBuilderController(BigQueryService bigQueryService,
                          ParticipantCounter participantCounter,
                          CriteriaDao criteriaDao,
                          CBCriteriaDao cbCriteriaDao,
                          CriteriaAttributeDao criteriaAttributeDao,
                          CBCriteriaAttributeDao cbCriteriaAttributeDao,
                          CdrVersionDao cdrVersionDao,
                          Provider<GenderRaceEthnicityConcept> genderRaceEthnicityConceptProvider,
                          CdrVersionService cdrVersionService,
                          ElasticSearchService elasticSearchService,
                          Provider<WorkbenchConfig> configProvider) {
    this.bigQueryService = bigQueryService;
    this.participantCounter = participantCounter;
    this.criteriaDao = criteriaDao;
    this.cbCriteriaDao = cbCriteriaDao;
    this.criteriaAttributeDao = criteriaAttributeDao;
    this.cbCriteriaAttributeDao = cbCriteriaAttributeDao;
    this.cdrVersionDao = cdrVersionDao;
    this.genderRaceEthnicityConceptProvider = genderRaceEthnicityConceptProvider;
    this.cdrVersionService = cdrVersionService;
    this.elasticSearchService = elasticSearchService;
    this.configProvider = configProvider;
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getCriteriaAutoComplete(Long cdrVersionId,
                                                                      String domain,
                                                                      String term,
                                                                      String type,
                                                                      Boolean standard,
                                                                      Long limit) {
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));
    Long resultLimit = Optional.ofNullable(limit).orElse(DEFAULT_TREE_SEARCH_LIMIT);
    String matchExp = modifyKeywordMatch(term, domain);
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    if (configProvider.get().cohortbuilder.enableListSearch) {
      validateDomainAndType(domain, type);
      String domainRank = "+[" + domain.toLowerCase() + "_rank1]";
      List<CBCriteria> criteriaList = cbCriteriaDao.findCriteriaByDomainAndTypeAndStandardAndSynonyms(domain, type, standard, matchExp, new PageRequest(0, resultLimit.intValue()));
      if (criteriaList.isEmpty()) {
        criteriaList = cbCriteriaDao.findCriteriaByDomainAndTypeAndStandardAndCode(domain, type, standard, term, domainRank, new PageRequest(0, resultLimit.intValue()));
      }
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    } else {
      List<Criteria> criteriaList;
      if (type == null) {
        criteriaList = criteriaDao.findCriteriaByTypeForCodeOrName(domain, matchExp, term, new PageRequest(0, resultLimit.intValue()));
      } else {
        criteriaList = domain.equals(TreeType.SNOMED.name()) ?
          criteriaDao.findCriteriaByTypeAndSubtypeForName(domain, type, matchExp, new PageRequest(0, resultLimit.intValue())) :
          criteriaDao.findCriteriaByTypeAndSubtypeForCodeOrName(domain, type, matchExp, term, new PageRequest(0, resultLimit.intValue()));
      }
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CRITERIA).collect(Collectors.toList()));
    }

    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getDrugBrandOrIngredientByValue(Long cdrVersionId,
                                                                             String value,
                                                                             Long limit) {
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));
    Long resultLimit = Optional.ofNullable(limit).orElse(DEFAULT_TREE_SEARCH_LIMIT);
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    if (configProvider.get().cohortbuilder.enableListSearch) {
      final List<CBCriteria> criteriaList = cbCriteriaDao.findDrugBrandOrIngredientByValue(value, resultLimit);
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    } else {
      final List<Criteria> criteriaList = criteriaDao.findDrugBrandOrIngredientByValue(value, resultLimit);
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CRITERIA).collect(Collectors.toList()));
    }
    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getDrugIngredientByConceptId(Long cdrVersionId, Long conceptId) {
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    if (configProvider.get().cohortbuilder.enableListSearch) {
      final List<CBCriteria> criteriaList = cbCriteriaDao.findDrugIngredientByConceptId(Arrays.asList(conceptId));
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    } else {
      final List<Criteria> criteriaList = criteriaDao.findDrugIngredientByConceptId(conceptId);
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CRITERIA).collect(Collectors.toList()));
    }
    return ResponseEntity.ok(criteriaResponse);
  }

  /**
   * This method will return a count of unique subjects defined by the provided {@link SearchRequest}.
   */
  @Override
  public ResponseEntity<Long> countParticipants(Long cdrVersionId, SearchRequest request) {
    CdrVersion cdrVersion = cdrVersionDao.findOne(cdrVersionId);
    cdrVersionService.setCdrVersion(cdrVersion);
    if (configProvider.get().elasticsearch.enableElasticsearchBackend &&
        !Strings.isNullOrEmpty(cdrVersion.getElasticIndexBaseName()) && !isApproximate(request)) {
      try {
        return ResponseEntity.ok(elasticSearchService.count(request));
      } catch (IOException e) {
        log.log(Level.SEVERE, "Elastic request failed, falling back to BigQuery", e);
      }
    }
    QueryJobConfiguration qjc = bigQueryService.filterBigQueryConfig(
      participantCounter.buildParticipantCounterQuery(new ParticipantCriteria(request))
    );
    TableResult result = bigQueryService.executeQuery(qjc);
    Map<String, Integer> rm = bigQueryService.getResultMapper(result);
    List<FieldValue> row = result.iterateAll().iterator().next();
    Long count = bigQueryService.getLong(row, rm.get("count"));
    return ResponseEntity.ok(count);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> findCriteriaByDomainAndSearchTerm(Long cdrVersionId,
                                                                                String domain,
                                                                                String term,
                                                                                Long limit) {
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));
    String domainRank = "+[" + domain.toLowerCase() + "_rank1]";
    List<CBCriteria> criteriaList = new ArrayList<>();
    int resultLimit = Optional.ofNullable(limit).orElse(DEFAULT_CRITERIA_SEARCH_LIMIT).intValue();
    List<StandardProjection> projections = cbCriteriaDao.findStandardProjectionByCode(domain, term);
    boolean isStandard = projections.isEmpty() || projections.get(0).getStandard();
    if (projections.isEmpty()) {
      String modTerm = modifyTermMatch(term) + domainRank;
      criteriaList = cbCriteriaDao.findCriteriaByDomainAndSynonyms(domain, isStandard, modTerm, new PageRequest(0, resultLimit));
    }
    if (criteriaList.isEmpty()) {
      criteriaList = cbCriteriaDao.findCriteriaByDomainAndCode(domain, isStandard, term, domainRank, new PageRequest(0, resultLimit));
    }
    if (criteriaList.isEmpty()) {
      criteriaList = cbCriteriaDao.findCriteriaByDomainAndCode(domain, !isStandard, term, domainRank, new PageRequest(0, resultLimit));
    }
    if (DomainType.DRUG.equals(DomainType.fromValue(domain))) {
      Map<Boolean, List<CBCriteria>> groups = criteriaList
        .stream()
        .collect(Collectors.partitioningBy(c -> c.getType().equals(CriteriaType.BRAND.toString())));
      List<Long> conceptIds = groups.get(true)
        .stream()
        .map(c -> Long.valueOf(c.getConceptId()))
        .collect(Collectors.toList());
      List<CBCriteria> ingredients = cbCriteriaDao.findDrugIngredientByConceptId(conceptIds);
      criteriaList = Stream
        .concat(groups.get(false).stream(), ingredients.stream())
        .sorted(Comparator.comparing(CBCriteria::getCount).reversed())
        .collect(Collectors.toList());
    }
    CriteriaListResponse criteriaResponse = new CriteriaListResponse()
      .items(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));

    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<DemoChartInfoListResponse> getDemoChartInfo(Long cdrVersionId, SearchRequest request) {
    DemoChartInfoListResponse response = new DemoChartInfoListResponse();
    CdrVersion cdrVersion = cdrVersionDao.findOne(cdrVersionId);
    cdrVersionService.setCdrVersion(cdrVersion);
    if (configProvider.get().elasticsearch.enableElasticsearchBackend &&
        !Strings.isNullOrEmpty(cdrVersion.getElasticIndexBaseName()) && !isApproximate(request)) {
      try {
        return ResponseEntity.ok(response.items(elasticSearchService.demoChartInfo(request)));
      } catch (IOException e) {
        log.log(Level.SEVERE, "Elastic request failed, falling back to BigQuery", e);
      }
    }
    QueryJobConfiguration qjc = bigQueryService.filterBigQueryConfig(participantCounter.buildDemoChartInfoCounterQuery(
      new ParticipantCriteria(request)));
    TableResult result = bigQueryService.executeQuery(qjc);
    Map<String, Integer> rm = bigQueryService.getResultMapper(result);

    for (List<FieldValue> row : result.iterateAll()) {
      response.addItemsItem(new DemoChartInfo()
        .gender(bigQueryService.getString(row, rm.get("gender")))
        .race(bigQueryService.getString(row, rm.get("race")))
        .ageRange(bigQueryService.getString(row, rm.get("ageRange")))
        .count(bigQueryService.getLong(row, rm.get("count"))));
    }
    return ResponseEntity.ok(response);
  }

  @Override
  public ResponseEntity<CriteriaAttributeListResponse> getCriteriaAttributeByConceptId(Long cdrVersionId, Long conceptId) {
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));
    CriteriaAttributeListResponse criteriaAttributeResponse = new CriteriaAttributeListResponse();
    if (configProvider.get().cohortbuilder.enableListSearch) {
      final List<CBCriteriaAttribute> criteriaAttributeList = cbCriteriaAttributeDao.findCriteriaAttributeByConceptId(conceptId);
      criteriaAttributeResponse.setItems(criteriaAttributeList.stream().map(TO_CLIENT_CBCRITERIA_ATTRIBUTE).collect(Collectors.toList()));
    } else {
      //TODO:Remove freemabd
      final List<CriteriaAttribute> criteriaAttributeList = criteriaAttributeDao.findCriteriaAttributeByConceptId(conceptId);
      criteriaAttributeResponse.setItems(criteriaAttributeList.stream().map(TO_CLIENT_CRITERIA_ATTRIBUTE).collect(Collectors.toList()));
    }
    return ResponseEntity.ok(criteriaAttributeResponse);
  }

  @Override
  public ResponseEntity<CriteriaListResponse> getCriteriaBy(Long cdrVersionId,
                                                            String domain,
                                                            String type,
                                                            Long parentId) {
    CriteriaListResponse criteriaResponse = new CriteriaListResponse();
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));

    if (configProvider.get().cohortbuilder.enableListSearch) {
      String domainMessage = "Bad Request: Please provide a valid criteria domain. %s is not valid.";
      String typeMessage = "Bad Request: Please provide a valid criteria type. %s is not valid.";
      validateDomainAndType(domain, type);

      List<CBCriteria> criteriaList;
      if (parentId != null) {
        criteriaList = cbCriteriaDao.findCriteriaByDomainIdAndTypeAndParentIdOrderByIdAsc(domain, type, parentId);
      } else {
        criteriaList = cbCriteriaDao.findCriteriaByDomainAndTypeOrderByIdAsc(domain, type);
      }
      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CBCRITERIA).collect(Collectors.toList()));
    } else {
      //TODO:Remove freemabd
      Optional.ofNullable(domain)
        .orElseThrow(() -> new BadRequestException(String.format("Bad Request: Please provide a valid criteria type. %s is not valid.", domain)));
      Arrays
        .stream(TreeType.values())
        .filter(treeType -> treeType.name().equalsIgnoreCase(domain))
        .findFirst()
        .orElseThrow(() -> new BadRequestException(String.format("Bad Request: Please provide a valid criteria type. %s is not valid.", domain)));
      Optional.ofNullable(type)
        .ifPresent(st -> Arrays
          .stream(TreeSubType.values())
          .filter(treeSubType -> treeSubType.name().equalsIgnoreCase(st))
          .findFirst()
          .orElseThrow(() -> new BadRequestException(String.format("Bad Request: Please provide a valid criteria subtype. %s is not valid.", st))));

      List<Criteria> criteriaList;
      if (parentId != null) {
        if (type != null) {
          criteriaList = criteriaDao.findCriteriaByTypeAndSubtypeAndParentIdOrderByIdAsc(domain, type, parentId);
        } else {
          criteriaList = criteriaDao.findCriteriaByTypeAndParentIdOrderByIdAsc(domain, parentId);
        }
      } else if (type != null) {
        criteriaList = criteriaDao.findCriteriaByTypeAndSubtypeOrderByIdAsc(domain, type);
      } else {
        criteriaList = criteriaDao.findCriteriaByType(domain);
      }

      criteriaResponse.setItems(criteriaList.stream().map(TO_CLIENT_CRITERIA).collect(Collectors.toList()));
    }

    return ResponseEntity.ok(criteriaResponse);
  }

  @Override
  public ResponseEntity<ParticipantDemographics> getParticipantDemographics(Long cdrVersionId) {
    cdrVersionService.setCdrVersion(cdrVersionDao.findOne(cdrVersionId));

    Map<String, Map<Long, String>> concepts = genderRaceEthnicityConceptProvider.get().getConcepts();
    List<ConceptIdName> genderList = concepts.get(ParticipantCohortStatusColumns.GENDER.name()).entrySet().stream()
      .map(e -> new ConceptIdName().conceptId(e.getKey()).conceptName(e.getValue()))
      .collect(Collectors.toList());
    List<ConceptIdName> raceList = concepts.get(ParticipantCohortStatusColumns.RACE.name()).entrySet().stream()
      .map(e -> new ConceptIdName().conceptId(e.getKey()).conceptName(e.getValue()))
      .collect(Collectors.toList());
    List<ConceptIdName> ethnicityList = concepts.get(ParticipantCohortStatusColumns.ETHNICITY.name()).entrySet().stream()
      .map(e -> new ConceptIdName().conceptId(e.getKey()).conceptName(e.getValue()))
      .collect(Collectors.toList());

    ParticipantDemographics participantDemographics =
      new ParticipantDemographics().genderList(genderList).raceList(raceList).ethnicityList(ethnicityList);
    return ResponseEntity.ok(participantDemographics);
  }

  /**
   * This method helps determine what request can only be approximated by elasticsearch
   * and must fallback to the BQ implementation.
   *
   * @param request
   * @return
   */
  protected boolean isApproximate(SearchRequest request) {
    List<SearchGroup> allGroups = ImmutableList.copyOf(
        Iterables.concat(request.getIncludes(), request.getExcludes()));
    List<SearchParameter> allParams = allGroups.stream()
        .flatMap(sg -> sg.getItems().stream())
        .flatMap(sgi -> sgi.getSearchParameters().stream())
        .collect(Collectors.toList());
    //currently elasticsearch doesn't implement Temporal/BP/DEC
    return allGroups.stream().anyMatch(sg -> sg.getTemporal())
      || allParams.stream()
        .anyMatch(sp -> TreeSubType.BP.toString().equals(sp.getSubtype()) || TreeSubType.DEC.toString().equals(sp.getSubtype()))
      || allParams.stream()
        // TODO(RW-2404): Support these queries.
        .anyMatch(sp -> TreeType.DRUG.toString().equals(sp.getType()));
  }

  //TODO:Remove freemabd
  private String modifyKeywordMatch(String value, String type) {
    if (value == null || value.trim().isEmpty()) {
      throw new BadRequestException(
        String.format("Bad Request: Please provide a valid search term: \"%s\" is not valid.", value));
    }
    String[] keywords = value.split("\\W+");
    if (keywords.length == 1 && keywords[0].length() <= 3) {
      return "+\"" + keywords[0] + "\"+\"[rank1]\"";
    }
    String rank1 = TreeType.PPI.name().equals(type) ? "" : "+\"[rank1]\"";

    return IntStream
      .range(0, keywords.length)
      .filter(i -> keywords[i].length() > 2)
      .mapToObj(i -> {
        if ((i + 1) != keywords.length) {
          return "+\"" + keywords[i] + "\"";
        }
        return "+" + keywords[i] + "*";
      })
      .collect(Collectors.joining())
      + rank1;
  }

  private String modifyTermMatch(String term) {
    if (term == null || term.trim().isEmpty()) {
      throw new BadRequestException(
        String.format("Bad Request: Please provide a valid search term: \"%s\" is not valid.", term));
    }
    String[] keywords = term.split("\\W+");
    if (keywords.length == 1 && keywords[0].length() <= 3) {
      return "+\"" + keywords[0];
    }

    return IntStream
      .range(0, keywords.length)
      .filter(i -> keywords[i].length() > 2)
      .mapToObj(i -> {
        if ((i + 1) != keywords.length) {
          return "+\"" + keywords[i] + "\"";
        }
        return "+" + keywords[i] + "*";
      })
      .collect(Collectors.joining());
  }

  private void validateDomainAndType(String domain, String type) {
    Optional
      .ofNullable(domain)
      .orElseThrow(() -> new BadRequestException(String.format(DOMAIN_MESSAGE, domain)));
    Optional
      .ofNullable(type)
      .orElseThrow(() -> new BadRequestException(String.format(TYPE_MESSAGE, type)));
    Arrays
      .stream(DomainType.values())
      .filter(domainType -> domainType.toString().equalsIgnoreCase(domain))
      .findFirst()
      .orElseThrow(() -> new BadRequestException(String.format(DOMAIN_MESSAGE, domain)));
    Optional.ofNullable(type)
      .ifPresent(t -> Arrays
        .stream(CriteriaType.values())
        .filter(critType -> critType.toString().equalsIgnoreCase(t))
        .findFirst()
        .orElseThrow(() -> new BadRequestException(String.format(TYPE_MESSAGE, t))));
  }

}
