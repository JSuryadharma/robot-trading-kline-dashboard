import tls from 'node:tls';

export async function sendGmailBrief(settings, { subject, text }) {
  const email = settings.email || {};
  if (!email.enabled || !email.gmailUser || !email.gmailAppPassword || !email.gmailTo) {
    return { sent: false, reason: 'Gmail settings are incomplete.' };
  }

  const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
  socket.setEncoding('utf8');

  try {
    await readResponse(socket, 220);
    await command(socket, `EHLO localhost`, 250);
    await command(socket, 'AUTH LOGIN', 334);
    await command(socket, Buffer.from(email.gmailUser).toString('base64'), 334);
    await command(socket, Buffer.from(email.gmailAppPassword).toString('base64'), 235);
    await command(socket, `MAIL FROM:<${email.gmailUser}>`, 250);
    await command(socket, `RCPT TO:<${email.gmailTo}>`, 250);
    await command(socket, 'DATA', 354);
    socket.write(formatMessage({
      from: email.gmailUser,
      to: email.gmailTo,
      subject,
      text
    }));
    await readResponse(socket, 250);
    await command(socket, 'QUIT', 221);
    return { sent: true };
  } finally {
    socket.end();
  }
}

export function buildBriefEmail({ report, candidates, emailResult }) {
  const lines = [
    `Robot Trading Brief`,
    `Updated: ${report.createdAt}`,
    `Mode: ${report.mode}`,
    '',
    report.text,
    '',
    'Candidates:'
  ];

  for (const item of candidates.slice(0, 8)) {
    const news = item.news?.items?.[0]?.title || 'No headline';
    const verdict = item.newsAnalysis?.verdict || 'neutral';
    const newsConfidence = item.newsAnalysis?.confidencePercentage ?? 0;
    lines.push(`${item.symbol}: ${item.decision.action} score ${item.decision.score}, confidence ${item.decision.confidencePercentage ?? '--'}%, 3M ${item.ranking?.performance3m ?? '--'}%, news ${verdict} ${newsConfidence}% - ${news}`);
  }

  if (emailResult?.reason) lines.push('', `Email note: ${emailResult.reason}`);
  return lines.join('\n');
}

function formatMessage({ from, to, subject, text }) {
  const safeSubject = sanitizeHeader(subject);
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'),
    '.',
    ''
  ].join('\r\n');
}

function sanitizeHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 160);
}

function command(socket, line, expected) {
  socket.write(`${line}\r\n`);
  return readResponse(socket, expected);
}

function readResponse(socket, expected) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP timed out.'));
    }, 12_000);

    function cleanup() {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onData(chunk) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const finalLine = lines.find((line) => /^\d{3} /.test(line));
      if (!finalLine) return;
      const code = Number(finalLine.slice(0, 3));
      cleanup();
      if (code === expected || (Array.isArray(expected) && expected.includes(code))) resolve(buffer);
      else reject(new Error(`SMTP expected ${expected}, received ${finalLine}`));
    }

    socket.on('data', onData);
    socket.on('error', onError);
  });
}
