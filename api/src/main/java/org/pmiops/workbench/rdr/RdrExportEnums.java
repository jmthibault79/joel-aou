package org.pmiops.workbench.rdr;

import com.google.common.collect.BiMap;
import com.google.common.collect.ImmutableBiMap;
import org.pmiops.workbench.model.*;

public class RdrExportEnums {

  private static final BiMap<Race, org.pmiops.workbench.rdr.model.Race> CLIENT_TO_RDR_RACE =
      ImmutableBiMap.<Race, org.pmiops.workbench.rdr.model.Race>builder()
          .put(Race.AA, org.pmiops.workbench.rdr.model.Race.AA)
          .put(Race.AIAN, org.pmiops.workbench.rdr.model.Race.AIAN)
          .put(Race.ASIAN, org.pmiops.workbench.rdr.model.Race.ASIAN)
          .put(Race.NHOPI, org.pmiops.workbench.rdr.model.Race.NHOPI)
          .put(Race.WHITE, org.pmiops.workbench.rdr.model.Race.WHITE)
          .put(Race.PREFER_NO_ANSWER, org.pmiops.workbench.rdr.model.Race.PREFER_NOT_TO_ANSWER)
          .put(Race.NONE, org.pmiops.workbench.rdr.model.Race.NONE)
          .build();

  private static final BiMap<Ethnicity, org.pmiops.workbench.rdr.model.Ethnicity>
      CLIENT_TO_RDR_ETHNICITY =
          ImmutableBiMap.<Ethnicity, org.pmiops.workbench.rdr.model.Ethnicity>builder()
              .put(Ethnicity.HISPANIC, org.pmiops.workbench.rdr.model.Ethnicity.HISPANIC)
              .put(Ethnicity.NOT_HISPANIC, org.pmiops.workbench.rdr.model.Ethnicity.NOT_HISPANIC)
              .put(
                  Ethnicity.PREFER_NO_ANSWER,
                  org.pmiops.workbench.rdr.model.Ethnicity.PREFER_NOT_TO_ANSWER)
              .build();

  private static final BiMap<Gender, org.pmiops.workbench.rdr.model.Gender> CLIENT_TO_RDR_GENDER =
      ImmutableBiMap.<Gender, org.pmiops.workbench.rdr.model.Gender>builder()
          .put(Gender.MALE, org.pmiops.workbench.rdr.model.Gender.MALE)
          .put(Gender.FEMALE, org.pmiops.workbench.rdr.model.Gender.FEMALE)
          .put(Gender.NON_BINARY, org.pmiops.workbench.rdr.model.Gender.NON_BINARY)
          .put(Gender.TRANSGENDER, org.pmiops.workbench.rdr.model.Gender.TRANSGENDER)
          .put(Gender.INTERSEX, org.pmiops.workbench.rdr.model.Gender.INTERSEX)
          .put(Gender.NONE, org.pmiops.workbench.rdr.model.Gender.NONE)
          .put(Gender.PREFER_NO_ANSWER, org.pmiops.workbench.rdr.model.Gender.PREFER_NOT_TO_ANSWER)
          .build();

  private static final BiMap<Education, org.pmiops.workbench.rdr.model.Education>
      CLIENT_TO_RDR_EDUCATION =
          ImmutableBiMap.<Education, org.pmiops.workbench.rdr.model.Education>builder()
              .put(Education.NO_EDUCATION, org.pmiops.workbench.rdr.model.Education.NO_EDUCATION)
              .put(Education.GRADES_1_12, org.pmiops.workbench.rdr.model.Education.GRADES_1_12)
              .put(
                  Education.COLLEGE_GRADUATE,
                  org.pmiops.workbench.rdr.model.Education.COLLEGE_GRADUATE)
              .put(Education.UNDERGRADUATE, org.pmiops.workbench.rdr.model.Education.UNDERGRADUATE)
              .put(Education.MASTER, org.pmiops.workbench.rdr.model.Education.MASTER)
              .put(Education.DOCTORATE, org.pmiops.workbench.rdr.model.Education.DOCTORATE)
              .build();

  private static final BiMap<SexAtBirth, org.pmiops.workbench.rdr.model.SexAtBirth>
      CLIENT_TO_RDR_SEX_AT_BIRTH =
          ImmutableBiMap.<SexAtBirth, org.pmiops.workbench.rdr.model.SexAtBirth>builder()
              .put(SexAtBirth.MALE, org.pmiops.workbench.rdr.model.SexAtBirth.MALE)
              .put(SexAtBirth.FEMALE, org.pmiops.workbench.rdr.model.SexAtBirth.FEMALE)
              .put(SexAtBirth.INTERSEX, org.pmiops.workbench.rdr.model.SexAtBirth.INTERSEX)
              .put(
                  SexAtBirth.NONE_OF_THESE_DESCRIBE_ME,
                  org.pmiops.workbench.rdr.model.SexAtBirth.NONE_OF_THESE_DESCRIBE_ME)
              .put(
                  SexAtBirth.PREFER_NO_ANSWER,
                  org.pmiops.workbench.rdr.model.SexAtBirth.PREFER_NOT_TO_ANSWER)
              .build();

  private static final BiMap<SexualOrientation, org.pmiops.workbench.rdr.model.SexualOrientation>
      CLIENT_TO_RDR_SEXUAL_ORIENTATION =
          ImmutableBiMap
              .<SexualOrientation, org.pmiops.workbench.rdr.model.SexualOrientation>builder()
              .put(
                  SexualOrientation.BISEXUAL,
                  org.pmiops.workbench.rdr.model.SexualOrientation.BISEXUAL)
              .put(SexualOrientation.GAY, org.pmiops.workbench.rdr.model.SexualOrientation.GAY)
              .put(
                  SexualOrientation.LESBIAN,
                  org.pmiops.workbench.rdr.model.SexualOrientation.LESBIAN)
              .put(
                  SexualOrientation.STRAIGHT,
                  org.pmiops.workbench.rdr.model.SexualOrientation.STRAIGHT)
              .put(
                  SexualOrientation.NONE_OF_THESE_DESCRIBE_ME,
                  org.pmiops.workbench.rdr.model.SexualOrientation.NONE_OF_THESE_DESCRIBE_ME)
              .put(
                  SexualOrientation.PREFER_NO_ANSWER,
                  org.pmiops.workbench.rdr.model.SexualOrientation.PREFER_NOT_TO_ANSWER)
              .build();

  private static final BiMap<Disability, org.pmiops.workbench.rdr.model.Disability>
      CLIENT_TO_RDR_DISABILITY =
          ImmutableBiMap.<Disability, org.pmiops.workbench.rdr.model.Disability>builder()
              .put(Disability.TRUE, org.pmiops.workbench.rdr.model.Disability.TRUE)
              .put(Disability.FALSE, org.pmiops.workbench.rdr.model.Disability.FALSE)
              .build();

  public static org.pmiops.workbench.rdr.model.Race raceToRdrRace(Race race) {
    if (race == null) return null;
    return CLIENT_TO_RDR_RACE.get(race);
  }

  public static org.pmiops.workbench.rdr.model.Ethnicity ethnicityToRdrEthnicity(
      Ethnicity ethnicity) {
    if (ethnicity == null) return null;
    return CLIENT_TO_RDR_ETHNICITY.get(ethnicity);
  }

  public static org.pmiops.workbench.rdr.model.Gender genderToRdrGender(Gender gender) {
    if (gender == null) return null;
    return CLIENT_TO_RDR_GENDER.get(gender);
  }

  public static org.pmiops.workbench.rdr.model.Education educationToRdrEducation(
      Education education) {
    if (education == null) return null;
    return CLIENT_TO_RDR_EDUCATION.get(education);
  }

  public static org.pmiops.workbench.rdr.model.SexAtBirth sexAtBirthToRdrSexAtBirth(
      SexAtBirth sexAtBirth) {
    if (sexAtBirth == null) return null;
    return CLIENT_TO_RDR_SEX_AT_BIRTH.get(sexAtBirth);
  }

  public static org.pmiops.workbench.rdr.model.SexualOrientation
      sexualOrientationToRdrSexualOrientation(SexualOrientation sexualOrientation) {
    if (sexualOrientation == null) return null;
    return CLIENT_TO_RDR_SEXUAL_ORIENTATION.get(sexualOrientation);
  }

  public static org.pmiops.workbench.rdr.model.Disability disabilityToRdrDisability(
      Disability disability) {
    if (disability == null) return org.pmiops.workbench.rdr.model.Disability.PREFER_NOT_TO_ANSWER;
    return CLIENT_TO_RDR_DISABILITY.get(disability);
  }
}
