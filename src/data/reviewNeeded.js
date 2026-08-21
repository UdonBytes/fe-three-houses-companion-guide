export const reviewNeeded = [
  {
    status: "review-needed",
    area: "Source files",
    source: "Fire Emblem- Three Houses One-Stop Guide.pdf",
    reason:
      "The PDF file is not present in the workspace. Current MVP PDF-derived data was supplied by user paste; any additional PDF sections beyond gifts, lost items, tea, topics, final responses, and question/answer chunks 5-7 require pasted source data or the original PDF.",
    affects: [
      "future PDF sections not yet imported",
    ],
  },
  {
    status: "review-needed",
    area: "Likely PDF/OCR typos",
    source: "User-pasted PDF extraction",
    reason:
      "Likely typos are preserved in displayed source text, with separate search aliases where the intended wording is clear. One truncated-looking prompt remains flagged without correction.",
    affects: [
      "Spekaing with you... -> search alias Speaking with you...",
      "Four-Spive Blend -> search alias Four-Spice Blend",
      "Potential traiing partners -> search alias Potential training partners",
      "The existense of Crests -> search alias The existence of Crests",
      "archbiship -> search alias archbishop",
      "I’m exhausted by the all... -> review-needed, no invented correction",
      "five year ago -> search alias five years ago",
    ],
  },
  {
    status: "review-needed",
    area: "Recruitment",
    source: "Uploaded Serenes Forest Recruitment screenshot and pasted PDF gift/lost-item chunk",
    reason:
      "Rhea appears in the pasted PDF gift/lost-item data but not in the recruitment screenshot.",
    affects: ["Rhea recruitment"],
  },
  {
    status: "review-needed",
    area: "Recruitment screenshot",
    source: "Uploaded Serenes Forest Recruitment screenshot",
    reason:
      "The screenshot intentionally redacts route details as [spoiler]. These are preserved exactly as source text rather than expanded.",
    affects: ["recruitment.notes"],
  },
];
