<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { loadBooks } from "../utils/loadBooks";
import { STORAGE_KEYS, readStorage } from "../utils/storage";

const books = loadBooks();
const router = useRouter();

const savedProgress = ref(
  readStorage(STORAGE_KEYS.progress, {
    bookSlug: "",
    chapters: {},
  }) ?? { bookSlug: "", chapters: {} },
);

const hasBooks = computed(() => books.length > 0);

const resolveLastChapter = (book) => {
  const savedChapterId = savedProgress.value.chapters?.[book.slug];
  return (
    book.chapters.find((chapter) => chapter.id === savedChapterId) ??
    book.chapters[0] ??
    null
  );
};

const resolveProgressPercent = (book) => {
  const lastChapter = resolveLastChapter(book);
  if (!lastChapter) return 0;
  const index = book.chapters.findIndex(
    (chapter) => chapter.id === lastChapter.id,
  );
  if (index === -1) return 0;
  return Math.round(((index + 1) / book.chapters.length) * 100);
};

const goToBook = (book) => {
  const chapter = resolveLastChapter(book);
  const chapterId = chapter?.id ?? "";
  router.push({
    name: "reader",
    params: {
      bookSlug: book.slug,
      chapterId,
    },
  });
};
</script>

<template>
  <div
    class="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100"
  >
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <header class="flex flex-col gap-2 text-center sm:text-left">
        <h1 class="text-3xl font-semibold">我的书架</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          自动扫描 `src/books` 中的文件夹，每个文件夹即一本书。
        </p>
      </header>

      <section v-if="hasBooks" class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="book in books"
          :key="book.slug"
          class="group flex cursor-pointer flex-col rounded-2xl border border-transparent bg-white/90 p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg dark:bg-slate-900/80"
          @click="goToBook(book)"
        >
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {{ book.title }}
              </h2>
              <span
                class="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
              >
                {{ book.chapters.length }} 章
              </span>
            </div>
            <p class="mt-4 text-sm text-slate-500 dark:text-slate-400">
              点击继续阅读或开始第一章。
            </p>
          </div>

          <div class="mt-6 space-y-2 text-sm">
            <p class="text-slate-500 dark:text-slate-400">
              继续：{{ resolveLastChapter(book)?.title ?? "尚未开始" }}
            </p>
            <div class="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                class="h-full rounded-full bg-indigo-500 transition-all duration-300 dark:bg-indigo-400"
                :style="{ width: `${resolveProgressPercent(book)}%` }"
              ></div>
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500">
              阅读进度 {{ resolveProgressPercent(book) }}%
            </p>
          </div>
        </article>
      </section>

      <section
        v-else
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/40 px-6 py-24 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400"
      >
        <p>暂未找到任何书籍，请在 `src/books` 下创建文件夹并放入章节文本。</p>
      </section>
    </div>
  </div>
</template>
