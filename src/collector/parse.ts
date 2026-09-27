import { load, type CheerioAPI } from "cheerio";

const HEADING_SELECTOR = "h2, h3, h4";
const SECTION_BOUNDARY_SELECTOR = "h1, h2, h3, h4, h5, h6";

export interface EstimatedRequestsTable {
  modelIndex: number;
  fiveHourIndex: number;
  weeklyIndex: number;
  monthlyIndex: number;
  rows: string[][];
}

export interface EndpointEntry {
  name: string;
  id: string;
}

function canonicalText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findHeading($: CheerioAPI, headingText: string) {
  return $(HEADING_SELECTOR)
    .filter((_index, element) => canonicalText($(element).text()) === headingText)
    .first();
}

type SectionHeading = ReturnType<typeof findHeading>;

function findSectionTable($: CheerioAPI, heading: SectionHeading) {
  const siblings = heading.nextUntil(SECTION_BOUNDARY_SELECTOR);

  const direct = siblings.filter("table").first();
  if (direct.length > 0) {
    return direct;
  }

  const nested = siblings.find("table").first();
  return nested.length > 0 ? nested : null;
}

type SectionTable = NonNullable<ReturnType<typeof findSectionTable>>;

function readHeaderCells($: CheerioAPI, table: SectionTable, section: string): string[] {
  const rows = table.find("tr").toArray();
  const headerRow = rows.find((row) => $(row).find("th").length > 0);

  if (!headerRow) {
    throw new Error(`${section} header row not found`);
  }

  return $(headerRow)
    .children("th")
    .toArray()
    .map((cell) => $(cell).text());
}

function readDataRows($: CheerioAPI, table: SectionTable): string[][] {
  const rows = table.find("tr").toArray();
  const headerRow = rows.find((row) => $(row).find("th").length > 0);

  return rows
    .filter((row) => row !== headerRow)
    .map((row) =>
      $(row)
        .children("td, th")
        .toArray()
        .map((cell) => $(cell).text()),
    );
}

export function parseEstimatedRequests(html: string): EstimatedRequestsTable {
  const $ = load(html);

  const heading = findHeading($, "estimated requests");
  if (heading.length === 0) {
    throw new Error("Estimated requests section not found");
  }

  const table = findSectionTable($, heading);
  if (!table) {
    throw new Error("Estimated requests table not found");
  }

  const headerCells = readHeaderCells($, table, "Estimated requests");
  const indexes = { model: -1, fiveHour: -1, weekly: -1, monthly: -1 };

  headerCells.forEach((cell, index) => {
    const key = canonicalText(cell);
    if (indexes.model < 0 && key.includes("model")) {
      indexes.model = index;
    } else if (indexes.fiveHour < 0 && (key.includes("5 hour") || key.includes("five hour"))) {
      indexes.fiveHour = index;
    } else if (indexes.weekly < 0 && key.includes("week")) {
      indexes.weekly = index;
    } else if (indexes.monthly < 0 && key.includes("month")) {
      indexes.monthly = index;
    }
  });

  if (indexes.model < 0) {
    throw new Error("Estimated requests is missing the Model header");
  }
  if (indexes.fiveHour < 0) {
    throw new Error("Estimated requests is missing the 5 hour header");
  }
  if (indexes.weekly < 0) {
    throw new Error("Estimated requests is missing the weekly header");
  }
  if (indexes.monthly < 0) {
    throw new Error("Estimated requests is missing the monthly header");
  }

  const rows = readDataRows($, table);
  if (rows.length === 0) {
    throw new Error("Estimated requests table has no data rows");
  }
  for (const row of rows) {
    if (row.length !== headerCells.length) {
      throw new Error("Estimated requests row has a mismatched number of cells");
    }
  }

  return {
    modelIndex: indexes.model,
    fiveHourIndex: indexes.fiveHour,
    weeklyIndex: indexes.weekly,
    monthlyIndex: indexes.monthly,
    rows,
  };
}

export function parseEndpoints(html: string): EndpointEntry[] {
  const $ = load(html);

  const heading = findHeading($, "endpoints");
  if (heading.length === 0) {
    throw new Error("Endpoints section not found");
  }

  const table = findSectionTable($, heading);
  if (!table) {
    throw new Error("Endpoints table not found");
  }

  const headerCells = readHeaderCells($, table, "Endpoints");
  let nameIndex = -1;
  let idIndex = -1;

  headerCells.forEach((cell, index) => {
    const key = canonicalText(cell);
    if (idIndex < 0 && key.includes("model id")) {
      idIndex = index;
    } else if (nameIndex < 0 && key.includes("model")) {
      nameIndex = index;
    }
  });

  if (nameIndex < 0) {
    throw new Error("Endpoints is missing the Model header");
  }
  if (idIndex < 0) {
    throw new Error("Endpoints is missing the Model ID header");
  }

  const rows = readDataRows($, table);
  if (rows.length === 0) {
    throw new Error("Endpoints table has no data rows");
  }

  const entries: EndpointEntry[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();

  for (const row of rows) {
    if (row.length !== headerCells.length) {
      throw new Error("Endpoints row has a mismatched number of cells");
    }

    const name = row[nameIndex] ?? "";
    const id = row[idIndex] ?? "";

    if (name.length === 0) {
      throw new Error("Endpoints row is missing a model name");
    }
    if (id.length === 0) {
      throw new Error("Endpoints row is missing a model id");
    }
    if (seenNames.has(name)) {
      throw new Error(`Duplicate model name "${name}" in Endpoints`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate model id "${id}" in Endpoints`);
    }

    seenNames.add(name);
    seenIds.add(id);
    entries.push({ name, id });
  }

  return entries;
}
