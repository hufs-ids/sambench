# android-sqlite-performance-visualizer

![dashboard](<docs/dashboard.png>)

## Introduction

Android의 SQLite 성능을 측정하고, 이를 시각화하는 도구입니다.

## Dependencies

- docker
- sqlite3
- adb
- nodejs

## Installation

1. .env.example 파일을 복사하여 .env 파일을 생성하고 내용을 적절히 수정합니다.
2. `docker-compose up -d` 명령어를 실행하여 prometheus와 grafana를 실행합니다.
3. `yarn start:dev` 명령어를 실행하여 서버를 실행합니다.
