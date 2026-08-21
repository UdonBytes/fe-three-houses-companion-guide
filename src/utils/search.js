import { normalizeText, tokenize } from "./normalizeSearch.js";

const RESULT_LIMITS = {
  conversations: 5,
  questionAnswers: 5,
  default: 12,
};

export function searchAll(query, characters, indexes, questionAnswers = []) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return emptyResults();

  return {
    questionAnswers: rankResults(
      questionAnswers.map((entry) => ({
        type: "question-answer",
        title: entry.question,
        text: `${entry.question} ${(entry.searchAliases || []).join(" ")} ${entry.answer} ${entry.timing}`,
        question: entry.question,
        searchAliases: entry.searchAliases || [],
        answer: entry.answer,
        timing: entry.timing,
      })),
      normalizedQuery,
    ).slice(0, RESULT_LIMITS.questionAnswers),
    conversations: rankResults(
      indexes.conversations.map((conversation) => ({
        type: "conversation",
        title: conversation.prompt,
        text: `${conversation.prompt} ${(conversation.searchAliases || []).join(" ")}`,
        prompt: conversation.prompt,
        character: conversation.character,
        answers: conversation.answers,
        status: conversation.status,
        reason: conversation.reason,
      })),
      normalizedQuery,
    ).slice(0, RESULT_LIMITS.conversations),
    lostItems: rankResults(
      indexes.lostItems.map((entry) => ({
        type: "lost-item",
        title: entry.item,
        text: `${entry.item} ${entry.owner.name} ${entry.owner.house}`,
        item: entry.item,
        owner: entry.owner,
      })),
      normalizedQuery,
    ).slice(0, RESULT_LIMITS.default),
    gifts: rankResults(
      indexes.gifts.map((entry) => ({
        type: "gift",
        title: entry.name,
        text: `${entry.name} ${entry.characters.map((c) => c.name).join(" ")}`,
        gift: entry.name,
        characters: entry.characters,
      })),
      normalizedQuery,
    ).slice(0, RESULT_LIMITS.default),
    characters: rankResults(
      characters.map((character) => ({
        type: "character",
        title: character.name,
        text: [
          character.name,
          character.house,
          character.pdfHouse,
          character.recruitment.class,
          character.recruitment.availableFrom,
          character.recruitment.requirement,
          character.recruitment.notes,
          textValues(character.teas).join(" "),
          aliases(character.teas).join(" "),
          textValues(character.topics).join(" "),
          aliases(character.topics).join(" "),
        ].join(" "),
        character,
      })),
      normalizedQuery,
    ).slice(0, RESULT_LIMITS.default),
    teas: rankResults(
      indexes.teas.map((entry) => ({
        type: "tea",
        title: entry.name,
        text: `${entry.name} ${entry.characters.map((c) => c.name).join(" ")}`,
        tea: entry.name,
        characters: entry.characters,
      })),
      normalizedQuery,
    ).slice(0, RESULT_LIMITS.default),
  };
}

function textValues(values) {
  return values.map((value) => (typeof value === "string" ? value : value.text));
}

function aliases(values) {
  return values.flatMap((value) => (typeof value === "string" ? [] : value.searchAliases || []));
}

export function rankResults(records, normalizedQuery) {
  const queryTokens = tokenize(normalizedQuery);

  return records
    .map((record) => {
      const normalizedText = normalizeText(record.text);
      const normalizedTitle = normalizeText(record.title);
      const score = scoreRecord(normalizedQuery, queryTokens, normalizedText, normalizedTitle);
      return { ...record, score };
    })
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function scoreRecord(query, queryTokens, text, title) {
  if (title === query) return 1000;
  if (text === query) return 950;
  if (title.startsWith(query)) return 850;
  if (text.startsWith(query)) return 800;
  if (title.includes(query)) return 720;
  if (text.includes(query)) return 650;

  const textTokens = tokenize(text);
  const matchedTokens = queryTokens.filter((token) =>
    textTokens.some((textToken) => textToken === token),
  );
  if (matchedTokens.length === queryTokens.length && queryTokens.length > 0) {
    return 540 + matchedTokens.length * 10;
  }

  return 0;
}

function emptyResults() {
  return {
    questionAnswers: [],
    conversations: [],
    lostItems: [],
    gifts: [],
    characters: [],
    teas: [],
  };
}
