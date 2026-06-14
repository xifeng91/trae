const env = require('../config/env');

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: env.appTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: env.appTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: env.appTimeZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getDateKey(value = new Date()) {
  return dateFormatter.format(toDate(value));
}

function getDateTimeText(value = new Date()) {
  return dateTimeFormatter.format(toDate(value));
}

function getTimeText(value = new Date()) {
  return timeFormatter.format(toDate(value));
}

function isSameAppDate(value, targetDateKey = getDateKey()) {
  return getDateKey(value) === targetDateKey;
}

function addMinutes(value, minutes) {
  return new Date(toDate(value).getTime() + minutes * 60 * 1000);
}

module.exports = {
  addMinutes,
  getDateKey,
  getDateTimeText,
  getTimeText,
  isSameAppDate,
  toDate,
};
