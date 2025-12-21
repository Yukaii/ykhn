import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import FeedPage from '../pages/FeedPage.vue'
import ItemPage from '../pages/ItemPage.vue'
import AboutPage from '../pages/AboutPage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'

export type FeedKind = 'top' | 'new' | 'best' | 'ask' | 'show' | 'jobs'

const feedRoutes: RouteRecordRaw[] = [
  { path: '/', name: 'top', component: FeedPage, props: { feed: 'top' satisfies FeedKind }, meta: { title: 'Top' } },
  { path: '/new', name: 'new', component: FeedPage, props: { feed: 'new' satisfies FeedKind }, meta: { title: 'New' } },
  { path: '/best', name: 'best', component: FeedPage, props: { feed: 'best' satisfies FeedKind }, meta: { title: 'Best' } },
  { path: '/ask', name: 'ask', component: FeedPage, props: { feed: 'ask' satisfies FeedKind }, meta: { title: 'Ask' } },
  { path: '/show', name: 'show', component: FeedPage, props: { feed: 'show' satisfies FeedKind }, meta: { title: 'Show' } },
  { path: '/jobs', name: 'jobs', component: FeedPage, props: { feed: 'jobs' satisfies FeedKind }, meta: { title: 'Jobs' } },
]

const routes: RouteRecordRaw[] = [
  ...feedRoutes,
  { path: '/item/:id(\\d+)', name: 'item', component: ItemPage, meta: { title: 'Item' } },
  { path: '/about', name: 'about', component: AboutPage, meta: { title: 'About' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, meta: { title: 'Not found' } },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.fullPath === from.fullPath) return
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'YKHN'
  document.title = `${title} · YKHN`
})
