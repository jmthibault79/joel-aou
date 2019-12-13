package org.pmiops.workbench.cdr.dao;

import static org.junit.Assert.assertEquals;

import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.pmiops.workbench.cdr.model.DbCriteriaAttribute;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@DataJpaTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
public class CBCriteriaAttributeDaoTest {

  @Autowired private CBCriteriaAttributeDao cbCriteriaAttributeDao;
  private DbCriteriaAttribute attribute;

  @Before
  public void onSetup() {
    attribute =
        cbCriteriaAttributeDao.save(
            new DbCriteriaAttribute()
                .conceptId(1L)
                .conceptName("test")
                .estCount("10")
                .type("type")
                .valueAsConceptId(12345678L));
  }

  @Test
  public void findCriteriaAttributeByConceptId() throws Exception {
    List<DbCriteriaAttribute> attributes =
        cbCriteriaAttributeDao.findCriteriaAttributeByConceptId(1L);
    assertEquals(1, attributes.size());
    assertEquals(attribute, attributes.get(0));
  }
}
