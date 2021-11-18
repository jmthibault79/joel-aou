#!/bin/bash

# This validates that prep tables, cohort builder menu, data dictionary, cope survey versions and whole genome variant tables exist.
set -e

export BQ_PROJECT=$1        # CDR project
export BQ_DATASET=$2        # CDR dataset
export DATA_BROWSER=$3      # data browser flag

schema_path=generate-cdr/bq-schemas
DEPENDENT_TABLES=("activity_summary"
            "concept"
            "concept_ancestor"
            "concept_relationship"
            "concept_synonym"
            "condition_occurrence"
            "condition_occurrence_ext"
            "death"
            "device_exposure"
            "device_exposure_ext"
            "domain"
            "drug_exposure"
            "drug_exposure_ext"
            "heart_rate_minute_level"
            "heart_rate_summary"
            "measurement"
            "measurement_ext"
            "observation"
            "observation_ext"
            "person"
            "procedure_occurrence"
            "procedure_occurrence_ext"
            "relationship"
            "steps_intraday"
            "visit_occurrence"
            "visit_occurrence_ext"
            "vocabulary")
INCOMPATIBLE_DATASETS=("R2019Q4R3" "R2019Q4R4", "R2020Q4R3")

if [[ ${INCOMPATIBLE_DATASETS[@]} =~ $BQ_DATASET ]];
  then
  echo "Can't run CDR build indices against "$BQ_DATASET"!"
  exit 1
fi

if [ "$DATA_BROWSER" == false ]
then
  for table in ${DEPENDENT_TABLES[@]}; do
    echo "Validating that $table exists!"
    tableInfo=$(bq show "$BQ_PROJECT:$BQ_DATASET.$table")
    echo $tableInfo
  done
fi

bq --project_id="$BQ_PROJECT" rm -f "$BQ_DATASET.prep_survey"
bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/prep_survey.json" "$BQ_DATASET.prep_survey"