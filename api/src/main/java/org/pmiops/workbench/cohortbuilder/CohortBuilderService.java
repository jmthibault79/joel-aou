package org.pmiops.workbench.cohortbuilder;

import java.util.List;
import org.pmiops.workbench.model.AgeTypeCount;
import org.pmiops.workbench.model.Criteria;
import org.pmiops.workbench.model.CriteriaAttribute;
import org.pmiops.workbench.model.DataFilter;
import org.pmiops.workbench.model.ParticipantDemographics;

public interface CohortBuilderService {

  List<AgeTypeCount> findAgeTypeCounts(Long cdrVersionId);

  List<CriteriaAttribute> findCriteriaAttributeByConceptId(Long cdrVersionId, Long conceptId);

  List<Criteria> findCriteriaAutoComplete(
      Long cdrVersionId, String domain, String term, String type, Boolean standard, Integer limit);

  List<Criteria> findCriteriaBy(
      Long cdrVersionId, String domain, String type, Boolean standard, Long parentId);

  List<Criteria> findCriteriaByDomainAndSearchTerm(
      Long cdrVersionId, String domain, String term, Integer limit);

  List<DataFilter> findDataFilters(Long cdrVersionId);

  List<Criteria> findDrugBrandOrIngredientByValue(Long cdrVersionId, String value, Integer limit);

  List<Criteria> findDrugIngredientByConceptId(Long cdrVersionId, Long conceptId);

  ParticipantDemographics findParticipantDemographics(Long cdrVersionId);

  List<Criteria> findStandardCriteriaByDomainAndConceptId(
      Long cdrVersionId, String domain, Long conceptId);
}
