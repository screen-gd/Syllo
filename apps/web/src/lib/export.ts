import type { Roadmap } from "@/types";

function fileNameFromTitle(title: string, ext: string): string {
    return `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${ext}`;
}

function buildMarkdown(workspace: Roadmap): string {
    let md = `# ${workspace.title}\n\n`;
    if (workspace.summary) md += `${workspace.summary}\n\n`;

    workspace.sections.forEach((sec) => {
        if (sec.type !== "module" || !sec.data) return;

        md += `## ${sec.title}\n`;
        if (typeof sec.data.description === "string" && sec.data.description.trim()) {
            md += `${sec.data.description}\n\n`;
        }

        if (Array.isArray(sec.data.tasks) && sec.data.tasks.length > 0) {
            md += "### Tasks\n";
            sec.data.tasks.forEach((task) => {
                md += `- [${task.completed ? "x" : " "}] ${task.title}\n`;
                (task.subtasks || []).forEach((subtask) => {
                    md += `  - [${subtask.completed ? "x" : " "}] ${subtask.title}\n`;
                });
            });
            md += "\n";
        }

        if (Array.isArray(sec.data.resources) && sec.data.resources.length > 0) {
            md += "### Resources\n";
            sec.data.resources.forEach((resource) => {
                md += `- [${resource.title}](${resource.url})\n`;
            });
            md += "\n";
        }
    });

    return md;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function escapePdfText(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(input: string, maxCharsPerLine = 95): string[] {
    const words = input.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines: string[] = [];
    let current = words[0];

    for (let i = 1; i < words.length; i += 1) {
        const candidate = `${current} ${words[i]}`;
        if (candidate.length <= maxCharsPerLine) {
            current = candidate;
        } else {
            lines.push(current);
            current = words[i];
        }
    }

    lines.push(current);
    return lines;
}

function markdownToPdfLines(markdown: string): string[] {
    const rawLines = markdown.split("\n");
    const output: string[] = [];

    rawLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            output.push("");
            return;
        }

        const normalized = trimmed
            .replace(/^#\s+/, "")
            .replace(/^##\s+/, "")
            .replace(/^###\s+/, "")
            .replace(/^- \[[x ]\]\s+/, "- ")
            .replace(/^-\s+/, "- ");

        output.push(...wrapText(normalized));
    });

    return output;
}

function buildPdfDocument(lines: string[]): Uint8Array {
    const linesPerPage = 46;
    const pagedLines: string[][] = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
        pagedLines.push(lines.slice(i, i + linesPerPage));
    }
    if (pagedLines.length === 0) pagedLines.push([""]);

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    let objectNumber = 1;

    const addObject = (content: string) => {
        offsets.push(pdf.length);
        pdf += `${objectNumber} 0 obj\n${content}\nendobj\n`;
        objectNumber += 1;
    };

    const pageObjectNumbers: number[] = [];

    const catalogObjectNumber = objectNumber;
    addObject("<< /Type /Catalog /Pages 2 0 R >>");

    const pagesObjectNumber = objectNumber;
    addObject("<< /Type /Pages /Count 0 /Kids [] >>");

    const fontObjectNumber = objectNumber;
    addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

    pagedLines.forEach((pageLines) => {
        const pageObject = objectNumber;
        const contentObject = objectNumber + 1;
        pageObjectNumbers.push(pageObject);
        const contentLines = [
            "BT",
            "/F1 11 Tf",
            "14 TL",
            "50 790 Td",
            ...pageLines.map((line, idx) => `${idx === 0 ? "" : "T* " }(${escapePdfText(line)}) Tj`),
            "ET",
        ];
        const stream = contentLines.join("\n");

        addObject(
            `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObject} 0 R >>`,
        );
        addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    const kids = pageObjectNumbers.map((num) => `${num} 0 R`).join(" ");
    const pagesObjectReplacement = `${pagesObjectNumber} 0 obj\n<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${kids}] >>\nendobj\n`;
    const pagesObjStart = offsets[pagesObjectNumber];
    const pagesObjEnd = pdf.indexOf("endobj\n", pagesObjStart) + "endobj\n".length;
    pdf = `${pdf.slice(0, pagesObjStart)}${pagesObjectReplacement}${pdf.slice(pagesObjEnd)}`;

    // Recompute offsets after replacing pages object
    const recomputedOffsets: number[] = [0];
    let scan = 0;
    for (let i = 1; i < objectNumber; i += 1) {
        const marker = `${i} 0 obj`;
        const index = pdf.indexOf(marker, scan);
        recomputedOffsets.push(index);
        scan = index + marker.length;
    }

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objectNumber}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i < objectNumber; i += 1) {
        const offset = String(recomputedOffsets[i]).padStart(10, "0");
        pdf += `${offset} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objectNumber} /Root ${catalogObjectNumber} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new TextEncoder().encode(pdf);
}

export function exportAsMarkdown(workspace: Roadmap): void {
    const markdown = buildMarkdown(workspace);
    downloadBlob(new Blob([markdown], { type: "text/markdown" }), fileNameFromTitle(workspace.title, "md"));
}

export function exportAsJSON(workspace: Roadmap): void {
    const data = JSON.stringify(workspace, null, 2);
    downloadBlob(new Blob([data], { type: "application/json" }), fileNameFromTitle(workspace.title, "json"));
}

export function exportAsPDF(workspace: Roadmap): void {
    const markdown = buildMarkdown(workspace);
    const lines = markdownToPdfLines(markdown);
    const bytes = buildPdfDocument(lines);
    downloadBlob(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), fileNameFromTitle(workspace.title, "pdf"));
}
