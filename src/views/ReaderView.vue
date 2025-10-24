<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { loadBooks } from "../utils/loadBooks";
import { STORAGE_KEYS, readStorage, writeStorage } from "../utils/storage";

const isClient = typeof window !== "undefined";
const books = loadBooks();
const route = useRoute();
const router = useRouter();

const defaultPreferences = {
  theme: "light",
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: "system",
};

const savedPreferences =
  readStorage(STORAGE_KEYS.preferences, defaultPreferences) ??
  defaultPreferences;
const preferences = reactive({
  ...defaultPreferences,
  ...savedPreferences,
});

const savedProgress =
  readStorage(STORAGE_KEYS.progress, {
    bookSlug: "",
    chapters: {},
    positions: {},
  }) ?? {};

const progressState = reactive({
  bookSlug: savedProgress.bookSlug ?? "",
  chapters: savedProgress.chapters ?? {},
  positions: savedProgress.positions ?? {},
});

const getBookBySlug = (slug) => books.find((book) => book.slug === slug);
const getChapterById = (book, id) =>
  book?.chapters.find((chapter) => chapter.id === id) ?? null;

const fallbackBookSlug = books[0]?.slug ?? "";
const routeBookSlug =
  typeof route.params.bookSlug === "string" ? route.params.bookSlug : "";

const ensureBookSlug = (candidate) => {
  if (candidate && getBookBySlug(candidate)) return candidate;
  if (progressState.bookSlug && getBookBySlug(progressState.bookSlug)) {
    return progressState.bookSlug;
  }
  return fallbackBookSlug;
};

const selectedBookSlug = ref(ensureBookSlug(routeBookSlug));
if (!selectedBookSlug.value && fallbackBookSlug) {
  selectedBookSlug.value = fallbackBookSlug;
}

const currentBook = computed(() => getBookBySlug(selectedBookSlug.value));

const resolveChapterId = (book, candidate) => {
  if (!book) return "";
  if (candidate) {
    const directMatch = getChapterById(book, candidate);
    if (directMatch) return directMatch.id;
  }
  const savedChapterId = progressState.chapters?.[book.slug];
  if (savedChapterId) {
    const savedChapter = getChapterById(book, savedChapterId);
    if (savedChapter) return savedChapter.id;
  }
  return book.chapters[0]?.id ?? "";
};

const routeChapterId =
  typeof route.params.chapterId === "string" ? route.params.chapterId : "";
const selectedChapterId = ref(resolveChapterId(currentBook.value, routeChapterId));

const chapters = computed(() => currentBook.value?.chapters ?? []);
const currentChapter = computed(() =>
  chapters.value.find((chapter) => chapter.id === selectedChapterId.value),
);

const currentChapterIndex = computed(() =>
  chapters.value.findIndex((chapter) => chapter.id === selectedChapterId.value),
);

const previousChapter = computed(() => {
  const index = currentChapterIndex.value;
  if (index > 0) return chapters.value[index - 1] ?? null;
  return null;
});

const nextChapter = computed(() => {
  const index = currentChapterIndex.value;
  if (index !== -1 && index < chapters.value.length - 1) {
    return chapters.value[index + 1] ?? null;
  }
  return null;
});

const readerContainerRef = ref(null);
const scrollProgress = ref(0);
let pendingProgressPersist = null;

const contentFontClass = computed(() => {
  switch (preferences.fontFamily) {
    case "serif":
      return "font-serif";
    case "reading":
      return "font-reading";
    default:
      return "font-system";
  }
});

const contentStyle = computed(() => ({
  fontSize: `${preferences.fontSize}px`,
  lineHeight: preferences.lineHeight,
}));

const isSidebarOpen = ref(false);

const openSidebar = () => {
  isSidebarOpen.value = true;
};

const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const clonePositions = () => {
  const result = {};
  Object.entries(progressState.positions ?? {}).forEach(
    ([bookSlug, chaptersMap]) => {
      result[bookSlug] = { ...(chaptersMap ?? {}) };
    },
  );
  return result;
};

const persistPreferences = () => {
  writeStorage(STORAGE_KEYS.preferences, { ...preferences });
};

const persistProgress = () => {
  writeStorage(STORAGE_KEYS.progress, {
    bookSlug: selectedBookSlug.value,
    chapters: { ...(progressState.chapters ?? {}) },
    positions: clonePositions(),
  });
};

const scheduleProgressPersist = () => {
  if (!isClient) return;
  if (pendingProgressPersist) return;
  pendingProgressPersist = window.requestAnimationFrame(() => {
    pendingProgressPersist = null;
    persistProgress();
  });
};

const ensurePositionBucket = () => {
  if (!progressState.positions[selectedBookSlug.value]) {
    progressState.positions[selectedBookSlug.value] = {};
  }
};

const restoreScrollPosition = () => {
  const container = readerContainerRef.value;
  if (!container) return;
  ensurePositionBucket();
  const savedTop =
    progressState.positions[selectedBookSlug.value]?.[
      selectedChapterId.value
    ] ?? 0;
  container.scrollTop = savedTop;
  const max = container.scrollHeight - container.clientHeight;
  scrollProgress.value = max > 0 ? Math.min(savedTop / max, 1) : 1;
};

const handleScroll = () => {
  const container = readerContainerRef.value;
  if (!container) return;
  const max = container.scrollHeight - container.clientHeight;
  scrollProgress.value =
    max > 0 ? Math.min(container.scrollTop / max, 1) : 1;
  if (!selectedChapterId.value) return;
  ensurePositionBucket();
  progressState.positions[selectedBookSlug.value][selectedChapterId.value] =
    container.scrollTop;
  scheduleProgressPersist();
};

const syncThemeClass = () => {
  if (!isClient) return;
  const root = document.documentElement;
  if (preferences.theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const handleBookChange = (slug) => {
  if (selectedBookSlug.value === slug) return;
  if (!getBookBySlug(slug)) return;
  selectedBookSlug.value = slug;
  closeSidebar();
};

const applyChapterForBook = (book) => {
  if (!book) {
    selectedChapterId.value = "";
    return;
  }
  const resolved = resolveChapterId(book, selectedChapterId.value);
  selectedChapterId.value = resolved;
};

const handleChapterChange = (chapterId) => {
  if (selectedChapterId.value === chapterId) return;
  const book = currentBook.value;
  if (!book) return;
  const chapter = getChapterById(book, chapterId);
  if (!chapter) return;
  selectedChapterId.value = chapter.id;
  closeSidebar();
};

const goToPreviousChapter = () => {
  if (!previousChapter.value) return;
  handleChapterChange(previousChapter.value.id);
};

const goToNextChapter = () => {
  if (!nextChapter.value) return;
  handleChapterChange(nextChapter.value.id);
};

const goBackToList = () => {
  closeSidebar();
  router.push({ name: "books" });
};

const syncRouteWithState = () => {
  if (!selectedBookSlug.value || !selectedChapterId.value) return;
  const currentSlug =
    typeof route.params.bookSlug === "string" ? route.params.bookSlug : "";
  const currentChapterId =
    typeof route.params.chapterId === "string" ? route.params.chapterId : "";
  if (
    currentSlug !== selectedBookSlug.value ||
    currentChapterId !== selectedChapterId.value
  ) {
    router.replace({
      name: "reader",
      params: {
        bookSlug: selectedBookSlug.value,
        chapterId: selectedChapterId.value,
      },
    });
  }
};

watch(
  () => [selectedBookSlug.value, selectedChapterId.value],
  () => {
    syncRouteWithState();
  },
);

watch(
  () => [route.params.bookSlug, route.params.chapterId],
  ([bookSlugParam, chapterParam]) => {
    const slug = typeof bookSlugParam === "string" ? bookSlugParam : "";
    const chapterIdParam =
      typeof chapterParam === "string" ? chapterParam : "";
    if (slug && slug !== selectedBookSlug.value) {
      if (!getBookBySlug(slug)) {
        router.replace({ name: "books" });
        return;
      }
      selectedBookSlug.value = slug;
      const book = getBookBySlug(slug);
      selectedChapterId.value = resolveChapterId(book, chapterIdParam);
      return;
    }
    if (slug && chapterIdParam && chapterIdParam !== selectedChapterId.value) {
      const book = getBookBySlug(slug);
      if (!book) return;
      const chapter = getChapterById(book, chapterIdParam);
      if (chapter) {
        selectedChapterId.value = chapter.id;
      }
    }
  },
);

watch(currentBook, (book) => {
  if (!book) {
    selectedChapterId.value = "";
    return;
  }
  const exists = book.chapters.some(
    (chapter) => chapter.id === selectedChapterId.value,
  );
  if (!exists) {
    applyChapterForBook(book);
  }
});

watch(
  selectedBookSlug,
  (slug) => {
    progressState.bookSlug = slug;
    persistProgress();
  },
  { immediate: true },
);

watch(
  selectedChapterId,
  (chapterId) => {
    closeSidebar();
    if (!chapterId) {
      scrollProgress.value = 0;
      return;
    }
    if (!currentBook.value) return;
    progressState.chapters[selectedBookSlug.value] = chapterId;
    persistProgress();
    nextTick(() => {
      restoreScrollPosition();
    });
  },
  { immediate: true },
);

watch(
  preferences,
  () => {
    persistPreferences();
  },
  { deep: true },
);

watch(
  () => preferences.theme,
  () => {
    syncThemeClass();
  },
  { immediate: true },
);

onMounted(() => {
  nextTick(() => {
    const container = readerContainerRef.value;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      restoreScrollPosition();
    }
    syncRouteWithState();
  });
});

onBeforeUnmount(() => {
  const container = readerContainerRef.value;
  if (container) {
    container.removeEventListener("scroll", handleScroll);
  }
  if (isClient && pendingProgressPersist) {
    window.cancelAnimationFrame(pendingProgressPersist);
    pendingProgressPersist = null;
  }
});
</script>

<template>
  <div
    class="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100"
  >
    <header
      class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300 sm:text-sm"
            @click="goBackToList"
          >
            ← 返回书架
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300 sm:hidden"
            @click="openSidebar"
          >
            章节目录
          </button>
        </div>
        <div>
          <p
            v-if="currentBook"
            class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            {{ currentBook.title }}
          </p>
          <h1 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {{ currentChapter?.title ?? "请选择章节" }}
          </h1>
        </div>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-6xl flex-1 gap-4 px-4 py-6">
      <aside
        class="hidden min-h-[calc(100vh-260px)] flex-col rounded-xl bg-white p-4 shadow-sm transition dark:bg-slate-900 lg:flex lg:w-64"
      >
        <h2
          class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          书架
        </h2>
        <div class="flex-1 space-y-2 overflow-y-auto pr-1">
          <button
            v-for="book in books"
            :key="book.slug"
            class="w-full rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            :class="
              book.slug === selectedBookSlug
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
            "
            @click="handleBookChange(book.slug)"
          >
            <div class="font-medium">{{ book.title }}</div>
            <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ book.chapters.length }} 章
            </div>
          </button>
        </div>
      </aside>

      <aside
        class="hidden min-h-[calc(100vh-260px)] flex-col rounded-xl bg-white p-4 shadow-sm transition dark:bg-slate-900 lg:flex lg:w-56"
      >
        <h2
          class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          章节
        </h2>
        <div class="flex-1 space-y-2 overflow-y-auto pr-1">
          <button
            v-for="chapter in chapters"
            :key="chapter.id"
            class="w-full rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            :class="
              chapter.id === selectedChapterId
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
            "
            @click="handleChapterChange(chapter.id)"
          >
            <div class="font-medium">
              {{ chapter.title }}
            </div>
          </button>
        </div>
      </aside>

      <section
        class="min-h-[calc(100vh-260px)] flex-1 overflow-hidden rounded-xl bg-white shadow-sm transition dark:bg-slate-900"
      >
        <div v-if="currentChapter" class="flex h-full flex-col">
          <div
            ref="readerContainerRef"
            class="flex-1 overflow-y-auto px-6 py-6 text-base text-slate-800 transition sm:text-lg dark:text-slate-100"
          >
            <article
              :class="['whitespace-pre-wrap break-words', contentFontClass]"
              :style="contentStyle"
            >
              {{ currentChapter.content }}
            </article>
          </div>

          <footer
            class="sticky bottom-0 border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur transition dark:border-slate-800 dark:bg-slate-900/85"
          >
            <div class="mx-auto grid max-w-3xl grid-cols-2 gap-3">
              <button
                type="button"
                class="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm transition hover:border-indigo-300 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
                :disabled="!previousChapter"
                @click="goToPreviousChapter"
              >
                上一章
              </button>
              <button
                type="button"
                class="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm transition hover:border-indigo-300 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
                :disabled="!nextChapter"
                @click="goToNextChapter"
              >
                下一章
              </button>
            </div>
          </footer>
        </div>

        <div
          v-else
          class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500 dark:text-slate-400"
        >
          <p>尚未找到任何章节内容，确认书籍目录是否存在文本文件。</p>
        </div>
      </section>
    </main>

    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 z-40 flex justify-end bg-slate-950/50 backdrop-blur-sm lg:hidden"
      @click.self="closeSidebar"
    >
      <aside
        class="flex h-full w-80 max-w-[85%] flex-col border-l border-slate-200 bg-white shadow-xl transition dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"
        >
          <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
            目录
          </h2>
          <button
            type="button"
            class="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:border-indigo-300 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
            @click="closeSidebar"
          >
            关闭
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-4">
          <section>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              章节列表
            </h3>
            <div class="mt-3 space-y-2">
              <button
                v-for="chapter in chapters"
                :key="chapter.id"
                class="w-full rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                :class="
                  chapter.id === selectedChapterId
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                "
                @click="handleChapterChange(chapter.id)"
              >
                {{ chapter.title }}
              </button>
            </div>
          </section>

          <section class="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              书籍列表
            </h3>
            <div class="mt-3 space-y-2">
              <button
                v-for="book in books"
                :key="book.slug"
                class="w-full rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                :class="
                  book.slug === selectedBookSlug
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                "
                @click="handleBookChange(book.slug)"
              >
                {{ book.title }}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </div>
</template>
