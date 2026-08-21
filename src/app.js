import { characters } from "./data/characters.js";
import { happyPortraitByCharacter, portraitByCharacter } from "./data/portraits.js?v=20260820-happy-1";
import { questionAnswers } from "./data/questionAnswers.js";
import { buildIndexes } from "./utils/buildIndexes.js";
import { normalizeText } from "./utils/normalizeSearch.js";
import { searchAll } from "./utils/search.js?v=20260820-exact-search-1";

const indexes = buildIndexes(characters);
const app = document.querySelector("#app");
const PAGE_FADE_MS = 220;
const GIFT_CHIP_ROW_BREAKS = {
  "Arithmetic Textbook": ["Lysithea"],
  "Board Game": ["Hubert"],
  "Book of Crest Designs": ["Linhardt"],
  "Ceremonial Sword": ["Ignatz"],
  "Exotic Spices": ["Petra"],
  "Fishing Float": ["Linhardt"],
  "Floral Adornment": ["Marianne"],
  "Gemstone Beads": ["Manuela"],
  "Goddess Statue": ["Mercedes"],
  "Hunting Dagger": ["Petra"],
  "Landscape Painting": ["Rhea"],
  "Riding Boots": ["Ferdinand"],
  "Smoked Meat": ["Petra"],
  "Stylish Hair Clip": ["Flayn"],
  "Tea Leaves": ["Lorenz"],
  "Training Weight": ["Felix"],
  "Watering Can": ["Cyril"],
  "Whetstone": ["Dimitri"],
};
let pendingNavigation = null;

const state = {
  route: parseRoute(),
  query: "",
  characterFilter: "All",
  alphabetFilters: {
    gifts: "All",
    lostItems: "All",
  },
};

window.addEventListener("hashchange", () => {
  state.route = parseRoute();
  render();
  window.scrollTo({ top: 0 });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !isTypingTarget(event.target)) {
    event.preventDefault();
    document.querySelector("[data-global-search]")?.focus();
  }
});

render();

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  const [page = "", rawParam = ""] = hash.split("/");
  return {
    page: page || "home",
    param: decodeURIComponent(rawParam),
  };
}

function navigate(path) {
  const targetHash = toRouteHash(path);
  const clearSearch = shouldClearSearchForRoute(path);
  if (window.location.hash === targetHash || (!window.location.hash && targetHash === "#/")) {
    if (clearSearch && state.query) {
      state.query = "";
      render();
    }
    return;
  }

  window.clearTimeout(pendingNavigation);
  const main = document.querySelector(".main");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const commitNavigation = () => {
    if (clearSearch) state.query = "";
    window.location.hash = path;
  };

  if (!main || reduceMotion) {
    commitNavigation();
    return;
  }

  main.classList.add("main-leaving");
  pendingNavigation = window.setTimeout(() => {
    commitNavigation();
    pendingNavigation = null;
  }, PAGE_FADE_MS);
}

function toRouteHash(path) {
  if (!path || path === "/") return "#/";
  if (path.startsWith("#")) return path;
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}

function shouldClearSearchForRoute(path) {
  const routePath = toRouteHash(path).replace(/^#\/?/, "").split("?")[0];
  return /^(character|conversations)\//.test(routePath);
}

function render(options = {}) {
  app.innerHTML = "";
  app.append(createShell());

  if (options.preserveSearchFocus) {
    const input = document.querySelector("[data-global-search]");
    input?.focus({ preventScroll: true });
    if (input && Number.isInteger(options.selectionStart) && Number.isInteger(options.selectionEnd)) {
      input.setSelectionRange(options.selectionStart, options.selectionEnd);
    }
  }
}

function createShell() {
  const shell = el("div", { className: `site-shell ${state.query.trim() ? "search-active" : ""}` });
  shell.append(createHeader());

  const main = el("main", { className: "main" });
  if (state.route.page === "characters") main.append(createCharactersPage());
  else if (state.route.page === "character") main.append(createCharacterDetail(state.route.param));
  else if (state.route.page === "gifts") main.append(createGiftsPage());
  else if (state.route.page === "lost-items") main.append(createLostItemsPage());
  else if (state.route.page === "conversations") main.append(createConversationsPage());
  else main.append(createHomePage());

  shell.append(main);
  return shell;
}

function createHeader() {
  const header = el("header", { className: "topbar" });
  const nav = createNav();
  header.append(nav);
  return header;
}

function createNav() {
  const nav = el("nav", { className: "nav", "aria-label": "Main navigation" });
  [
    ["Home", "/"],
    ["Characters", "/characters"],
    ["Gifts", "/gifts"],
    ["Lost Items", "/lost-items"],
    ["Conversations", "/conversations"],
  ].forEach(([label, path]) => {
    nav.append(
      el("button", {
        className: `nav-link ${isActivePath(path) ? "active" : ""}`,
        textContent: label,
        onclick: () => navigate(path),
      }),
    );
  });
  return nav;
}

function isActivePath(path) {
  const page = path.replace("/", "") || "home";
  return state.route.page === page;
}

function createHomePage() {
  const section = el("section", { className: "home page-stack" });
  section.append(
    el("div", { className: "intro" }, [
      el("img", {
        className: "site-banner",
        src: "./src/assets/three-houses-quick-guide-banner.png",
        alt: "Fire Emblem Three Houses Quick Guide",
        loading: "eager",
      }),
    ]),
  );

  section.append(createPrimarySearch());
  section.append(createGlobalResults());
  section.append(createQuickTiles());
  return section;
}

function createPrimarySearch() {
  return el("div", { className: "primary-search" }, [
    createSearchBox({
      value: state.query,
      placeholder: "Search character, item, question, or dialogue...",
      onInput: (value) => {
        state.query = value;
        updateSearchSurfaces();
      },
      global: true,
    }),
  ]);
}

function createSearchBox({ value, placeholder, onInput, global = false }) {
  const wrap = el("label", { className: "search-wrap" });
  wrap.append(el("span", { className: "sr-only", textContent: placeholder }));
  const input = el("input", {
    className: "search-input",
    type: "search",
    value,
    placeholder,
    autocomplete: "off",
    "data-global-search": global ? "true" : null,
    oninput: (event) => onInput(event.target.value, event),
  });
  const clear = el("button", {
    className: "clear-search",
    type: "button",
    textContent: "x",
    "aria-label": "Clear search",
    onclick: () => {
      input.value = "";
      onInput("", { target: { selectionStart: 0, selectionEnd: 0 } });
      input.focus();
    },
  });
  wrap.append(input, clear);
  return wrap;
}

function updateSearchSurfaces() {
  document.querySelector(".site-shell")?.classList.toggle("search-active", Boolean(state.query.trim()));
  renderResultsInPlace();
  renderBrowseInPlace();
}

function renderResultsInPlace() {
  const target = document.querySelector("[data-results]");
  if (!target) {
    return;
  }
  target.replaceWith(createGlobalResults());
}

function renderBrowseInPlace() {
  const target = document.querySelector("[data-browse-kind]");
  if (!target) return;

  if (target.dataset.browseKind === "gifts") target.replaceWith(createGiftBrowse());
  else if (target.dataset.browseKind === "lost-items") target.replaceWith(createLostItemBrowse());
  else if (target.dataset.browseKind === "characters") target.replaceWith(createCharacterBrowse());
  else if (target.dataset.browseKind === "conversations") target.replaceWith(createConversationBrowse());
}

function createGlobalResults() {
  const results = searchAll(state.query, characters, indexes, questionAnswers);
  const wrapper = el("section", { className: "results", "data-results": "true" });

  if (!state.query.trim()) {
    return wrapper;
  }

  const groups = resultGroupsForCurrentRoute(results);

  let renderedAny = false;
  for (const [title, items, renderer] of groups) {
    if (!items.length) continue;
    renderedAny = true;
    wrapper.append(el("h2", { className: "result-heading", textContent: title }));
    const list = el("div", { className: "result-list" });
    items.forEach((item) => list.append(renderer(item)));
    wrapper.append(list);
  }

  if (!renderedAny) {
    wrapper.append(
      el("div", { className: "empty-state" }, [
        el("strong", { textContent: "No verified match." }),
        el("span", {
          textContent:
            "No supplied-source entry matches that text yet.",
        }),
      ]),
    );
  }

  return wrapper;
}

function resultGroupsForCurrentRoute(results) {
  const page = state.route.page;

  if (page === "characters" || page === "character") {
    return [[
      "Characters",
      results.characters.filter((result) =>
        state.characterFilter === "All" || displayHouse(result.character) === state.characterFilter,
      ),
      renderCharacterResult,
    ]];
  }

  if (page === "gifts") {
    return [["Gifts", results.gifts, renderGiftResult]];
  }

  if (page === "lost-items") {
    return [["Lost Items", results.lostItems, renderLostItemResult]];
  }

  if (page === "conversations") {
    return [
      ["Conversation", results.conversations, renderConversationResult],
      ["Questions", results.questionAnswers, renderQuestionAnswerResult],
      ["Tea", results.teas, renderTeaResult],
    ];
  }

  return [
    ["Characters", results.characters, renderCharacterResult],
    ["Conversation", results.conversations, renderConversationResult],
    ["Questions", results.questionAnswers, renderQuestionAnswerResult],
    ["Lost Items", results.lostItems, renderLostItemResult],
    ["Gifts", results.gifts, renderGiftResult],
    ["Tea", results.teas, renderTeaResult],
  ];
}

function createQuickTiles() {
  return el("div", { className: "quick-tiles" }, [
    quickTile("Characters", "/characters"),
    quickTile("Gifts", "/gifts"),
    quickTile("Lost Items", "/lost-items"),
    quickTile("Conversations", "/conversations"),
  ]);
}

function quickTile(title, path) {
  return el("button", { className: "quick-tile", onclick: () => navigate(path) }, [
    el("strong", { textContent: title }),
  ]);
}

function createCharactersPage() {
  const page = el("section", { className: "page-stack" });
  page.append(createImagePageBanner(
    "./src/assets/characters-banner.png",
    "Characters - Alphabetical, with recruitment details from the screenshot.",
  ));
  page.append(createPrimarySearch(), createHouseFilter(), createGlobalResults());
  page.append(createCharacterBrowse());
  return page;
}

function createCharacterBrowse() {
  if (state.query.trim()) return el("div", { className: "browse-block", "data-browse-kind": "characters" });

  const filtered = characters.filter(
    (character) =>
      (state.characterFilter === "All" || displayHouse(character) === state.characterFilter) &&
      characterMatchesQuery(character, state.query),
  );
  const browse = el("div", { className: "browse-block", "data-browse-kind": "characters" });
  const grid = el("div", { className: "character-grid" });
  filtered.forEach((character) => grid.append(createCharacterCard(character)));
  if (filtered.length) browse.append(grid);
  else {
    browse.append(
      el("div", { className: "empty-state" }, [
        el("strong", { textContent: "No matching characters." }),
        el("span", { textContent: "No character record contains that exact text." }),
      ]),
    );
  }
  return browse;
}

function characterMatchesQuery(character, query) {
  if (!query.trim()) return true;
  return normalizeText(characterSearchText(character)).includes(normalizeText(query));
}

function characterSearchText(character) {
  return [
    character.name,
    character.house,
    character.pdfHouse,
    character.recruitment.class,
    character.recruitment.availableFrom,
    character.recruitment.requirement,
    character.recruitment.notes,
    character.gifts.join(" "),
    character.lostItems.join(" "),
    textValues(character.teas).join(" "),
    aliases(character.teas).join(" "),
    textValues(character.topics).join(" "),
    aliases(character.topics).join(" "),
    character.finalResponses.map((entry) => `${entry.prompt} ${entry.answers.join(" ")}`).join(" "),
  ].join(" ");
}

function createHouseFilter() {
  const houses = ["All", "Black Eagles", "Blue Lions", "Golden Deer", "Church / Misc"];
  const controls = el("div", { className: "segmented", role: "group", "aria-label": "Filter by house" });
  houses.forEach((house) => {
    controls.append(
      el("button", {
        className: state.characterFilter === house ? "selected" : "",
        textContent: house,
        onclick: (event) => {
          state.characterFilter = house;
          if (state.query.trim()) {
            event.currentTarget.closest(".segmented")?.replaceWith(createHouseFilter());
            document.querySelector("[data-results]")?.replaceWith(createGlobalResults());
            document.querySelector("[data-global-search]")?.focus({ preventScroll: true });
          } else {
            render();
          }
        },
      }),
    );
  });
  return controls;
}

function createCharacterCard(character) {
  const goToCharacter = () => navigate(`/character/${encodeURIComponent(character.name)}`);
  const card = el("article", {
    className: `card character-card clickable-card house-${slug(character.house)}`,
    role: "link",
    tabindex: "0",
    "aria-label": `Open ${character.name}`,
    onclick: goToCharacter,
    onkeydown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToCharacter();
      }
    },
  });
  card.append(
    createPortrait(character, "small"),
    el("div", { className: "character-card-body" }, [
      el("span", {
        className: "card-link-title",
        textContent: character.name,
      }),
      el("div", { className: "meta-line", textContent: displayHouse(character) }),
      el("div", { className: "mini-label", textContent: "Recruitment" }),
      el("p", { className: "requirement" }, createRequirementDisplay(character.recruitment.requirement)),
      createInlineLinks(character),
    ]),
  );
  return card;
}

function createInlineLinks(character) {
  return el("div", { className: "inline-links" }, [
    el("button", { textContent: "Gifts", onclick: (event) => openCharacterSection(event, character) }),
    el("button", { textContent: "Lost Items", onclick: (event) => openCharacterSection(event, character) }),
    el("button", { textContent: "Tea", onclick: (event) => openCharacterSection(event, character) }),
  ]);
}

function openCharacterSection(event, character) {
  event.stopPropagation();
  navigate(`/character/${encodeURIComponent(character.name)}`);
}

function createCharacterDetail(name) {
  const character = characters.find((entry) => entry.name === name);
  if (!character) return createNotFound();

  const page = el("section", { className: "page-stack detail-page" });
  page.append(
    el("button", { className: "back-link", textContent: "Back to characters", onclick: () => navigate("/characters") }),
    el("header", { className: `character-header house-${slug(character.house)}` }, [
      createPortrait(character, "large"),
      el("div", { className: "character-title-block" }, [
        el("p", { className: "mini-label", textContent: displayHouse(character) }),
        el("h1", { textContent: character.name }),
      ]),
      el("span", { className: "class-pill", textContent: character.recruitment.class }),
    ]),
    createPrimarySearch(),
    createGlobalResults(),
  );

  const primary = el("div", { className: "detail-column detail-primary" }, [
    createSection("Overview", [
      kv("Name", character.name),
      kv("House / affiliation", displayHouse(character)),
      character.pdfHouse ? kv("PDF house label", character.pdfHouse) : null,
      kv("Class", character.recruitment.class),
      kv("Available", character.recruitment.availableFrom),
      kv("Requirement", createRequirementDisplay(character.recruitment.requirement)),
      kv(
        "Favorite tea",
        character.teas.length
          ? el("span", { className: "stacked-values" }, textValues(character.teas).map((tea) => el("span", { textContent: tea })))
          : "Review needed: tea PDF chunk not supplied",
      ),
    ].filter(Boolean)),
    createRecruitmentInfo(character),
    createListSection("Gifts", character.gifts, "No verified gift data listed for this character.", "gifts", (gift) =>
      navigate(`/gifts?q=${encodeURIComponent(gift)}`),
    ),
    createListSection("Lost Items", character.lostItems, character.lostItemsNote || "No verified lost-item data yet.", "lost", (item) =>
      navigate(`/lost-items?q=${encodeURIComponent(item)}`),
    ),
  ]);

  const secondary = el("div", { className: "detail-column detail-secondary" }, [
    createTeaInfo(character),
  ]);

  page.append(el("div", { className: "detail-grid" }, [primary, secondary]));
  return page;
}

function createRecruitmentInfo(character) {
  return createSection("Recruitment", [
    kv("Available", character.recruitment.availableFrom),
    kv("Requirement", createRequirementDisplay(character.recruitment.requirement)),
    character.recruitment.notes ? kv("Notes", character.recruitment.notes) : null,
  ].filter(Boolean));
}

function createTeaInfo(character) {
  const body = [
    el("h3", { textContent: "Favorite Tea" }),
    listOrMissing(character.teas, "No verified favorite tea data yet. Tea PDF chunk not supplied."),
    el("h3", { textContent: "Conversation Topics" }),
    listOrMissing(character.topics, "No verified topic data yet. Conversation PDF chunk not supplied."),
    el("h3", { textContent: "Final Conversation Responses" }),
  ];

  if (character.finalResponses.length) {
    const prompts = el("div", { className: "prompt-list" });
    character.finalResponses.forEach((entry) => {
      prompts.append(renderPrompt(entry.prompt, entry.answers));
    });
    body.push(prompts);
  } else {
    body.push(el("p", { className: "missing-note", textContent: "No verified final-response data yet. Conversation PDF chunk not supplied." }));
  }

  return createSection("Tea Party", body, "tea");
}

function createGiftsPage() {
  const queryFromHash = new URLSearchParams(window.location.hash.split("?")[1] || "").get("q");
  if (queryFromHash && !state.query) state.query = queryFromHash;

  const page = el("section", { className: "page-stack" });
  page.append(createImagePageBanner(
    "./src/assets/gifts-banner.png",
    "Gifts",
  ));
  page.append(createPrimarySearch(), createGlobalResults());
  page.append(createIndexNotice("gifts"));
  page.append(createGiftBrowse());
  return page;
}

function createGiftBrowse() {
  if (state.query.trim()) return el("div", { className: "browse-block", "data-browse-kind": "gifts" });

  const entries = filterByQuery(indexes.gifts, state.query, "name");
  const filtered = filterByLetter(entries, state.alphabetFilters.gifts, "name");
  const browse = el("div", { className: "browse-block", "data-browse-kind": "gifts" });
  browse.append(createAZNav(
    entries.map((entry) => entry.name),
    state.alphabetFilters.gifts,
    (letter) => {
      state.alphabetFilters.gifts = letter;
      renderBrowseInPlace();
    },
  ));
  const list = el("div", { className: "result-list browse-list" });
  appendAlphabetizedResults(
    list,
    filtered,
    (entry) => entry.name,
    (entry) => renderGiftResult({ ...entry, gift: entry.name }),
  );
  browse.append(list);
  return browse;
}

function createLostItemsPage() {
  const queryFromHash = new URLSearchParams(window.location.hash.split("?")[1] || "").get("q");
  if (queryFromHash && !state.query) state.query = queryFromHash;

  const page = el("section", { className: "page-stack" });
  page.append(createImagePageBanner(
    "./src/assets/lost-items-banner.png",
    "Lost Items",
  ));
  page.append(createPrimarySearch(), createGlobalResults());
  page.append(createIndexNotice("lost items"));
  page.append(createLostItemBrowse());
  return page;
}

function createLostItemBrowse() {
  if (state.query.trim()) return el("div", { className: "browse-block", "data-browse-kind": "lost-items" });

  const entries = filterByQuery(indexes.lostItems, state.query, "item");
  const filtered = filterByLetter(entries, state.alphabetFilters.lostItems, "item");
  const browse = el("div", { className: "browse-block", "data-browse-kind": "lost-items" });
  browse.append(createAZNav(
    entries.map((entry) => entry.item),
    state.alphabetFilters.lostItems,
    (letter) => {
      state.alphabetFilters.lostItems = letter;
      renderBrowseInPlace();
    },
  ));
  const list = el("div", { className: "result-list browse-list" });
  appendAlphabetizedResults(
    list,
    filtered,
    (entry) => entry.item,
    (entry) => renderLostItemResult({ ...entry, owner: entry.owner }),
  );
  browse.append(list);
  return browse;
}

function createConversationsPage() {
  if (state.route.param) return createConversationDetail(state.route.param);

  const page = el("section", { className: "page-stack" });
  page.append(createImagePageBanner(
    "./src/assets/conversations-banner.png",
    "Conversations",
  ));
  page.append(createPrimarySearch(), createGlobalResults());
  page.append(createConversationBrowse());
  return page;
}

function createConversationBrowse() {
  if (state.query.trim()) return el("div", { className: "browse-block", "data-browse-kind": "conversations" });

  const grid = el("div", { className: "character-grid", "data-browse-kind": "conversations" });
  characters.forEach((character) => {
    grid.append(
      el("article", {
        className: `card conversation-card clickable-card house-${slug(character.house)}`,
        role: "link",
        tabindex: "0",
        "aria-label": `Open ${character.name}`,
        onclick: () => navigate(`/conversations/${encodeURIComponent(character.name)}`),
        onkeydown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate(`/conversations/${encodeURIComponent(character.name)}`);
          }
        },
      }, [
        createPortrait(character, "small"),
        el("div", { className: "conversation-card-body" }, [
          el("span", { className: "card-link-title", textContent: character.name }),
          el("span", { className: "meta-line", textContent: displayHouse(character) }),
          character.finalResponses.length
            ? null
            : el("p", {
              className: "missing-note",
              textContent: "Review needed: conversation PDF chunk not supplied",
            }),
        ]),
      ]),
    );
  });
  return grid;
}

function createConversationDetail(name) {
  const character = characters.find((entry) => entry.name === name);
  if (!character) return createConversationNotFound();

  const page = el("section", { className: "page-stack conversation-detail-page" });
  page.append(
    createConversationHeader(character),
    createPrimarySearch(),
    createGlobalResults(),
    el("button", { className: "back-link", textContent: "Back to conversations", onclick: () => navigate("/conversations") }),
    createTeaInfo(character),
  );
  return page;
}

function createConversationHeader(character) {
  return el("header", { className: `conversation-character-header house-${slug(character.house)}` }, [
    createHappyPortrait(character, "large"),
    el("div", { className: "character-title-block" }, [
      el("h1", { textContent: `${character.name} Conversations` }),
      el("p", { className: "meta-line", textContent: displayHouse(character) }),
    ]),
  ]);
}

function createIndexNotice(label) {
  if (label === "gifts" && indexes.gifts.length) return document.createDocumentFragment();
  if (label === "lost items" && indexes.lostItems.length) return document.createDocumentFragment();
  return el("div", { className: "empty-state compact" }, [
    el("strong", { textContent: `No verified ${label} loaded yet.` }),
    el("span", { textContent: "This index will populate automatically from the character data after PDF extraction." }),
  ]);
}

function createAZNav(names, activeLetter, onSelect) {
  const letters = Array.from(new Set(names.map((name) => name[0]?.toUpperCase()).filter(Boolean)));
  if (!letters.length) return document.createDocumentFragment();
  return el("div", { className: "az-nav", "aria-label": "Alphabet filter" }, ["All", ...letters].map((letter) =>
    el("button", {
      className: letter === activeLetter ? "active" : "",
      type: "button",
      textContent: letter,
      "aria-pressed": letter === activeLetter ? "true" : "false",
      onclick: () => onSelect(letter),
    }),
  ));
}

function appendAlphabetizedResults(list, entries, getName, renderEntry) {
  const seenLetters = new Set();
  entries.forEach((entry) => {
    const card = renderEntry(entry);
    const letter = getName(entry)[0]?.toUpperCase();
    if (letter && !seenLetters.has(letter)) {
      card.id = `letter-${letter}`;
      seenLetters.add(letter);
    }
    list.append(card);
  });
}

function filterByLetter(entries, letter, field) {
  if (!letter || letter === "All") return entries;
  return entries.filter((entry) => entry[field][0]?.toUpperCase() === letter);
}

function filterByQuery(entries, query, field) {
  if (!query.trim()) return entries;
  const normalizedQuery = normalizeText(query);
  return entries.filter((entry) => normalizeText(entry[field]).includes(normalizedQuery));
}

function renderConversationResult(result) {
  const children = [
    el("div", { className: "result-identity" }, [
      el("button", {
        className: "result-title",
        onclick: () => navigate(`/conversations/${encodeURIComponent(result.character.name)}`),
      }, highlightMatches(result.character.name)),
      el("span", { className: "meta-line", textContent: displayHouse(result.character) }),
    ]),
    quotedText(result.prompt),
    el("div", { className: "answer-row answer-row-primary" }, result.answers.map((answer) => el("strong", { textContent: answer }))),
  ];
  if (result.status === "review-needed") {
    children.push(el("p", { className: "missing-note", textContent: `Review needed: ${result.reason}` }));
  }
  return el("article", {
    className: `result-card conversation-result house-${slug(result.character.house)}`,
  }, children);
}

function renderQuestionAnswerResult(result) {
  return el("article", { className: "result-card question-result" }, [
    el("div", { className: "answer-row qa-answer" }, [
      el("strong", { textContent: result.answer }),
    ]),
    el("span", { className: "mini-label", textContent: result.timing }),
    quotedText(result.question),
  ]);
}

function renderLostItemResult(result) {
  return el("article", { className: "result-card lost-result" }, [
    el("button", {
      className: "answer-name",
      onclick: () => navigate(`/character/${encodeURIComponent(result.owner.name)}`),
    }, highlightMatches(result.owner.name)),
    el("strong", { className: "item-name" }, highlightMatches(result.item)),
    el("span", { className: "meta-line", textContent: displayHouse(result.owner) }),
  ]);
}

function renderGiftResult(result) {
  const giftName = result.gift || result.name;
  return el("article", { className: `result-card gift-result gift-${slug(giftName)}` }, [
    el("strong", { className: "item-name" }, highlightMatches(giftName)),
    el("div", { className: "chip-row" }, renderGiftChips(giftName, result.characters)),
  ]);
}

function renderGiftChips(giftName, giftCharacters) {
  const breakBefore = new Set(GIFT_CHIP_ROW_BREAKS[giftName] || []);
  return giftCharacters.flatMap((character) => {
    const chip = el("button", {
      className: "name-chip",
      onclick: () => navigate(`/character/${encodeURIComponent(character.name)}`),
    }, highlightMatches(character.name));

    if (!breakBefore.has(character.name)) return [chip];
    return [el("span", { className: "chip-break", "aria-hidden": "true" }), chip];
  });
}

function renderCharacterResult(result) {
  const character = result.character;
  const openCharacter = () => navigate(`/character/${encodeURIComponent(character.name)}`);
  return el("article", {
    className: `result-card character-result clickable-card house-${slug(character.house)}`,
    role: "link",
    tabindex: "0",
    "aria-label": `Open ${character.name}`,
    onclick: openCharacter,
    onkeydown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCharacter();
      }
    },
  }, [
    createPortrait(character, "tiny"),
    el("div", { className: "character-result-body" }, [
      el("strong", { className: "answer-name" }, highlightMatches(character.name)),
      el("span", { className: "meta-line", textContent: displayHouse(character) }),
      el("p", { className: "requirement" }, [
        el("span", { className: "requirement-prefix", textContent: "Recruitment" }),
        createRequirementDisplay(character.recruitment.requirement),
      ]),
    ]),
  ]);
}

function renderTeaResult(result) {
  return el("article", { className: "result-card" }, [
    el("strong", { className: "item-name" }, highlightMatches(result.tea)),
    el("span", { className: "mini-label", textContent: "Favorite for" }),
    el("div", { className: "chip-row" }, result.characters.map((character) =>
      el("button", {
        className: "name-chip",
        onclick: () => navigate(`/character/${encodeURIComponent(character.name)}`),
      }, highlightMatches(character.name)),
    )),
  ]);
}

function renderPrompt(prompt, answers) {
  return el("article", { className: "prompt-card" }, [
    el("div", { className: "answer-row" }, answers.map((answer) => el("strong", { textContent: answer }))),
    el("p", { className: "quote", textContent: prompt }),
  ]);
}

function quotedText(text) {
  return el("p", { className: "quote" }, [
    document.createTextNode('"'),
    ...highlightMatches(text),
    document.createTextNode('"'),
  ]);
}

function highlightMatches(text) {
  const queryTokens = Array.from(new Set(normalizeText(state.query).split(" ").filter(Boolean)));
  if (!queryTokens.length) return [document.createTextNode(text)];

  const pattern = queryTokens
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const matcher = new RegExp(pattern, "gi");
  const nodes = [];
  let lastIndex = 0;
  for (const match of text.matchAll(matcher)) {
    if (match.index > lastIndex) nodes.push(document.createTextNode(text.slice(lastIndex, match.index)));
    nodes.push(el("strong", { className: "match-text", textContent: match[0] }));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(document.createTextNode(text.slice(lastIndex)));
  return nodes.length ? nodes : [document.createTextNode(text)];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createPortrait(character, size = "small") {
  const src = portraitByCharacter[character.name];
  if (!src) return el("span", { className: `portrait portrait-${size} portrait-missing`, "aria-hidden": "true" });
  return el("img", {
    className: `portrait portrait-${size}`,
    src,
    alt: `${character.name} portrait`,
    loading: size === "large" ? "eager" : "lazy",
  });
}

function createHappyPortrait(character, size = "small") {
  const src = happyPortraitByCharacter[character.name] || portraitByCharacter[character.name];
  if (!src) return el("span", { className: `portrait portrait-${size} portrait-missing`, "aria-hidden": "true" });
  return el("img", {
    className: `portrait portrait-${size} portrait-happy`,
    src,
    alt: `${character.name} happy portrait`,
    loading: size === "large" ? "eager" : "lazy",
  });
}

function createListSection(title, items, emptyText, id, onSelect) {
  return createSection(title, [listOrMissing(items, emptyText, onSelect)], id);
}

function listOrMissing(items, emptyText, onSelect) {
  if (!items.length) return el("p", { className: "missing-note", textContent: emptyText });
  return el("ul", { className: "plain-list" }, items.map((item) =>
    el("li", [
      onSelect
        ? el("button", { className: "text-link", textContent: textValue(item), onclick: () => onSelect(textValue(item)) })
        : document.createTextNode(textValue(item)),
    ]),
  ));
}

function createSection(title, children, id = "") {
  return el("section", { className: "info-section", id }, [
    el("h2", { textContent: title }),
    ...children,
  ]);
}

function createPageTitle(title, subtitle, options = {}) {
  if (options.hideWhenSearching && state.query.trim()) return document.createDocumentFragment();
  return el("header", { className: "page-title" }, [
    el("h1", { textContent: title }),
    el("p", { textContent: subtitle }),
  ]);
}

function createImagePageBanner(src, alt, options = {}) {
  if (options.hideWhenSearching && state.query.trim()) return document.createDocumentFragment();
  return el("div", { className: "page-art-banner" }, [
    el("img", {
      src,
      alt,
      loading: "eager",
    }),
  ]);
}

function kv(label, value) {
  return el("div", { className: "kv" }, [
    el("span", { textContent: label }),
    value instanceof Node ? el("strong", [value]) : el("strong", { textContent: value }),
  ]);
}

function createRequirementDisplay(requirement) {
  const parsed = parseRecruitmentRequirement(requirement);
  if (!parsed.length) {
    return el("span", { textContent: requirement.replace(/^Need\s+/i, "") });
  }

  return el("span", { className: "requirement-lines" }, parsed.map((entry) =>
    el("span", { className: "requirement-line" }, [
      el("span", { className: "requirement-line-label" }, highlightMatches(entry.label)),
      document.createTextNode(": "),
      el("span", { className: "requirement-line-value" }, highlightMatches(entry.value)),
    ]),
  ));
}

function parseRecruitmentRequirement(requirement) {
  const levelMatch = requirement.match(/^Need\s+to\s+be\s+Level\s+(\d+)$/i);
  if (levelMatch) {
    return [{ label: "Level", value: levelMatch[1] }];
  }

  const statSkillMatch = requirement.match(/^Need\s+(\d+)\s+(.+?)\s+and\s+([A-E][+]?)\s+in\s+(.+)$/i);
  if (statSkillMatch) {
    return [
      { label: statSkillMatch[2], value: statSkillMatch[1] },
      { label: statSkillMatch[4], value: statSkillMatch[3] },
    ];
  }

  return [];
}

function createNotFound() {
  return el("section", { className: "empty-state" }, [
    el("strong", { textContent: "Character not found." }),
    el("button", { className: "nav-link", textContent: "Back to characters", onclick: () => navigate("/characters") }),
  ]);
}

function createConversationNotFound() {
  return el("section", { className: "empty-state" }, [
    el("strong", { textContent: "Conversation character not found." }),
    el("button", { className: "nav-link", textContent: "Back to conversations", onclick: () => navigate("/conversations") }),
  ]);
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function textValue(value) {
  return typeof value === "string" ? value : value.text;
}

function textValues(values) {
  return values.map(textValue);
}

function aliases(values) {
  return values.flatMap((value) => (typeof value === "string" ? [] : value.searchAliases || []));
}

function displayHouse(character) {
  if (character.house === "Church of Seiros" || character.house === "Misc" || character.pdfHouse === "Misc") {
    return "Church / Misc";
  }
  return character.house;
}

function el(tag, attrs = {}, children = []) {
  if (Array.isArray(attrs) || attrs instanceof Node || typeof attrs === "string") {
    children = attrs;
    attrs = {};
  }

  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (key === "className") node.className = value;
    else if (key === "textContent") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  });

  const childArray = Array.isArray(children) ? children : [children];
  childArray.forEach((child) => {
    if (child === null || child === undefined) return;
    if (typeof child === "string") node.append(document.createTextNode(child));
    else node.append(child);
  });
  return node;
}
