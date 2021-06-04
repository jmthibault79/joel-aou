package org.pmiops.workbench;

import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.junit.jupiter.SpringExtension;

@Import({FakeClockConfiguration.class})
@ExtendWith(SpringExtension.class)
public class SpringTest {}
