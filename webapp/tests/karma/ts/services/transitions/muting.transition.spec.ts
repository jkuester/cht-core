import { TestBed } from '@angular/core/testing';
import sinon from 'sinon';
import { expect } from 'chai';

import { DbService } from '@mm-services/db.service';
import { LineageModelGeneratorService } from '@mm-services/lineage-model-generator.service';
import { ContactMutedService } from '@mm-services/contact-muted.service';
import { ContactTypesService } from '@mm-services/contact-types.service';
import { MutingTransition } from '@mm-services/transitions/muting.transition';
import { ValidationService } from '@mm-services/validation.service';
import { clone, cloneDeep } from 'lodash-es';

describe('Muting Transition', () => {
  let transition:MutingTransition;
  let dbService;
  let lineageModelGenerator;
  let contactMutedService;
  let contactTypesService;
  let validationService;
  let clock;

  beforeEach(() => {
    dbService = { get: sinon.stub(), query: sinon.stub() };
    lineageModelGenerator = { docs: sinon.stub() };
    contactMutedService = { getMutedParent: sinon.stub(), getMuted: sinon.stub() };
    contactTypesService = { includes: sinon.stub() };
    validationService = { validate: sinon.stub() };

    contactTypesService.includes.withArgs(sinon.match({ type: 'person' })).returns(true);
    contactTypesService.includes.withArgs(sinon.match({ type: 'clinic' })).returns(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: DbService, useValue: { get: () => dbService } },
        { provide: LineageModelGeneratorService, useValue: lineageModelGenerator },
        { provide: ContactMutedService, useValue: contactMutedService },
        { provide: ContactTypesService, useValue: contactTypesService },
        { provide: ValidationService, useValue: validationService },
      ],
    });
    transition = TestBed.inject(MutingTransition);
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('init', () => {
    it('should return false when no settings', () => {
      expect(transition.init(false)).to.equal(false);
      expect(transition.init({ })).to.equal(false);
      expect(transition.init({ settings: 'yes' })).to.equal(false);
      expect(transition.init({ not_muting: 'yes' })).to.equal(false);
    });

    it('should return false when transition not enabled', () => {
      const settings = {
        muting: {
          mute_forms: ['mute'],
          unmute_forms: ['unmute'],
          offline_muting: false,
        }
      };
      expect(transition.init(settings)).to.equal(false);
    });

    it('should return false with incomplete config', () => {
      const settings = {
        muting: {
          unmute_forms: ['unmute'],
          offline_muting: true,
        }
      };
      expect(transition.init(settings)).to.equal(false);
    });

    it('should return true with valid config', () => {
      const settings = {
        muting: {
          mute_forms: ['mute'],
          unmute_forms: ['unmute'],
          offline_muting: true,
        }
      };
      expect(transition.init(settings)).to.equal(true);
    });
  });

  describe('filter', () => {
    beforeEach(async () => {
      const settings = {
        muting: {
          mute_forms: ['mute'],
          unmute_forms: ['unmute'],
          offline_muting: true,
        }
      };

      await transition.init(settings);
    });
    it('should return false when there are no relevant docs', async () => {
      const editMutingReport = [ { _id: 'existent_report', _rev: '1', type: 'data_record', form: 'mute' }, ];
      expect(transition.filter(editMutingReport)).to.equal(false);

      const editUnmuteReport = [ { _id: 'existent_report', _rev: '1', type: 'data_record', form: 'unmute' }, ];
      expect(transition.filter(editUnmuteReport)).to.equal(false);

      const editContacts = [
        { _id: 'contact1', _rev: 'value', type: 'person' },
        { _id: 'contact2', _rev: 'value', type: 'person' },
        { _id: 'contact3', _rev: 'value', type: 'clinic' },
      ];
      expect(transition.filter(editContacts)).to.equal(false);

      const docs = [
        { _id: 'report1', type: 'data_record' },
        { _id: 'report2', type: 'data_record', form: 'something' },
        { _id: 'contact3', _rev: 'value', type: 'clinic' },
        { _id: 'existent_report', _rev: '1', type: 'data_record', form: 'mute' },
      ];

      expect(transition.filter(docs)).to.equal(false);
    });

    it('should return true when one report is relevant', () => {
      const docs = [
        { _id: 'existent_contact', _rev: 'aaa', type: 'person' },
        { _id: 'new_report', type: 'data_record', form: 'mute' }, // new mute report
        { _id: 'existent_report', _rev: '1', type: 'data_record', form: 'mute' },
      ];
      expect(transition.filter(docs)).to.equal(true);
    });

    it('should return true when one contact is relevant', () => {
      const docs = [
        { _id: 'new_report', type: 'data_record', form: 'someform' },
        { _id: 'existent_report', _rev: '1', type: 'data_record', form: 'mute' },
        { _id: 'new_contact', type: 'person' },
      ];
      expect(transition.filter(docs)).to.equal(true);
    });

    it('should return true when multiple contacts are relevant', () => {
      const docs = [
        { _id: 'new_report', type: 'data_record', form: 'someform' },
        { _id: 'existent_report', _rev: '1', type: 'data_record', form: 'mute' },
        { _id: 'new_contact', type: 'person' },
        { _id: 'new_contact', type: 'clinic' },
      ];
      expect(transition.filter(docs)).to.equal(true);
    });
  });

  describe('run', () => {
    beforeEach(async () => {
      const settings = {
        muting: {
          mute_forms: ['mute'],
          unmute_forms: ['unmute'],
          offline_muting: true,
        }
      };

      await transition.init(settings);
    });

    describe('new reports', () => {
      it('should mute a person', async () => {
        const now = 12345;
        clock.tick(now);
        const docs = [{
          _id: 'new_report',
          type: 'data_record',
          form: 'mute',
          contact: { _id: 'contact_id' },
          fields: {
            patient_id: 'shortcode',
          }
        }];

        const hydratedReport = {
          _id: 'new_report',
          type: 'data_record',
          form: 'mute',
          fields: {
            patient_id: 'shortcode',
          },
          patient: {
            _id: 'patient',
            name: 'patient name',
            type: 'person',
            parent: {
              _id: 'parent',
              name: 'parent',
            },
            patient_id: 'shortcode',
          },
        };
        const minifiedPatient = {
          _id: 'patient',
          name: 'patient name',
          type: 'person',
          parent: { _id: 'parent' },
          patient_id: 'shortcode',
        };

        lineageModelGenerator.docs.resolves([hydratedReport]);
        dbService.query.withArgs('medic-client/contacts_by_place').resolves({ rows: [] });
        dbService.get.withArgs('patient').resolves(minifiedPatient);
        contactMutedService.getMuted.returns(false);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'new_report',
          type: 'data_record',
          form: 'mute',
          fields: {
            patient_id: 'shortcode',
          }
        }]]);
        expect(dbService.query.callCount).to.equal(1);
        expect(dbService.query.args[0]).to.deep.equal([
          'medic-client/contacts_by_place',
          { key: ['patient'], include_docs: true },
        ]);
        expect(dbService.get.callCount).to.equal(1);
        expect(dbService.get.args[0]).to.deep.equal(['patient']);
        expect(contactMutedService.getMuted.callCount).to.equal(1);
        expect(contactMutedService.getMuted.args[0]).to.deep.equal([{
          _id: 'patient',
          name: 'patient name',
          type: 'person',
          parent: { _id: 'parent', name: 'parent' },
          patient_id: 'shortcode',
        }]);

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'new_report',
            type: 'data_record',
            form: 'mute',
            contact: { _id: 'contact_id' },
            fields: {
              patient_id: 'shortcode',
            },
            offline_transitions: { muting: true },
          },
          {
            _id: 'patient',
            name: 'patient name',
            type: 'person',
            parent: { _id: 'parent' },
            patient_id: 'shortcode',
            muted: new Date(now).toISOString(),
            muting_history: {
              last_update: 'offline',
              online: { muted: false, date: undefined },
              offline: [{
                muted: true,
                date: new Date(now).toISOString(),
                report_id: 'new_report'
              }]
            },
          }
        ]);
      });

      it('should unmute a person', async () => {
        const now = 5000;
        clock.tick(now);
        const docs = [{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          contact: { _id: 'contact_id' },
          fields: {
            patient_id: 'shortcode',
          }
        }];

        const hydratedReport = {
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          fields: {
            patient_id: 'shortcode',
          },
          patient: {
            _id: 'patient',
            name: 'patient name',
            type: 'person',
            muted: 6000,
            patient_id: 'shortcode',
            parent: {
              _id: 'parent',
              name: 'parent',
            }
          },
        };
        lineageModelGenerator.docs.resolves([hydratedReport]);
        dbService.query.withArgs('medic-client/contacts_by_place').resolves({ rows: [] });
        dbService.get.withArgs('patient').resolves({
          _id: 'patient',
          name: 'patient name',
          type: 'person',
          muted: 6000,
          patient_id: 'shortcode',
          parent: { _id: 'parent' },
        });
        contactMutedService.getMuted.returns(true);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          fields: {
            patient_id: 'shortcode',
          }
        }]]);
        expect(dbService.query.callCount).to.equal(1);
        expect(dbService.query.args[0]).to.deep.equal([
          'medic-client/contacts_by_place',
          { key: ['patient'], include_docs: true },
        ]);
        expect(dbService.get.callCount).to.equal(1);
        expect(dbService.get.args[0]).to.deep.equal(['patient']);
        expect(contactMutedService.getMuted.callCount).to.equal(1);
        expect(contactMutedService.getMuted.args[0]).to.deep.equal([hydratedReport.patient]);

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'a_report',
            type: 'data_record',
            form: 'unmute',
            contact: { _id: 'contact_id' },
            fields: {
              patient_id: 'shortcode',
            },
            offline_transitions: { muting: true },
          },
          {
            _id: 'patient',
            name: 'patient name',
            type: 'person',
            parent: { _id: 'parent' },
            patient_id: 'shortcode',
            muting_history: {
              last_update: 'offline',
              online: { muted: true, date: 6000 },
              offline: [{
                muted: false,
                date: new Date(now).toISOString(),
                report_id: 'a_report'
              }]
            },
          }
        ]);
      });

      it('should do nothing when subject is not found', async () => {
        const docs = [{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          contact: { _id: 'contact_id' },
          fields: {
            patient_id: 'shortcode',
          }
        }];

        lineageModelGenerator.docs.resolves([{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          fields: {
            patient_id: 'shortcode',
          },
        }]);
        contactMutedService.getMuted.returns(true);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          fields: {
            patient_id: 'shortcode',
          }
        }]]);
        expect(dbService.query.callCount).to.equal(0);
        expect(dbService.get.callCount).to.equal(0);

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'a_report',
            type: 'data_record',
            form: 'unmute',
            contact: { _id: 'contact_id' },
            fields: {
              patient_id: 'shortcode',
            },
          },
        ]);
      });

      it('should do nothing if contact is already muted', async() => {
        const docs = [{
          _id: 'new_report',
          type: 'data_record',
          form: 'mute',
          contact: { _id: 'contact_id' },
          fields: {
            patient_id: 'shortcode',
          }
        }];

        lineageModelGenerator.docs.resolves([{
          _id: 'new_report',
          type: 'data_record',
          form: 'mute',
          fields: {
            patient_id: 'shortcode',
          },
          patient: {
            _id: 'patient',
            name: 'patient name',
            type: 'person',
            muted: 6582,
            parent: {
              _id: 'parent',
              name: 'parent',
            },
            patient_id: 'shortcode',
          },
        }]);
        contactMutedService.getMuted.returns(true);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'new_report',
          type: 'data_record',
          form: 'mute',
          fields: {
            patient_id: 'shortcode',
          }
        }]]);
        expect(dbService.query.callCount).to.equal(0);
        expect(dbService.get.callCount).to.equal(0);

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'new_report',
            type: 'data_record',
            form: 'mute',
            contact: { _id: 'contact_id' },
            fields: {
              patient_id: 'shortcode',
            },
          },
        ]);
      });

      it('should do nothing if contact is already unmuted', async () => {
        const now = 5000;
        clock.tick(now);
        const docs = [{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          contact: { _id: 'contact_id' },
          fields: {
            patient_id: 'shortcode',
          }
        }];

        lineageModelGenerator.docs.resolves([{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          fields: {
            patient_id: 'shortcode',
          },
          patient: {
            _id: 'patient',
            name: 'patient name',
            type: 'person',
            patient_id: 'shortcode',
            parent: {
              _id: 'parent',
              name: 'parent',
            }
          },
        }]);

        contactMutedService.getMuted.returns(false);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(dbService.query.callCount).to.equal(0);
        expect(dbService.get.callCount).to.equal(0);

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'a_report',
            type: 'data_record',
            form: 'unmute',
            contact: { _id: 'contact_id' },
            fields: {
              patient_id: 'shortcode',
            },
          },
        ]);
      });

      it('should cascade muting to all descendents', async () => {
        const now = 158742118;
        clock.tick(now);

        const docs = [{
          _id: 'report',
          type: 'data_record',
          form: 'mute',
          contact: { _id: 'contact_id' },
          fields: {
            place_id: 'place_id',
          }
        }];

        lineageModelGenerator.docs.resolves([{
          _id: 'report',
          type: 'data_record',
          form: 'mute',
          fields: {
            place_id: 'place_id',
          },
          place: {
            _id: 'place',
            name: 'place name',
            type: 'health_center',
            contact: { _id: 'chw', name: 'chw' },
            parent: {
              _id: 'parent',
              name: 'parent',
            },
            place_id: 'place_id',
          },
        }]);

        dbService.query.withArgs('medic-client/contacts_by_place').resolves({
          rows: [
            {
              id: 'contact1',
              doc: {
                _id: 'contact1',
                type: 'person',
                parent: { _id: 'place', parent: { _id: 'parent' } },
              },
            },
            {
              id: 'clinic1',
              doc: {
                _id: 'clinic1',
                contact: { _id: 'othercontact' },
                type: 'clinic',
                parent: { _id: 'place', parent: { _id: 'parent' } },
              }
            },
            {
              id: 'patient1',
              doc: {
                _id: 'patient1',
                type: 'person',
                parent: { _id: 'clinic1', parent: { _id: 'place', parent: { _id: 'parent' } } },
              }
            },
            {
              id: 'clinic2',
              doc: {
                _id: 'clinic2',
                type: 'clinic',
                parent: { _id: 'place', parent: { _id: 'parent' } },
              }
            },
            {
              id: 'patient2',
              doc: {
                _id: 'patient2',
                type: 'person',
                parent: { _id: 'clinic2', parent: { _id: 'place', parent: { _id: 'parent' } } },
              }
            }
          ],
        });
        dbService.get.withArgs('place').resolves({
          _id: 'place',
          name: 'place name',
          type: 'health_center',
          contact: { _id: 'chw' },
          parent: { _id: 'parent' },
          place_id: 'place_id',
        });
        contactMutedService.getMuted.returns(false);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'report',
          type: 'data_record',
          form: 'mute',
          fields: {
            place_id: 'place_id',
          }
        }]]);
        expect(dbService.query.callCount).to.equal(1);
        expect(dbService.query.args[0]).to.deep.equal([
          'medic-client/contacts_by_place',
          { key: ['place'], include_docs: true },
        ]);
        expect(dbService.get.callCount).to.equal(1);
        expect(dbService.get.args[0]).to.deep.equal(['place']);
        expect(contactMutedService.getMuted.callCount).to.equal(1);
        expect(contactMutedService.getMuted.args[0]).to.deep.equal([{
          _id: 'place',
          name: 'place name',
          type: 'health_center',
          contact: { _id: 'chw', name: 'chw' },
          parent: {
            _id: 'parent',
            name: 'parent',
          },
          place_id: 'place_id',
        }]);

        const mutingDate = new Date(now).toISOString();

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'report',
            type: 'data_record',
            form: 'mute',
            contact: { _id: 'contact_id' },
            fields: {
              place_id: 'place_id',
            },
            offline_transitions: { muting: true },
          },
          {
            _id: 'contact1',
            type: 'person',
            parent: { _id: 'place', parent: { _id: 'parent' } },
            muted: mutingDate,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: mutingDate, report_id: 'report' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'clinic1',
            contact: { _id: 'othercontact' },
            type: 'clinic',
            parent: { _id: 'place', parent: { _id: 'parent' } },
            muted: mutingDate,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: mutingDate, report_id: 'report' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'patient1',
            type: 'person',
            parent: { _id: 'clinic1', parent: { _id: 'place', parent: { _id: 'parent' } } },
            muted: mutingDate,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: mutingDate, report_id: 'report' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'clinic2',
            type: 'clinic',
            parent: { _id: 'place', parent: { _id: 'parent' } },
            muted: mutingDate,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: mutingDate, report_id: 'report' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'patient2',
            type: 'person',
            parent: { _id: 'clinic2', parent: { _id: 'place', parent: { _id: 'parent' } } },
            muted: mutingDate,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: mutingDate, report_id: 'report' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'place',
            name: 'place name',
            type: 'health_center',
            contact: { _id: 'chw' },
            parent: { _id: 'parent' },
            place_id: 'place_id',
            muted: mutingDate,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: mutingDate, report_id: 'report' }],
              last_update: 'offline',
            },
          },
        ]);
      });

      it('should cascade unmuting to all ancestors', async () => {
        const now = 158742118;
        clock.tick(now);

        const docs = [{
          _id: 'record',
          type: 'data_record',
          form: 'unmute',
          contact: { _id: 'contact_id' },
          fields: {
            place_id: 'place_id',
          },
        }];

        const hydratedReport = {
          _id: 'record',
          type: 'data_record',
          form: 'unmute',
          fields: {
            place_id: 'place_id',
          },
          place: {
            _id: 'place',
            place_id: 'place_id',
            muted: 1234,
            type: 'clinic',
            contact: { _id: 'chw' },
            parent: {
              _id: 'parent',
              type: 'health_center',
              contact: { _id: 'chw' },
              muted: 1234,
              parent: {
                _id: 'grandparent',
                contact: { _id: 'chw' },
                type: 'district_hospital'
              },
            },
          },
        };
        lineageModelGenerator.docs.resolves([hydratedReport]);

        dbService.query.withArgs('medic-client/contacts_by_place').resolves({
          rows: [
            {
              id: 'place',
              doc: {
                _id: 'place',
                type: 'clinic',
                muted: 1234,
                contact: { _id: 'chw' },
                parent: { _id: 'parent', parent: { _id: 'grandparent' } },
              }
            },
            {
              id: 'other_place',
              doc: {
                _id: 'other_place',
                type: 'clinic',
                muted: 65478,
                contact: { _id: 'other_chw' },
                parent: { _id: 'parent', parent: { _id: 'grandparent' } },
              },
            },
            {
              id: 'contact1',
              doc: {
                _id: 'contact1',
                type: 'person',
                muted: 9999,
                parent: { _id: 'parent', parent: { _id: 'grandparent' } },
              }
            },
            {
              id: 'contact2',
              doc: {
                _id: 'contact2',
                type: 'person',
                muted: 98412,
                parent: {
                  _id: 'place',
                  parent: { _id: 'parent', parent: { _id: 'grandparent' } },
                },
              },
            },
            {
              id: 'contact3',
              doc: {
                _id: 'contact3',
                type: 'person',
                muted: 87488,
                parent: {
                  _id: 'other_place',
                  parent: { _id: 'parent', parent: { _id: 'grandparent' } },
                },
              },
            },
          ]
        });
        dbService.get.withArgs('parent').resolves({
          _id: 'parent',
          type: 'health_center',
          contact: { _id: 'chw' },
          muted: 1234,
          parent: { _id: 'grandparent' },
        });
        contactMutedService.getMuted.returns(true);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'record',
          type: 'data_record',
          form: 'unmute',
          fields: {
            place_id: 'place_id',
          },
        }]]);
        expect(dbService.query.callCount).to.equal(1);
        expect(dbService.query.args[0]).to.deep.equal([
          'medic-client/contacts_by_place',
          { key: ['parent'], include_docs: true },
        ]);
        expect(dbService.get.callCount).to.equal(1);
        expect(dbService.get.args[0]).to.deep.equal(['parent']);
        expect(contactMutedService.getMuted.callCount).to.equal(1);
        expect(contactMutedService.getMuted.args[0]).to.deep.equal([hydratedReport.place]);

        const mutingDate = new Date(now).toISOString();

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'record',
            type: 'data_record',
            form: 'unmute',
            contact: { _id: 'contact_id' },
            fields: { place_id: 'place_id' },
            offline_transitions: { muting: true },
          },
          {
            _id: 'place',
            type: 'clinic',
            contact: { _id: 'chw' },
            parent: { _id: 'parent', parent: { _id: 'grandparent' } },
            muting_history: {
              online: { muted: true, date: 1234 },
              offline: [{ muted: false, date: mutingDate, report_id: 'record' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'other_place',
            type: 'clinic',
            contact: { _id: 'other_chw' },
            parent: { _id: 'parent', parent: { _id: 'grandparent' } },
            muting_history: {
              online: { muted: true, date: 65478 },
              offline: [{ muted: false, date: mutingDate, report_id: 'record' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'contact1',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' } },
            muting_history: {
              online: { muted: true, date: 9999 },
              offline: [{ muted: false, date: mutingDate, report_id: 'record' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'contact2',
            type: 'person',
            parent: {
              _id: 'place',
              parent: { _id: 'parent', parent: { _id: 'grandparent' } },
            },
            muting_history: {
              online: { muted: true, date: 98412 },
              offline: [{ muted: false, date: mutingDate, report_id: 'record' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'contact3',
            type: 'person',
            parent: {
              _id: 'other_place',
              parent: { _id: 'parent', parent: { _id: 'grandparent' } },
            },
            muting_history: {
              online: { muted: true, date: 87488 },
              offline: [{ muted: false, date: mutingDate, report_id: 'record' }],
              last_update: 'offline',
            },
          },
          {
            _id: 'parent',
            type: 'health_center',
            contact: { _id: 'chw' },
            parent: { _id: 'grandparent' },
            muting_history: {
              online: { muted: true, date: 1234 },
              offline: [{ muted: false, date: mutingDate, report_id: 'record' }],
              last_update: 'offline',
            },
          }
        ]);
      });

      it('should add entry to offline muting history', async () => {
        const now = 5000;
        clock.tick(now);
        const docs = [{
          _id: 'a_report',
          type: 'data_record',
          form: 'mute',
          contact: { _id: 'contact_id' },
          fields: {
            place_id: 'place_shortcode',
          }
        }];

        lineageModelGenerator.docs.resolves([{
          _id: 'a_report',
          type: 'data_record',
          form: 'unmute',
          fields: {
            patient_id: 'shortcode',
          },
          place: {
            _id: 'place_uuid',
            name: 'place name',
            type: 'clinic',
            place_id: 'place_shortcode',
            parent: {
              _id: 'parent',
              name: 'parent',
            },
            muting_history: {
              last_update: 'online',
              online: { muted: false, date: undefined },
              offline: [
                { muted: false, date: 100, report_id: 'a' },
                { muted: true, date: 200, report_id: 'b' },
                { muted: false, date: 300, report_id: 'c' },
              ]
            },
          },
        }]);
        dbService.query.withArgs('medic-client/contacts_by_place').resolves({
          rows: [
            {
              id: 'patient',
              doc: {
                _id: 'patient_uuid',
                type: 'person',
                parent: { _id: 'place_uuid', parent: { _id: 'parent' } },
                muting_history: {
                  last_update: 'offline',
                  online: { muted: false, date: undefined },
                  offline: [
                    { muted: false, date: 100, report_id: 'aaaa' },
                  ]
                },
              }
            }
          ]
        });
        dbService.get.withArgs('place_uuid').resolves({
          _id: 'place_uuid',
          name: 'place name',
          type: 'clinic',
          place_id: 'place_shortcode',
          parent: { _id: 'parent' },
          muting_history: {
            last_update: 'online',
            online: { muted: false, date: undefined },
            offline: [
              { muted: false, date: 100, report_id: 'a' },
              { muted: true, date: 200, report_id: 'b' },
              { muted: false, date: 300, report_id: 'c' },
            ]
          },
        });
        contactMutedService.getMuted.returns(false);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([[{
          _id: 'a_report',
          type: 'data_record',
          form: 'mute',
          fields: {
            place_id: 'place_shortcode',
          }
        }]]);
        expect(dbService.query.callCount).to.equal(1);
        expect(dbService.query.args[0]).to.deep.equal([
          'medic-client/contacts_by_place',
          { key: ['place_uuid'], include_docs: true },
        ]);
        expect(dbService.get.callCount).to.equal(1);
        expect(dbService.get.args[0]).to.deep.equal(['place_uuid']);
        expect(updatedDocs).to.deep.equal([
          {
            _id: 'a_report',
            type: 'data_record',
            form: 'mute',
            contact: { _id: 'contact_id' },
            fields: {
              place_id: 'place_shortcode',
            },
            offline_transitions: { muting: true },
          },
          {
            _id: 'patient_uuid',
            type: 'person',
            parent: { _id: 'place_uuid', parent: { _id: 'parent' } },
            muted: new Date(now).toISOString(),
            muting_history: {
              last_update: 'offline',
              online: { muted: false, date: undefined },
              offline: [
                { muted: false, date: 100, report_id: 'aaaa' },
                { muted: true, date: new Date(now).toISOString(), report_id: 'a_report' },
              ]
            },
          },
          {
            _id: 'place_uuid',
            name: 'place name',
            type: 'clinic',
            place_id: 'place_shortcode',
            parent: { _id: 'parent' },
            muted: new Date(now).toISOString(),
            muting_history: {
              last_update: 'offline',
              online: { muted: false, date: undefined },
              offline: [
                { muted: false, date: 100, report_id: 'a' },
                { muted: true, date: 200, report_id: 'b' },
                { muted: false, date: 300, report_id: 'c' },
                { muted: true, date: new Date(now).toISOString(), report_id: 'a_report' },
              ]
            },
          },
        ]);
      });
    });

    describe('new contacts', () => {
      it('should mute a person under a muted parent', async () => {
        const now = 457385943;
        clock.tick(now);
        const docs = [
          {
            _id: 'new_contact',
            name: 'contact',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' }}
          }
        ];

        const hydratedContact = {
          _id: 'new_contact',
          name: 'contact',
          type: 'person',
          parent: {
            _id: 'parent',
            type: 'clinic',
            muted: 1000,
            parent: {
              _id: 'grandparent',
              type: 'health_center',
            }
          }
        };
        lineageModelGenerator.docs.resolves([ hydratedContact ]);
        contactMutedService.getMutedParent.returns(hydratedContact.parent);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([docs]);
        expect(contactMutedService.getMutedParent.callCount).to.equal(1);
        expect(contactMutedService.getMutedParent.args[0]).to.deep.equal([hydratedContact]);

        const muteTime = new Date(now).toISOString();
        expect(updatedDocs).to.deep.equal([
          {
            _id: 'new_contact',
            name: 'contact',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' }},
            muted: muteTime,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: muteTime, report_id: undefined }],
              last_update: 'offline',
            }
          },
        ]);
      });

      it('should not mute a contact under an unmuted parent', async () => {
        const docs = [
          {
            _id: 'new_contact',
            name: 'contact',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' }}
          }
        ];

        const hydratedContact = {
          _id: 'new_contact',
          name: 'contact',
          type: 'person',
          parent: {
            _id: 'parent',
            type: 'clinic',
            parent: {
              _id: 'grandparent',
              type: 'health_center',
            }
          }
        };
        lineageModelGenerator.docs.resolves([ hydratedContact ]);
        contactMutedService.getMutedParent.returns(false);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([docs]);
        expect(contactMutedService.getMutedParent.callCount).to.equal(1);
        expect(contactMutedService.getMutedParent.args[0]).to.deep.equal([hydratedContact]);

        expect(updatedDocs).to.deep.equal([
          {
            _id: 'new_contact',
            name: 'contact',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' }},
          },
        ]);
      });

      it('should copy offline muting report in history if it exists', async () => {
        const now = 32131;
        clock.tick(now);
        const docs = [
          {
            _id: 'new_contact',
            name: 'contact',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' }}
          }
        ];

        const hydratedContact = {
          _id: 'new_contact',
          name: 'contact',
          type: 'person',
          parent: {
            _id: 'parent',
            type: 'clinic',
            muted: 1000,
            muting_history: {
              last_update: 'offline',
              online: { muted: false, date: 1000, report_id: 'online_report' },
              offline: [
                { muted: true, date: 100, report_id: 'offline1' },
                { muted: false, date: 200, report_id: 'offline2' },
                { muted: true, date: 300, report_id: 'offline3' },
              ]
            },
            parent: {
              _id: 'grandparent',
              type: 'health_center',
            }
          }
        };
        lineageModelGenerator.docs.resolves([ hydratedContact ]);
        contactMutedService.getMutedParent.returns(hydratedContact.parent);

        const updatedDocs = await transition.run(docs);

        expect(lineageModelGenerator.docs.callCount).to.equal(1);
        expect(lineageModelGenerator.docs.args[0]).to.deep.equal([docs]);
        expect(contactMutedService.getMutedParent.callCount).to.equal(1);
        expect(contactMutedService.getMutedParent.args[0]).to.deep.equal([hydratedContact]);

        const muteTime = new Date(now).toISOString();
        expect(updatedDocs).to.deep.equal([
          {
            _id: 'new_contact',
            name: 'contact',
            type: 'person',
            parent: { _id: 'parent', parent: { _id: 'grandparent' }},
            muted: muteTime,
            muting_history: {
              online: { muted: false, date: undefined },
              offline: [{ muted: true, date: muteTime, report_id: 'offline3' }],
              last_update: 'offline',
            }
          },
        ]);
      });
    });

    describe('filtering', () => {
      it('should skip edited reports', () => {

      });

      it('should skip reports that are not muting/unmuting reports', () => {

      });

      it('should skip invalid reports', () => {

      });

      it('should skip edited contacts', () => {

      });
    });

    describe('weird cases', () => {
      it('should only unmute when both mute and unmute forms exist in the same batch', () => {

      });

      it('create new place + new person in place + mute place', () => {

      });

      it('create new place + new persons in place + mute place', () => {

      });

      it('should create new person and mute person parent', () => {

      });

      it('create new person and mute person', () => {

      });

      it('create new person in muted place and unmute person', () => {

      });

      it('should create new person in muted place and unkute place', () => {

      });

      it('create new place + new person under muted place and unmute new person', () => {

      });

      it('create new place + new person under muted place and unmute old place', () => {

      });

      it('create two new persons under muted place and unmute one of them', () => {

      });
    });
  });
});
