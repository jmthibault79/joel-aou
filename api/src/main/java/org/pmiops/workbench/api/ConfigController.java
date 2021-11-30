package org.pmiops.workbench.api;

import javax.inject.Provider;
import org.pmiops.workbench.config.WorkbenchConfig;
import org.pmiops.workbench.config.WorkbenchConfigMapper;
import org.pmiops.workbench.model.ConfigResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ConfigController implements ConfigApiDelegate {

  private final Provider<WorkbenchConfig> configProvider;
  private final WorkbenchConfigMapper configMapper;

  @Autowired
  ConfigController(Provider<WorkbenchConfig> configProvider, WorkbenchConfigMapper configMapper) {
    this.configProvider = configProvider;
    this.configMapper = configMapper;
  }

  @Override
  public ResponseEntity<ConfigResponse> getConfig() {
    return ResponseEntity.ok(configMapper.toModel(configProvider.get()));
  }
}
