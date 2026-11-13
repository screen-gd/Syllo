import type { GlossarySection, GlossaryTerm, Roadmap } from "@/types";

export interface GlossaryEntry {
    term: GlossaryTerm;
    roadmapId: string;
    roadmapTitle: string;
}

/** Review cards made from a term share this id, so a term makes one card. */
export function glossaryReviewId(roadmapId: string, termId: string) {
    return `${roadmapId}:glossary:${termId}`;
}

/** Every term across the given roadmaps, sorted A to Z. */
export function collectGlossary(roadmaps: readonly Roadmap[]): GlossaryEntry[] {
    return roadmaps
        .flatMap((roadmap) =>
            roadmap.sections.flatMap((section) =>
                section.type === "glossary"
                    ? section.data.map((term) => ({
                          term,
                          roadmapId: roadmap.id,
                          roadmapTitle: roadmap.title,
                      }))
                    : [],
            ),
        )
        .sort((a, b) =>
            a.term.term.localeCompare(b.term.term, undefined, {
                sensitivity: "base",
            }),
        );
}

/** Case-insensitive match over the term and its definition. */
export function matchesTerm(entry: GlossaryEntry, query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        entry.term.term.toLowerCase().includes(needle) ||
        entry.term.definition.toLowerCase().includes(needle)
    );
}

/**
 * A copy of the roadmap with the term added or, when `id` matches an existing
 * term, replaced. A roadmap with no glossary yet gets one at the end.
 */
export function upsertGlossaryTerm(
    roadmap: Roadmap,
    input: { id?: string; term: string; definition: string },
): Roadmap {
    const next: GlossaryTerm = {
        id: input.id ?? crypto.randomUUID(),
        term: input.term.trim(),
        definition: input.definition.trim(),
    };
    const owner = roadmap.sections.find(
        (section): section is GlossarySection =>
            section.type === "glossary" &&
            section.data.some((term) => term.id === next.id),
    );
    const target =
        owner ?? roadmap.sections.find((section) => section.type === "glossary");
    const sections = target
        ? roadmap.sections.map((section) =>
              section.type === "glossary" && section.id === target.id
                  ? {
                        ...section,
                        data: owner
                            ? section.data.map((term) =>
                                  term.id === next.id
                                      ? { ...term, ...next }
                                      : term,
                              )
                            : [...section.data, next],
                    }
                  : section,
          )
        : [
              ...roadmap.sections,
              {
                  id: crypto.randomUUID(),
                  type: "glossary" as const,
                  title: "Glossary",
                  order:
                      Math.max(
                          -1,
                          ...roadmap.sections.map((section) => section.order),
                      ) + 1,
                  data: [next],
              },
          ];
    return { ...roadmap, sections, updatedAt: new Date().toISOString() };
}

/** A copy of the roadmap without the term. */
export function removeGlossaryTerm(roadmap: Roadmap, termId: string): Roadmap {
    return {
        ...roadmap,
        sections: roadmap.sections.map((section) =>
            section.type === "glossary"
                ? {
                      ...section,
                      data: section.data.filter((term) => term.id !== termId),
                  }
                : section,
        ),
        updatedAt: new Date().toISOString(),
    };
}
