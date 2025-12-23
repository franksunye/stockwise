-- 核心股票池管理表
CREATE TABLE IF NOT EXISTS core_pool (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始数据 (港股热门股)
INSERT OR IGNORE INTO core_pool (symbol, name) VALUES
('02171', '映客'),
('02269', '药明生物'),
('01801', '信达生物'),
('00700', '腾讯控股'),
('09988', '阿里巴巴-SW'),
('03690', '美团-W'),
('01024', '快手-W'),
('02015', '理想汽车-W'),
('09868', '小鹏汽车-W'),
('01810', '小米集团-W');
