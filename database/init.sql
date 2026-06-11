CREATE TABLE IF NOT EXISTS vtubers (
    vtuber_id INTEGER PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    gender ENUM('男', '女', 'その他', '定義不能') NOT NULL,
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
    vtuber_id INTEGER NOT NULL,
);