import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBookIndex, retrieveChapter } from "../js/retrieval.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(HERE, "./fixtures/sample-study.txt");

export function demoText() {
  return fs.readFileSync(DEMO, "utf8");
}

export function demoIndex() {
  return buildBookIndex(
    { id: "demo-test", title: "Demo Study Pack", subject: "Science, Maths & English", grade: "8" },
    demoText(),
  );
}

export function chapterHits(topic = "photosynthesis", topK = 10) {
  return retrieveChapter(topic, [demoIndex()], { topK }).hits;
}
