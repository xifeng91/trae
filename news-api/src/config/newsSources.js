const newsSources = [
  {
    name: '联合早报',
    url: 'https://plink.anyfeeder.com/zaobao/realtime/china',
    category: '国内',
    defaultPriority: 'P0',
  },
  {
    name: 'China Daily',
    url: 'https://www.chinadaily.com.cn/rss/world_rss.xml',
    category: '国际',
    defaultPriority: 'P0',
  },
  {
    name: '联合早报国际',
    url: 'https://plink.anyfeeder.com/zaobao/realtime/world',
    category: '国际',
    defaultPriority: 'P0',
  },
  {
    name: '央视新闻国际',
    url: 'https://plink.anyfeeder.com/weixin/cctvnewscenter',
    category: '国际',
    defaultPriority: 'P1',
  },
  {
    name: '人民网国际',
    url: 'http://www.people.com.cn/rss/world.xml',
    category: '国际',
    defaultPriority: 'P1',
  },
  {
    name: '新华网国际',
    url: 'http://www.xinhuanet.com/world/news_world.xml',
    category: '国际',
    defaultPriority: 'P1',
  },
  {
    name: '财新',
    url: 'https://plink.anyfeeder.com/weixin/caixinwang',
    category: '财经',
    defaultPriority: 'P1',
  },
  {
    name: '界面财经',
    url: 'https://plink.anyfeeder.com/jiemian/finance',
    category: '财经',
    defaultPriority: 'P1',
    useFetchTimeAsPublishedAt: true,
  },
  {
    name: '经济日报',
    url: 'https://plink.anyfeeder.com/jingjiribao',
    category: '财经',
    defaultPriority: 'P1',
  },
  {
    name: '央视财经',
    url: 'https://plink.anyfeeder.com/weixin/cctvyscj',
    category: '财经',
    defaultPriority: 'P1',
  },
  {
    name: '21世纪经济报道',
    url: 'https://plink.anyfeeder.com/weixin/jjbd21',
    category: '财经',
    defaultPriority: 'P1',
  },
  {
    name: '华尔街见闻',
    url: 'https://plink.anyfeeder.com/weixin/wallstreetcn',
    category: '财经',
    defaultPriority: 'P1',
  },
  {
    name: '雪球精选',
    url: 'https://plink.anyfeeder.com/weixin/xueqiujinghua',
    category: '财经',
    defaultPriority: 'P2',
  },
  {
    name: '英为财情市场头条',
    url: 'https://cn.investing.com/rss/news_285.rss',
    category: '财经',
    defaultPriority: 'P1',
  },
  {
    name: '界面商业',
    url: 'https://plink.anyfeeder.com/jiemian/business',
    category: '商业',
    defaultPriority: 'P1',
    useFetchTimeAsPublishedAt: true,
  },
  {
    name: '36氪',
    url: 'https://36kr.com/feed',
    category: '科技',
    defaultPriority: 'P1',
  },
  {
    name: '爱范儿',
    url: 'https://www.ifanr.com/feed',
    category: '科技',
    defaultPriority: 'P2',
  },
];

module.exports = newsSources;
