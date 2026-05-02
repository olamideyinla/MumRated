import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi, toSlug } from "@/lib/admin";

/** Minimal CSV parser (no external deps). Handles quoted fields with commas. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const adminResult = await requireAdminApi();
  if (adminResult instanceof Response) return adminResult;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const text = await (file as File).text();
  const allRows = parseCSV(text);

  if (allRows.length < 2) {
    return NextResponse.json(
      { error: "File is empty or has no data rows." },
      { status: 400 },
    );
  }

  // Expected columns: name,type,category_slug,description,brandOrProvider,locationText,priceRangeNGN,priceRangeMin,priceRangeMax
  const header = allRows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const COL = {
    name: header.indexOf("name"),
    type: header.indexOf("type"),
    category_slug: header.indexOf("category_slug"),
    description: header.indexOf("description"),
    brandOrProvider: header.indexOf("brandorprovider"),
    locationText: header.indexOf("locationtext"),
    priceRangeNGN: header.indexOf("pricerangengn"),
    priceRangeMin: header.indexOf("pricerangemin"),
    priceRangeMax: header.indexOf("pricerangemax"),
  };

  if (COL.name === -1 || COL.type === -1 || COL.category_slug === -1) {
    return NextResponse.json(
      { error: "Missing required columns: name, type, category_slug" },
      { status: 400 },
    );
  }

  // Pre-load all categories by slug
  const allCats = await db.category.findMany({
    select: { id: true, slug: true },
  });
  const catMap = new Map(allCats.map((c) => [c.slug, c.id]));

  const dataRows = allRows.slice(1);
  const rowErrors: { row: number; error: string }[] = [];
  const toInsert: {
    name: string;
    slug: string;
    type: "PRODUCT" | "SERVICE";
    categoryId: string;
    description: string | null;
    brandOrProvider: string | null;
    locationText: string | null;
    priceRangeNGN: string | null;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    createdById: string;
  }[] = [];

  // Track slugs within this import to avoid duplicates
  const usedSlugs = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    const name = COL.name >= 0 ? (row[COL.name] ?? "").trim() : "";
    const typeRaw = COL.type >= 0 ? (row[COL.type] ?? "").trim().toUpperCase() : "";
    const catSlug = COL.category_slug >= 0 ? (row[COL.category_slug] ?? "").trim() : "";

    if (!name) {
      rowErrors.push({ row: rowNum, error: "Missing name" });
      continue;
    }
    if (typeRaw !== "PRODUCT" && typeRaw !== "SERVICE") {
      rowErrors.push({ row: rowNum, error: `Invalid type "${typeRaw}" (must be PRODUCT or SERVICE)` });
      continue;
    }
    const categoryId = catMap.get(catSlug);
    if (!categoryId) {
      rowErrors.push({ row: rowNum, error: `Unknown category_slug "${catSlug}"` });
      continue;
    }

    // Generate unique slug within this import batch
    const baseSlug = toSlug(name);
    let candidate = baseSlug;
    let n = 1;
    while (usedSlugs.has(candidate)) {
      candidate = `${baseSlug}-${n++}`;
    }
    usedSlugs.add(candidate);

    const parseNum = (idx: number) => {
      if (idx < 0 || !row[idx]) return null;
      const v = parseInt(row[idx], 10);
      return isNaN(v) ? null : v;
    };
    const str = (idx: number) =>
      idx >= 0 && row[idx]?.trim() ? row[idx].trim() : null;

    toInsert.push({
      name,
      slug: candidate,
      type: typeRaw as "PRODUCT" | "SERVICE",
      categoryId,
      description: str(COL.description),
      brandOrProvider: str(COL.brandOrProvider),
      locationText: str(COL.locationText),
      priceRangeNGN: str(COL.priceRangeNGN),
      priceRangeMin: parseNum(COL.priceRangeMin),
      priceRangeMax: parseNum(COL.priceRangeMax),
      createdById: adminResult.id,
    });
  }

  let imported = 0;
  if (toInsert.length > 0) {
    const result = await db.listing.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    imported = result.count;
  }

  return NextResponse.json({ imported, errors: rowErrors });
}
