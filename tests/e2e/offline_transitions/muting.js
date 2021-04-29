const _ = require('lodash');
const { expect } = require('chai');

const auth = require('../../auth')();
const commonElements = require('../../page-objects/common/common.po.js');
const utils = require('../../utils');
const loginPage = require('../../page-objects/login/login.po.js');
const contactsObjects = require('../../page-objects/contacts/contacts.po');
const sentinelUtils = require('../sentinel/utils');
const formsUtils = require('./forms');


describe('Muting', () => {
  const password = 'Sup3rSecret!';
  const DISTRICT = {
    _id: 'DISTRICT',
    type: 'district_hospital',
    name: 'DISTRICT'
  };

  const HEALTH_CENTER = {
    _id: 'HEALTH_CENTER',
    type: 'health_center',
    name: 'Health Center',
    parent: { _id: DISTRICT._id },
  };

  const contact1 = {
    _id: 'contact1',
    name: 'contact1',
    type: 'person',
    parent: { _id: DISTRICT._id },
  };
  const clinic1 = {
    _id: 'clinic1',
    name: 'clinic one',
    type: 'clinic',
    place_id: 'clinic_1',
    parent: { _id: HEALTH_CENTER._id, parent: { _id: DISTRICT._id } },
    contact: { _id: 'contact1' },
  };
  const clinic2 = {
    _id: 'clinic2',
    name: 'clinic two',
    type: 'clinic',
    place_id: 'clinic_2',
    parent: { _id: HEALTH_CENTER._id, parent: { _id: DISTRICT._id } },
    contact: { _id: 'contact1' },
  };
  const patient1 = {
    _id: 'patient1',
    name: 'patient one',
    type: 'person',
    patient_id: 'patient_1',
    parent: { _id: 'clinic1', parent: { _id: HEALTH_CENTER._id, parent: { _id: DISTRICT._id } } },
  };
  const patient2 = {
    _id: 'patient2',
    name: 'patient two',
    type: 'person',
    patient_id: 'patient_2',
    parent: { _id: 'clinic2', parent: { _id: HEALTH_CENTER._id, parent: { _id: DISTRICT._id } } },
  };
  const patient3 = {
    _id: 'patient3',
    name: 'patient three',
    type: 'person',
    patient_id: 'patient_3',
    parent: { _id: 'clinic1', parent: { _id: HEALTH_CENTER._id, parent: { _id: DISTRICT._id } } },
  };

  const contacts = [
    contact1,
    clinic1,
    clinic2,
    patient1,
    patient2,
    patient3,
  ];

  const offlineUser = {
    username: 'offline_user',
    password: password,
    place: 'HEALTH_CENTER',
    contact: {
      _id: 'fixture:user:offline',
      name: 'Offline'
    },
    roles: ['district_admin']
  };

  const onlineUser = {
    username: 'online',
    password: password,
    place: 'HEALTH_CENTER',
    contact: {
      _id: 'fixture:user:online',
      name: 'Offline'
    },
    roles: ['national_admin']
  };

  const settings = {
    transitions: { muting: true },
    muting: {
      mute_forms: ['mute_person', 'mute_clinic'],
      unmute_forms: ['unmute_person', 'unmute_clinic'],
      offline_muting: true,
    },
  };

  const getLastSubmittedReport = async () => {
    const query = await utils.db.query(
      'medic-client/reports_by_date',
      { descending: true, limit: 1, include_docs: true }
    );

    if (!query.rows.length) {
      await commonElements.syncNative();
      return getLastSubmittedReport();
    }

    return query.rows[0].doc;
  };

  const submitMutingForm = async (name, form, sync = false) =>  {
    await commonElements.goToPeople();
    try {
      await contactsObjects.selectLHSRowByText(name);
    } catch(err) {
      console.warn('Failed loading contact', err);
      await contactsObjects.selectLHSRowByText(name);
    }

    await formsUtils.openForm(form);
    await formsUtils.submit();
    sync && await commonElements.syncNative();
  };

  const muteClinic = (contact, sync = false) => {
    return submitMutingForm(contact.name, 'mute_clinic', sync);
  };

  const unmuteClinic = (contact, sync = false) => {
    return submitMutingForm(contact.name, 'unmute_clinic', sync);
  };

  const mutePerson = (contact, sync = false) => {
    return submitMutingForm(contact.name, 'mute_person', sync);
  };

  const unmutePerson = (contact, sync = false) => {
    return submitMutingForm(contact.name, 'unmute_person', sync);
  };

  const restartSentinel = async (sync = false) => {
    await utils.startSentinel();
    await sentinelUtils.waitForSentinel();
    sync && await commonElements.syncNative();
  };

  const expectUnmutedNoHistory = (doc) => {
    expect(doc.muted).to.be.undefined;
    expect(doc.muting_history).to.be.undefined;
  };
  const expectMutedNoHistory = (doc) => {
    expect(doc.muted).to.be.ok;
    expect(doc.muting_history).to.be.undefined;
  };

  beforeAll(async () => {
    await utils.saveDocs([DISTRICT, HEALTH_CENTER]);
    await formsUtils.uploadForms();
  });

  afterAll(async () => {
    await utils.startSentinel();
    await commonElements.goToLoginPageNative();
    await loginPage.loginNative(auth.username, auth.password);
    await utils.revertDb();
    await commonElements.calmNative();
  });

  afterEach(async () => {
    await utils.revertSettings(true);
  });

  describe('for an online user',  () => {
    beforeAll(async () => {
      await utils.saveDocs(contacts);
      await utils.createUsers([onlineUser]);
      await commonElements.goToLoginPageNative();
      await loginPage.loginNative('online', password);
      await utils.closeTour();
    });

    afterAll(async () => {
      await utils.deleteUsers([onlineUser]);
      await utils.revertDb([DISTRICT._id, HEALTH_CENTER._id, /^form:/]);
    });

    it('should not process offline_muting when muting as an online user', async () => {
      // turning off sentinel so it doesn't process muting
      await utils.stopSentinel();
      await utils.updateSettings(settings);

      await muteClinic(clinic1);

      expectUnmutedNoHistory(await utils.getDoc(clinic1._id));
      expectUnmutedNoHistory(await utils.getDoc(patient1._id));

      await restartSentinel();

      expectMutedNoHistory(await utils.getDoc(clinic1._id));
      expectMutedNoHistory(await utils.getDoc(patient1._id));
    });
  });

  describe('for an offline user', () => {
    beforeAll(async () => {
      await utils.saveDocs(contacts);
      await utils.createUsers([offlineUser]);
      await commonElements.goToLoginPageNative();
      await loginPage.loginNative(offlineUser.username, password);
      await utils.closeTour();
    });

    afterAll(async () => {
      await utils.deleteUsers([offlineUser]);
    });

    afterEach(async () => {
      await unmuteContacts();
      await commonElements.syncNative();
      await utils.refreshToGetNewSettings();
    });

    const updateSettings = async (settings) => {
      await utils.updateSettings(settings, true);
      await commonElements.syncNative();
      await utils.refreshToGetNewSettings();
    };

    const unmuteContacts = async () => {
      const docs = await utils.getDocs(contacts.map(c => c._id));

      const docsToUpdate = docs.filter(doc => {
        if (doc.muted || doc.muting_history) {
          delete doc.muted;
          delete doc.muting_history;
          return doc;
        }
      });
      return utils.saveDocs(docsToUpdate);
    };

    it('should not process muting offline if not enabled', async () => {
      const settingsWithDisabled = _.cloneDeep(settings);
      settingsWithDisabled.muting.offline_muting = false;

      await utils.stopSentinel();
      await updateSettings(settingsWithDisabled);

      await muteClinic(clinic2, true);

      expectUnmutedNoHistory(await utils.getDoc(clinic2._id));
      expectUnmutedNoHistory(await utils.getDoc(patient2._id));

      await restartSentinel(true);

      expectMutedNoHistory(await utils.getDoc(clinic2._id));
      expectMutedNoHistory(await utils.getDoc(patient2._id));
    });

    // for simplicity, offline means sentinel is stopped
    it('should mute and unmute a person while "offline", with processing in between', async () => {
      await utils.stopSentinel();
      await updateSettings(settings);

      await mutePerson(patient1, true);

      const mutingReport = await getLastSubmittedReport();
      expect(mutingReport).to.deep.nested.include({
        form: 'mute_person',
        'fields.patient_uuid': patient1._id,
        offline_transitions: { muting: true },
      });

      let updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient1.muted, report_id: mutingReport._id }],
      });
      const offlineMutingDate = updatedPatient1.muted;

      expectUnmutedNoHistory(await utils.getDoc(clinic1._id));

      // other contacts are not muted
      expectUnmutedNoHistory(await utils.getDoc(patient2._id));
      expectUnmutedNoHistory(await utils.getDoc(clinic2._id));

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: true, date: updatedPatient1.muted },
        offline: [{ muted: true, date: offlineMutingDate, report_id: mutingReport._id }],
      });
      const onlineMutedDate = updatedPatient1.muted;

      expectUnmutedNoHistory(await utils.getDoc(clinic1._id));

      await utils.stopSentinel();

      await unmutePerson(patient1, true);

      const unmutingReport = await getLastSubmittedReport();
      expect(unmutingReport).to.deep.nested.include({
        form: 'unmute_person',
        'fields.patient_uuid': patient1._id,
        offline_transitions: { muting: true },
      });

      updatedPatient1 = await utils.getDoc(patient1._id);

      expect(updatedPatient1.muted).to.be.undefined;
      const unmutingDate = updatedPatient1.muting_history.offline[1].date;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: true, date: onlineMutedDate },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate /* can't guess this date */, report_id: unmutingReport._id },
        ],
      });

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);

      expect(updatedPatient1.muted).to.be.undefined;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedPatient1.muting_history.online.date /* can't guess this date */ },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate, report_id: unmutingReport._id },
        ],
      });

      expectUnmutedNoHistory(await utils.getDoc(clinic1._id));

      const infodoc = await sentinelUtils.getInfoDoc(patient1._id);
      expect(infodoc.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);
    });

    it('should mute and unmute a person while "offline", without processing in between', async () => {
      await utils.stopSentinel();
      await updateSettings(settings);

      await mutePerson(patient1, true);

      const mutingReport = await getLastSubmittedReport();
      expect(mutingReport).to.deep.nested.include({
        form: 'mute_person',
        'fields.patient_uuid': patient1._id,
        offline_transitions: { muting: true },
      });

      let updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient1.muted, report_id: mutingReport._id }],
      });
      const offlineMutingDate = updatedPatient1.muted;

      await unmutePerson(patient1, true);

      const unmutingReport = await getLastSubmittedReport();
      expect(unmutingReport).to.deep.nested.include({
        form: 'unmute_person',
        'fields.patient_uuid': patient1._id,
        offline_transitions: { muting: true },
      });

      updatedPatient1 = await utils.getDoc(patient1._id);

      expect(updatedPatient1.muted).to.be.undefined;
      const unmutingDate = updatedPatient1.muting_history.offline[1].date;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate /* can't guess this date */, report_id: unmutingReport._id },
        ],
      });

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);

      expect(updatedPatient1.muted).to.be.undefined;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedPatient1.muting_history.online.date /* can't guess this date */ },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate, report_id: unmutingReport._id },
        ],
      });

      const infodoc = await sentinelUtils.getInfoDoc(patient1._id);
      expect(infodoc.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);
    });

    it('should mute and unmute a clinic while "offline", with processing in between', async () => {
      await utils.stopSentinel();
      await updateSettings(settings);

      await muteClinic(clinic1, true);

      const mutingReport = await getLastSubmittedReport();
      expect(mutingReport).to.deep.nested.include({
        form: 'mute_clinic',
        'fields.place_id': clinic1._id,
        offline_transitions: { muting: true },
      });

      let updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.ok;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedClinic1.muted, report_id: mutingReport._id }],
      });

      let updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient1.muted, report_id: mutingReport._id }],
      });
      expect(updatedClinic1.muted).to.equal(updatedPatient1.muted);

      let updatedPatient3 = await utils.getDoc(patient3._id);
      expect(updatedPatient3.muted).to.be.ok;
      expect(updatedPatient3.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient3.muted, report_id: mutingReport._id }],
      });

      expectUnmutedNoHistory(await utils.getDoc(clinic2._id));
      expectUnmutedNoHistory(await utils.getDoc(patient2._id));

      const offlineMutingDate = updatedPatient1.muted;

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: true, date: updatedPatient1.muted },
        offline: [{ muted: true, date: offlineMutingDate, report_id: mutingReport._id }],
      });
      updatedPatient3 = await utils.getDoc(patient3._id);
      expect(updatedPatient3.muted).to.be.ok;
      expect(updatedPatient3.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: true, date: updatedPatient3.muted },
        offline: [{ muted: true, date: offlineMutingDate, report_id: mutingReport._id }],
      });
      updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.ok;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: true, date: updatedClinic1.muted },
        offline: [{ muted: true, date: offlineMutingDate, report_id: mutingReport._id }],
      });

      const patient1OnlineMutingDate = updatedPatient1.muted;
      const clinic1OnlineMutingDate = updatedClinic1.muted;

      await utils.stopSentinel();

      await unmuteClinic(clinic1, true);

      const unmutingReport = await getLastSubmittedReport();
      expect(unmutingReport).to.deep.nested.include({
        form: 'unmute_clinic',
        'fields.place_id': clinic1._id,
        offline_transitions: { muting: true },
      });

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.undefined;
      const unmutingDate = updatedPatient1.muting_history.offline[1].date;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: true, date: patient1OnlineMutingDate },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate, report_id: unmutingReport._id },
        ],
      });

      updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.undefined;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: true, date: clinic1OnlineMutingDate },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate, report_id: unmutingReport._id },
        ],
      });

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);

      expect(updatedPatient1.muted).to.be.undefined;
      let onlineUnmutingDate = updatedPatient1.muting_history.online.date;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: onlineUnmutingDate },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate, report_id: unmutingReport._id },
        ],
      });

      updatedClinic1 = await utils.getDoc(clinic1._id);
      onlineUnmutingDate = updatedClinic1.muting_history.online.date;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: onlineUnmutingDate },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: unmutingDate, report_id: unmutingReport._id },
        ],
      });

      const clinic1Infodoc = await sentinelUtils.getInfoDoc(clinic1._id);
      expect(clinic1Infodoc.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);

      const patient1Infodoc = await sentinelUtils.getInfoDoc(patient1._id);
      expect(patient1Infodoc.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);
    });

    it('should mute and unmute a clinic while "offline", without processing in between', async () => {
      await utils.stopSentinel();
      await updateSettings(settings);

      await muteClinic(clinic1, true);

      const mutingReport = await getLastSubmittedReport();
      expect(mutingReport).to.deep.nested.include({
        form: 'mute_clinic',
        'fields.place_id': clinic1._id,
        offline_transitions: { muting: true },
      });

      let updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient1.muted, report_id: mutingReport._id }],
      });
      let updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedClinic1.muted, report_id: mutingReport._id }],
      });
      expect(updatedPatient1.muted).to.equal(updatedClinic1.muted);

      const offlineMutingDate = updatedClinic1.muted;

      await unmuteClinic(clinic1, true);

      const unmutingReport = await getLastSubmittedReport();
      expect(unmutingReport).to.deep.nested.include({
        form: 'unmute_clinic',
        'fields.place_id': clinic1._id,
        offline_transitions: { muting: true },
      });

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.undefined;
      const patient1unmutingDate = updatedPatient1.muting_history.offline[1].date;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: patient1unmutingDate, report_id: unmutingReport._id },
        ],
      });

      updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.undefined;
      const clinic1unmutingDate = updatedClinic1.muting_history.offline[1].date;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: clinic1unmutingDate, report_id: unmutingReport._id },
        ],
      });

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.undefined;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedPatient1.muting_history.online.date /* can't guess this date */ },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: patient1unmutingDate, report_id: unmutingReport._id },
        ],
      });
      updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.undefined;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedClinic1.muting_history.online.date /* can't guess this date */},
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: clinic1unmutingDate, report_id: unmutingReport._id },
        ],
      });

      const infodocPatient = await sentinelUtils.getInfoDoc(patient1._id);
      expect(infodocPatient.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);

      const infodocClinic = await sentinelUtils.getInfoDoc(clinic1._id);
      expect(infodocClinic.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);
    });

    it('should mute a clinic and unmute a patient while "offline", without processing in between', async () => {
      await utils.stopSentinel();
      await updateSettings(settings);

      await muteClinic(clinic1, true);

      const mutingReport = await getLastSubmittedReport();
      expect(mutingReport).to.deep.nested.include({
        form: 'mute_clinic',
        'fields.place_id': clinic1._id,
        offline_transitions: { muting: true },
      });

      let updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient1.muted, report_id: mutingReport._id }],
      });
      let updatedPatient3 = await utils.getDoc(patient3._id);
      expect(updatedPatient3.muted).to.be.ok;
      expect(updatedPatient3.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedPatient3.muted, report_id: mutingReport._id }],
      });
      let updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedPatient1.muted).to.be.ok;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [{ muted: true, date: updatedClinic1.muted, report_id: mutingReport._id }],
      });
      expect(updatedPatient1.muted).to.equal(updatedClinic1.muted);

      const offlineMutingDate = updatedClinic1.muted;

      await unmutePerson(patient1, true);

      const unmutingReport = await getLastSubmittedReport();
      expect(unmutingReport).to.deep.nested.include({
        form: 'unmute_person',
        'fields.patient_uuid': patient1._id,
        offline_transitions: { muting: true },
      });

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.undefined;
      const patient1unmutingDate = updatedPatient1.muting_history.offline[1].date;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: patient1unmutingDate, report_id: unmutingReport._id },
        ],
      });
      updatedPatient3 = await utils.getDoc(patient3._id);
      expect(updatedPatient3.muted).to.be.undefined;
      const patient3unmutingDate = updatedPatient3.muting_history.offline[1].date;
      expect(updatedPatient3.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: patient3unmutingDate, report_id: unmutingReport._id },
        ],
      });

      updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.undefined;
      const clinic1unmutingDate = updatedClinic1.muting_history.offline[1].date;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'offline',
        online: { muted: false },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: clinic1unmutingDate, report_id: unmutingReport._id },
        ],
      });

      await restartSentinel(true);

      updatedPatient1 = await utils.getDoc(patient1._id);
      expect(updatedPatient1.muted).to.be.undefined;
      expect(updatedPatient1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedPatient1.muting_history.online.date /* can't guess this date */ },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: patient1unmutingDate, report_id: unmutingReport._id },
        ],
      });
      updatedPatient3 = await utils.getDoc(patient3._id);
      expect(updatedPatient3.muted).to.be.undefined;
      expect(updatedPatient3.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedPatient3.muting_history.online.date /* can't guess this date */ },
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: patient3unmutingDate, report_id: unmutingReport._id },
        ],
      });
      updatedClinic1 = await utils.getDoc(clinic1._id);
      expect(updatedClinic1.muted).to.be.undefined;
      expect(updatedClinic1.muting_history).to.deep.equal({
        last_update: 'online',
        online: { muted: false, date: updatedClinic1.muting_history.online.date /* can't guess this date */},
        offline: [
          { muted: true, date: offlineMutingDate, report_id: mutingReport._id },
          { muted: false, date: clinic1unmutingDate, report_id: unmutingReport._id },
        ],
      });

      const infodocPatient = await sentinelUtils.getInfoDoc(patient1._id);
      expect(infodocPatient.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);

      const infodocClinic = await sentinelUtils.getInfoDoc(clinic1._id);
      expect(infodocClinic.muting_history.slice(-2)).excludingEvery('date').to.deep.equal([
        { muted: true, report_id: mutingReport._id },
        { muted: false, report_id: unmutingReport._id },
      ]);
    });
  });
});
