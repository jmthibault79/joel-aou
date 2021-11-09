#!/bin/bash

# This script does the following
#   create and populate all prep_* tables.
#   create empty cb_* tables (criteria_* and survey_*)
echo "-----------------------------------------------------------"
echo "Started prep-tables at "`date`
echo "PID "$$

set -e
# vars are purposely hard-coded for iterative testing
export BQ_PROJECT=$1       # project - 'all-of-us-ehr-dev'
export BQ_DATASET=$2       # dataset - 'BillDummyMult'

echo "Using run-type: mult, Dataset: $BQ_DATASET"
echo ""
################################################
# CREATE EMPTY CB_CRITERIA RELATED TABLES
################################################
function timeIt(){
  local e=$((SECONDS - $1))
  echo "$e"
}
function createReplaceEmptyTables() {
    for table in "${empty_tables[@]}"
    do
      (bq rm -f --project_id=$BQ_PROJECT $BQ_DATASET.$table
       bq mk --project_id=$BQ_PROJECT $BQ_DATASET.$table ../../bq-schemas/$table.json) &
       pids[${i}]=$!
    done
    for pid in "${pids[@]}" ; do
      wait $pid
    done
}

function runScript(){
  source "$1" "$2" "$3"
  echo "Running script $f done in - $(timeIt st_time) secs - total time - $(timeIt main_start) secs"
  echo ""
}
## json schema for empty tables
empty_tables=(
cb_criteria
cb_criteria_ancestor
cb_criteria_attribute
cb_survey_attribute
cb_criteria_relationship
prep_ancestor_staging
prep_concept_ancestor
prep_cpt_ancestor
prep_atc_rel_in_data
prep_loinc_rel_in_data
prep_snomed_rel_cm_in_data
prep_snomed_rel_cm_src_in_data
prep_snomed_rel_meas_in_data
prep_snomed_rel_pcs_in_data
prep_snomed_rel_pcs_src_in_data
)
script_start=$SECONDS
createReplaceEmptyTables
wait
echo "Running scripts done making empty tables for populating data - $(timeIt $script_start) secs"
################################################
# These tables are needed for creating / populating prep_* tables
################################################
# make-bq-prep-concept-merged.sh
#245 - #251 : prep_concept_merged : make-bq-criteria-tables.sh
st_time=$SECONDS
echo "Running script done populate prep_concept_merged..."
../make-bq-prep-concept-merged.sh $BQ_PROJECT $BQ_DATASET
echo "Running script done populating prep_concept_merged - $(timeIt $st_time) secs - total time - $(timeIt script_start) secs"
echo
# make-bq-prep-concept-relationship-merged.sh
#253 - #259 : prep_concept_relationship_merged : make-bq-criteria-tables.sh
st_time=$SECONDS
echo "Running script done populate prep_concept_relationship_merged..."
../make-bq-prep-concept-relationship-merged.sh $BQ_PROJECT $BQ_DATASET
echo "Running scripts done populating prep_concept_relationship_merged - $(timeIt $st_time) secs - total time - $(timeIt script_start) secs"
echo "Running scripts to create and populate prep_* tables started after $(timeIt $script_start) secs"
################################################
# These prep_* tables can be created / populated independently/in-parallel
# as they are not dependent on prep tables from other domain/type(?)
###############################################
## TODO check EXIST required tables?
prep_tables=(
../make-bq-prep-icd10-rel-cm-src-tables.sh
../make-bq-prep-icd10pcs-rel-src-tables.sh
../make-bq-prep-snomed-rel-cm-tables.sh
../make-bq-prep-loinc-rel-tables.sh
../make-bq-prep-snomed-rel-meas-tables.sh
../make-bq-prep-atc-rel-in-data.sh
../make-bq-prep-snomed-rel-pcs-tables.sh
)
for f in "${prep_tables[@]}"; do
  st_time=$SECONDS
  runScript "$f" "$BQ_PROJECT" "$BQ_DATASET" &
  sleep 1
done
# wait for all prep_pids to complete
wait
echo "Running scripts done creating and populating all prep tables for cb_criteria total time $(timeIt script_start) secs"
echo "###########################################################################"
echo "# Running script for cb_criteria main tables....run time reset to 0 secs  #"
echo "###########################################################################"
#source make-cb-criteria-00-main-tables.sh "$BQ_PROJECT" "$BQ_DATASET" "$run_in_parallel"
# vars are purposely hard-coded
#source make-cb-criteria-00-main-tables.sh "$run_in_parallel"
wait
echo "Running all scripts done total time $(timeIt script_start)"
echo ""
echo "Ended prep and main tables at "`date`
echo "-----------------------------------------------------------"
exit 0

