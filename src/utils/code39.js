const CODE39 = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw",
  C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww",
  O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn",
  S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw",
  W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "$": "nwnwnwnnn",
  "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
};

export function normalizeParcelCode(value) {
  const input = String(value || "").trim().toUpperCase();
  const finalPart = input.split(/[/?#]/).filter(Boolean).at(-1) || input;
  return finalPart.replace(/[^A-Z0-9* .$/+%-]/g, "").replaceAll("*", "").trim();
}

export function code39Svg(value, { height = 74, module = 2 } = {}) {
  const text = String(value || "").toUpperCase();
  if (!text || text.length > 80 || [...text].some((character) => !CODE39[character] || character === "*")) return "";
  const encoded = `*${text}*`;
  const narrowGap = 1;
  const units = [...encoded].reduce((sum, character) => sum + [...CODE39[character]].reduce((width, size) => width + (size === "w" ? 3 : 1), 0), 0) + (encoded.length - 1) * narrowGap;
  const quiet = 10;
  const svgWidth = (units + quiet * 2) * module;
  let x = quiet * module;
  const bars = [];
  [...encoded].forEach((character, characterIndex) => {
    [...CODE39[character]].forEach((size, patternIndex) => {
      const width = (size === "w" ? 3 : 1) * module;
      if (patternIndex % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}"/>`);
      x += width;
    });
    if (characterIndex < encoded.length - 1) x += narrowGap * module;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Parcel code ${text}" viewBox="0 0 ${svgWidth} ${height}" width="${svgWidth}" height="${height}" shape-rendering="crispEdges" fill="#172b24">${bars.join("")}</svg>`;
}
