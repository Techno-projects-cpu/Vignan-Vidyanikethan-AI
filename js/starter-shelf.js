/**
 * The starter shelf.
 *
 * The library is empty until a student adds pages, and an empty library makes
 * every grounded feature look broken: questions come back as "add a book", the
 * exam packs have nothing to draw from, and a judge sees a screen that refuses
 * to work. Publishers of the real textbooks have not given permission, and this
 * project must not become a copy of them, so the answer is not somebody else's
 * book. It is our own.
 *
 * Everything below was written for this project: plain explanatory prose about
 * standard scientific facts, in our own words. It is not a reproduction of any
 * textbook, and it does not claim to be one. Each page is a normal library page,
 * so it is cited, searched, quizzed and graded exactly like a student upload,
 * and a student can delete it the moment they add their real book.
 *
 * Pure data and pure functions: no DOM, no imports, no network, ASCII only.
 */

export const STARTER_NOTE =
  "Starter pages written for this project, not a published textbook. They are ordinary pages: cited, searchable and replaceable.";

const PHYSICS = [
  {
    heading: "Units and Measurements",
    text: "Measurement in physics begins with a unit, a fixed quantity used as a standard for comparison. The SI system uses seven base units, including the metre for length, the kilogram for mass, the second for time and the kelvin for temperature. Every other unit is derived from these, for example the newton for force and the watt for power. Dimensional analysis checks whether an equation is consistent, because both sides must carry the same dimensions. Measured values always carry some uncertainty, so results are written with significant figures and a stated error.",
  },
  {
    heading: "Motion in a Straight Line",
    text: "Displacement is the change in position in a stated direction, while distance is the total path covered. Average velocity divides displacement by the time taken, and instantaneous velocity is its value at one moment. Acceleration measures how quickly velocity changes with time. For uniformly accelerated motion, the equations of motion connect velocity, displacement, acceleration and time without needing a graph. A velocity time graph shows acceleration as its slope and displacement as the area under the line.",
  },
  {
    heading: "Laws of Motion",
    text: "The laws of motion were stated by Isaac Newton and describe how forces change the movement of a body. The first law says a body keeps its state of rest or uniform motion unless a net external force acts on it. The second law states that force equals the rate of change of momentum, which for constant mass becomes force equals mass times acceleration. The third law says every action has an equal and opposite reaction, and the two forces act on different bodies. Friction is the force that opposes relative motion between surfaces in contact.",
  },
  {
    heading: "Work, Energy and Power",
    text: "Work is done when a force moves a body through a distance, and for a constant force it is the product of force, displacement and the cosine of the angle between them. The kinetic energy of a moving body equals half its mass times the square of its speed. Potential energy is stored energy that depends on position, and near the earth's surface it is mass times gravity times height. The work energy theorem connects the net work done on a body with the change in its kinetic energy. Power is the rate of doing work and is measured in watts.",
  },
  {
    heading: "Gravitation",
    text: "Gravitation is the attraction between any two bodies that have mass. Newton's law of gravitation states that the force between two point masses is proportional to the product of the masses and inversely proportional to the square of the distance between them. The acceleration due to gravity near the earth's surface is about 9.8 metres per second squared and falls with height. Escape velocity is the minimum speed with which a body can leave the earth's pull for ever. Kepler's laws describe planetary orbits as ellipses with the sun at one focus.",
  },
  {
    heading: "Thermodynamics",
    text: "Thermodynamics studies heat, work and internal energy, and the laws that connect them. The first law of thermodynamics says the heat supplied to a system equals the increase in its internal energy plus the work done by the system. An isothermal process keeps the temperature constant, while an adiabatic process allows no heat exchange with the surroundings. The second law states that heat flows from a hotter body to a colder one and that the entropy of an isolated system never decreases. A heat engine converts part of the heat it receives into work and rejects the rest.",
  },
  {
    heading: "Oscillations",
    text: "An oscillation is a repeated to and fro motion about a mean position, and simple harmonic motion is the special case where the restoring force is proportional to the displacement. In simple harmonic motion the body moves between two extreme points, and the greatest distance from the mean position is the amplitude. The period is the time for one complete oscillation and the frequency is the number of oscillations in one second. The displacement of a simple harmonic oscillator follows a sine or cosine curve. A loaded spring and a simple pendulum are the standard examples used in problems.",
  },
  {
    heading: "Waves",
    text: "A wave carries energy from one place to another without carrying matter along with it. In a transverse wave the particles move at right angles to the direction in which the wave travels, while in a longitudinal wave they move along it. The wavelength is the distance between two neighbouring points in the same phase, and the frequency is the number of waves crossing a point each second. Wave speed equals wavelength multiplied by frequency. When waves from two sources meet, superposition produces points of reinforcement and cancellation, which is the basis of interference.",
  },
  {
    heading: "Electric Charges and Fields",
    text: "Electric charge is a property of matter that produces electric forces between objects. Like charges repel and unlike charges attract, and the total charge of an isolated system is conserved. Coulomb's law states that the force between two point charges is proportional to the product of the charges and inversely proportional to the square of the distance between them. The electric field at a point is the force per unit charge that a small test charge would feel there. Field lines start on positive charges and end on negative charges, and the density of the lines shows the strength of the field.",
  },
  {
    heading: "Current Electricity",
    text: "An electric current is a flow of charge through a conductor, measured in amperes. Ohm's law states that the current through a metallic conductor is proportional to the potential difference across it at constant temperature, and the constant of proportionality is the resistance. Resistance depends on the length, the area of cross section and the nature of the material, through a property called resistivity. Resistors in series add, while in parallel their reciprocals add. Kirchhoff's rules apply charge conservation at a junction and energy conservation around a closed loop.",
  },
  {
    heading: "Ray Optics and Optical Instruments",
    text: "In ray optics light travels in straight lines and its path is traced as a ray. Reflection at a plane mirror makes the angle of incidence equal to the angle of reflection. Refraction happens because light changes speed when it passes from one medium to another, and Snell's law relates the angles of incidence and refraction to the refractive indices. A converging lens bends parallel rays to a focus, and the lens formula connects the object distance, the image distance and the focal length. A microscope magnifies very small objects, and a telescope collects light from distant objects.",
  },
];

const CHEMISTRY = [
  {
    heading: "Some Basic Concepts of Chemistry",
    text: "Chemistry studies the composition, properties and changes of matter. Matter is made of atoms, and the mole is the unit used to count particles, with one mole containing Avogadro's number of particles. The molar mass of a substance is the mass of one mole of it, so the number of moles equals the mass divided by the molar mass. A chemical equation is balanced to follow the law of conservation of mass. Stoichiometry uses the balanced equation to calculate how much of each reactant is needed and how much product forms.",
  },
  {
    heading: "Structure of Atom",
    text: "An atom consists of a small dense nucleus containing protons and neutrons, with electrons moving around it. The number of protons is the atomic number and fixes the identity of the element. Bohr's model explained the hydrogen spectrum by saying that an electron occupies fixed energy levels and emits light when it drops to a lower level. The modern picture describes the electron by an orbital, a region where the probability of finding it is high. The arrangement of electrons in an atom follows the Aufbau principle and Hund's rule.",
  },
  {
    heading: "Classification of Elements",
    text: "The modern periodic table arranges elements in order of increasing atomic number. Elements in the same group have similar outer shell configurations and therefore similar chemical properties. Moving across a period the atomic radius decreases, the ionisation enthalpy increases and the electronegativity increases. Moving down a group the atomic radius increases and the metallic character increases. These periodic trends explain why the elements of one group behave alike.",
  },
  {
    heading: "Chemical Bonding",
    text: "A chemical bond holds atoms together in a compound. An ionic bond forms when one atom transfers electrons to another and the resulting ions attract each other. A covalent bond forms when two atoms share a pair of electrons, and a coordinate bond is a covalent bond in which both shared electrons come from one atom. The shape of a molecule is predicted from the repulsion between electron pairs around the central atom. Polarity depends on the difference in electronegativity between the bonded atoms.",
  },
  {
    heading: "Equilibrium",
    text: "A reversible reaction can proceed in both directions, and equilibrium is reached when the forward and backward rates become equal. At equilibrium the concentrations of reactants and products stay constant, although the reaction has not stopped. The equilibrium constant is the ratio of the product concentrations to the reactant concentrations, each raised to its coefficient in the balanced equation. Le Chatelier's principle states that a change in concentration, pressure or temperature shifts the position of equilibrium so as to oppose the change. A catalyst speeds up the approach to equilibrium without changing its position.",
  },
  {
    heading: "Redox Reactions",
    text: "A redox reaction is one in which oxidation and reduction happen at the same time. Oxidation is the loss of electrons and reduction is the gain of electrons, and the two are always paired. The oxidation number of an atom tracks its electrons and rises when the atom is oxidised. The substance that accepts electrons is the oxidising agent and the one that gives them up is the reducing agent. Redox equations are balanced by making the electrons lost equal to the electrons gained.",
  },
  {
    heading: "Hydrocarbons",
    text: "Hydrocarbons are compounds that contain only carbon and hydrogen. Alkanes have single bonds only and are relatively unreactive, while alkenes contain a double bond and alkynes a triple bond. Alkenes and alkynes are unsaturated and readily undergo addition reactions with hydrogen, halogens and water. Alkanes undergo substitution reactions in the presence of light. Benzene is an aromatic hydrocarbon whose electrons are delocalised around the ring.",
  },
  {
    heading: "Solutions",
    text: "A solution is a homogeneous mixture of a solute dissolved in a solvent. Concentration is expressed as molarity, the moles of solute per litre of solution, or as molality, the moles of solute per kilogram of solvent. Raoult's law states that the vapour pressure of a solvent above a solution is proportional to its mole fraction in the mixture. Colligative properties such as boiling point elevation and freezing point depression depend on the number of solute particles rather than their identity. Osmosis is the movement of solvent through a semipermeable membrane into the more concentrated solution.",
  },
  {
    heading: "Chemical Kinetics",
    text: "Chemical kinetics is the study of the rate of a chemical reaction and the factors that change it. The rate depends on concentration, temperature, surface area and the presence of a catalyst. The order of a reaction expresses how the rate depends on the concentration of each reactant. The rate constant increases with temperature, and the Arrhenius equation relates it to the activation energy and the temperature. A catalyst lowers the activation energy and speeds up the reaction without being consumed.",
  },
  {
    heading: "Biomolecules",
    text: "Biomolecules are the molecules found in living organisms, and they include carbohydrates, proteins, lipids and nucleic acids. Carbohydrates are a source of energy, and glucose is the simplest sugar used by cells. Proteins are chains of amino acids joined by peptide bonds, and they act as enzymes, hormones and structural material. Enzymes are biological catalysts that are highly specific for their substrate. Nucleic acids are the molecules that store and transfer genetic information.",
  },
];

const BIOLOGY = [
  {
    heading: "Cell: The Unit of Life",
    text: "The cell is the basic structural and functional unit of life in every organism, and it is the smallest unit that can carry out all the activities of living. A prokaryotic cell has no true nucleus and no membrane bound organelles, while a eukaryotic cell keeps its genetic material inside a nucleus. The plasma membrane controls which substances enter and leave the cell. Mitochondria release energy from food, ribosomes build proteins, and the chloroplast of a plant cell carries out photosynthesis. Cells of the same kind group together to form tissues, and tissues form organs.",
  },
  {
    heading: "Cell Cycle and Cell Division",
    text: "The cell cycle is the sequence of events through which a cell grows and divides into two new cells. Interphase is the longest stage, when the cell grows and copies its DNA. Mitosis divides the nucleus so that each daughter cell receives an identical set of chromosomes, and it passes through prophase, metaphase, anaphase and telophase. Meiosis produces four cells with half the chromosome number and creates variation through crossing over. In humans, meiosis is essential for forming gametes.",
  },
  {
    heading: "Photosynthesis in Higher Plants",
    text: "Photosynthesis is the process in which green plants use light energy to make food from carbon dioxide and water. It takes place in the chloroplast, where the pigment chlorophyll absorbs light. In the light reaction, water is split and the energy carriers ATP and NADPH are produced. The Calvin cycle then uses that energy to fix carbon dioxide into sugar. Temperature, light intensity and carbon dioxide concentration all limit the rate of photosynthesis.",
  },
  {
    heading: "Respiration in Plants",
    text: "Respiration in plants breaks down glucose to release energy that is stored in ATP. The first stage, glycolysis, happens in the cytoplasm and splits glucose into two molecules of pyruvate. In the presence of oxygen the pyruvate enters the mitochondrion, where the Krebs cycle and the electron transport chain release much more energy. When oxygen is not available, fermentation converts pyruvate into ethanol or lactic acid and releases far less energy. Respiration goes on in plants day and night, unlike photosynthesis.",
  },
  {
    heading: "Digestion and Absorption",
    text: "Digestion is the breakdown of large food molecules into small ones that the body can absorb. It begins in the mouth, where saliva contains the enzyme amylase that acts on starch. In the stomach, hydrochloric acid and the enzyme pepsin break proteins into shorter chains. The small intestine completes digestion with enzymes from the pancreas and the intestinal wall, and its villi increase the surface for absorption. Water and salts are absorbed mainly in the large intestine.",
  },
  {
    heading: "Body Fluids and Circulation",
    text: "Blood is a fluid connective tissue that carries oxygen, nutrients, hormones and waste products through the body. Plasma is the liquid part, red blood cells carry oxygen using haemoglobin, white blood cells defend against infection, and platelets help in clotting. The human heart has four chambers, and the right side pumps blood to the lungs while the left side pumps it to the rest of the body. The rhythmic contraction and relaxation of the heart is called the cardiac cycle. Blood groups depend on antigens on the surface of red blood cells.",
  },
  {
    heading: "Principles of Inheritance and Variation",
    text: "Inheritance is the passing of characters from parents to offspring through genes. Mendel worked with garden peas and found that each character is controlled by a pair of factors, one coming from each parent. His law of segregation states that the two factors separate during gamete formation, and his law of independent assortment states that different characters are inherited independently. A dominant factor shows itself in the offspring, while a recessive factor appears only when both factors are recessive. Variation arises from independent assortment, crossing over and mutation.",
  },
  {
    heading: "Molecular Basis of Inheritance",
    text: "DNA is the molecule that stores genetic information in all living organisms. It is a double helix of two strands held together by hydrogen bonds between complementary bases, where adenine pairs with thymine and guanine pairs with cytosine. Replication copies the DNA before a cell divides, and transcription makes a messenger RNA copy of a gene. Translation at the ribosome reads the genetic code three bases at a time and joins amino acids into a protein. A change in the base sequence is a mutation, and it may or may not change the protein.",
  },
  {
    heading: "Human Health and Disease",
    text: "Health is a state of complete physical, mental and social well being, not merely the absence of disease. Disease causing organisms include bacteria, viruses, fungi and protozoa, and they spread through air, water, food, contact and vectors. The immune system defends the body with barriers, phagocytes and antibodies. A vaccine trains the immune system with a harmless form of a pathogen, so that a later infection is fought quickly. Cancer results when cells lose control over division and multiply without limit.",
  },
  {
    heading: "Ecosystem",
    text: "An ecosystem is a community of living organisms together with the non living environment in which they live. Producers such as green plants convert solar energy into food, consumers feed on other organisms, and decomposers break down dead matter. A food chain shows the path of energy from one organism to the next, and a food web shows how several chains are linked. Energy flow is one way, and only about ten per cent of it passes from one trophic level to the next. Nutrients, unlike energy, are recycled within the ecosystem.",
  },
];

const MATHEMATICS = [
  {
    heading: "Sets, Relations and Functions",
    text: "A set is a collection of distinct objects, and the objects it contains are its elements. The union of two sets contains every element in either set, and the intersection contains only the elements common to both. A relation is a rule that pairs elements of one set with elements of another, and a function is a relation in which every input has exactly one output. The domain of a function is the set of allowed inputs and the range is the set of values it produces. Functions can be added, multiplied and composed, and the inverse of a function undoes its effect.",
  },
  {
    heading: "Trigonometric Functions",
    text: "Trigonometric functions relate the angles of a triangle to the lengths of its sides. The sine of an angle is the ratio of the opposite side to the hypotenuse, and the cosine is the ratio of the adjacent side to the hypotenuse. Angles are measured in degrees or in radians, where pi radians equal 180 degrees. Identities such as sine squared plus cosine squared equals one hold for every angle. The graphs of sine and cosine repeat after one full turn, and this repeating behaviour makes them useful in the study of waves.",
  },
  {
    heading: "Complex Numbers and Quadratic Equations",
    text: "A complex number has a real part and an imaginary part and is written in terms of the imaginary unit i, where i squared equals minus one. The modulus of a complex number is its distance from the origin in the Argand plane, and the argument is the angle it makes with the real axis. A quadratic equation is solved by factorising or by the quadratic formula. The discriminant, the square of b minus four times a times c, tells whether the roots are real and different, real and equal, or complex.",
  },
  {
    heading: "Permutations and Combinations",
    text: "A permutation is an arrangement of objects in which order matters, while a combination is a selection in which order does not matter. The number of permutations of n distinct objects taken r at a time is written nPr, and the number of combinations is written nCr. Factorial notation expresses the product of all whole numbers up to a given number. A permutation equals a combination multiplied by the factorial of r. These counts solve problems about seating, committees, passwords and arrangements with repeated letters.",
  },
  {
    heading: "Binomial Theorem",
    text: "The binomial theorem expands a sum of two terms raised to a whole number power as a series of terms. Each term carries a binomial coefficient, and the coefficients form Pascal's triangle, where every entry is the sum of the two entries above it. The general term makes it possible to find one particular term without writing the whole expansion. The middle term is the term with the largest coefficient and depends on whether the power is even or odd. The theorem is also useful for approximations when the second term is small.",
  },
  {
    heading: "Sequences and Series",
    text: "A sequence is an ordered list of numbers, and a series is the sum of the terms of a sequence. In an arithmetic progression each term differs from the previous one by a fixed number, so the nth term is a plus n minus one times d. The sum of the first n terms of an arithmetic progression is n divided by two, multiplied by the sum of the first and last terms. In a geometric progression each term is a fixed multiple of the previous term, and the sum of n terms is a times one minus r to the n, divided by one minus r. An infinite geometric progression adds to a finite value only when the ratio is smaller than one.",
  },
  {
    heading: "Straight Lines",
    text: "A straight line in the coordinate plane can be described by its slope and one point on it. The slope of a line through two points is the change in y divided by the change in x. The slope intercept form is y equals m x plus c, and the two point form builds the equation from two known points. Two lines are parallel when their slopes are equal and perpendicular when the product of their slopes is minus one. The distance of a point from a line measures how far the point lies from it along the perpendicular.",
  },
  {
    heading: "Matrices and Determinants",
    text: "A matrix is a rectangular arrangement of numbers in rows and columns, and its order gives the number of rows and the number of columns. Matrices of the same order can be added, and a matrix can be multiplied by a scalar. Matrix multiplication is possible when the number of columns of the first equals the number of rows of the second, and it is not commutative. The determinant of a square matrix is a single number that tells whether the matrix has an inverse. A system of linear equations can be solved with determinants using Cramer's rule.",
  },
  {
    heading: "Limits, Continuity and Differentiability",
    text: "A limit describes the value a function approaches as its input approaches a chosen point. Standard limits, such as sine x divided by x tending to one as x tends to zero, are used to evaluate harder expressions. A function is continuous at a point when its limit there equals its value there, so its graph has no break at that point. The derivative measures the instantaneous rate of change and is defined as a limit of a difference quotient. Differentiation rules for sums, products, quotients and composite functions make derivatives quick to compute.",
  },
  {
    heading: "Integrals",
    text: "Integration is the reverse of differentiation, and an antiderivative of a function is a function whose derivative is the original function. An indefinite integral carries a constant of integration because many functions share the same derivative. A definite integral gives the exact area under a curve between two limits, and the fundamental theorem of calculus connects the two ideas. Substitution and integration by parts are the standard techniques for integrals that are not in the basic table. Definite integrals also give the area between two curves and the displacement from a velocity curve.",
  },
];

const BOOKS = [
  {
    id: "starter-physics",
    title: "Starter Physics: Force, Energy and Electricity",
    subject: "Physics",
    grade: "11",
    pages: PHYSICS,
  },
  {
    id: "starter-chemistry",
    title: "Starter Chemistry: Atoms, Bonds and Reactions",
    subject: "Chemistry",
    grade: "11",
    pages: CHEMISTRY,
  },
  {
    id: "starter-biology",
    title: "Starter Biology: Cells, Plants and the Human Body",
    subject: "Biology",
    grade: "11",
    pages: BIOLOGY,
  },
  {
    id: "starter-mathematics",
    title: "Starter Mathematics: Algebra, Geometry and Calculus",
    subject: "Mathematics",
    grade: "11",
    pages: MATHEMATICS,
  },
];

/** The starter books, copied so a caller cannot edit the shipped content. */
export function shelfBooks() {
  return BOOKS.map((book) => ({
    ...book,
    pages: book.pages.map((page) => ({ heading: page.heading, text: page.text })),
  }));
}

export function isStarterBookId(id = "") {
  return BOOKS.some((book) => book.id === id) || /^starter-/.test(String(id));
}

/** Turns one starter book into the markdown a pasted note would be. */
export function shelfMarkdown(book = {}) {
  const lines = [];
  const pages = Array.isArray(book.pages) ? book.pages : [];
  pages.forEach((page, index) => {
    lines.push(`[[page:${index + 1}]]`);
    lines.push(`# ${page.heading}`);
    lines.push(String(page.text || "").trim());
    lines.push("");
  });
  return lines.join("\n").trim();
}

/** Book and page counts, for the interface and for tests. */
export function shelfSummary() {
  const books = BOOKS.length;
  const pages = BOOKS.reduce((total, book) => total + book.pages.length, 0);
  const words = BOOKS.reduce(
    (total, book) => total + book.pages.reduce((sum, page) => sum + String(page.text || "").split(/\s+/).filter(Boolean).length, 0),
    0,
  );
  return { books, pages, words };
}
