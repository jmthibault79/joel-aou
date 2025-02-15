#!/bin/bash

# This script removes/creates all CDR indices specific tables.

set -e

export BQ_PROJECT=$1         # CDR project
export BQ_DATASET=$2         # CDR dataset

TABLE_LIST=$(bq ls -n 1000 "$BQ_PROJECT:$BQ_DATASET")

INCOMPATIBLE_DATASETS=("R2019Q4R3" "R2019Q4R4" "R2020Q4R3", "R2021Q3R5", "C2021Q2R1", "C2021Q3R6", "R2022Q2R2", "C2022Q2R2")

if [[ ${INCOMPATIBLE_DATASETS[@]} =~ $BQ_DATASET ]];
  then
  echo "Can't run CDR build indices against $BQ_DATASET!"
  exit 1
fi
done_ds_proc_occur=0
schema_path=generate-cdr/bq-schemas
for filename in generate-cdr/bq-schemas/*.json;
do
    json_name=${filename##*/}
    table_name=${json_name%.json}
    if [[ "$table_name" != 'ds_procedure_occurrence_52' ]]
    then
      echo "Deleting $table_name"
      bq --project_id="$BQ_PROJECT" rm -f "$BQ_DATASET.$table_name"
    fi

    if [[ "$table_name" == 'domain_card' ]]
    then
      echo "Skipping domain_card"
      continue
    elif [[ "$table_name" == 'survey_module' ]]
    then
      echo "Skipping survey_module"
      continue
    elif [[ "$table_name" == 'cb_data_filter' ]]
    then
      echo "Skipping cb_data_filter"
      continue
    elif [[ "$table_name" == 'cb_person' ]]
    then
      echo "Skipping cb_person"
      continue
    elif [[ "$table_name" == 'cb_search_all_events' ]]
    then
      echo "Creating $table_name"
      bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" --time_partitioning_type=DAY --clustering_fields concept_id "$BQ_DATASET.$table_name"
    elif [[ "$table_name" == 'cb_review_survey' || "$table_name" == 'cb_search_person' ]]
    then
      echo "Creating $table_name"
      bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" --time_partitioning_type=DAY --clustering_fields person_id "$BQ_DATASET.$table_name"
    elif [[ "$table_name" == 'cb_review_all_events' ]]
    then
      echo "Creating $table_name"
      bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" --time_partitioning_type=DAY --clustering_fields person_id,domain "$BQ_DATASET.$table_name"
    elif [[ "$table_name" == 'ds_zip_code_socioeconomic' ]]
    then
      if [[ "$TABLE_LIST" == *"zip3_ses_map"* ]]
      then
        echo "Creating $table_name"
        bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" "$BQ_DATASET.$table_name"
      fi
    elif [[ "$TABLE_LIST" == *'visit_detail'* && "$table_name" == 'ds_procedure_occurrence' && "$done_ds_proc_occur" == 0 ]]
    then
      echo "Creating $table_name (OMOP v5.3.1)"
      bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" "$BQ_DATASET.$table_name"
      done_ds_proc_occur=1
    elif [[ "$TABLE_LIST" != *'visit_detail'* && "$table_name" == 'ds_procedure_occurrence_52' && "$done_ds_proc_occur" == 0 ]]
    then
      echo "Creating ds_procedure_occurrence (OMOP v5.2) schema:$json_name -> table: ds_procedure_occurrence"
      bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" "$BQ_DATASET.ds_procedure_occurrence"
      done_ds_proc_occur=1
   elif [[ ! $table_name =~ ds_procedure_occurrence|ds_procedure_occurrence_52 ]]
    then
      echo "Creating $table_name"
      bq --quiet --project_id="$BQ_PROJECT" mk --schema="$schema_path/$json_name" "$BQ_DATASET.$table_name"
    fi
done
