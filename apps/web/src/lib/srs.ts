import type { Roadmap, SrsItem } from "@/types";

function toSrsId(roadmapId: string, sectionId: string, index: number) {
    return `${roadmapId}:${sectionId}:${index}`;
}

export function seedSrsItems(roadmap: Roadmap): SrsItem[] {
    const dueAt = new Date().toISOString();
    const items: SrsItem[] = [];

    for (const section of roadmap.sections) {
        if (section.type === "glossary") {
            for (const term of section.data) {
                items.push({
                    id: `${roadmap.id}:glossary:${term.id}`,
                    roadmapId: roadmap.id,
                    sectionId: section.id,
                    prompt: term.term,
                    answer: term.definition,
                    easeFactor: 2.5,
                    intervalDays: 0,
                    repetitions: 0,
                    dueAt,
                });
            }
        }

        if (section.type === "module") {
            section.data.tasks.forEach((task, index) => {
                const answer = task.description || task.text || task.notes;
                if (!answer) return;
                items.push({
                    id: toSrsId(roadmap.id, section.id, index),
                    roadmapId: roadmap.id,
                    sectionId: section.id,
                    prompt: task.title,
                    answer,
                    easeFactor: 2.5,
                    intervalDays: 0,
                    repetitions: 0,
                    dueAt,
                });
            });
        }
    }

    return items;
}
