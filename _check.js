const fs = require('fs');
try {
  const d = JSON.parse(fs.readFileSync('./data/news.json', 'utf8'));
  console.log('total=' + d.total);
  console.log('国内=' + d.stats['国内']);
  console.log('国际=' + d.stats['国际']);
  console.log('财经=' + d.stats['财经']);
  console.log('科技=' + d.stats['科技']);
  console.log('updated=' + d.updatedAt);
} catch(e) {
  console.log('err=' + e.message);
}
