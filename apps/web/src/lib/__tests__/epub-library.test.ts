// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { File, Blob } from "node:buffer";
import { webcrypto } from "node:crypto";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
    importEpub,
    getBookFile,
    updateBook,
    findBook,
} from "@/lib/personal/books";
import { getPersonalSnapshot, personalEntries } from "@/lib/personal/store";

beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("File", File);
    vi.stubGlobal("Blob", Blob);
    vi.stubGlobal("DOMParser", DOMParser);
});
beforeEach(() => {
    localStorage.clear();
    getPersonalSnapshot();
});

async function exampleEpub() {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file(
        "META-INF/container.xml",
        '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    );
    zip.file(
        "OEBPS/book.opf",
        '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">syllo-test</dc:identifier><dc:title>Learning by Doing</dc:title><dc:creator>A. Reader</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-21T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>',
    );
    zip.file(
        "OEBPS/nav.xhtml",
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">Try one idea</a></li></ol></nav></body></html>',
    );
    zip.file(
        "OEBPS/one.xhtml",
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Try one idea</title></head><body><h1>Try one idea</h1><p>Use what you learn and describe what happens.</p></body></html>',
    );
    return new File(
        [new Uint8Array(await zip.generateAsync({ type: "arraybuffer" }))],
        "learning.epub",
        { type: "application/epub+zip" },
    );
}

it("imports real EPUB metadata, keeps bytes locally, and deduplicates without resetting progress", async () => {
    const file = await exampleEpub();
    const book = await importEpub(file);
    expect(book.title).toBe("Learning by Doing");
    expect(book.author).toBe("A. Reader");
    expect(book.status).toBe("to-read");
    expect((await getBookFile(book)).size).toBe(file.size);
    updateBook(book.id, {
        position: "epubcfi(/6/2!/4/2:0)",
        chapter: "Try one idea",
        percent: 24,
        status: "reading",
    });
    const reimported = await importEpub(file);
    expect(reimported.id).toBe(book.id);
    expect(findBook(book.id)?.percent).toBe(24);
    expect(personalEntries(getPersonalSnapshot(), "book")).toHaveLength(1);
});

it("uses the actual EPUB table of contents", async () => {
    const { default: ePub } = await import("epubjs");
    const epub = ePub();
    try {
        await epub.open(await (await exampleEpub()).arrayBuffer(), "binary");
        const navigation = await epub.loaded.navigation;
        expect(navigation.toc.map((item) => item.label.trim())).toEqual([
            "Try one idea",
        ]);
        expect(navigation.toc[0].href).toBe("one.xhtml");
    } finally {
        epub.destroy();
    }
});

it("rejects non-EPUB input without saving a library entry", async () => {
    await expect(importEpub(new File(["text"], "notes.txt"))).rejects.toThrow(
        "Choose an EPUB file",
    );
    expect(personalEntries(getPersonalSnapshot(), "book")).toEqual([]);
});
