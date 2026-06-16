import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/Home.vue';

const APP_TITLE = '西风简报-24H新闻AI解读';

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: {
      title: '今日简报',
    },
  },
  {
    path: '/news/:id',
    name: 'news-detail',
    component: () => import('../views/NewsDetail.vue'),
    meta: {
      title: '新闻详情',
    },
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('../views/Search.vue'),
    meta: {
      title: '搜索',
    },
  },
  {
    path: '/search/history',
    name: 'search-history',
    component: () => import('../views/SearchHistory.vue'),
    meta: {
      title: '搜索历史',
    },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  document.title = to.name === 'home' || !to.meta?.title ? APP_TITLE : `${to.meta.title} - ${APP_TITLE}`;
});

export default router;
