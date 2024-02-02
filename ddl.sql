CREATE TABLE QueryPerformanceMetrics (
    id SERIAL PRIMARY KEY,
    query_id VARCHAR(255) NOT NULL,
    device_capacity_percentage INT NOT NULL,
    cpu_cycles BIGINT,
    execution_time_milliseconds INT,
    android_device_execution_time INT,
    linux_host_execution_time INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    additional_info JSONB
);

CREATE TABLE QueryDetails (
    query_id VARCHAR(255) PRIMARY KEY,
    query_text TEXT NOT NULL
);
