export function buildIndexes(characters) {
  const gifts = new Map();
  const lostItems = new Map();
  const teas = new Map();
  const conversations = [];
  const houses = new Map();

  for (const character of characters) {
    addToGroup(houses, character.house, character);

    for (const gift of character.gifts) {
      addToGroup(gifts, gift, character);
    }

    for (const lostItem of character.lostItems) {
      lostItems.set(lostItem, character);
    }

    for (const tea of character.teas) {
      addToGroup(teas, getTextValue(tea), character);
    }

    for (const response of character.finalResponses) {
      conversations.push({
        character,
        prompt: response.prompt,
        searchAliases: response.searchAliases || [],
        status: response.status || null,
        reason: response.reason || null,
        answers: response.answers,
      });
    }
  }

  return {
    gifts: sortedEntries(gifts),
    lostItems: Array.from(lostItems, ([item, owner]) => ({ item, owner })).sort(
      (a, b) => a.item.localeCompare(b.item),
    ),
    teas: sortedEntries(teas),
    conversations,
    houses,
  };
}

function getTextValue(value) {
  return typeof value === "string" ? value : value.text;
}

function addToGroup(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function sortedEntries(map) {
  return Array.from(map, ([name, characters]) => ({
    name,
    characters: characters.sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
