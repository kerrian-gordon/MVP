// Scenario 2 — Calendar Sync
// Matches a calendar event to a candidate row in the unified Tracker tab by attendee
// email, falling back to a name-in-title match if no attendee email is on file.
//
// COLUMN CONTRACT
//   READ:   CANDIDATE, EMAIL, STAGE
//   WRITE:  STAGE, INTERVIEW DATE, INTERVIEWER, ROUND, UPDATED
//   NEVER:  DEPARTMENT, REFERRED BY
// DEPARTMENT and REFERRED BY are never looked up — not just left blank,
// structurally absent from anything this script can touch. If a future edit
// needs to read or write either, that's a deliberate contract change, not a
// side effect of an unrelated fix.

// ====== CONFIG ======
const CALENDAR_ID = 'kerrian.gordon@pursuit.org'; // swap for a specific shared calendar ID if interviews live there

// ====== ONE-TIME SETUP — run this once manually from the Apps Script editor ======
function createCalendarTrigger() {
  ScriptApp.newTrigger('onCalendarUpdate')
    .forUserCalendar(CALENDAR_ID)
    .onEventUpdated()
    .create();
}

// ====== FIRES ON EVERY CALENDAR CHANGE ======
function onCalendarUpdate(e) {
  const props = PropertiesService.getUserProperties();
  let syncToken = props.getProperty('syncToken');
  let events;

  try {
    events = Calendar.Events.list(e.calendarId, syncToken ? { syncToken } : { maxResults: 50, timeMin: new Date().toISOString() });
  } catch (err) {
    // sync token can expire — drop it and resync fresh rather than crash silently
    props.deleteProperty('syncToken');
    events = Calendar.Events.list(e.calendarId, { maxResults: 50, timeMin: new Date().toISOString() });
  }

  events.items.forEach(processEvent);
  if (events.nextSyncToken) props.setProperty('syncToken', events.nextSyncToken);
}

// ====== MATCH + WRITE, COLUMN-SCOPED ======
function processEvent(event) {
  if (event.status === 'cancelled') return;

  const ss = SpreadsheetApp.getActiveSpreadsheet(); // openById(...) if the Tracker lives in a different file
  const tracker = ss.getSheetByName(TRACKER_NAME);
  const data = tracker.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  // Only the columns Scenario 2 is allowed to touch.
  const emailCol         = headers.indexOf('EMAIL');
  const nameCol           = headers.indexOf('CANDIDATE');
  const stageCol          = headers.indexOf('STAGE');
  const interviewDateCol = headers.indexOf('INTERVIEW DATE');
  const interviewerCol   = headers.indexOf('INTERVIEWER');
  const roundCol          = headers.indexOf('ROUND');
  const updatedCol       = headers.indexOf('UPDATED');

  const required = [['EMAIL',emailCol],['CANDIDATE',nameCol],['STAGE',stageCol],
                     ['INTERVIEW DATE',interviewDateCol],['INTERVIEWER',interviewerCol],
                     ['ROUND',roundCol],['UPDATED',updatedCol]];
  const missing = required.filter(([, idx]) => idx === -1);
  if (missing.length > 0) {
    logError(ss, `Missing column(s): ${missing.map(m => m[0]).join(', ')} — check Row 1 in "${TRACKER_NAME}"`);
    return;
  }

  const attendees = (event.attendees || []).map(a => (a.email || '').toLowerCase());
  const title = event.summary || '';
  const dateStr = (event.start && (event.start.dateTime || event.start.date)) || '';
  const interviewer = (event.organizer && event.organizer.email) || '';
  const roundMatch = title.match(/round\s*\d+/i);
  const round = roundMatch ? roundMatch[0] : '';

  // 1. exact attendee email match
  let matchRow = -1, method = null, via = null;
  for (let i = 1; i < data.length; i++) {
    const rowEmail = String(data[i][emailCol]).trim().toLowerCase();
    if (attendees.includes(rowEmail)) { matchRow = i + 1; method = 'email'; via = rowEmail; break; }
  }

  // 2. fallback — candidate name appears in the event title
  if (matchRow === -1) {
    const titleLower = title.toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const rowName = String(data[i][nameCol]).trim().toLowerCase();
      if (rowName && titleLower.includes(rowName)) { matchRow = i + 1; method = 'name-fallback'; via = rowName; break; }
    }
  }

  if (matchRow === -1) {
    logError(ss, `No match for "${title}" (${dateStr}) — attendees: ${attendees.join(', ') || 'none'}`);
    return;
  }

  try {
    tracker.getRange(matchRow, interviewDateCol + 1).setValue(dateStr);
    tracker.getRange(matchRow, interviewerCol + 1).setValue(interviewer);
    tracker.getRange(matchRow, roundCol + 1).setValue(round);
    const currentStage = tracker.getRange(matchRow, stageCol + 1).getValue();
    if (currentStage === 'Applied') tracker.getRange(matchRow, stageCol + 1).setValue('Interview');
    tracker.getRange(matchRow, updatedCol + 1).setValue(new Date());
    if (method === 'name-fallback') {
      logError(ss, `Matched "${title}" to row ${matchRow} by name (${via}), not attendee email — worth a glance to confirm.`);
    }
  } catch (err) {
    logError(ss, `Write failed for "${title}": ${err.message}`);
  }
}
