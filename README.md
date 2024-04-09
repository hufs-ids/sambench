# SAMBench
A comprehensive SQLite benchmark for Android Media access with interactive analysis.

![dashboard](<docs/Dashboard.png>)

## Introduction

SAMBench offers intuitive web-based dashboards and allows users to evaluate media access performance on different configurations, leveraging media access queries collected from Android applications

## Dependencies

- docker
- sqlite3
- adb
- nodejs

## Prerequisite

You need a Linux server and an Android device

## Build and Install

1. Clone the source code
```
git clone https://github.com/hufs-ids/sambench.git
```
2. Install Grafana and Prometheus


## Run

1. Copy the `.env.example` file to create a `.env` file and modify the contents appropriately.
2. Run `docker-compose up -d` to start Prometheus and Grafana.
3. Execute `yarn start:dev` to run the server

