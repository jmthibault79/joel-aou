package org.pmiops.workbench.db.dao.projection;

import java.sql.Timestamp;
import org.pmiops.workbench.model.BillingAccountType;
import org.pmiops.workbench.model.BillingStatus;

public interface ProjectedReportingWorkspace {
  BillingAccountType getBillingAccountType();

  BillingStatus getBillingStatus();

  Long getCdrVersionId();

  Timestamp getCreationTime();

  Long getCreatorId();

  String getDisseminateResearchOther();

  Timestamp getLastAccessedTime();

  Timestamp getLastModifiedTime();

  String getName();

  Short getNeedsRpReviewPrompt();

  Boolean getPublished();

  String getRpAdditionalNotes();

  Boolean getRpAncestry();

  String getRpAnticipatedFindings();

  Boolean getRpApproved();

  Boolean getRpCommercialPurpose();

  Boolean getRpControlSet();

  Boolean getRpDiseaseFocusedResearch();

  String getRpDiseaseOfFocus();

  Boolean getRpDrugDevelopment();

  Boolean getRpEducational();

  Boolean getRpEthics();

  String getRpIntendedStudy();

  Boolean getRpMethodsDevelopment();

  String getRpOtherPopulationDetails();

  Boolean getRpOtherPurpose();

  String getRpOtherPurposeDetails();

  Boolean getRpPopulationHealth();

  String getRpReasonForAllOfUs();

  Boolean getRpReviewRequested();

  String getRpScientificApproach();

  Boolean getRpSocialBehavioral();

  Timestamp getRpTimeRequested();

  Long getWorkspaceId();
}
