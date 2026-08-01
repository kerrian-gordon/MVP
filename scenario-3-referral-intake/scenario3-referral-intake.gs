// Scenario 3 — Referral Intake
// Writes internal referral form submissions into the unified Tracker tab.
//
// COLUMN CONTRACT
//   READ:   EMAIL
//   WRITE:  CANDIDATE, EMAIL, ROLE, DEPARTMENT, STAGE (new rows only), REFERRED BY, UPDATED
//   NEVER:  INTERVIEW DATE, INTERVIEWER, ROUND
// Those three belong to Scenario 2. If a future edit needs to read or write
// any of them here, that's a deliberate contract change, not a side effect
// of an unrelated fix.

function onFormSubmit(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // switch to openById('...') if the Form's responses live in a different file than the Tracker
  const tracker = ss.getSheetByName(TRACKER_NAME);
  const data = tracker.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const emailCol    = headers.indexOf('EMAIL');
  const nameCol     = headers.indexOf('CANDIDATE');
  const roleCol     = headers.indexOf('ROLE');
  const deptCol     = headers.indexOf('DEPARTMENT');
  const stageCol    = headers.indexOf('STAGE');
  const referredCol = headers.indexOf('REFERRED BY');
  const updatedCol  = headers.indexOf('UPDATED');

  const required = [['EMAIL',emailCol],['CANDIDATE',nameCol],['ROLE',roleCol],
                     ['DEPARTMENT',deptCol],['STAGE',stageCol],['REFERRED BY',referredCol],['UPDATED',updatedCol]];
  const missing = required.filter(([, idx]) => idx === -1);
  if (missing.length > 0) {
   logError(ss, `Missing column(s): ${missing.map(m => m[0]).join(', ')} — check Row 1 in "${TRACKER_NAME}"`);
    return;
  }

  const r = e.namedValues;
  const referredBy     = (r['Referred by'] || [''])[0].trim();
  const candidateName  = (r['Candidate name'] || [''])[0].trim();
  const candidateEmail = (r['Candidate email'] || [''])[0].trim().toLowerCase();
  const role           = (r['Role'] || [''])[0].trim();
  const department     = (r['Department'] || [''])[0].trim();

  if (!candidateEmail) {
    logError(ss, `Referral from ${referredBy || 'unknown'} for ${candidateName || 'unknown candidate'} — no email captured, skipped to avoid a false match.`);
    return;
  }

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
      tracker.getRange(foundRow, referredCol + 1).setValue(referredBy);
      tracker.getRange(foundRow, updatedCol + 1).setValue(today);
    } else {
      const newRow = new Array(headers.length).fill('');
      newRow[nameCol]     = candidateName;
      newRow[emailCol]    = candidateEmail;
      newRow[roleCol]     = role;
      newRow[deptCol]     = department;
      newRow[stageCol]    = 'Applied';
      newRow[referredCol] = referredBy;
      newRow[updatedCol]  = today;
      tracker.appendRow(newRow);
    }
  } catch (err) {
    logError(ss, `Write failed for ${candidateEmail}: ${err.message}`);
  }
}
