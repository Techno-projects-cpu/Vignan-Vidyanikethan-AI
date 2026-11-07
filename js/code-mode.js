/**
 * Code learning mode — the arithmetic behind a programming lesson.
 *
 * Most of this school's students have no laptop and no code editor. They have a
 * phone and a textbook. So this mode is built to work with nothing but the page
 * already loaded:
 *
 *   1. Twelve short lessons that we wrote ourselves, in three languages, each
 *      with one idea, one example and one thing to try.
 *   2. A line-by-line explainer for code the student types or pastes. It reads
 *      the code the way a teacher reads it aloud: what this line does, why the
 *      punctuation is there, and which mistake beginners make on that line.
 *   3. A "predict the output" check for programs whose answer is certain. It
 *      never guesses: if a program depends on input or a random number, it says
 *      so instead of inventing an answer.
 *
 * Everything here is deterministic and offline. No model is involved, nothing is
 * sent anywhere, and a student on a school Wi-Fi that has just died still gets
 * the same explanation as one at home.
 */

/* -------------------------------------------------------------------------- */
/* The lessons                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The languages we teach. `glyph` is a native-script/one-character mark rather
 * than a logo: no external images, and it reads at 14px.
 */
export const LANGUAGES = [
  {
    id: "python",
    label: "Python",
    glyph: "🐍",
    note: "The friendliest first language. Reads almost like English and is what most Indian school coding clubs start with.",
    runnable: true,
  },
  {
    id: "javascript",
    label: "JavaScript",
    glyph: "JS",
    note: "The language of every website, including this one. Nothing to install — a browser already runs it.",
    runnable: true,
  },
  {
    id: "html",
    label: "HTML & CSS",
    glyph: "<>",
    note: "Not really programming: it is how a page says what is a heading and what is a link. Start here if you want to build a website.",
    runnable: false,
  },
];

/**
 * The lessons, written for this project. Short on purpose: one idea, one
 * example, one thing to try, one mistake to avoid.
 */
export const LESSONS = {
  python: [
    {
      id: "py-output",
      title: "Your first line of output",
      goal: "Make the computer say something, and keep a value in a name.",
      idea: [
        "A program is a list of instructions the computer follows from top to bottom. print() is the instruction that puts words on the screen.",
        "A variable is a labelled box. `marks = 87` puts 87 in a box called marks, and after that you can use the name instead of the number. The = sign means \"store this\", not \"equals\".",
      ],
      code: `name = "Ananya"\nmarks = 87\nprint("Hello, " + name)\nprint("Marks:", marks)`,
      tryIt: "Change the name to your own and add a line that prints your class.",
      check: `Hello, <your name>` ,
      mistake: "Words in quotes are text. A bare word without quotes is treated as a variable, so print(Hello) fails while print(\"Hello\") works.",
    },
    {
      id: "py-if",
      title: "Making a decision",
      goal: "Run one set of lines only when a condition is true.",
      idea: [
        "An if statement asks a yes/no question. The indented lines under it run only when the answer is yes.",
        "A colon (:) opens the block and indentation holds it together. Two equals signs (==) compare; one (=) stores.",
      ],
      code: `marks = 72\nif marks >= 90:\n    print("Grade A")\nelif marks >= 60:\n    print("Grade B")\nelse:\n    print("Keep practising")`,
      tryIt: "Change marks to 45 and work out what will print before you run it.",
      check: "Keep practising",
      mistake: "Leaving out the colon, or pressing Tab on one line and four spaces on the next. Python reads indentation as meaning.",
    },
    {
      id: "py-for",
      title: "Repeating without repeating yourself",
      goal: "Use a for loop and range() to run a line many times.",
      idea: [
        "A loop runs the same lines again and again. `for i in range(5)` counts 0, 1, 2, 3, 4 — five times, starting at zero.",
        "range(1, 6) gives 1 to 5. The number after the comma is where it stops, and it stops before that number.",
      ],
      code: `total = 0\nfor i in range(1, 6):\n    total = total + i\n    print("After", i, "total is", total)\nprint("Sum:", total)`,
      tryIt: "Change range(1, 6) to range(1, 11) and predict the final sum.",
      check: "Sum: 15",
      mistake: "Printing inside the loop when you wanted one answer at the end — that is what the un-indented last line is for.",
    },
    {
      id: "py-lists",
      title: "Many values in one name",
      goal: "Store a list, walk through it, and count it.",
      idea: [
        "A list holds several values in order: `marks = [72, 65, 90]`. Counting starts at zero, so marks[0] is 72.",
        "A for loop over a list gives you each item in turn. len() tells you how many there are.",
      ],
      code: `marks = [72, 65, 90]\nfor mark in marks:\n    print("One subject:", mark)\nprint("Subjects:", len(marks))\nprint("Total:", sum(marks))`,
      tryIt: "Add a fourth mark, then predict what len() will print.",
      check: "Subjects: 3",
      mistake: "Asking for marks[3] on a three-item list. The last item is marks[2].",
    },
  ],
  javascript: [
    {
      id: "js-output",
      title: "Saying something in a browser",
      goal: "Write values and text out of a JavaScript program.",
      idea: [
        "JavaScript runs inside the browser you are already using. console.log() writes a line to the developer console, which is the programmer's notebook.",
        "let makes a value you can change later; const makes one you cannot. Numbers do not need quotes, text does.",
      ],
      code: `let name = "Ananya";\nconst marks = 87;\nconsole.log("Hello, " + name);\nconsole.log("Marks: " + marks);`,
      tryIt: "Make a second variable for your class and print a sentence using both.",
      check: "Hello, Ananya",
      mistake: "Using let name = 5 and later expecting text — the value keeps its type, so 5 + 1 is 6 but \"5\" + 1 is \"51\".",
    },
    {
      id: "js-if",
      title: "Conditions in JavaScript",
      goal: "Choose between two outcomes with if and else.",
      idea: [
        "The rule is the same as in Python, with two differences: the test goes in round brackets, and the body goes in curly braces.",
        "=== compares without changing type. == tries to convert, which is why \"5\" == 5 is true and \"5\" === 5 is not. Use === unless you have a reason.",
      ],
      code: `const marks = 72;\nif (marks >= 90) {\n  console.log("Grade A");\n} else if (marks >= 60) {\n  console.log("Grade B");\n} else {\n  console.log("Keep practising");\n}`,
      tryIt: "Change 72 to 91 and predict the output before reading the answer.",
      check: "Grade B",
      mistake: "Forgetting a semicolon is usually forgiven; forgetting the closing brace is not. Count the { and }.",
    },
    {
      id: "js-loops",
      title: "Loops and arrays",
      goal: "Repeat work over a list of values.",
      idea: [
        "An array is JavaScript's list: `[72, 65, 90]`. Its first item is at index 0.",
        "`for (const mark of marks)` visits each item. `.length` gives the count. The older counting loop still works and is worth recognising.",
      ],
      code: `const marks = [72, 65, 90];\nlet total = 0;\nfor (const mark of marks) {\n  total = total + mark;\n}\nconsole.log("Subjects: " + marks.length);\nconsole.log("Total: " + total);`,
      tryIt: "Print the average instead of the total. (Hint: divide by marks.length.)",
      check: "Total: 227",
      mistake: "Using = inside the comparison of a loop condition. `i = 10` stores; `i < 10` compares.",
    },
    {
      id: "js-functions",
      title: "Functions: a name for a job",
      goal: "Write one block of code and use it many times.",
      idea: [
        "A function takes inputs, does one job, and returns a result. You write it once and call it whenever you need it.",
        "The word return hands the answer back. A function that prints but never returns gives you nothing to store.",
      ],
      code: `function average(a, b) {\n  return (a + b) / 2;\n}\nconsole.log(average(80, 90));\nconsole.log(average(60, 70));`,
      tryIt: "Write average3 for three marks and check it with 60, 70 and 80.",
      check: "85",
      mistake: "Writing console.log(average) instead of console.log(average(80, 90)). The first prints the function itself.",
    },
  ],
  html: [
    {
      id: "html-skeleton",
      title: "The skeleton of a web page",
      goal: "Recognise the tags every page has.",
      idea: [
        "HTML is not programming: it is markup. Tags in angle brackets describe what each piece of text is.",
        "Most tags come in pairs — an opening <p> and a closing </p>. What sits between them is the content.",
      ],
      code: `<!DOCTYPE html>\n<html>\n  <head>\n    <title>My science project</title>\n  </head>\n  <body>\n    <h1>Water filters</h1>\n    <p>This page is about clean water.</p>\n  </body>\n</html>`,
      tryIt: "Change the title and the heading to your own project name.",
      check: "My science project",
      mistake: "A missing closing tag. The page still loads, but everything after it inherits the style of the tag you left open.",
    },
    {
      id: "html-text",
      title: "Headings, paragraphs and lists",
      goal: "Give a page structure a reader can follow.",
      idea: [
        "h1 is the biggest heading and there should be one per page. h2 and h3 come under it.",
        "ul makes a bullet list and ol makes a numbered list. Each item goes in li, inside the list.",
      ],
      code: `<h1>Steps of photosynthesis</h1>\n<ol>\n  <li>Leaves absorb sunlight.</li>\n  <li>Water rises from the roots.</li>\n  <li>The plant makes glucose.</li>\n</ol>`,
      tryIt: "Turn the numbered list into a bullet list, then back again.",
      check: "1. Leaves absorb sunlight.",
      mistake: "Putting <li> outside <ul>. It renders, but the list has no bullets and screen readers lose the structure.",
    },
    {
      id: "html-links",
      title: "Links and pictures",
      goal: "Point at another page or an image with attributes.",
      idea: [
        "Attributes are extra facts inside the opening tag: href is where a link goes, src is where an image is, alt is what to say if it cannot load.",
        "alt is not decoration. A reader who cannot see the image depends on it.",
      ],
      code: `<a href="https://example.org/water">Read the full article</a>\n<img src="filter.jpg" alt="A sand and charcoal water filter" width="320">`,
      tryIt: "Add a second link to a page you actually use for school.",
      check: "Read the full article",
      mistake: "Writing href=\"www.example.org\" without https:// — the browser then looks for a page with that name on your own site.",
    },
    {
      id: "css-style",
      title: "Making it look deliberate",
      goal: "Change colour and size with CSS.",
      idea: [
        "CSS is a list of rules. Each rule picks something (the selector) and says what to change (declarations).",
        "A declaration is property: value; — the colon and semicolon are not optional.",
      ],
      code: `<style>\n  h1 {\n    color: #111111;\n    font-size: 32px;\n  }\n  .note {\n    color: #666666;\n  }\n</style>\n<h1>Water filters</h1>\n<p class="note">Written for the science fair.</p>`,
      tryIt: "Make .note italic without changing any other paragraph.",
      check: "font-style: italic;",
      mistake: "Writing a dot for an id (#) or a hash for a class (.). `.note` is a class; `#note` is an id.",
    },
  ],
};

/** Lessons for one language, or an empty list for a language we do not teach. */
export function lessonsFor(language = "python") {
  return LESSONS[language] ? LESSONS[language].slice() : [];
}

/** The lesson with this id, in any language. */
export function lessonById(id) {
  for (const [language, lessons] of Object.entries(LESSONS)) {
    const lesson = lessons.find((entry) => entry.id === id);
    if (lesson) return { ...lesson, language };
  }
  return null;
}

/** How many lessons the mode ships, for the screen and for the tests. */
export function lessonCount() {
  return Object.values(LESSONS).reduce((total, lessons) => total + lessons.length, 0);
}

/* -------------------------------------------------------------------------- */
/* Reading code aloud, line by line                                            */
/* -------------------------------------------------------------------------- */

const QUOTED = /(["'`])(?:\\.|(?!\1).)*\1/;

/** Friendly words for the comparison operators a beginner meets. */
function comparisonWords(text = "") {
  return String(text)
    .replace(/===/g, " is exactly equal to ")
    .replace(/!==/g, " is not equal to ")
    .replace(/==/g, " is equal to ")
    .replace(/!=/g, " is not equal to ")
    .replace(/>=/g, " is greater than or equal to ")
    .replace(/<=/g, " is less than or equal to ")
    .replace(/\s*>\s*/g, " is greater than ")
    .replace(/\s*<\s*/g, " is less than ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "the text “Hello, ”" — how a person would point at a value. */
function describeValue(expression = "") {
  const text = String(expression).trim().replace(/;$/, "").replace(/\)$/, "");
  if (!text) return "nothing";
  if (/^(["'`]).*\1$/.test(text)) return `the text ${text}`;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `the number ${text}`;
  if (/^\[.*\]$/s.test(text)) {
    const inner = text.slice(1, -1).trim();
    return inner ? `a list holding ${inner}` : "an empty list";
  }
  if (/^\{.*\}$/s.test(text)) return "a group of named values";
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return `the value stored in ${text}`;
  if (/[+\-*/%]/.test(text)) return `the value of \`${text}\``;
  return text;
}

const PY_RULES = [
  { re: /^#/, say: () => "A comment. Python ignores this line completely — it is a note for the person reading the code." },
  { re: /^from\s+(\S+)\s+import\s+(.+)$/, say: (m) => `Brings specific tools (${m[2]}) out of the ${m[1]} toolkit so they can be used below.` },
  { re: /^import\s+(\S+)$/, say: (m) => `Loads the ${m[1]} toolkit. Python ships some, and others are installed separately.` },
  { re: /^def\s+([A-Za-z_]\w*)\s*\((.*)\)\s*:$/, say: (m) => {
    const inputs = m[2].trim();
    return inputs
      ? `Starts a reusable block of instructions called ${m[1]}. It needs ${inputs} given to it each time it is used. Nothing runs yet — this only defines it.`
      : `Starts a reusable block of instructions called ${m[1]}. It needs nothing given to it. Nothing runs yet — this only defines it.`;
  } },
  { re: /^return\b\s*(.*)$/, say: (m) => (m[1].trim()
    ? `Hands ${describeValue(m[1])} back to whatever used this function, and stops here.`
    : "Stops here and hands back nothing.") },
  { re: /^for\s+([A-Za-z_]\w*)\s+in\s+range\(([^)]*)\)\s*:$/, say: (m) => {
    const args = m[2].split(",").map((part) => part.trim()).filter(Boolean);
    const count = args.length > 1 ? `from ${args[0]} up to but not including ${args[1]}` : `from 0 up to but not including ${args[0] || "0"}`;
    return `Repeats the indented lines below, counting ${count}. Each pass, the counter is stored in ${m[1]}.`;
  } },
  { re: /^for\s+([A-Za-z_]\w*)\s+in\s+(.+?)\s*:$/, say: (m) => `Repeats the indented lines below once for every item in ${describeValue(m[2])}, and calls the current item ${m[1]}.` },
  { re: /^while\s+(.+?)\s*:$/, say: (m) => `Keeps repeating the indented lines below for as long as "${comparisonWords(m[1])}" stays true. If it never becomes false, the program never stops.` },
  { re: /^if\s+(.+?)\s*:$/, say: (m) => `Checks whether "${comparisonWords(m[1])}". The indented lines below run only when that is true.` },
  { re: /^elif\s+(.+?)\s*:$/, say: (m) => `If the earlier checks were false, checks this instead: "${comparisonWords(m[1])}".` },
  { re: /^else\s*:$/, say: () => "The catch-all: these indented lines run when none of the checks above were true." },
  { re: /^print\s*\((.*)\)$/, say: (m) => {
    const inner = m[1].trim();
    if (!inner) return "Prints an empty line — a blank gap on screen.";
    if (/^(["'`]).*\1$/.test(inner)) return `Shows ${describeValue(inner)} on screen. The quote marks are not shown; they tell Python where the text starts and ends.`;
    if (/\+/.test(inner) && /["']/.test(inner)) {
      return `Puts ${describeValue(inner)} together into one line of text, then shows it. A + between pieces of text joins them; it does not add them.`;
    }
    return `Works out ${describeValue(inner)}, then shows the result on screen.`;
  } },
  { re: /^input\s*\((.*)\)$/, say: (m) => `Waits for the student to type something, with ${m[1].trim() ? describeValue(m[1]) : "nothing"} as the prompt. Whatever is typed arrives as text, even if it looks like a number.` },
  { re: /^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/, say: (m) => `Takes the current value of ${m[1]}, changes it by ${describeValue(m[3])}, and stores the answer back in ${m[1]}. Shorthand for ${m[1]} = ${m[1]} ${m[2][0]} (${m[3]}).` },
  { re: /^([A-Za-z_]\w*)\s*=\s*(.+)$/, say: (m) => `Stores ${describeValue(m[2])} in a box named ${m[1]}. The single = means "put this in the box", not "is equal to".` },
  { re: /^([A-Za-z_]\w*)\s*\((.*)\)$/, say: (m) => `Runs the function ${m[1]}${m[2].trim() ? ` with ${describeValue(m[2])}` : " with nothing"} given to it.` },
  { re: /^\+\+|\-\-$/, say: () => "This is C-style counting and is not Python. Write i += 1 instead." },
];

const JS_RULES = [
  { re: /^\/\//, say: () => "A comment. JavaScript ignores this line — it is a note for the person reading the code." },
  { re: /^\/\*|\*\/$/, say: () => "Part of a comment block, which runs from /* to */. JavaScript ignores everything inside it." },
  { re: /^(let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);?$/, say: (m) => {
    const word = m[1] === "const"
      ? `The name ${m[2]} cannot be pointed at a different value later.`
      : m[1] === "var"
        ? "var is the old way to do this; let is the modern one."
        : `The name ${m[2]} can be given a new value later.`;
    return `Stores ${describeValue(m[3])} in ${m[2]}. ${word}`;
  } },
  { re: /^console\.log\s*\((.*)\);?$/, say: (m) => `Writes ${describeValue(m[1])} to the console — the browser's notebook for programmers.` },
  { re: /^function\s+([A-Za-z_$][\w$]*)\s*\((.*)\)\s*\{?$/, say: (m) => {
    const inputs = m[2].trim();
    return inputs
      ? `Defines a reusable block called ${m[1]}, which needs ${inputs} each time it is used. Nothing runs until something calls it.`
      : `Defines a reusable block called ${m[1]}. Nothing runs until something calls it.`;
  } },
  { re: /^const\s+([A-Za-z_$][\w$]*)\s*=\s*\((.*)\)\s*=>\s*(.+?);?$/, say: (m) => `Defines ${m[1]} as a short function: it takes ${m[2].trim() || "nothing"} and returns ${describeValue(m[3])}.` },
  { re: /^return\b\s*(.*?);?$/, say: (m) => (m[1].trim()
    ? `Hands ${describeValue(m[1])} back to whatever called this function, and stops here.`
    : "Stops here and hands back nothing.") },
  { re: /^\}?\s*else\s+if\s*\((.*)\)\s*\{?$/, say: (m) => `Otherwise, checks "${comparisonWords(m[1])}" instead.` },
  { re: /^\}?\s*else\s*\{?$/, say: () => "The catch-all: this block runs when none of the checks above were true." },
  { re: /^if\s*\((.*)\)\s*\{?$/, say: (m) => `Checks whether "${comparisonWords(m[1])}". The block in braces runs only when that is true.` },
  { re: /^for\s*\(\s*(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);\s*(.+?);\s*(.+?)\s*\)\s*\{?$/, say: (m) => `Counts with ${m[1]}: starts at ${describeValue(m[2])}, keeps going while "${comparisonWords(m[3])}", and changes by ${m[4].trim()} after each pass.` },
  { re: /^for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+(.+?)\s*\)\s*\{?$/, say: (m) => `Goes through ${describeValue(m[2])} one item at a time, calling the current item ${m[1]}.` },
  { re: /^while\s*\((.*)\)\s*\{?$/, say: (m) => `Keeps repeating the block for as long as "${comparisonWords(m[1])}" stays true.` },
  { re: /^document\.querySelector\s*\((.*)\)\s*;?$/, say: (m) => `Finds the element matching ${describeValue(m[1])} on the page.` },
  { re: /\.addEventListener\s*\(\s*(['"`])(\w+)\1/, say: (m) => `Attaches a reaction: when the "${m[2]}" event happens on that element, the function after the comma runs.` },
  { re: /^(?:alert|prompt)\s*\((.*)\)\s*;?$/, say: (m) => `${/^prompt/.test(m[0]) ? "Asks the student to type something in a popup" : "Shows a popup message"} with ${describeValue(m[1])}.` },
  { re: /^([A-Za-z_$][\w$]*)\s*(\+=|-=|\*=|\/=)\s*(.+?);?$/, say: (m) => `Changes ${m[1]} by ${describeValue(m[3])} and stores the answer back in ${m[1]}.` },
  { re: /^([A-Za-z_$][\w$]*)\s*=\s*(.+?);?$/, say: (m) => `Stores ${describeValue(m[2])} in the existing name ${m[1]}.` },
  { re: /^([A-Za-z_$][\w$]*)\s*\((.*)\)\s*;?$/, say: (m) => `Calls the function ${m[1]}${m[2].trim() ? ` with ${describeValue(m[2])}` : " with nothing"}.` },
  { re: /^\}\s*\)?;?$/, say: () => "This closes the block opened further up. Every { needs its }." },
];

/**
 * HTML and CSS share a language tab, so the explainer decides which it is
 * looking at by whether the line is inside a <style> block.
 */
const HTML_TAGS = {
  html: "the whole page",
  head: "the part the browser reads but does not show",
  body: "the part a reader sees",
  title: "the name shown in the browser tab",
  h1: "the biggest heading",
  h2: "a second-level heading",
  h3: "a third-level heading",
  p: "a paragraph of text",
  ul: "an unordered list — bullets",
  ol: "an ordered list — numbers",
  li: "one item in the list above it",
  a: "a link",
  img: "a picture",
  div: "a plain container for grouping things",
  span: "a small inline piece of text",
  button: "a button",
  style: "a block of CSS",
  link: "a link to an outside file such as a stylesheet",
  script: "a block of JavaScript",
  table: "a table",
  tr: "one row of the table",
  td: "one cell of the table",
  br: "a line break",
  strong: "important text, shown bold",
  em: "emphasised text, shown italic",
};

function explainHtmlLine(line, insideStyle) {
  const text = line.trim();
  if (!text) return "";
  // The two style tags themselves are markup, even though one of them turns the
  // CSS reading on and the other turns it off.
  if (/^<style\b/i.test(text)) return "Starts a block of CSS inside the page, so no separate file is needed.";
  if (/^<\/style>/i.test(text)) return "Ends the CSS block. Everything after this is ordinary page content again.";
  if (insideStyle) return explainCssLine(text);
  if (/^<!doctype/i.test(text)) return "Tells the browser this is a modern HTML page, not an old one.";
  if (/^<!--/.test(text)) return "A comment. The browser does not show it — it is a note for whoever edits the page later.";
  const closing = text.match(/^<\/\s*([a-z0-9]+)\s*>/i);
  if (closing) {
    const tag = closing[1].toLowerCase();
    return `Closes the ${tag} element opened above: ${HTML_TAGS[tag] || "that element"} ends here.`;
  }
  const opening = text.match(/^<\s*([a-z0-9]+)([^>]*)>/i);
  if (opening) {
    const tag = opening[1].toLowerCase();
    const attributes = opening[2] || "";
    const parts = [];
    const href = attributes.match(/href\s*=\s*"([^"]*)"/i);
    const src = attributes.match(/src\s*=\s*"([^"]*)"/i);
    const alt = attributes.match(/alt\s*=\s*"([^"]*)"/i);
    const className = attributes.match(/class\s*=\s*"([^"]*)"/i);
    if (href) parts.push(`where the link goes: ${href[1]}`);
    if (src) parts.push(`where the file is: ${src[1]}`);
    if (alt) parts.push(`what to say when it cannot load: "${alt[1]}"`);
    if (className) parts.push(`which style class applies: ${className[1]}`);
    const rest = text.slice(opening[0].length).replace(/<\/[a-z0-9]+>$/i, "").trim();
    const what = `Starts ${HTML_TAGS[tag] ? HTML_TAGS[tag] : `a ${tag} element`}`;
    const withAttributes = parts.length ? `${what}. The attributes inside the tag say ${parts.join("; ")}` : what;
    const withContent = rest ? `${withAttributes}. Between the tags, the reader sees: "${rest}".` : `${withAttributes}.`;
    return withContent;
  }
  return ""; // plain text between tags
}

function explainCssLine(text) {
  if (/^\}$/.test(text)) return "Closes the CSS rule opened above.";
  // A whole rule on one line: `h1 { color: #111; }`
  const inline = text.match(/^([^{}]+)\{([^{}]*)\}$/);
  if (inline) {
    const selector = inline[1].trim();
    const what = selector.startsWith("#")
      ? `the element with id "${selector.slice(1)}"`
      : selector.startsWith(".")
        ? `every element with class "${selector.slice(1)}"`
        : `every <${selector}> element`;
    const settings = inline[2].split(";").map((part) => part.trim()).filter(Boolean);
    const described = settings
      .map((setting) => {
        const own = explainCssLine(setting);
        return own.replace(/ The semicolon ends the setting\.$/, "").replace(/\.+$/, ".");
      })
      .filter(Boolean)
      .join(" ");
    return `A CSS rule for ${what}. ${described || "The braces hold the settings."}`;
  }
  if (/^[.#]?[A-Za-z][^{]*\{$/.test(text)) {
    const selector = text.replace(/\{$/, "").trim();
    const what = selector.startsWith("#")
      ? `the element with id "${selector.slice(1)}"`
      : selector.startsWith(".")
        ? `every element with class "${selector.slice(1)}"`
        : `every <${selector}> element`;
    return `A CSS rule that applies to ${what}. Everything between the braces changes how they look.`;
  }
  const property = text.match(/^([a-z-]+)\s*:\s*(.+?);?$/i);
  if (property) {
    const words = {
      color: "the text colour",
      "background-color": "the colour behind the text",
      "font-size": "the text size",
      "font-family": "the typeface",
      "font-style": "the style (italic or upright)",
      "font-weight": "the boldness",
      "text-align": "the alignment",
      margin: "the space outside the element",
      padding: "the space inside the element",
      border: "the line around the element",
      width: "the width",
      height: "the height",
      display: "whether it behaves as a block or inline",
    };
    const meaning = words[property[1].toLowerCase()] || property[1];
    return `Sets ${meaning} to ${property[2].trim()}. The semicolon ends the setting.`;
  }
  return "";
}

/**
 * Explain a program line by line.
 *
 * Never throws and never invents: a line the rules do not recognise is reported
 * as unrecognised instead of being guessed at, because a confident wrong
 * explanation teaches the wrong thing.
 *
 * @param {string} code
 * @param {string} language
 * @returns {{lines: Array<{number: number, text: string, explain: string, kind: string}>, summary: string, notes: string[], recognised: number, total: number}}
 */
export function explainCode(code, language = "python") {
  const source = String(code ?? "").replace(/\r\n?/g, "\n");
  const rawLines = source.split("\n");
  const lines = [];
  const notes = [];
  let insideStyle = false;
  let loops = 0;
  let decisions = 0;
  let functions = 0;
  let prints = 0;

  rawLines.forEach((raw, index) => {
    const text = raw.replace(/\t/g, "    ");
    const trimmed = text.trim();
    const number = index + 1;
    if (!trimmed) {
      lines.push({ number, text, explain: "", kind: "blank" });
      return;
    }
    let explain = "";
    let kind = "code";

    if (language === "html") {
      if (/^<style\b/i.test(trimmed)) insideStyle = true;
      explain = explainHtmlLine(trimmed, insideStyle);
      if (/^<\/style>/i.test(trimmed)) insideStyle = false;
      if (/^<!--/.test(trimmed)) kind = "comment";
      if (!explain) kind = "text";
      if (explain) {
        if (/^Starts <|^Starts the whole|^Starts the part|^Starts a block/.test(explain)) { /* markup, not counted */ }
      }
      if (/^<h[1-6]\b/i.test(trimmed)) kind = "heading";
    } else {
      const rules = language === "javascript" ? JS_RULES : PY_RULES;
      for (const rule of rules) {
        const match = trimmed.match(rule.re);
        if (!match) continue;
        explain = rule.say(match, trimmed);
        break;
      }
      if (/^#|^\/\//.test(trimmed)) kind = "comment";
      if (/^for\b|^while\b/.test(trimmed)) loops += 1;
      if (/^if\b|^elif\b|^\}?\s*else\b/.test(trimmed)) decisions += 1;
      if (/^def\b|^function\b|=>\s*/.test(trimmed)) functions += 1;
      if (/^print\s*\(|^console\.log\s*\(/.test(trimmed)) prints += 1;
      if (!explain) {
        // A bare closing brace or an indented continuation is still worth a word.
        if (/^[})\];]+$/.test(trimmed)) explain = "Closes a block or a call that was opened above.";
        else explain = "";
        kind = explain ? "punctuation" : "unknown";
      }
    }

    if (!explain && trimmed) {
      if (language === "html") explain = "Plain text that the browser shows as written.";
      else explain = "I do not recognise this line, so I will not guess. Copy it to your teacher, or tell me what it is meant to do.";
    }

    lines.push({ number, text, explain, kind });
  });

  // Mistakes a teacher would point at, checked once for the whole program.
  const joined = rawLines.join("\n");
  if (language === "python") {
    if (/^\s*(?:if|elif|for|while|def|else)\b.*[^:]\s*$/m.test(joined) && !/:\s*#/.test(joined)) {
      notes.push("Some decision or loop lines do not end with a colon (:). Python needs one at the end of each.");
    }
    if (/[^=!<>]=[^=]/.test(joined) && /\bif\b/.test(joined) && /(?:if|elif|while)[^\n]*[^=!<>]=[^=]/.test(joined)) {
      notes.push("A single = stores a value. To ask a question inside if or while, use two: ==.");
    }
    if (/\t/.test(source) && /^ +/m.test(source)) {
      notes.push("This program mixes tabs and spaces for indentation. Python is strict about that; pick one.");
    }
    if (/;\s*$/.test(joined)) notes.push("A semicolon at the end of a line is JavaScript habit. Python does not need it.");
  }
  if (language === "javascript") {
    const opens = (joined.match(/\{/g) || []).length;
    const closes = (joined.match(/\}/g) || []).length;
    if (opens !== closes) notes.push(`There are ${opens} opening braces and ${closes} closing ones. Every { needs its }.`);
    if (/\bif\s*\([^)]*[^=!<>]=[^=]/.test(joined)) notes.push("A single = inside if stores a value. To compare, use ===.");
  }
  if (language === "html") {
    for (const tag of ["div", "p", "html", "body", "head", "ul", "ol", "li", "table", "style"]) {
      const opens = (joined.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
      const closes = (joined.match(new RegExp(`</${tag}>`, "gi")) || []).length;
      if (opens !== closes) notes.push(`<${tag}> is opened ${opens} time(s) and closed ${closes} time(s).`);
    }
  }

  const spoken = lines.filter((line) => line.explain && line.kind !== "blank").length;
  const total = lines.filter((line) => line.kind !== "blank").length;
  let summary;
  if (!total) summary = "There is no code here yet. Paste a program, or open a lesson and copy the example.";
  else if (language === "html") summary = `This is markup, not a program: it tells the browser what ${total} piece(s) of the page are. Nothing runs; the browser just reads it top to bottom.`;
  else {
    const parts = [];
    if (prints) parts.push(`shows ${prints} line${prints === 1 ? "" : "s"} of output`);
    if (loops) parts.push(`uses ${loops} loop${loops === 1 ? "" : "s"}`);
    if (decisions) parts.push(`makes ${decisions} decision${decisions === 1 ? "" : "s"}`);
    if (functions) parts.push(`defines ${functions === 1 ? "a function" : `${functions} functions`}`);
    const listText = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    summary = parts.length
      ? `Read top to bottom, this program ${listText}. Every line runs in order unless a loop or a decision says otherwise.`
      : "This program has no output, loop, decision or function yet — it only prepares values. Add a print line to see it do something.";
  }
  if (spoken < total) notes.push(`${total - spoken} line(s) were not recognised. They are marked rather than explained, because a wrong explanation is worse than none.`);

  return { lines, summary, notes, recognised: spoken, total };
}

/** The explanation as the markdown the chat renders (numbers, bold, no HTML). */
export function codeExplanationMarkdown(result, { title = "Code, line by line" } = {}) {
  if (!result || !result.lines) return "";
  const rows = result.lines
    .filter((line) => line.kind !== "blank")
    .map((line) => `**${line.number}.** \`${line.text.trim()}\` — ${line.explain}`);
  const notes = (result.notes || []).map((note) => `- ${note}`);
  return [
    `**${title}**`,
    result.summary,
    "",
    ...rows,
    notes.length ? "\n**Worth checking**" : "",
    ...notes,
  ].filter(Boolean).join("\n");
}

/* -------------------------------------------------------------------------- */
/* Predicting the output of a small program                                    */
/* -------------------------------------------------------------------------- */

/**
 * A very small expression evaluator.
 *
 * Deliberately tiny: numbers, quoted text, + - * / % with the usual precedence
 * and brackets. It exists so "predict the output" can be marked exactly, not to
 * run a student's program. Anything outside this subset returns ok: false.
 */
function evaluateExpression(expression, variables) {
  const tokens = String(expression).match(/(["'])(?:\\.|(?!\1).)*\1|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[+\-*/%()]/g);
  if (!tokens) return { ok: false, reason: "empty" };
  if (tokens.join("").replace(/["'\s]/g, "").length !== String(expression).replace(/["'\s]/g, "").length) {
    return { ok: false, reason: "unsupported" };
  }
  let index = 0;

  const peek = () => tokens[index];
  const next = () => tokens[index++];

  function parsePrimary() {
    const token = next();
    if (token === undefined) throw new Error("unexpected end");
    if (token === "(") {
      const value = parseSum();
      if (next() !== ")") throw new Error("missing )");
      return value;
    }
    if (token === "-") {
      const value = parsePrimary();
      if (typeof value !== "number") throw new Error("negative text");
      return -value;
    }
    if (/^["']/.test(token)) return token.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    if (/^\d/.test(token)) return Number(token);
    if (/^[A-Za-z_$]/.test(token)) {
      if (Object.prototype.hasOwnProperty.call(variables, token)) return variables[token];
      throw new Error(`unknown name ${token}`);
    }
    throw new Error(`unexpected ${token}`);
  }

  function parseProduct() {
    let value = parsePrimary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const operator = next();
      const right = parsePrimary();
      if (typeof value !== "number" || typeof right !== "number") throw new Error("arithmetic on text");
      if ((operator === "/" || operator === "%") && right === 0) throw new Error("division by zero");
      if (operator === "*") value *= right;
      else if (operator === "/") value /= right;
      else value %= right;
    }
    return value;
  }

  function parseSum() {
    let value = parseProduct();
    while (peek() === "+" || peek() === "-") {
      const operator = next();
      const right = parseProduct();
      if (operator === "+" && (typeof value === "string" || typeof right === "string")) value = `${value}${right}`;
      else if (typeof value !== "number" || typeof right !== "number") throw new Error("mixed types");
      else if (operator === "+") value += right;
      else value -= right;
    }
    return value;
  }

  try {
    const value = parseSum();
    if (index !== tokens.length) return { ok: false, reason: "unsupported" };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: /unknown name/.test(error.message) ? "name" : "unsupported" };
  }
}

const PRINT_LINE = {
  python: /^print\s*\((.*)\)\s*$/,
  javascript: /^console\.log\s*\((.*)\)\s*;?\s*$/,
};

const ASSIGN_LINE = {
  python: /^([A-Za-z_]\w*)\s*=\s*(.+)$/,
  javascript: /^(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);?$/,
};

/**
 * Work out what a program prints, when the answer is certain.
 *
 * Only straight-line programs are accepted: assignments and print lines, with
 * simple expressions. A loop, a decision, input() or prompt() makes the output
 * depend on something we cannot see, and the honest answer is to say so.
 *
 * @returns {{ok: true, output: string, lines: string[]} | {ok: false, reason: string}}
 */
export function predictOutput(code, language = "python") {
  const source = String(code ?? "").replace(/\r\n?/g, "\n");
  const printPattern = PRINT_LINE[language] || PRINT_LINE.python;
  const assignPattern = ASSIGN_LINE[language] || ASSIGN_LINE.python;
  const variables = {};
  const lines = [];

  for (const raw of source.split("\n")) {
    const text = raw.trim();
    if (!text) continue;
    if (/^#|^\/\//.test(text)) continue;
    if (language === "html") return { ok: false, reason: "html" };
    if (/^for\b|^while\b|^if\b|^else\b|^elif\b|^function\b|^def\b|^return\b|=>/.test(text)) {
      return { ok: false, reason: "control" };
    }
    if (/\binput\s*\(|\bprompt\s*\(|Math\.random|random\.|Date\(/.test(text)) {
      return { ok: false, reason: "input" };
    }
    const printed = text.match(printPattern);
    if (printed) {
      const value = evaluateExpression(printed[1], variables);
      if (!value.ok) return { ok: false, reason: value.reason };
      lines.push(String(value.value));
      continue;
    }
    const assigned = text.match(assignPattern);
    if (assigned) {
      const value = evaluateExpression(assigned[2], variables);
      if (!value.ok) return { ok: false, reason: value.reason };
      variables[assigned[1]] = value.value;
      continue;
    }
    return { ok: false, reason: "unsupported" };
  }
  if (!lines.length) return { ok: false, reason: "no-output" };
  return { ok: true, output: lines.join("\n"), lines };
}

/** The sentence shown when a program is outside the predictable subset. */
export function unpredictableReason(reason = "") {
  switch (reason) {
    case "control":
      return "This program makes a decision or repeats something, so the output depends on the values it is given. Read the line-by-line explanation instead — it explains the path.";
    case "input":
      return "This program asks for input or uses a random number, so its output changes every time. There is no single right answer to predict.";
    case "html":
      return "HTML does not print output — it describes a page. Look at the explanation instead of an output.";
    case "name":
      return "A name is used before it is given a value, so the program would stop with an error. That error is the useful answer here.";
    case "no-output":
      return "This program prints nothing, so there is no output to predict.";
    case "division by zero":
      return "This program divides by zero, so it would stop with an error rather than print a number.";
    default:
      return "The output of this program is not certain from the code alone, so I will not invent one.";
  }
}

/**
 * Mark a student's prediction.
 *
 * Trailing spaces and blank lines are forgiven; the text itself is not. A
 * nearly-right answer is told exactly which line differs, because "wrong" with
 * no detail teaches nothing.
 */
export function checkPrediction(code, guess, language = "python") {
  const expected = predictOutput(code, language);
  if (!expected.ok) {
    return { checkable: false, correct: false, expected: "", reason: unpredictableReason(expected.reason) };
  }
  const clean = (value) => String(value ?? "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
  const actual = clean(guess);
  const wanted = clean(expected.output);
  const correct = actual === wanted;
  let hint = "";
  if (!correct) {
    const actualLines = actual.split("\n");
    const wantedLines = wanted.split("\n");
    const firstBad = wantedLines.findIndex((line, index) => line !== actualLines[index]);
    if (firstBad >= 0) {
      hint = actualLines[firstBad] === undefined
        ? `Line ${firstBad + 1} of the output is missing.`
        : `Line ${firstBad + 1} differs.`;
    }
  }
  return { checkable: true, correct, expected: wanted, hint };
}

/* -------------------------------------------------------------------------- */
/* Recognising code in a message                                               */
/* -------------------------------------------------------------------------- */

/**
 * Does this message contain a program rather than a question about school?
 *
 * A student pastes code in two ways: in a fenced block, or as a few lines that
 * are plainly not sentences. Both are recognised; prose that merely mentions a
 * word like "print" is not.
 */
export function looksLikeCode(text = "") {
  const source = String(text ?? "");
  if (!source.trim()) return false;
  if (/```/.test(source)) return true;
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const codeSignals = /^(?:print\s*\(|console\.log\s*\(|def\s+\w+\s*\(|function\s+\w*\s*\(|for\s+\w+\s+in\s+|for\s*\(|while\s*[(\s]|if\s*[(\s]|let\s+\w+\s*=|const\s+\w+\s*=|var\s+\w+\s*=|import\s+\w+|<[a-z!\/][^>]*>|#include\s*<|\w+\s*=\s*[^=])/i;
  const shaped = lines.filter((line) => codeSignals.test(line));
  if (shaped.length >= 2) return true;
  if (lines.length === 1 && /[;{}]|\w+\([^)]*\)\s*$/.test(lines[0]) && shaped.length === 1) {
    // One line only counts when it is clearly a statement, not a sentence that
    // happens to end with a bracket.
    return /[;{}]$|^\s*(?:print|console\.log|def|function|for|while|if|let|const|var)\b/.test(lines[0]);
  }
  return false;
}

/** The code inside a fenced block, or the whole message when there is none. */
export function extractCode(text = "") {
  const source = String(text ?? "");
  const fenced = source.match(/```[a-zA-Z0-9+#]*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return source.trim();
}

/**
 * Which language is this code? Only used to pick the right reading rules; a
 * wrong guess produces honest "I do not recognise this line" marks, not a crash.
 */
export function guessLanguage(text = "") {
  const source = String(text ?? "");
  if (/<!doctype|<html|<body|<\/[a-z][a-z0-9]*>|<style\b|<(?:h[1-6]|p|div|ul|ol|li|a|img|table|br)\b/i.test(source)) return "html";
  if (/\bconsole\.log\b|\bconst\s+\w+\s*=|\blet\s+\w+\s*=|=>|document\.querySelector/.test(source)) return "javascript";
  return "python";
}

/**
 * The lesson a question is asking for, e.g. "teach me loops in python".
 *
 * Returns null when the question is not about programming, so the normal
 * textbook path is untouched.
 */
export function requestedCodeLesson(query = "") {
  const text = String(query ?? "").toLowerCase();
  if (!text.trim()) return null;
  // Deliberately narrow. "List the parts of a flower" and "the functions of the
  // heart" are school questions, not programming ones: a language name or an
  // unmistakably technical word has to be there before a lesson takes over.
  const wantsCode = /\b(?:python|javascript|js|html|css|coding|code|program|programming|loops?|algorithm|debug|bug|syntax)\b/.test(text);
  const wantsLearning = /\b(?:learn|teach|lesson|explain|how (?:do|does|to)|start|beginner|basics?|practice|example|what is|what's)\b/.test(text);
  if (!wantsCode) return null;
  const language = /\b(?:javascript|js)\b/.test(text) ? "javascript"
    : /\b(?:html|css)\b/.test(text) ? "html"
    : /\bpython\b/.test(text) ? "python"
    : null;
  // Most specific first: "loops" must win over "first program", and a question
  // about functions must not be answered with a lesson on variables.
  const topics = [
    { key: "js-functions", test: /\b(?:functions?|return|method|methods)\b/ },
    { key: "py-lists", test: /\b(?:lists?|arrays?|items?|sum|len)\b/ },
    { key: "py-for", test: /\b(?:for|while|loops?|range|repeat|count(?:ing)?)\b/ },
    { key: "py-if", test: /\b(?:if|else|conditions?|decisions?|compare|comparison|marks|grades?)\b/ },
    { key: "html-links", test: /\b(?:links?|href|images?|img|alt)\b/ },
    { key: "html-text", test: /\b(?:headings?|paragraphs?|ul|ol|li)\b/ },
    { key: "css-style", test: /\b(?:css|styles?|colours?|colors?|fonts?|sizes?)\b/ },
    { key: "html-skeleton", test: /\b(?:pages?|skeleton|doctype|structure)\b/ },
    { key: "py-output", test: /\b(?:print|output|first (?:line|program)|variables?|hello world)\b/ },
  ];
  const topic = topics.find((entry) => entry.test.test(text));
  if (!wantsLearning && !topic) return null;
  // A named topic decides the language; otherwise the named language, in order.
  const byTopic = topic ? lessonById(topic.key) : null;
  if (byTopic && (!language || byTopic.language === language)) return byTopic;
  if (language) {
    const lessons = lessonsFor(language);
    const match = topic ? lessons.find((lesson) => lesson.id === topic.key) : null;
    if (match) return { ...match, language };
    return lessons.length ? { ...lessons[0], language } : null;
  }
  return byTopic;
}

/** A lesson, written the way the chat renders: headings, code, one thing to try. */
export function lessonMarkdown(lesson) {
  if (!lesson) return "";
  const language = LANGUAGES.find((entry) => entry.id === lesson.language);
  const label = language ? language.label : "Code";
  return [
    `**Code lesson · ${label} · ${lesson.title}**`,
    lesson.goal,
    "",
    ...lesson.idea,
    "",
    "**Example**",
    `\`\`\`${lesson.language === "html" ? "html" : lesson.language}\n${lesson.code}\n\`\`\``,
    "",
    `**Try it:** ${lesson.tryIt}`,
    `**Expected:** ${lesson.check}`,
    `**The mistake almost everyone makes:** ${lesson.mistake}`,
    "",
    "_Written for this project. Open Code practice from the menu to type it yourself and see every line explained._",
  ].join("\n");
}
