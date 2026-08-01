// Scenario 1 — Email Sync
// Parses new emails in the "Recruiting" Gmail label and writes them into the
// unified Tracker tab. Apps Script has no native "on new email" trigger, so
// this runs on a short time-based interval and tracks what it's already
// processed via a second Gmail label, rather than reprocessing the same
// thread every run.
//
// COLUMN CONTRACT
//   READ:   EMAIL
//   WRITE:  CANDIDATE, EMAIL, ROLE, DEPARTMENT, STAGE, UPDATED
//   NEVER:  INTERVIEW DATE, INTERVIEWER, ROUND, REFERRED BY
// Those four belong to Scenarios 2 and 3. If a future edit needs to read or
// write any of them here, that's a deliberate contract change, not a side
// effect of an unrelated fix.

// ====== CONFIG ======
const TRACKER_NAME = 'Tracker';
const ERROR_TAB_NAME = 'Errors';
const GMAIL_LABEL = 'Recruiting';
const PROCESSED_LABEL = 'Recruiting/Processed';
const NEEDS_REVIEW_LABEL = 'Recruiting/Needs Review';

// ====== ONE-TIME SETUP — run this once manually from the Apps Script editor ======
function createEmailSyncTrigger() {
  // Gmail has no push trigger in Apps Script — poll on a short interval instead.
  ScriptApp.newTrigger('processRecruitingEmails')
    .timeBased()
    .everyMinutes(10)
    .create();

  // Make sure the labels this script depends on actually exist before it runs.
  [GMAIL_LABEL, PROCESSED_LABEL, NEEDS_REVIEW_LABEL].forEach(name => {
    if (!GmailApp.getUserLabelByName(name)) GmailApp.createLabel(name);
  });
}

// ====== FIRES EVERY 10 MINUTES ======
function processRecruitingEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // openById('...') if the Tracker lives in a different file
  const tracker = ss.getSheetByName(TRACKER_NAME);
  if (!tracker) {
    logError(ss, `Tracker tab "${TRACKER_NAME}" not found — sync skipped.`);
    return;
  }

  const threads = GmailApp.search(`label:${labelQuery(GMAIL_LABEL)} -label:${labelQuery(PROCESSED_LABEL)}`, 0, 25);
  if (threads.length === 0) return;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    const latest = messages[messages.length - 1];
    handleMessage(ss, tracker, thread, latest);
  });
}

function labelQuery(name) {
  // Gmail search treats "/" in label names as a nested-label path, which works fine unquoted.
  return name.replace(/\s+/g, '-').toLowerCase();
}

function handleMessage(ss, tracker, thread, message) {
  const raw = message.getPlainBody();
  const subject = message.getSubject();
  const from = message.getFrom();

  const fields = {
    name: extract(raw, /Candidate:\s*(.+)/i),
    email: extract(raw, /Email:\s*([\w.+-]+@[\w-]+\.[\w.-]+)/i),
    role: extract(raw, /Role:\s*(.+)/i),
    department: extract(raw, /Department:\s*(.+)/i),
    stage: extract(raw, /Stage:\s*(.+)/i),
  };

  if (!fields.email || !fields.name) {
    const missing = [!fields.name && 'candidate name', !fields.email && 'candidate email'].filter(Boolean);
    logError(ss, `"${subject}" from ${from} — missing ${missing.join(', ')}. Flagged in Gmail, not written.`);
    applyLabels(thread, [PROCESSED_LABEL, NEEDS_REVIEW_LABEL]);
    return;
  }

  const data = tracker.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const emailCol = headers.indexOf('EMAIL');
  const nameCol = headers.indexOf('CANDIDATE');
  const roleCol = headers.indexOf('ROLE');
  const deptCol = headers.indexOf('DEPARTMENT');
  const stageCol = headers.indexOf('STAGE');
  const updatedCol = headers.indexOf('UPDATED');

  const required = [['EMAIL',emailCol],['CANDIDATE',nameCol],['ROLE',roleCol],
                     ['DEPARTMENT',deptCol],['STAGE',stageCol],['UPDATED',updatedCol]];
  const missingCols = required.filter(([, idx]) => idx === -1);
  if (missingCols.length > 0) {
    logError(ss, `Missing column(s): ${missingCols.map(m => m[0]).join(', ')} — check Row 1 in "${TRACKER_NAME}"`);
    return; // leave the thread unprocessed — worth retrying once the sheet is fixed, not a data problem
  }

  const candidateEmail = fields.email.trim().toLowerCase();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).trim().toLowerCase() === candidateEmail) {
      foundRow = i + 1;
      break;
    }
  }

  const today = new Date();

  try {
    if (foundRow > -1) {
      if (fields.role) tracker.getRange(foundRow, roleCol + 1).setValue(fields.role);
      if (fields.department) tracker.getRange(foundRow, deptCol + 1).setValue(fields.department);
      if (fields.stage) tracker.getRange(foundRow, stageCol + 1).setValue(fields.stage);
      tracker.getRange(foundRow, updatedCol + 1).setValue(today);
    } else {
      const newRow = new Array(headers.length).fill('');
      newRow[nameCol]   = fields.name;
      newRow[emailCol]  = candidateEmail;
      newRow[roleCol]   = fields.role || '';
      newRow[deptCol]   = fields.department || '';
      newRow[stageCol]  = fields.stage || 'Applied';
      newRow[updatedCol] = today;
      tracker.appendRow(newRow);
    }
    applyLabels(thread, [PROCESSED_LABEL]);
  } catch (err) {
    logError(ss, `Write failed for ${candidateEmail}: ${err.message}`);
  }
}

function extract(raw, regex) {
  const m = raw.match(regex);
  return m ? m[1].trim() : null;
}

function applyLabels(thread, labelNames) {
  labelNames.forEach(name => {
    const label = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
    thread.addLabel(label);
  });
}

function logError(ss, message) {
  let tab = ss.getSheetByName(ERROR_TAB_NAME);
  if (!tab) {
    tab = ss.insertSheet(ERROR_TAB_NAME);
    tab.appendRow(['Timestamp', 'Message']);
  }
  tab.appendRow([new Date(), message]);
}

// TEMPORARY — paste this in alongside the real script, run it once to diagnose,
// then delete it. Not part of the real pipeline.
function debugCheckLabel() {
  const threads = GmailApp.search('label:recruiting -label:recruiting/processed');
  Logger.log('Threads found matching "recruiting, not yet processed": ' + threads.length);
  threads.forEach(t => Logger.log(' - ' + t.getFirstMessageSubject()));

  const allRecruiting = GmailApp.search('label:recruiting');
  Logger.log('Total threads with "recruiting" label (any state): ' + allRecruiting.length);
  allRecruiting.forEach(t => {
    const labels = t.getLabels().map(l => l.getName());
    Logger.log(' - "' + t.getFirstMessageSubject() + '" has labels: ' + labels.join(', '));
  });
}
