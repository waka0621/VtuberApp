CREATE TABLE IF NOT EXISTS vtubers (
    vtuber_id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    gender CHAR(4) NOT NULL CHECK (gender IN ('女','男', 'その他', '定義不能')) NOT NULL,
    group_name VARCHAR(63),
    birthday DATE,
    color_code VARCHAR(8),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    nickname VARCHAR(63) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS vtuber_links (
    link_id INTEGER PRIMARY KEY,
    vtuber_id INTEGER NOT NULL,
    site_name VARCHAR(63),
    url VARCHAR(255),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INTEGER NOT NULL,
    vtuber_id INTEGER NOT NULL
);