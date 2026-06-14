export const CATEGORY_OPTIONS = [
  { label: '全部', value: '全部', color: '#0e0e0b' },
  { label: '国内', value: '国内', color: '#e31d33' },
  { label: '国际', value: '国际', color: '#16a34a' },
  { label: '财经', value: '财经', color: '#ecb23e' },
  { label: '科技', value: '科技', color: '#155aef' },
];

export const CATEGORY_META = CATEGORY_OPTIONS.reduce((result, item) => {
  result[item.value] = item;
  return result;
}, {});

export const PRIORITY_META = {
  P0: { label: '要闻', tone: 'critical' },
  P1: { label: '关注', tone: 'important' },
  P2: { label: '补充', tone: 'normal' },
};
