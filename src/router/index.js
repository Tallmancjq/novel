import { createRouter, createWebHashHistory } from "vue-router";
import BookListView from "../views/BookListView.vue";
import ReaderView from "../views/ReaderView.vue";

export const routes = [
  {
    path: "/",
    name: "books",
    component: BookListView,
  },
  {
    path: "/reader/:bookSlug/:chapterId?",
    name: "reader",
    component: ReaderView,
    props: true,
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: { name: "books" },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
