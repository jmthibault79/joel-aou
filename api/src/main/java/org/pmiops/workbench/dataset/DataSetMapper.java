package org.pmiops.workbench.dataset;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.pmiops.workbench.db.model.DbDataDictionaryEntry;
import org.pmiops.workbench.db.model.DbDataset;
import org.pmiops.workbench.db.model.DbStorageEnums;
import org.pmiops.workbench.model.DataDictionaryEntry;
import org.pmiops.workbench.model.DataSet;
import org.pmiops.workbench.model.PrePackagedConceptSetEnum;
import org.pmiops.workbench.utils.mappers.CommonMappers;

@Mapper(
    componentModel = "spring",
    uses = {CommonMappers.class})
public interface DataSetMapper {

  // This is a lightweight version of a client mapper that doesn't make any extra db calls for extra
  // data
  @Mapping(target = "id", source = "dataSetId")
  // This is stored as a list of ids. Look those up in the controller for entities
  @Mapping(target = "conceptSets", ignore = true)
  // This is stored as a list of ids. Look those up in the controller for entities
  @Mapping(target = "cohorts", ignore = true)
  // This is stored in a subtable, we may not want to fetch all the time
  @Mapping(target = "domainValuePairs", ignore = true)
  @Mapping(target = "etag", source = "version", qualifiedByName = "cdrVersionToEtag")
  // TODO (RW-4756): Define a DatasetLight type.
  DataSet dbModelToClientLight(DbDataset dbDataset);

  default PrePackagedConceptSetEnum prePackagedConceptSetFromStorage(Short prePackagedConceptSet) {
    return DbStorageEnums.prePackagedConceptSetsFromStorage(prePackagedConceptSet);
  }

  @Mapping(target = "cdrVersionId", source = "dbModel.cdrVersion.cdrVersionId")
  DataDictionaryEntry toApi(DbDataDictionaryEntry dbModel);
}
