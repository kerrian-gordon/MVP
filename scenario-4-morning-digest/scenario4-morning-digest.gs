// Scenario 4 — Morning Digest
// Pure reader: takes the current state of the unified Tracker tab and posts a
// plain-text summary to Slack. Never writes to the Tracker — it's only as
// accurate as what Scenarios 1–3 already put there.

// ====== CONFIG ======
const TRACKER_NAME = 'Tracker';
const ERROR_TAB_NAME = 'Errors';
const SLACK_WEBHOOK_URL = 'YOUR_SLACK_INCOMING_WEBHOOK_URL';

// ====== ONE-TIME SETUP — run this once manually from the Apps Script editor ======
function createDailyDigestTrigger() {
  ScriptApp.newTrigger('postMorningDigest')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

// ====== FIRES DAILY AT ~8AM ======
function postMorningDigest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tracker = ss.getSheetByName(TRACKER_NAME);
  if (!tracker) {
    logError(ss, `Tracker tab "${TRACKER_NAME}" not found — digest not sent.`);
    return;
  }
  const data = tracker.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const col = name => headers.indexOf(name);
  const cols = {
    name: col('CANDIDATE'), role: col('ROLE'), dept: col('DEPARTMENT'), stage: col('STAGE'),
    interviewDate: col('INTERVIEW DATE'), interviewer: col('INTERVIEWER'), round: col('ROUND'),
    referredBy: col('REFERRED BY'), updated: col('UPDATED')
  };
  const missing = Object.entries(cols).filter(([, v]) => v === -1);
  if (missing.length > 0) {
    logError(ss, `Digest aborted — missing column(s): ${missing.map(m => m[0]).join(', ')}`);
    return;
  }

  const today = new Date();
  const isSameDay = (d) => {
    if (!d) return false;
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return false;
    return date.toDateString() === today.toDateString();
  };

  const rows = data.slice(1);
  const newApplicants   = rows.filter(r => r[cols.stage] === 'Applied' && isSameDay(r[cols.updated]));
  const todaysInterviews = rows.filter(r => isSameDay(r[cols.interviewDate]));
  const pendingOffers    = rows.filter(r => r[cols.stage] === 'Offer');

  const text = buildDigestText(today, newApplicants, todaysInterviews, pendingOffers, cols);

  try {
    postToSlack(text);
  } catch (err) {
    logError(ss, `Slack post failed: ${err.message}`);
  }
}

function buildDigestText(today, newApplicants, interviews, offers, cols) {
  const tz = Session.getScriptTimeZone();
  const dateStr = Utilities.formatDate(today, tz, 'MMM d, yyyy');
  let text = `📋 Morning Recruiting Digest — ${dateStr}\n\n`;

  text += `NEW APPLICANTS (${newApplicants.length})\n`;
  text += newApplicants.length
    ? newApplicants.map(r => `• ${r[cols.name]} — ${r[cols.role]} (${r[cols.dept]})${r[cols.referredBy] ? ' — referred by ' + r[cols.referredBy] : ''}`).join('\n')
    : 'Nothing new today.';
  text += '\n\n';

  text += `TODAY'S INTERVIEWS (${interviews.length})\n`;
  text += interviews.length
    ? interviews.map(r => `• ${formatTime(r[cols.interviewDate], tz)} — ${r[cols.name]} — ${r[cols.role]}, ${r[cols.round] || 'round TBD'} with ${r[cols.interviewer] || 'TBD'}`).join('\n')
    : 'No interviews scheduled today.';
  text += '\n\n';

  text += `PENDING OFFERS (${offers.length})\n`;
  text += offers.length
    ? offers.map(r => `• ${r[cols.name]} — ${r[cols.role]} — offer out since ${formatDateOnly(r[cols.updated], tz)}`).join('\n')
    : 'No offers currently pending.';

  return text;
}

function formatTime(d, tz) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return 'time TBD';
  return Utilities.formatDate(date, tz, 'h:mm a');
}

function formatDateOnly(d, tz) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return 'unknown date';
  return Utilities.formatDate(date, tz, 'MMM d');
}

function postToSlack(text) {
  const payload = { text: text };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const resp = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
  if (resp.getResponseCode() !== 200) {
    throw new Error(`Slack responded ${resp.getResponseCode()}: ${resp.getContentText()}`);
  }
}

function logError(ss, message) {
  let tab = ss.getSheetByName(ERROR_TAB_NAME);
  if (!tab) {
    tab = ss.insertSheet(ERROR_TAB_NAME);
    tab.appendRow(['Timestamp', 'Message']);
  }
  tab.appendRow([new Date(), message]);
}
