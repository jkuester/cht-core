/** Drain a cursor-paginated cht-datasource endpoint into a flat array. */
async function collectPages(fetchPage) {
  const out = [];
  let cursor = null;
  do {
    const page = await fetchPage(cursor);
    out.push(...(page?.data || []));
    cursor = page?.cursor || null;
  } while (cursor);
  return out;
}

/**
 * Loads every chicken contact and its reports via the injected cht-datasource.
 * Returns [{ contact, reports }].
 */
export async function loadFlock(cht, cfg) {
  const api = cht.v1;

  const uuids = await collectPages(
    (cursor) => api.contact.getUuidsPageByType(cfg.chickenContactType, cursor, 1000)
  );
  const contacts = (await Promise.all(uuids.map((id) => api.contact.getByUuid(id))))
    .filter(Boolean);

  return Promise.all(contacts.map(async (contact) => {
    const key = contact.patient_id || contact._id;
    const reportIds = await collectPages(
      (cursor) => api.report.getUuidsPageByFreetext(key, cursor, 1000)
    );
    const reports = (await Promise.all(reportIds.map((id) => api.report.getByUuid(id))))
      .filter(Boolean);
    return { contact, reports };
  }));
}
