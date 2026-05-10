import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import { trackPageView } from '../lib/ga'

import FeedPage from '../pages/FeedPage.vue'
import SearchPage from '../pages/SearchPage.vue'
import ItemPage from '../pages/ItemPage.vue'
import AboutPage from '../pages/AboutPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import AuthListPage from '../pages/AuthListPage.vue'
import AuthTermsPage from '../pages/AuthTermsPage.vue'
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
  { path: '/search', name: 'search', component: SearchPage, meta: { title: 'Search' } },
  { path: '/item/:id(\\d+)', name: 'item', component: ItemPage, meta: { title: 'Item' } },
  { path: '/login', name: 'login', component: LoginPage, meta: { title: 'Login' } },
  { path: '/auth-terms', name: 'auth-terms', component: AuthTermsPage, meta: { title: 'Auth terms' } },
  { path: '/me/submissions', name: 'me-submissions', component: AuthListPage, props: { kind: 'submissions' }, meta: { title: 'My submissions' } },
  { path: '/me/comments', name: 'me-comments', component: AuthListPage, props: { kind: 'comments' }, meta: { title: 'My comments' } },
  { path: '/me/upvoted/submissions', name: 'me-upvoted-submissions', component: AuthListPage, props: { kind: 'upvoted-submissions' }, meta: { title: 'Upvoted stories' } },
  { path: '/me/upvoted/comments', name: 'me-upvoted-comments', component: AuthListPage, props: { kind: 'upvoted-comments' }, meta: { title: 'Upvoted comments' } },
  { path: '/me/favorites/submissions', name: 'me-favorites-submissions', component: AuthListPage, props: { kind: 'favorites-submissions' }, meta: { title: 'Favorite stories' } },
  { path: '/me/favorites/comments', name: 'me-favorites-comments', component: AuthListPage, props: { kind: 'favorites-comments' }, meta: { title: 'Favorite comments' } },
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
  trackPageView()
})
