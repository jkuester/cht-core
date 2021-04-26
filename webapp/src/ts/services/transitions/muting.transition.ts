import { Injectable } from '@angular/core';
import { cloneDeep } from 'lodash-es';

import { DbService } from '@mm-services/db.service';
import { LineageModelGeneratorService } from '@mm-services/lineage-model-generator.service';
import { ContactMutedService } from '@mm-services/contact-muted.service';
import { ContactTypesService } from '@mm-services/contact-types.service';
import { TransitionInterface } from '@mm-services/transitions/transition';
import { ValidationService } from '@mm-services/validation.service';

@Injectable({
  providedIn: 'root'
})
export class MutingTransition implements TransitionInterface {
  constructor(
    private dbService:DbService,
    private lineageModelGeneratorService:LineageModelGeneratorService,
    private contactMutedService:ContactMutedService,
    private contactTypesService:ContactTypesService,
    private validationService:ValidationService,
  ) { }

  readonly name = 'muting';

  private transitionConfig;
  private readonly CONFIG_NAME = 'muting';
  private readonly MUTE_PROPERTY = 'mute_forms';
  private readonly UNMUTE_PROPERTY = 'unmute_forms';
  private readonly OFFLINE = 'offline';

  private loadSettings(settings = {}) {
    this.transitionConfig = settings[this.CONFIG_NAME] || {};
  }

  private getMutingForms() {
    return this.transitionConfig[this.MUTE_PROPERTY];
  }

  private getUnmutingForms() {
    return this.transitionConfig[this.UNMUTE_PROPERTY];
  }

  init(settings) {
    this.loadSettings(settings);
    if (!this.transitionConfig.offline_muting) {
      return false;
    }

    const mutingForms = this.getMutingForms();
    if (!mutingForms || !Array.isArray(mutingForms) || !mutingForms.length) {
      console.warn(
        `Configuration error. Config must define have a '${this.CONFIG_NAME}.${this.MUTE_PROPERTY}' array defined.`
      );
      return false;
    }
    return true;
  }

  private isMuteForm(form) {
    return this.getMutingForms().includes(form);
  }

  private isUnmuteForm(form) {
    return this.getUnmutingForms().includes(form);
  }

  /**
   * Returns whether a document is a muting or unmuting report that should be processed.
   * We only process new reports. The muting transition should not run when existing reports are edited.
   * @param {Object} doc
   * @returns {Boolean}
   * @private
   */
  private isRelevantReport(doc) {
    // exclude docs that are not reports and existent reports.
    if (!doc || doc._rev || doc.type !== 'data_record' || !doc.form) {
      return false;
    }

    if (this.isMuteForm(doc.form) || this.isUnmuteForm(doc.form)) {
      return true;
    }

    return false;
  }

  /**
   * Returns whether a document is a new contact.
   * The muting transition should not run on when existing contacts are edited.
   * @param {Object} doc
   * @returns {Boolean}
   * @private
   */
  private isRelevantContact(doc) {
    return !doc._rev && this.contactTypesService.includes(doc);
  }

  /**
   * Returns whether any of the docs from the batch should be processed
   * @param docs
   * @return {Boolean}
   */
  filter(docs) {
    const relevantDocs = docs
      .map(doc => this.isRelevantReport(doc) || this.isRelevantContact(doc))
      .filter(result => !!result);
    return !!relevantDocs.length;
  }

  private async hydrateDocs(context) {
    const reportsToHydrate = context.reports.map(report => {
      const reportClone = cloneDeep(report);
      // don't hydrate the submitter to save time, we already know who submitted these
      delete reportClone.contact;
      return reportClone;
    });

    const docs = [
      ...reportsToHydrate,
      ...context.contacts,
    ];
    const hydratedDocs = await this.lineageModelGeneratorService.docs(docs);

    for (const contact of hydratedDocs) {
      context.hydratedDocs[contact._id] = contact;
      let parent = contact.parent;
      while (parent) {
        context.hydratedDocs[parent._id] = parent;
        parent = parent.parent;
      }
    }
  }

  private async isValid(report) {
    const errors = await this.validationService.validate(report, this.transitionConfig);
    // todo add the errors on the doc?
    return !errors || !errors.length;
  }

  private getSubject(report) {
    return report.patient || report.place;
  }

  private async processReports(context) {
    for (const report of context.reports) {
      const hydratedReport = context.hydratedDocs[report._id];
      await this.processReport(report, hydratedReport, context);
    }
  }

  private processReport(report, hydratedReport, context) {
    const mutedState = this.isMuteForm(report.form);
    const subject = this.getSubject(hydratedReport);
    if (!subject || !!this.contactMutedService.getMuted(subject) === mutedState) {
      // no subject or already in the correct state
      return Promise.resolve();
    }

    report.offline_transitions = report.offline_transitions || {};
    report.offline_transitions.muting = true;

    return this.updatedMuteState(subject, mutedState, report, context);
  }

  private async updatedMuteState(contact, muted, report, context) {
    let rootContactId;

    // when muting, mute the contact itself + all descendents
    rootContactId = contact._id;
    // when unmuting, find the topmost muted ancestor and unmute it and all its descendents
    if (!muted) {
      let parent = contact;
      while (parent) {
        rootContactId = parent.muted ? parent._id : rootContactId;
        parent = parent.parent;
      }
    }

    const contactsToProcess = await this.getContactsToProcess(contact, rootContactId, context);
    contactsToProcess.forEach(contactToProcess => {
      const knownContact = context.docs.find(doc => doc._id === contactToProcess._id);
      if (knownContact) {
        this.processContact(knownContact, muted, report._id, context);
        return;
      }

      this.processContact(contactToProcess, muted, report._id, context);
      context.docs.push(contactToProcess);
    });
  }

  private getRootContact(rootContactId, context) {
    const knownContact = context.docs.find(doc => doc._id === rootContactId);
    if (knownContact) {
      return Promise.resolve(knownContact);
    }

    return this.dbService.get().get(rootContactId);
  }

  private async getDescendents(rootContactId) {
    const results = await this.dbService
      .get()
      .query('medic-client/contacts_by_place', { key: [rootContactId], include_docs: true });

    return results.rows.map(row => row.doc);
  }

  private async getContactsToProcess(contact, rootContactId, context) {
    const descendents = await this.getDescendents(rootContactId);
    const rootContact = await this.getRootContact(rootContactId, context);

    descendents.push(rootContact);
    const foundContact = descendents.find(descendent => descendent._id === contact._id);
    if (!foundContact) {
      descendents.push(contact);
    }

    return descendents;
  }

  private getLastMutingEvent(contact) {
    return this.lastUpdatedOffline(contact) && contact?.muting_history?.offline?.slice(-1)[0] || {};
  }
  private lastUpdatedOffline(contact) {
    return contact?.muting_history?.last_update === this.OFFLINE;
  }

  private processContacts(context) {
    if (!context.contacts.length) {
      return;
    }
    const contactsToProcess = [];

    context.contacts.forEach(contact => {
      const hydratedContact = context.hydratedDocs[contact._id];
      const lineage = this.compileLineage(hydratedContact, context);
      const mutedParent = this.contactMutedService.getMutedParent(hydratedContact, lineage);
      if (mutedParent) {
        const updatedMutedParent = context.hydratedDocs[mutedParent._id];
        // store reportId if the parent was last muted offline
        // if the parent was last muted online, we don't have access to this information
        const reportId = this.lastUpdatedOffline(updatedMutedParent) ?
          this.getLastMutingEvent(updatedMutedParent).report_id :
          undefined;

        contactsToProcess.push({ contact, reportId });
      }
    });

    contactsToProcess.forEach(({ contact, reportId }) => this.processContact(contact, true, reportId, context));
  }

  private compileLineage(contact, context) {
    let parent = contact.parent;
    const lineage = [];
    while (parent && parent._id) {
      lineage.push(context.hydratedDocs[parent._id]);
      parent = parent.parent;
    }
    return lineage;
  }

  private isSameMutingEvent(eventA, eventB) {
    const keys = ['muted', 'date', 'report_id'];
    return keys.every(key => eventA[key] === eventB[key]);
  }

  private processContact(contact, muted, reportId, context) {
    if (!contact.muting_history) {
      // store "online" state when first processing this doc offline
      contact.muting_history = {
        online: {
          muted: !!contact.muted,
          date: contact.muted,
        },
        offline: [],
      };
    }

    if (muted) {
      contact.muted = context.mutedTimestamp;
    } else {
      delete contact.muted;
    }
    contact.muting_history.last_update = this.OFFLINE;

    const mutingEvent = {
      muted: muted,
      date: context.mutedTimestamp,
      report_id: reportId,
    };
    const lastMutingEvent = this.getLastMutingEvent(contact);
    if (this.isSameMutingEvent(mutingEvent, lastMutingEvent)) {
      // don't duplicate the muting events
      return;
    }

    contact.muting_history.offline.push(mutingEvent);
    // consolidate muted state in hydratedDocs
    if (context.hydratedDocs[contact._id]) {
      context.hydratedDocs[contact._id].muted = contact.muted;
      context.hydratedDocs[contact._id].muting_history = contact.muting_history;
    }
  }

  async run(docs) {
    const context = {
      docs,
      reports: [],
      contacts: [],
      hydratedDocs: {},
      mutedTimestamp: new Date().toISOString(),
    };

    let hasMutingReport;
    let hasUnmutingReport;

    for (const doc of docs) {
      if (this.isRelevantContact(doc)) {
        context.contacts.push(doc);
        continue;
      }

      if (this.isRelevantReport(doc)) {
        const valid = await this.isValid(doc);
        if (!valid) {
          continue;
        }

        if (this.isMuteForm(doc.form)) {
          hasMutingReport = true;
        } else {
          hasUnmutingReport = true;
        }
        context.reports.push(doc);
      }
    }

    if (hasMutingReport && hasUnmutingReport) {
      // we have reports that mute and unmute in the same batch, so only unmute!
      context.reports = context.reports.filter(report => this.isUnmuteForm(report.form));
    }

    await this.hydrateDocs(context);
    await this.processReports(context);
    this.processContacts(context);

    return docs;
  }
}

