package org.pmiops.workbench.cohortbuilder;

import com.google.common.collect.Table;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.pmiops.workbench.db.model.DbConceptSetConceptId;
import org.pmiops.workbench.model.*;

public interface CohortBuilderService {

  class ConceptIds {

    private final List<Long> standardConceptIds;
    private final List<Long> sourceConceptIds;

    public ConceptIds(List<Long> standardConceptIds, List<Long> sourceConceptIds) {
      this.standardConceptIds = standardConceptIds;
      this.sourceConceptIds = sourceConceptIds;
    }

    public List<Long> getStandardConceptIds() {
      return standardConceptIds;
    }

    public List<Long> getSourceConceptIds() {
      return sourceConceptIds;
    }
  }

  ConceptIds classifyConceptIds(Set<Long> conceptIds);

  List<Criteria> findCriteriaByDomainIdAndConceptIds(
      String domainId, Collection<DbConceptSetConceptId> dbConceptSetConceptIds);

  List<Criteria> findCriteriaByDomainIdAndConceptIds(
      String domainId, Collection<Long> sourceConceptIds, Collection<Long> standardConceptIds);

  Long countParticipants(SearchRequest request);

  List<AgeTypeCount> findAgeTypeCounts();

  List<CohortChartData> findCohortChartData(SearchRequest searchRequest, Domain domain, int limit);

  List<CriteriaAttribute> findCriteriaAttributeByConceptId(Long conceptId);

  List<Criteria> findCriteriaAutoComplete(
      String domain, String term, String type, Boolean standard, Integer limit);

  List<Criteria> findCriteriaAutoCompleteV2(
      String domain, String term, String type, Boolean standard, Integer limit);

  List<Criteria> findCriteriaBy(String domain, String type, Boolean standard, Long parentId);

  CriteriaListWithCountResponse findCriteriaByDomain(
      String domain, String term, String surveyName, Boolean standard, Integer limit);

  CriteriaListWithCountResponse findCriteriaByDomainV2(
      String domain, String term, String surveyName, Boolean standard, Integer limit);

  List<CriteriaMenu> findCriteriaMenuByParentId(long parentId);

  List<DataFilter> findDataFilters();

  List<DemoChartInfo> findDemoChartInfo(
      GenderOrSexType genderOrSexType, AgeType ageType, SearchRequest request);

  List<CardCount> findUniversalDomainCounts(String term);

  List<CardCount> findDomainCounts(String term);

  List<CardCount> findDomainCountsV2(String term);

  List<DomainCard> findDomainCards();

  List<Criteria> findDrugBrandOrIngredientByValue(String value, Integer limit);

  List<Criteria> findDrugIngredientByConceptId(Long conceptId);

  List<EthnicityInfo> findEthnicityInfo(SearchRequest request);

  ParticipantDemographics findParticipantDemographics();

  List<Criteria> findStandardCriteriaByDomainAndConceptId(String domain, Long conceptId);

  /**
   * Build a map that contains all gender/race/ethnicity/sex_at_birth names with the concept id as
   * the key.
   */
  Table<Long, CriteriaType, String> findAllDemographicsMap();

  List<String> findSortedConceptIdsByDomainIdAndType(
      String domainId, String sortColumn, String sortName);

  List<SurveyModule> findSurveyModules();

  List<SurveyVersion> findSurveyVersionByQuestionConceptId(Long questionConceptId);

  List<SurveyVersion> findSurveyVersionByQuestionConceptIdAndAnswerConceptId(
      Long questionConceptId, Long answerConceptId);

  List<Criteria> findVersionedSurveys();
}
