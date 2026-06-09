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

module.exports = {
  context: context,
  cards: [],
  fields: fields
};
