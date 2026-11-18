-- 只存汇总计数：哪一天、哪个事件、哪个分组，一共多少次。没有任何能识别个人的字段。
CREATE TABLE IF NOT EXISTS counters (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  dim TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name, dim)
) WITHOUT ROWID;
