package org.pmiops.workbench.db.dao;

import static com.google.common.truth.Truth.assertThat;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.pmiops.workbench.db.model.DbInstitution;
import org.pmiops.workbench.db.model.DbInstitutionEmailAddress;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@DataJpaTest
@DirtiesContext(classMode = ClassMode.BEFORE_EACH_TEST_METHOD)
public class InstitutionEmailAddressDaoTest {

  @Autowired InstitutionDao institutionDao;
  @Autowired InstitutionEmailAddressDao institutionEmailAddressDao;

  private DbInstitution testInst;

  @Before
  public void setUp() {
    testInst =
        institutionDao.save(
            new DbInstitution().setShortName("Broad").setDisplayName("The Broad Institute"));
  }

  @Test
  public void test_getByInstitution_empty() {
    assertThat(institutionEmailAddressDao.getByInstitution(testInst)).isEmpty();
    assertThat(institutionEmailAddressDao.count()).isEqualTo(0L);
  }

  @Test
  public void test_getByInstitution_multiple() {
    final DbInstitutionEmailAddress one =
        institutionEmailAddressDao.save(
            new DbInstitutionEmailAddress()
                .setEmailAddress("researcher@vumc.org")
                .setInstitution(testInst));
    final DbInstitutionEmailAddress two =
        institutionEmailAddressDao.save(
            new DbInstitutionEmailAddress()
                .setEmailAddress("researcher@nih.gov")
                .setInstitution(testInst));

    assertThat(institutionEmailAddressDao.getByInstitution(testInst)).containsExactly(one, two);
    assertThat(institutionEmailAddressDao.count()).isEqualTo(2L);
  }

  @Test
  public void test_getByInstitution_multipleInsts() {
    final DbInstitutionEmailAddress one =
        institutionEmailAddressDao.save(
            new DbInstitutionEmailAddress()
                .setEmailAddress("researcher@vumc.org")
                .setInstitution(testInst));

    final DbInstitution otherInst =
        institutionDao.save(new DbInstitution().setShortName("VUMC").setDisplayName("Vanderbilt"));

    final DbInstitutionEmailAddress two =
        institutionEmailAddressDao.save(
            new DbInstitutionEmailAddress()
                .setEmailAddress("researcher@nih.gov")
                .setInstitution(otherInst));

    assertThat(institutionEmailAddressDao.getByInstitution(testInst)).containsExactly(one);
    assertThat(institutionEmailAddressDao.getByInstitution(otherInst)).containsExactly(two);
    assertThat(institutionEmailAddressDao.count()).isEqualTo(2L);
  }

  @Test
  public void test_deleteByInstitution_empty() {
    assertThat(institutionEmailAddressDao.deleteByInstitution(testInst)).isEqualTo(0L);
  }

  @Test
  public void test_deleteByInstitution_multiple() {
    institutionEmailAddressDao.save(
        new DbInstitutionEmailAddress()
            .setEmailAddress("researcher@vumc.org")
            .setInstitution(testInst));
    institutionEmailAddressDao.save(
        new DbInstitutionEmailAddress()
            .setEmailAddress("researcher@nih.gov")
            .setInstitution(testInst));

    assertThat(institutionEmailAddressDao.deleteByInstitution(testInst)).isEqualTo(2L);
    assertThat(institutionEmailAddressDao.deleteByInstitution(testInst)).isEqualTo(0L);
    assertThat(institutionEmailAddressDao.count()).isEqualTo(0L);
  }

  @Test
  public void test_deleteByInstitution_multipleInsts() {
    institutionEmailAddressDao.save(
        new DbInstitutionEmailAddress()
            .setEmailAddress("researcher@vumc.org")
            .setInstitution(testInst));

    final DbInstitution otherInst =
        institutionDao.save(new DbInstitution().setShortName("VUMC").setDisplayName("Vanderbilt"));

    institutionEmailAddressDao.save(
        new DbInstitutionEmailAddress()
            .setEmailAddress("researcher@nih.gov")
            .setInstitution(otherInst));

    assertThat(institutionEmailAddressDao.deleteByInstitution(testInst)).isEqualTo(1L);
    assertThat(institutionEmailAddressDao.deleteByInstitution(otherInst)).isEqualTo(1L);
    assertThat(institutionEmailAddressDao.deleteByInstitution(testInst)).isEqualTo(0L);
    assertThat(institutionEmailAddressDao.deleteByInstitution(otherInst)).isEqualTo(0L);
    assertThat(institutionEmailAddressDao.count()).isEqualTo(0L);
  }
}
