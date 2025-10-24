const modules = import.meta.glob("../books/**/*.txt", {
  eager: true,
  query: "?raw",
  import: "default",
});

const slugify = (value) =>
  encodeURIComponent(value.replace(/\s+/g, "-").toLowerCase());

export function loadBooks() {
  const byBook = new Map();

  Object.entries(modules).forEach(([path, content]) => {
    const segments = path.split("/");
    const fileName = segments.at(-1) ?? "";
    const bookTitle = segments.at(-2) ?? "未命名书籍";
    const chapterTitle = fileName.replace(/\.txt$/i, "");

    if (!byBook.has(bookTitle)) {
      byBook.set(bookTitle, {
        title: bookTitle,
        slug: slugify(bookTitle),
        chapters: [],
      });
    }

    byBook.get(bookTitle).chapters.push({
      id: slugify(`${bookTitle}-${chapterTitle}`),
      fileName,
      title: chapterTitle,
      content,
    });
  });

  const books = Array.from(byBook.values())
    .map((book) => ({
      ...book,
      chapters: book.chapters
        .sort((a, b) => a.title.localeCompare(b.title, "zh-CN", { numeric: true }))
        .map((chapter, index) => ({
          ...chapter,
          number: index + 1,
        })),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN", { numeric: true }));

  return books;
}
