function isAlive(thisContact) {
  return thisContact && !thisContact.date_of_death;
}

//contact, reports, lineage are globally available for contact-summary
const thisContact = contact;
// const thisLineage = lineage;
const context = {
  alive: isAlive(thisContact),
};

const fields = [
  // { appliesToType: 'person', label: 'patient_id', value: thisContact.patient_id, width: 4 },
  // { appliesToType: 'person', label: 'contact.age', value: thisContact.date_of_birth, width: 4, filter: 'age' },
  // { appliesToType: 'person', label: 'External ID', value: thisContact.patient_id, width: 4 },
  // { appliesIf: function () { return thisContact.parent && thisLineage[0]; }, label: 'contact.parent', value: thisLineage, filter: 'lineage' },
  // // { appliesToType: '!person', label: 'contact', value: thisContact.contact && thisContact.contact.name, width: 4 },
  // { appliesToType: '!person', label: 'External ID', value: thisContact.patient_id, width: 4 },
  // // { appliesToType: '!person', appliesIf: function () { return thisContact.parent && thisLineage[0]; }, label: 'contact.parent', value: thisLineage, filter: 'lineage' },
  // { appliesToType: 'person', label: 'contact.notes', value: thisContact.notes, width: 12 },
  // { appliesToType: '!person', label: 'contact.notes', value: thisContact.notes, width: 12 }
];

// The bird's health status comes from its most recent health_check report
// (written from the flock-overview extension's health-grid dropdown).
function latestHealthCondition() {
  const checks = (reports || [])
    .filter(function (r) { return r.form === 'health_check' && r.fields; })
    .sort(function (a, b) { return b.reported_date - a.reported_date; });
  return checks.length ? checks[0].fields.condition : null;
}
const healthCondition = latestHealthCondition();

const cards = [
  {
    // Shown on a chicken contact only when its latest health_check is watch/sick.
    label: 'Health alert',
    appliesToType: 'chicken',
    appliesIf: function () {
      return healthCondition === 'watch' || healthCondition === 'sick';
    },
    fields: [
      {
        label: 'Current status',
        value: healthCondition === 'sick' ? 'Sick' : 'Needs watching',
        width: 12,
      },
      {
        label: 'Recommended action',
        value: healthCondition === 'sick'
          ? 'Isolate the bird and inspect closely; consider reporting to an animal-health worker.'
          : 'Monitor closely and recheck over the next day or two.',
        width: 12,
      },
    ],
  },
];

module.exports = {
  context: context,
  cards: cards,
  fields: fields
};
