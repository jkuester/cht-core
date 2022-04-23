const Factory = require('rosie').Factory;
const Faker = require('@faker-js/faker');
const moment = require('moment');

const YES_NO = ['yes', 'no'];
const POSITIVE_NEGATIVE = ['pos', 'neg'];
const LAST_FOOD = ['meat', 'eggs', 'milk'];
const NONE = 'none';
const DURATION_OF_PREGNANCY_IN_DAYS = 279;
const RISK_FACTORS_CODES = {
  'First pregnancy': 'r1'
  'More than 4 children': 'r2'
  'Last baby born less than 1 year before': 'r3'
  'Had previous miscarriages or previous difficulties in childbirth': 'r4'
  'Has any of the following conditions: heart conditions, asthma, high blood pressure, known diabetes': 'r5'
  'HIV positive': 'r6'
  'Is gravida 4+': 'r7'
  'None': 'r8'
};

const isPregnant = (edd, lmpApprox, pregRes, pregResKit) => {
  if (edd && lmpApprox !== '61' && lmpApprox !== '91') {
    return true;
  }
  if (lmpApprox === '122' || lmpApprox === '183' || lmpApprox === '244') {
    return true;
  }
  if (edd !== null && (pregRes === 'pos' || pregResKit === 'pos')) {
    return true;
  }
  return false;
};

module.exports = new Factory()
  .option('patient', '')
  .option('contact', '')
  .attr('inputs', ['patient'], (patient) => {
    const inputContact = {
      _id: patient._id,
      name: patient.name,
      date_of_birth: patient.date_of_birth,
      sex: patient.sex,
      parent: { _id: patient.parent._id }
    };
    const input = {
      meta: '',
      source: 'contact',
      source_id: '',
      contact: inputContact
    };
    return input;
  })
  .attr('patient_id', ['patient'], (patient) => {
    return patient._id;
  })
  .attr('patient_name', ['patient'], (patient) => {
    return patient.name;
  })
  .attr('visited_contact_uuid', ['contact'], (contact) => {
    return contact._id;
  })
  .attr('patient_age_in_years', ['patient'], (patient) => {
    return patient.age_years;
  })
  .attr('group_lmp', () => {
    const groupLmp = {
      g_lmp_method: Faker.faker.random.arrayElement(['calendar', 'approx']),
      g_lmp_calendar: null,
      g_lmp_approx: null,
      g_lmp_date_raw: null,
      g_lmp_date_8601: null,
      g_lmp_date: null,
      g_edd_8601: null,
      g_edd: null,
      g_preg_test: null,
      g_preg_res: null,
      g_preg_res_kit: null,
    };
    if (gLmpMethod === 'calendar') {
      groupLmp.g_lmp_calendar = moment().subtract(Faker.faker.datatype.number({ min: 1, max: 9 }), 'month').format('YYYY-MM-DD');
      groupLmp.g_lmp_date_raw = gLmpCalendar;
      groupLmp.g_lmp_date_8601 = gLmpCalendar;
      groupLmp.g_lmp_date = gLmpCalendar;
    } else {
      groupLmp.g_lmp_approx = Faker.faker.random.arrayElement([61, 91, 122, 183, 244]);
      groupLmp.g_lmp_date_raw = moment().subtract(groupLmp.g_lmp_approx, 'day');
      groupLmp.g_lmp_date_8601 = moment().subtract(groupLmp.g_lmp_approx, 'day').format('YYYY-MM-DD');
      groupLmp.g_lmp_date = moment().subtract(groupLmp.g_lmp_approx, 'day').format('MMM D, YYYY');
    }
    groupLmp.g_edd_8601 = moment(groupLmp.g_lmp_date_8601).add(DURATION_OF_PREGNANCY_IN_DAYS, 'days');
    gEdd = moment(groupLmp.g_lmp_date_8601).add(DURATION_OF_PREGNANCY_IN_DAYS, 'days').format('MMM D, YYYY');
    if (groupLmp.g_lmp_approx === '61' || groupLmp.g_lmp_approx === '91') {
      groupLmp.g_preg_test = Faker.faker.random.arrayElement(YES_NO);
    }
    if (groupLmp.g_preg_test === 'yes') {
      groupLmp.g_preg_res = Faker.faker.random.arrayElement(POSITIVE_NEGATIVE);
    } else {
      groupLmp.g_preg_res_kit = Faker.faker.random.arrayElement(POSITIVE_NEGATIVE);
    }
    return groupLmp;
  })
  .attr('group_llin_parity', ['group_lmp'], (groupLmp) => {
    if (isPregnant(groupLmp.g_edd, groupLmp.g_lmp_approx, groupLmp.g_preg_res, groupLmp.g_preg_res_kit)) {
      const groupLlinParity = {
        patient_llin: Faker.faker.random.arrayElement(YES_NO)
      };
      return groupLlinParity;
    }
  })
  .attr('group_anc_visit', ['group_lmp'], (groupLmp) => {
    if (isPregnant(groupLmp.g_edd, groupLmp.g_lmp_approx, groupLmp.g_preg_res, groupLmp.g_preg_res_kit)) {
      const groupAncVisit = {
        anc_visit: Faker.faker.random.arrayElement(YES_NO),
        anc_visit_repeat: null,
        prophylaxis_taken: Faker.faker.random.arrayElement(YES_NO),
        last_dose: null,
        last_dose_date: null,
        tt_imm: Faker.faker.random.arrayElement(YES_NO),
        tt_received: null,
        tt_date: null,
        given_mebendazole: Faker.faker.random.arrayElement(YES_NO)
      };
      if (groupAncVisit.anc_visit === 'yes') {
        const ancVisitRepeat = {
          anc_visit_completed: Faker.faker.random.arrayElement(
            ['anc_1', 'anc_2', 'anc_3', 'anc_4', 'anc_5', 'anc_6', 'anc_7', 'anc_8']),
          g_anc_last_visit: moment().format('YYYY-MM-DD'),
          note_warning: '',
          g_anc_last_visit_epoch: null,
          bp_reading: Faker.faker.lorem.word()
        };
        ancVisitRepeat.g_anc_last_visit_epoch = moment(ancVisitRepeat.g_anc_last_visit).unix();
        groupAncVisit.anc_visit_repeat = ancVisitRepeat;
      }
      if (groupAncVisit.prophylaxis_taken === 'yes') {
        groupAncVisit.last_dose = Faker.faker.random.arrayElement(['ipt_1', 'ipt_2', 'ipt_3', 'ipt_4']);
        groupAncVisit.last_dose_date = moment().subtract(Faker.faker.datatype.number({ min: 1, max: 120 }), 'month').format('YYYY-MM-DD');
      }
      if (groupAncVisit.tt_imm === 'yes') {
        groupAncVisit.tt_received = Faker.faker.random.arrayElement(['tt_1', 'tt_2']);
        groupAncVisit.tt_date = moment().subtract(Faker.faker.datatype.number({ min: 1, max: 120 }), 'month').format('YYYY-MM-DD');

      }
      return groupAncVisit;
    }
  })
  .attr('g_nutrition_screening', ['group_lmp'], (groupLmp) => {
    if (isPregnant(groupLmp.g_edd, groupLmp.g_lmp_approx, groupLmp.g_preg_res, groupLmp.g_preg_res_kit)) {
      const gNutritionScreening = {
        muac_score: Faker.faker.datatype.number(),
        mother_weight: Faker.faker.datatype.number(),
        last_fed: Faker.faker.random.arrayElement(['1', '2', '3', '4', '5', '6', '7']),
        last_food: null,
        mother_hiv_status: Faker.faker.random.arrayElement(...POSITIVE_NEGATIVE, 'unknown', 'undisclosed'),
        mother_arv: null
      };
      if (Faker.faker.datatype.boolean()) {
        gNutritionScreening.last_food.push(Faker.faker.random.uniqueArray(LAST_FOOD, Faker.faker.datatype.number({ min: 1, max: 3 })));
      } else {
        gNutritionScreening.last_food.push(NONE);
      }
      if (gNutritionScreening.mother_hiv_status === 'pos') {
        gNutritionScreening.mother_arv = Faker.faker.random.arrayElement(YES_NO);
      }
      return gNutritionScreening;
    }
  })
  .attr('group_risk_factors', ['group_lmp'], (groupLmp) => {
    if (!isPregnant(groupLmp.g_edd, groupLmp.g_lmp_approx, groupLmp.g_preg_res, groupLmp.g_preg_res_kit)) {
      const groupRiskFactors = {
        gravida: Faker.faker.datatype.number({ min: 0, max: 4 }),
        parity: Faker.faker.datatype.number({ min: 0, max: gravida }),
        g_risk_factors: gRiskFactors
      };
      const gRiskFactors = [];
      gRiskFactors.push(Faker.faker.random.arrayElement(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']));
      if (gRiskFactors[0] !== 'r8') {
        if (gRiskFactors[0] === 'r1') {
          gRiskFactors.push(Faker.faker.helpers.uniqueArray(
            ['r5', 'r6'],
            Faker.faker.datatype.number({ min: 0, max: 2 })));
        } else {
          gRiskFactors.push(Faker.faker.helpers.uniqueArray(
            ['r2', 'r3', 'r4', 'r5', 'r6', 'r7'],
            Faker.faker.datatype.number({ min: 0, max: 6 })));
        }
      }
      c
      return groupRiskFactors;
    }
  })
  .attr('group_danger_signs', ['group_lmp'], (groupLmp) => {
    if (!isPregnant(groupLmp.g_edd, groupLmp.g_lmp_approx, groupLmp.g_preg_res, groupLmp.g_preg_res_kit)) {
      return null;
    }
    const groupDangerSigns = {
      g_danger_signs: Faker.faker.helpers.uniqueArray(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'],
        Faker.faker.datatype.number({ min: 0, max: 9 }))
    };
    return groupDangerSigns;
  })
  .attr('lmp_method', ['group_lmp'], (groupLmp) => {
    return groupLmp.g_lmp_method;
  })
  .attr('lmp_date_8601', ['group_lmp'], (groupLmp) => {
    return groupLmp.g_lmp_date_8601;
  })
  .attr('lmp_date', ['group_lmp'], (groupLmp) => {
    return groupLmp.g_lmp_date;
  })
  .attr('edd_8601', ['group_lmp'], (groupLmp) => {
    return groupLmp.g_edd_8601;
  })
  .attr('edd', ['group_lmp'], (groupLmp) => {
    return groupLmp.g_edd;
  })
  .attr('risk_factors', ['group_risk_factors'], (groupRiskFactors) => {
    return groupRiskFactors.g_risk_factors;
  })
  .attr('danger_signs', ['group_danger_signs'], (groupDangerDigns) => {
    return groupDangerDigns.g_danger_signs;
  })
  .attr('anc_last_visit', ['group_anc_visit'], (groupAncVisit) => {
    return groupAncVisit.g_anc_last_visit;
  })
  .attr('anc_visit_identifier', '')
  .attr('anc_last_bp_reading', '')
  .attr('patient_age_at_lmp', ['patient', 'group_lmp'], (patient, groupLmp) => {
    const birthDate = moment(patient.date_of_birth);
    const lmpDate = moment(groupLmp.g_lmp_date_8601);
    return lmpDate.diff(birthDate, 'years');
  })
  .attr('days_since_lmp', ['group_lmp'], (groupLmp) => {
    const now = moment();
    const lmpDate = moment(groupLmp.g_lmp_date_8601);
    const daysDiff = now.diff(lmpDate, 'days');
    return daysDiff;
  })
  .attr('weeks_since_lmp', ['group_lmp'], (groupLmp) => {
    const now = moment();
    const lmpDate = moment(groupLmp.g_lmp_date_8601);
    const weeksDiff = now.diff(lmpDate, 'weeks');
    return weeksDiff;
  });
