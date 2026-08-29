import { Resend } from 'resend';
import prisma from '@/lib/db';

interface TicketEmailInput {
  userId: string;
  recoveryCaseId: string;
  packageId: string;
  ticketing?: {
    pnr?: string;
    ticketNumber?: string;
    orderId?: string;
    status?: string;
  };
  newPrice?: number;
  priceChanged?: boolean;
}

interface SendTicketEmailResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}

/**
 * Normalized flight segment.
 *
 * Segments reach this service in two different shapes:
 * - `RecoveryPackage.segments` (Json) holds the raw Atlas `SearchSegment`
 *   (`departureTime` / `arrivalTime` / `aircraft` / `duration`).
 * - `BookingSegment` rows hold `departureAt` / `arrivalAt` / `cabinClass`.
 */
interface TicketSegment {
  origin: string;
  destination: string;
  flightNo: string;
  airline: string;
  aircraft?: string;
  cabinClass?: string;
  durationMinutes?: number;
  departure: Date | null;
  arrival: Date | null;
}

function isEmailConfigured() {
  return Boolean(
    process.env.EMAIL_ENABLED === 'true' &&
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM
  );
}

function formatMoney(value: unknown, currency = 'USD') {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatClock(value: Date | null) {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

function formatDay(value: Date | null) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function formatIssuedAt(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeSegment(value: unknown): TicketSegment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const origin = asText(raw.origin);
  const destination = asText(raw.destination);
  if (!origin || !destination) return null;

  const duration = raw.duration;

  return {
    origin,
    destination,
    flightNo: asText(raw.flightNo) || 'TBC',
    airline: asText(raw.airline) || 'Operating carrier',
    aircraft: asText(raw.aircraft),
    cabinClass: asText(raw.cabinClass),
    durationMinutes: typeof duration === 'number' ? duration : undefined,
    // Atlas search segments use *Time; persisted booking segments use *At.
    departure: toDate(raw.departureTime ?? raw.departureAt),
    arrival: toDate(raw.arrivalTime ?? raw.arrivalAt),
  };
}

export function normalizeSegments(value: unknown): TicketSegment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeSegment)
    .filter((segment): segment is TicketSegment => segment !== null);
}

// ========== Atlas e-ticket template (demo watermarked) ==========

const DEMO_AMBER_BG = '#fff6e5';
const DEMO_AMBER_TEXT = '#8a5a00';
const DEMO_AMBER_BORDER = '#f0d5a0';
const WATERMARK_GREY = '#e8ebef';
const RULE = '#dde2e8';
const MUTED = '#68727f';
const INK = '#101418';
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

/** Faint repeated "DEMO" band — renders identically in every mail client. */
function watermarkBand() {
  return `
    <tr>
      <td style="padding:0 28px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:7px;color:${WATERMARK_GREY};white-space:nowrap;overflow:hidden;padding:7px 0;border-top:1px solid ${RULE};">
          DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO&nbsp;·&nbsp;DEMO
        </div>
      </td>
    </tr>`;
}

function demoBadge() {
  return `<span style="display:inline-block;background:${DEMO_AMBER_BG};color:${DEMO_AMBER_TEXT};border:1px solid ${DEMO_AMBER_BORDER};border-radius:3px;font-size:9px;font-weight:800;letter-spacing:1.4px;padding:2px 5px;vertical-align:middle;">DEMO</span>`;
}

function fieldCell(label: string, value: string, opts?: { mono?: boolean; badge?: boolean }) {
  const valueStyle = opts?.mono
    ? `font-family:${MONO};font-size:16px;font-weight:700;letter-spacing:1px;color:${INK};`
    : `font-size:14px;font-weight:600;color:${INK};`;

  return `
    <td width="50%" valign="top" style="padding:11px 0;">
      <div style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};margin-bottom:5px;">${escapeHtml(label)}</div>
      <div style="${valueStyle}">${escapeHtml(value)}${opts?.badge ? `&nbsp;${demoBadge()}` : ''}</div>
    </td>`;
}

function segmentBlock(segment: TicketSegment, index: number, total: number) {
  const duration = formatDuration(segment.durationMinutes);
  const meta = [segment.aircraft, segment.cabinClass, duration]
    .filter(Boolean)
    .map((part) => escapeHtml(part))
    .join('&nbsp;·&nbsp;');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${RULE};border-radius:4px;margin-bottom:${index === total - 1 ? '0' : '10px'};">
      <tr>
        <td style="padding:12px 16px;background:#f7f9fb;border-bottom:1px solid ${RULE};">
          <span style="font-size:13px;font-weight:700;color:${INK};">${escapeHtml(segment.airline)}</span>
          <span style="font-family:${MONO};font-size:13px;font-weight:700;color:${INK};">&nbsp;&nbsp;${escapeHtml(segment.flightNo)}</span>
          ${meta ? `<span style="font-size:11px;color:${MUTED};">&nbsp;&nbsp;${meta}</span>` : ''}
          <span style="float:right;font-size:10px;letter-spacing:1.2px;color:${MUTED};">FLIGHT ${index + 1} OF ${total}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td width="42%" valign="top">
                <div style="font-family:${MONO};font-size:26px;font-weight:800;letter-spacing:1px;color:${INK};">${escapeHtml(segment.origin)}</div>
                <div style="font-size:17px;font-weight:700;color:${INK};margin-top:2px;">${escapeHtml(formatClock(segment.departure))}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:3px;">${escapeHtml(formatDay(segment.departure))}</div>
              </td>
              <td width="16%" align="center" valign="middle" style="font-size:15px;color:${MUTED};">&#9992;</td>
              <td width="42%" valign="top" align="right">
                <div style="font-family:${MONO};font-size:26px;font-weight:800;letter-spacing:1px;color:${INK};">${escapeHtml(segment.destination)}</div>
                <div style="font-size:17px;font-weight:700;color:${INK};margin-top:2px;">${escapeHtml(formatClock(segment.arrival))}</div>
                <div style="font-size:11px;color:${MUTED};margin-top:3px;">${escapeHtml(formatDay(segment.arrival))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function buildTicketEmailHtml(params: {
  passengerName: string;
  originalPnr?: string | null;
  newPnr?: string;
  ticketNumber?: string;
  atlasOrderId?: string | null;
  segments: TicketSegment[];
  fare: string;
  authorizedFare: string;
  journeyTime?: number | null;
  recoveryUrl: string;
  priceChanged?: boolean;
  issuedAt: Date;
}) {
  const segmentsHtml = params.segments.length
    ? params.segments
        .map((segment, index) => segmentBlock(segment, index, params.segments.length))
        .join('')
    : `<div style="border:1px dashed ${RULE};border-radius:4px;padding:18px;font-size:13px;color:${MUTED};">Segment details are still being returned by Atlas.</div>`;

  const totalJourney = formatDuration(params.journeyTime ?? undefined);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f4;">
  <div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;">DEMO specimen e-ticket — no travel value, no card charged.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef1f4;padding:26px 12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:#ffffff;border:1px solid #d5dbe2;border-radius:6px;overflow:hidden;">

          <tr>
            <td style="padding:9px 28px;background:${DEMO_AMBER_BG};border-bottom:1px dashed ${DEMO_AMBER_BORDER};">
              <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:${DEMO_AMBER_TEXT};text-align:center;">
                DEMO SPECIMEN &nbsp;·&nbsp; NOT VALID FOR TRAVEL &nbsp;·&nbsp; NO PAYMENT TAKEN
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px 16px;border-bottom:1px solid ${RULE};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="top">
                    <div style="font-size:19px;font-weight:800;letter-spacing:5px;color:${INK};">ATLAS</div>
                    <div style="font-size:12px;color:${MUTED};margin-top:5px;">Electronic Ticket &middot; Itinerary Receipt</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="display:inline-block;background:#eaf7ee;color:#1a6b34;border:1px solid #bfe2c9;border-radius:3px;font-size:10px;font-weight:800;letter-spacing:1.4px;padding:4px 8px;">TICKETED</div>
                    <div style="font-size:11px;color:${MUTED};margin-top:7px;">Issued ${escapeHtml(formatIssuedAt(params.issuedAt))}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 4px;">
              <p style="font-size:14px;line-height:1.6;color:#39424e;margin:0;">
                Dear ${escapeHtml(params.passengerName)}, your replacement itinerary has been re-issued through Atlas. Present this receipt with photo ID at check-in.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:6px 28px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  ${fieldCell('Passenger', params.passengerName)}
                  ${fieldCell('Passenger type', 'ADT · Adult')}
                </tr>
                <tr>
                  ${fieldCell('Booking reference (PNR)', params.newPnr || 'Pending', { mono: true, badge: true })}
                  ${fieldCell('E-ticket number', params.ticketNumber || 'Pending', { mono: true, badge: true })}
                </tr>
                <tr>
                  ${fieldCell('Atlas order number', params.atlasOrderId || 'N/A', { mono: true })}
                  ${fieldCell('Rebooked from PNR', params.originalPnr || 'N/A', { mono: true })}
                </tr>
              </table>
            </td>
          </tr>

          ${watermarkBand()}

          <tr>
            <td style="padding:4px 28px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${INK};">Itinerary</span>
                    ${totalJourney ? `<span style="font-size:11px;color:${MUTED};">&nbsp;&nbsp;Total journey ${escapeHtml(totalJourney)}</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 28px 0;">
              ${segmentsHtml}
              <div style="text-align:center;font-size:40px;font-weight:800;letter-spacing:16px;color:${WATERMARK_GREY};padding:14px 0 6px;">DEMO</div>
              <div style="font-size:10px;color:${MUTED};text-align:center;padding-bottom:6px;">All times are local to each airport.</div>
            </td>
          </tr>

          ${watermarkBand()}

          <tr>
            <td style="padding:4px 28px 0;">
              <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${INK};margin-bottom:8px;">Fare &amp; payment</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;">
                <tr>
                  <td style="padding:6px 0;color:${MUTED};">Fare quoted</td>
                  <td style="padding:6px 0;text-align:right;font-weight:600;color:${INK};">${escapeHtml(params.fare)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:${MUTED};border-top:1px solid ${RULE};">Total authorized</td>
                  <td style="padding:6px 0;text-align:right;font-weight:800;color:${INK};border-top:1px solid ${RULE};">${escapeHtml(params.authorizedFare)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:${MUTED};">Form of payment</td>
                  <td style="padding:6px 0;text-align:right;font-weight:600;color:${INK};">Demo card &middot; not charged&nbsp;${demoBadge()}</td>
                </tr>
              </table>
              ${
                params.priceChanged
                  ? `<p style="font-size:12px;line-height:1.55;color:${DEMO_AMBER_TEXT};background:${DEMO_AMBER_BG};border:1px solid ${DEMO_AMBER_BORDER};border-radius:4px;padding:10px 12px;margin:12px 0 0;">Atlas re-verified this fare at ticketing, so the authorized total differs from the originally quoted package price.</p>`
                  : ''
              }
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px 0;">
              <a href="${escapeHtml(params.recoveryUrl)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:4px;padding:12px 18px;">View recovery case</a>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px 0;">
              <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${INK};margin-bottom:8px;">Before you fly</div>
              <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.7;color:#4b5563;">
                <li>Check in online or reach the counter at least 60 minutes before departure.</li>
                <li>Carry the photo ID or passport used at booking; the name must match this receipt.</li>
                <li>Baggage allowance follows the operating carrier's published rules for this fare.</li>
              </ul>
            </td>
          </tr>

          ${watermarkBand()}

          <tr>
            <td style="padding:12px 28px 20px;background:#f7f9fb;">
              <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:${DEMO_AMBER_TEXT};margin-bottom:7px;">DEMO SPECIMEN &middot; NOT VALID FOR TRAVEL</div>
              <div style="font-size:11px;line-height:1.6;color:${MUTED};">
                This document was generated by the Pathfinder demo after a user-approved rebooking against the Atlas demo adapter. The ticket number, PNR and order number are simulated, no seat is held with any airline, and no payment card was charged.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTicketEmailText(params: {
  passengerName: string;
  originalPnr?: string | null;
  newPnr?: string;
  ticketNumber?: string;
  atlasOrderId?: string | null;
  segments: TicketSegment[];
  authorizedFare: string;
  recoveryUrl: string;
}) {
  const lines = [
    '*** DEMO SPECIMEN - NOT VALID FOR TRAVEL - NO PAYMENT TAKEN ***',
    '',
    'ATLAS - ELECTRONIC TICKET / ITINERARY RECEIPT',
    '',
    `Passenger:            ${params.passengerName}`,
    `Booking ref (PNR):    ${params.newPnr || 'Pending'}  [DEMO]`,
    `E-ticket number:      ${params.ticketNumber || 'Pending'}  [DEMO]`,
    `Atlas order number:   ${params.atlasOrderId || 'N/A'}`,
    `Rebooked from PNR:    ${params.originalPnr || 'N/A'}`,
    '',
    'ITINERARY',
  ];

  if (params.segments.length) {
    params.segments.forEach((segment, index) => {
      lines.push(
        `  ${index + 1}. ${segment.airline} ${segment.flightNo}  ${segment.origin} -> ${segment.destination}`,
        `     Dep ${formatClock(segment.departure)} ${formatDay(segment.departure)}`,
        `     Arr ${formatClock(segment.arrival)} ${formatDay(segment.arrival)}`
      );
    });
  } else {
    lines.push('  Segment details are still being returned by Atlas.');
  }

  lines.push(
    '',
    `Total authorized:     ${params.authorizedFare} (demo card, not charged)`,
    '',
    `Recovery case:        ${params.recoveryUrl}`,
    '',
    'This is a simulated document from the Pathfinder demo. The PNR, ticket',
    'number and order number are not real and no seat is held with any airline.'
  );

  return lines.join('\n');
}

export async function sendTicketEmail(input: TicketEmailInput): Promise<SendTicketEmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, skipped: true, reason: 'Email delivery is not configured.' };
  }

  const recovery = await prisma.recoveryCase.findFirst({
    where: {
      id: input.recoveryCaseId,
      booking: { userId: input.userId },
    },
    include: {
      booking: {
        include: {
          user: true,
          segments: { orderBy: { sortOrder: 'asc' } },
        },
      },
      packages: {
        where: { id: input.packageId },
        take: 1,
      },
    },
  });

  if (!recovery) {
    return { sent: false, skipped: true, reason: 'Recovery case not found or unauthorized.' };
  }

  const recipient =
    process.env.EMAIL_TO_OVERRIDE ||
    recovery.booking.passengerEmail ||
    recovery.booking.user.email;

  if (!recipient || !recipient.includes('@')) {
    return { sent: false, skipped: true, reason: 'No valid recipient email.' };
  }

  const selectedPackage = recovery.packages[0];

  // Prefer the rebooked Atlas package; fall back to the original booking segments.
  const segments = normalizeSegments(selectedPackage?.segments);
  const ticketSegments = segments.length
    ? segments
    : normalizeSegments(recovery.booking.segments);

  const currency = selectedPackage?.currency || 'USD';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const recoveryUrl = `${appUrl.replace(/\/$/, '')}/recovery/${input.recoveryCaseId}`;

  const passengerName =
    recovery.booking.passengerName || recovery.booking.user.name || 'Traveler';
  const fare = formatMoney(selectedPackage?.price, currency);
  const authorizedFare = formatMoney(input.newPrice ?? selectedPackage?.price, currency);

  const routeLabel = ticketSegments.length
    ? `${ticketSegments[0].origin}\u2013${ticketSegments[ticketSegments.length - 1].destination}`
    : 'Replacement itinerary';

  const templateParams = {
    passengerName,
    originalPnr: recovery.booking.pnr,
    newPnr: input.ticketing?.pnr,
    ticketNumber: input.ticketing?.ticketNumber,
    atlasOrderId: recovery.booking.atlasOrderId,
    segments: ticketSegments,
    authorizedFare,
    recoveryUrl,
  };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const response = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: recipient,
    subject: `[DEMO] Atlas e-Ticket \u00b7 ${routeLabel}${
      input.ticketing?.pnr ? ` \u00b7 PNR ${input.ticketing.pnr}` : ''
    }`,
    html: buildTicketEmailHtml({
      ...templateParams,
      fare,
      journeyTime: selectedPackage?.journeyTime,
      priceChanged: input.priceChanged,
      issuedAt: new Date(),
    }),
    text: buildTicketEmailText(templateParams),
  });

  if (response.error) {
    throw new Error(response.error.message || 'Resend email delivery failed.');
  }

  return { sent: true, messageId: response.data?.id };
}
