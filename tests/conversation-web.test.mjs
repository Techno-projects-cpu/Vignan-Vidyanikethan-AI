import test from "node:test";
import assert from "node:assert/strict";
import { asksAboutCreator, contextualQuery, conversationReply, CREATOR_ANSWER, isFollowUp, searchTopic } from "../js/conversation.js";
import { composeLinkAnswer, composeWebAnswer } from "../js/external-answer.js";
import { buildBookIndex, retrievePreferBooks } from "../js/retrieval.js";
import { composeGroundedAnswer } from "../js/answer.js";
import { normalizeSettings, privacyLabel } from "../js/settings.js";

const text = "Photosynthesis is a process in which green plants use sunlight to make food from carbon dioxide and water. It releases oxygen. This process occurs in the green leaves of plants.";
const book = (id, sourceUrl = "", value = text) => buildBookIndex({ id, title: id, sourceUrl }, [{ page: 1, text: value, heading: "Photosynthesis" }]);

test("creator questions return the project's exact attribution, not unrelated inventors", () => {
  for (const query of ["Who Made You??", "Who created you?", "Who built this AI?", "Who built the app?", "Who is your creator?", "Who developed Vignan AI?", "Who was Bolt made by?"]) assert.equal(asksAboutCreator(query), true, query);
  for (const query of ["Who invented the telephone?", "Who invented the telephone? Do you know?", "Who created photosynthesis?", "What is the Vignan school?", "Who made this machine?"]) assert.equal(asksAboutCreator(query), false, query);
  assert.match(CREATOR_ANSWER, /a student of Vignan Vidyanikethan English Medium High School/);
  assert.match(CREATOR_ANSWER, /INSPIRE-MANAK science fair/);
  assert.match(CREATOR_ANSWER, /not a newly trained model/);
});

test("recent follow-ups reuse the last substantive student topic without contaminating new questions", () => {
  const history = [
    { role: "user", content: "Explain photosynthesis" },
    { role: "assistant", content: "Plants make food." },
    { role: "user", content: "How does it work?" },
    { role: "assistant", content: "Sunlight helps." },
  ];
  assert.equal(isFollowUp("Why does it need sunlight?"), true);
  assert.match(contextualQuery("Why does it need sunlight?", history), /photosynthesis/i);
  assert.equal(contextualQuery("What is gravity?", history), "What is gravity?");
  assert.equal(contextualQuery("How does it work?", [{ role: "user", content: "Who made you?" }]), "How does it work?");
  assert.ok(contextualQuery("Tell me more", [{ role: "user", content: "x".repeat(5000) }]).length <= 900);
  assert.equal(searchTopic("What is quantum entanglement?"), "quantum entanglement");
});

test("retrieval follows conversational context and prioritises textbooks over web imports", () => {
  const local = book("Class science");
  const imported = book("Online article", "https://example.org/article");
  const query = contextualQuery("How does it work?", [{ role: "user", content: "What is photosynthesis?" }]);
  const localResult = retrievePreferBooks(query, [imported, local]);
  assert.equal(localResult.grounded, true);
  assert.equal(localResult.hits[0].bookId, "Class science");
  const scoped = retrievePreferBooks(query, [imported, local], { bookIds: ["Online article"] });
  assert.equal(scoped.hits[0].sourceUrl, "https://example.org/article");
  const answer = composeGroundedAnswer({ query: "How does it work?", evidenceQuery: query, hits: scoped.hits });
  assert.match(answer.text, /imported from a website/i);
  assert.match(answer.text, /Web import/i);
  assert.match(answer.text, /section 1/i);
});

test("Wikipedia snippets become labelled excerpts, never made-up textbook answers", () => {
  const results = [{ title: "Quantum mechanics", url: "https://en.wikipedia.org/wiki/Quantum_mechanics", domain: "en.wikipedia.org", snippet: "Quantum mechanics is a fundamental theory in physics. It describes the behaviour of matter and light." }];
  const answer = composeWebAnswer({ query: "What is quantum mechanics?", results, provider: "Wikipedia" });
  assert.match(answer.text, /outside your textbooks.*Wikipedia/i);
  assert.match(answer.text, /not independently verified/i);
  assert.match(answer.text, /fundamental theory in physics/i);
  assert.match(answer.text, /\[W1\]/);
  assert.equal(answer.sources.length, 0);
  assert.equal(answer.webSources[0].url, results[0].url);
  assert.equal(composeWebAnswer({ query: "What is an elephant?", results }), null);
});

test("linked pages show source citations, match honestly, and preserve PDF page numbers", () => {
  const resource = { url: "https://example.org/chapter.pdf", title: "Science", inspected: { kind: "pdf" }, pages: [{ page: 7, text }] };
  const index = buildBookIndex({ id: "remote", title: "Science", type: "pdf" }, resource.pages);
  const found = composeLinkAnswer({ query: "Explain photosynthesis https://example.org/chapter.pdf", resource, index });
  assert.match(found.text, /outside your textbooks/i);
  assert.match(found.text, /PDF page 7/);
  assert.match(found.text, /\[W1\]/);
  assert.equal(found.webSources[0].url, "https://example.org/chapter.pdf#page=7");
  const unknown = composeLinkAnswer({ query: "Explain dinosaurs https://example.org/chapter.pdf", resource, index });
  assert.match(unknown.text, /could not find that topic confidently/i);
  assert.match(unknown.text, /opening excerpt/i);
  const html = composeLinkAnswer({ query: "https://example.org/chapter", resource: { ...resource, url: "https://example.org/chapter", inspected: { kind: "html" } }, index });
  assert.doesNotMatch(html.text, /PDF page/);
  assert.match(html.text, /not a full summary/i);
});

test("new users get a disclosed web fallback and saved opt-outs remain off", () => {
  assert.equal(normalizeSettings().webEnabled, true);
  assert.equal(normalizeSettings({ webEnabled: false }).webEnabled, false);
  assert.match(privacyLabel(normalizeSettings()), /search query goes to Wikipedia/i);
  assert.match(privacyLabel(normalizeSettings({ webEnabled: false })), /Web fallback is off/i);
});
