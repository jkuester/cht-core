import { Injectable } from '@angular/core';

import * as validation from '@medic/validation';
import { DbService } from '@mm-services/db.service';
import { SettingsService } from '@mm-services/settings.service';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  constructor(
    private dbService:DbService,
    private settingsService:SettingsService,
  ) {
  }
  private inited;

  async init() {
    if (this.inited) {
      return Promise.resolve();
    }

    const settings = await this.settingsService.get();

    // todo translate or not???
    const translate = (key) => key;
    validation.init({ settings, db: { medic: this.dbService.get() }, translate, logger: console });
    this.inited = true;
  }

  async validate(doc, config) {
    await this.init();
    const validations = config?.validations?.list;
    if (!validations || !validations.length) {
      return Promise.resolve();
    }

    // todo translate messages?????
    return validation.validate(doc, validations);
  }
}
