/**
 * A cited answer, made portable.
 *
 * Why this exists: the app's whole claim is a citation you can check by hand —
 * but the checking happens in the app, alone. A student who is stuck at 9pm
 * does not want a second student to install anything: they want to send the
 * question, the answer and the page to the classmate who has the book open.
 *
 * So this module turns one answer into a *card*: plain text, no markup, short
 * enough to travel through the in-app chat (which caps a message at 500
 * characters), and carrying a link that opens the same question in the app.
 * The link uses the `?ask=` parameter the goal cards already understand, so a
 * classmate who taps it lands in the ask box with the question written out.
 *
 * Rules kept here:
 *   1. The card never claims more than the answer did. If the answer had no
 *      citation, the card says so instead of inventing a page line.
 *   2. Plain text only: it has to survive WhatsApp, SMS, a photocopy and a
 *      school noticeboard equally badly, and markup would help none of them.
 *   3. It is trimmed to the chat limit *before* it is offered, so "Ask a
 *      classmate" cannot silently fail on a long answer.
 */

/** The in-app chat refuses anything longer; trim here, not there. */
export const CARD_LIMIT = 480;

const clean = (value) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    // A card is text for a human; drop the emphasis markers the answer uses.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

/** Cut to a length without leaving half a word or an unclosed bracket. */
export function trimTo(text, limit) {
  const value = String(text ?? "").trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, Math.max(0, limit - 1));
  const atSpace = cut.lastIndexOf(" ");
  const kept = (atSpace > limit * 0.6 ? cut.slice(0, atSpace) : cut).trimEnd();
  return `${kept.replace(/[.,;:—-]$/, "")}…`;
}

/**
 * The link that reopens this question.
 *
 * `base` is passed in (rather than read from `location`) so the function can be
 * tested and so the card can be built for the canonical host when the app is
 * running from a copied file.
 */
export function questionLink(question, base = "") {
  const text = clean(question).slice(0, 300);
  if (!text) return "";
  const root = String(base || "").replace(/[?#].*$/, "");
  const separator = root.includes("?") ? "&" : "?";
  return `${root}${separator}ask=${encodeURIComponent(text)}`;
}

/** The one-line citation, or an honest admission that there is none. */
export function citationLine(sources = []) {
  const rows = (Array.isArray(sources) ? sources : [])
    .filter((source) => source && (source.title || source.bookId))
    .slice(0, 3)
    .map((source, index) => {
      const where = source.sourceUrl ? "web import" : `page ${source.page ?? "?"}`;
      const title = clean(source.title || "Library source");
      return `[${source.n || index + 1}] ${title}, ${where}`;
    });
  return rows.length ? rows.join("\n") : "No page was cited for this answer. Treat it as unverified.";
}

/**
 * Build the card.
 *
 * `answer` is the message text, `question` the question it answered. The link
 * is omitted when there is no base to build it from, so a card is never sent
 * with a dead URL.
 */
export function buildStudyCard({ question = "", answer = "", sources = [], base = "", limit = CARD_LIMIT } = {}) {
  const asked = clean(question).slice(0, 300);
  const said = clean(answer);
  const link = questionLink(asked, base);
  const footer = link ? `Asked and cited in Vignan Vidyanikethan AI\n${link}` : "Asked and cited in Vignan Vidyanikethan AI";
  const head = asked ? `A question from today's revision:\n\n${asked}\n\n` : "";
  const tail = `\n\n${citationLine(sources)}\n\n${footer}`;
  // The answer gets whatever room is left, so the citation and the link are
  // never the part that is cut.
  const room = Math.max(60, limit - head.length - tail.length);
  return `${head}${trimTo(said, room)}${tail}`;
}

/** A short title for the toast, so the student knows which answer left. */
export function cardTitle(question = "") {
  const asked = clean(question);
  if (!asked) return "This answer";
  return asked.length > 48 ? `${asked.slice(0, 47).trimEnd()}…` : asked;
}
