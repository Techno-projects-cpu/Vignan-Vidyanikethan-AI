/**
 * Academic content for the multiplayer mini games.
 *
 * Every question and clue here was written for this project, so nothing is
 * copied from a textbook or a coaching material. Questions stay inside the
 * school syllabus (science, maths, social studies, English) for classes 6–10.
 */

export const SUBJECTS = ["science", "maths", "social", "english"];

// Each item is [prompt, correct answer, wrong answer, wrong answer, wrong answer, subject]
const RAW_QUESTIONS = [
  ["Which part of the plant carries water from the roots to the leaves?", "Xylem", "Phloem", "Cambium", "Stomata", "science"],
  ["What gas do plants take in during photosynthesis?", "Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen", "science"],
  ["Which unit measures electric current?", "Ampere", "Volt", "Ohm", "Watt", "science"],
  ["The powerhouse of the cell is the…", "Mitochondrion", "Nucleus", "Ribosome", "Vacuole", "science"],
  ["Which mirror is used in a vehicle's side mirror?", "Convex", "Concave", "Plane", "Cylindrical", "science"],
  ["Rusting of iron needs oxygen and…", "Moisture", "Carbon dioxide", "Nitrogen", "Sunlight", "science"],
  ["The speed of light in vacuum is about…", "3 × 10⁸ m/s", "3 × 10⁶ m/s", "3 × 10⁵ m/s", "3 × 10¹⁰ m/s", "science"],
  ["Which blood cells help to clot blood?", "Platelets", "Red blood cells", "White blood cells", "Plasma", "science"],
  ["Sound cannot travel through…", "Vacuum", "Steel", "Water", "Air", "science"],
  ["Which acid is present in a lemon?", "Citric acid", "Lactic acid", "Acetic acid", "Sulphuric acid", "science"],
  ["The SI unit of force is the…", "Newton", "Joule", "Pascal", "Watt", "science"],
  ["Which organ filters waste from the blood?", "Kidney", "Liver", "Spleen", "Pancreas", "science"],
  ["A body in uniform circular motion has constant…", "Speed", "Velocity", "Acceleration", "Displacement", "science"],
  ["Which vitamin is produced when skin is exposed to sunlight?", "Vitamin D", "Vitamin A", "Vitamin C", "Vitamin K", "science"],
  ["The chemical symbol Na stands for…", "Sodium", "Nickel", "Nitrogen", "Neon", "science"],
  ["Which layer of the atmosphere contains the ozone layer?", "Stratosphere", "Troposphere", "Mesosphere", "Thermosphere", "science"],
  ["Newton's first law is also called the law of…", "Inertia", "Momentum", "Gravitation", "Action", "science"],
  ["The pH of pure water at room temperature is…", "7", "0", "14", "1", "science"],
  ["Which part of the eye controls the amount of light entering?", "Iris", "Retina", "Cornea", "Lens", "science"],
  ["Electric power is measured in…", "Watt", "Ampere", "Volt", "Coulomb", "science"],
  ["Which gas is most abundant in Earth's atmosphere?", "Nitrogen", "Oxygen", "Carbon dioxide", "Argon", "science"],
  ["The process of a solid changing directly into gas is called…", "Sublimation", "Evaporation", "Condensation", "Fusion", "science"],
  ["Which cell organelle makes proteins?", "Ribosome", "Lysosome", "Golgi body", "Mitochondrion", "science"],
  ["The value of acceleration due to gravity on Earth is about…", "9.8 m/s²", "6.8 m/s²", "12.8 m/s²", "3.8 m/s²", "science"],

  ["What is the value of 7 × 8?", "56", "54", "49", "64", "maths"],
  ["The square root of 144 is…", "12", "14", "11", "16", "maths"],
  ["How many degrees are there in a right angle?", "90", "180", "45", "360", "maths"],
  ["The sum of the interior angles of a triangle is…", "180°", "90°", "270°", "360°", "maths"],
  ["Which number is prime?", "17", "21", "27", "33", "maths"],
  ["The LCM of 4 and 6 is…", "12", "24", "8", "6", "maths"],
  ["The HCF of 18 and 24 is…", "6", "3", "9", "12", "maths"],
  ["If x + 5 = 12, then x equals…", "7", "5", "17", "6", "maths"],
  ["The area of a circle with radius r is…", "πr²", "2πr", "πr", "2πr²", "maths"],
  ["A number increased by 20% becomes 60. The number is…", "50", "48", "40", "55", "maths"],
  ["The median of 3, 7, 9, 11, 15 is…", "9", "7", "11", "8", "maths"],
  ["Which of these is an irrational number?", "√2", "0.25", "3/4", "0.333…", "maths"],
  ["The value of (2³)² is…", "64", "32", "16", "128", "maths"],
  ["In a right triangle, the longest side is the…", "Hypotenuse", "Base", "Altitude", "Median", "maths"],
  ["The mean of 10, 20, 30, 40 is…", "25", "20", "30", "35", "maths"],
  ["The probability of getting a head in one fair coin toss is…", "1/2", "1/4", "1", "1/3", "maths"],
  ["If a = 3 and b = 4, then a² + b² equals…", "25", "7", "12", "49", "maths"],
  ["The perimeter of a square of side 6 cm is…", "24 cm", "36 cm", "12 cm", "18 cm", "maths"],
  ["Which fraction is equal to 0.75?", "3/4", "7/5", "4/3", "3/5", "maths"],
  ["The next prime number after 19 is…", "23", "21", "25", "27", "maths"],
  ["A triangle with all sides equal is called…", "Equilateral", "Isosceles", "Scalene", "Right-angled", "maths"],
  ["The simple interest on ₹1000 for 2 years at 10% per annum is…", "₹200", "₹100", "₹300", "₹220", "maths"],
  ["The value of sin 30° is…", "1/2", "√3/2", "1", "1/√2", "maths"],
  ["The midpoint of (2, 4) and (6, 8) is…", "(4, 6)", "(8, 12)", "(3, 5)", "(4, 8)", "maths"],

  ["Which river is known as the Dakshina Ganga?", "Godavari", "Krishna", "Kaveri", "Narmada", "social"],
  ["The capital of Telangana is…", "Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "social"],
  ["Who wrote the Indian National Anthem?", "Rabindranath Tagore", "Bankim Chandra Chatterjee", "Sarojini Naidu", "Subramania Bharati", "social"],
  ["The Indian Constitution came into force on…", "26 January 1950", "15 August 1947", "26 November 1949", "2 October 1947", "social"],
  ["Which is the largest continent by area?", "Asia", "Africa", "Europe", "North America", "social"],
  ["The Tropic of Cancer passes through how many Indian states?", "8", "6", "5", "10", "social"],
  ["The Dandi March was led by…", "Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Patel", "Rajendra Prasad", "social"],
  ["Which soil is best for cotton in the Deccan plateau?", "Black soil", "Alluvial soil", "Red soil", "Laterite soil", "social"],
  ["The Lok Sabha can have a maximum of how many members?", "552", "545", "500", "600", "social"],
  ["The Palk Strait separates India from…", "Sri Lanka", "Maldives", "Bangladesh", "Myanmar", "social"],
  ["The first woman Chief Minister of an Indian state was…", "Sucheta Kripalani", "Sarojini Naidu", "Indira Gandhi", "Vijaya Lakshmi Pandit", "social"],
  ["Which is the highest mountain peak in India?", "Kanchenjunga", "Nanda Devi", "Mount Everest", "K2", "social"],
  ["The Green Revolution in India was led by…", "M. S. Swaminathan", "Verghese Kurien", "Homi Bhabha", "C. V. Raman", "social"],
  ["Which planet is called the Red Planet?", "Mars", "Venus", "Jupiter", "Mercury", "social"],
  ["Which state has the longest coastline in India?", "Gujarat", "Tamil Nadu", "Andhra Pradesh", "Kerala", "social"],
  ["The Kothagudem region of Telangana is known for…", "Coal", "Coffee", "Rubber", "Tea", "social"],
  ["Who was the first President of India?", "Rajendra Prasad", "S. Radhakrishnan", "Zakir Husain", "Sardar Patel", "social"],
  ["The Indian Railways was started in the year…", "1853", "1849", "1861", "1870", "social"],
  ["Which line divides India into almost two equal parts?", "Tropic of Cancer", "Equator", "Standard Meridian", "Tropic of Capricorn", "social"],
  ["The Ramappa Temple, a UNESCO World Heritage site, is in which state?", "Telangana", "Andhra Pradesh", "Karnataka", "Tamil Nadu", "social"],
  ["Which type of government does India have?", "Parliamentary democracy", "Monarchy", "Military rule", "One-party rule", "social"],
  ["The Chipko movement was mainly about…", "Protecting forests", "Water sharing", "Land reforms", "Fisheries", "social"],
  ["The Rampa rebellion in Telangana was led by…", "Alluri Sitarama Raju", "Komaram Bheem", "Rani Rudrama Devi", "Chakali Ilamma", "social"],

  ["Choose the correctly spelt word.", "Necessary", "Neccessary", "Necesary", "Necassary", "english"],
  ["The plural of 'child' is…", "Children", "Childs", "Childes", "Childrens", "english"],
  ["Pick the synonym of 'diligent'.", "Hardworking", "Lazy", "Careless", "Sleepy", "english"],
  ["Pick the antonym of 'scarce'.", "Plentiful", "Rare", "Limited", "Small", "english"],
  ["She ____ to school every day.", "walks", "walk", "walking", "walked", "english"],
  ["The past tense of 'teach' is…", "Taught", "Teached", "Teach", "Teaching", "english"],
  ["Identify the adverb in: 'The boy ran quickly.'", "Quickly", "Boy", "Ran", "The", "english"],
  ["Choose the correct article: '____ hour.'", "an", "a", "the", "no article", "english"],
  ["Pick the correct passive voice of 'The teacher explains the lesson.'", "The lesson is explained by the teacher.", "The lesson explained the teacher.", "The teacher is explained.", "The lesson was explain.", "english"],
  ["A word that describes a noun is called…", "Adjective", "Adverb", "Verb", "Preposition", "english"],
  ["Pick the correct preposition: 'He is good ____ mathematics.'", "at", "in", "on", "for", "english"],
  ["Which sentence is in the present perfect tense?", "I have finished my homework.", "I finished my homework.", "I am finishing my homework.", "I will finish my homework.", "english"],
  ["Choose the correct indirect speech: He said, 'I am busy.'", "He said that he was busy.", "He said that he is busy.", "He says he was busy.", "He said I was busy.", "english"],
  ["Pick the word with a silent 'k'.", "Knight", "Kitten", "Kitchen", "Kettle", "english"],
  ["Choose the correct form: 'Neither of the boys ____ present.'", "was", "were", "are", "have", "english"],
  ["The prefix in 'unhappy' is…", "un-", "happy", "-py", "hap-", "english"],
  ["Which word is a conjunction?", "because", "beautiful", "bench", "quickly", "english"],
  ["Pick the sentence without an error.", "She has gone to the market.", "She have gone to the market.", "She has went to the market.", "She gone to the market.", "english"],
  ["The opposite gender of 'king' is…", "queen", "princess", "lady", "duchess", "english"],
  ["Choose the correct comparative form of 'good'.", "better", "gooder", "best", "more good", "english"]
];

export const QUESTIONS = RAW_QUESTIONS.map(([prompt, answer, ...rest], index) => {
  const subject = rest.pop();
  return {
    id: `q${index + 1}`,
    prompt,
    answer,
    options: [answer, ...rest],
    subject,
  };
});

// A clue plus the answer students type. The answer is scrambled for the round.
const RAW_TERMS = [
  ["The green pigment that traps sunlight in leaves.", "chlorophyll", "science"],
  ["The force that pulls objects towards Earth.", "gravity", "science"],
  ["A material that allows electricity to pass through it.", "conductor", "science"],
  ["The process by which plants make food.", "photosynthesis", "science"],
  ["The smallest particle of an element that keeps its properties.", "atom", "science"],
  ["A device that converts mechanical energy into electricity.", "generator", "science"],
  ["The change of a liquid into vapour.", "evaporation", "science"],
  ["The unit used to measure force.", "newton", "science"],
  ["The organ that pumps blood around the body.", "heart", "science"],
  ["The gas released by plants during photosynthesis.", "oxygen", "science"],
  ["The number of degrees in a straight angle.", "180", "maths"],
  ["A polygon with eight sides.", "octagon", "maths"],
  ["The result of multiplying two numbers.", "product", "maths"],
  ["A straight line that touches a circle at one point.", "tangent", "maths"],
  ["The average of a set of numbers.", "mean", "maths"],
  ["The longest side of a right triangle.", "hypotenuse", "maths"],
  ["A number with exactly two factors.", "prime", "maths"],
  ["The distance around a circle.", "circumference", "maths"],
  ["The study of the Earth's surface and its people.", "geography", "social"],
  ["The law-making body of the Indian Union.", "parliament", "social"],
  ["A person who studies the past using evidence.", "historian", "social"],
  ["The seasonal wind that brings rain to India.", "monsoon", "social"],
  ["The right to vote is called adult…", "suffrage", "social"],
  ["A narrow strip of land joining two larger areas.", "isthmus", "social"],
  ["A word that names a person, place or thing.", "noun", "english"],
  ["A word that shows action.", "verb", "english"],
  ["The main idea of a paragraph is called its…", "topic", "english"],
  ["A comparison using 'like' or 'as'.", "simile", "english"],
  ["The person who writes a story.", "author", "english"],
  ["Words that sound the same but differ in meaning.", "homophones", "english"],
];

export const TERMS = RAW_TERMS.map(([clue, answer, subject], index) => ({
  id: `t${index + 1}`,
  clue,
  answer,
  subject,
}));

// Small deterministic PRNG so a game can be rebuilt from its seed on the server.
export function seededRandom(seed) {
  let value = Number(seed) >>> 0 || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value >>>= 0;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 4294967296;
  };
}

export function shuffle(list, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function pickQuestions({ seed, count, subjects = SUBJECTS, scrambleOptions = true }) {
  const random = seededRandom(seed);
  const pool = QUESTIONS.filter((question) => subjects.includes(question.subject));
  const chosen = shuffle(pool, random).slice(0, count);
  return chosen.map((question, index) => ({
    id: `${question.id}-${index}`,
    prompt: question.prompt,
    subject: question.subject,
    options: scrambleOptions ? shuffle(question.options, random) : question.options,
    answer: question.answer,
  }));
}

export function pickTerm({ seed, index }) {
  const random = seededRandom(Number(seed) + index * 7919 + 13);
  const term = TERMS[Math.floor(random() * TERMS.length)];
  return { ...term, letters: shuffle([...term.answer], random) };
}

export function makeEquation({ seed, index, difficulty = 2 }) {
  const random = seededRandom(Number(seed) + index * 104729 + 7);
  const kind = difficulty >= 3 ? Math.floor(random() * 4) : Math.floor(random() * 2);
  const number = (min, max) => min + Math.floor(random() * (max - min + 1));
  if (kind === 0) {
    const a = number(11, 39);
    const b = number(11, 39);
    return { prompt: `${a} + ${b}`, answer: String(a + b), hint: "Add the tens, then the ones." };
  }
  if (kind === 1) {
    const a = number(40, 99);
    const b = number(11, 39);
    return { prompt: `${a} − ${b}`, answer: String(a - b), hint: "Borrow from the tens column." };
  }
  if (kind === 2) {
    const a = number(3, 12);
    const b = number(3, 12);
    return { prompt: `${a} × ${b}`, answer: String(a * b), hint: "Split one factor into tens and ones." };
  }
  const b = number(2, 9);
  const answer = number(3, 12);
  return { prompt: `${b * answer} ÷ ${b}`, answer: String(answer), hint: "Which number times the divisor gives the dividend?" };
}
