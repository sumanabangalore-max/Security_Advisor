-- Create Schema for Security Advisory Tracker

-- Drop tables if they exist
DROP TABLE IF EXISTS vulnerability_lifecycle;
DROP TABLE IF EXISTS live_cves;
DROP TABLE IF EXISTS master_inventory;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

-- Roles table
CREATE TABLE roles (
    name VARCHAR(50) PRIMARY KEY
);

-- Seed Roles
INSERT INTO roles (name) VALUES ('admin'), ('analyst'), ('viewer');

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL REFERENCES roles(name),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Master Inventory table
CREATE TABLE master_inventory (
    id SERIAL PRIMARY KEY,
    software_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    environment VARCHAR(100) NOT NULL DEFAULT 'Production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Live CVEs table (NVD)
CREATE TABLE live_cves (
    cve_id VARCHAR(50) PRIMARY KEY,
    summary TEXT NOT NULL,
    cvss_score DECIMAL(3,1),
    published_date TIMESTAMP WITH TIME ZONE NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL,
    software_name VARCHAR(255) NOT NULL,
    version_affected VARCHAR(100) NOT NULL,
    cpe23 VARCHAR(255)
);

-- Vulnerability Lifecycle table
CREATE TABLE vulnerability_lifecycle (
    id SERIAL PRIMARY KEY,
    cve_id VARCHAR(50) NOT NULL REFERENCES live_cves(cve_id) ON DELETE CASCADE,
    software_id INTEGER NOT NULL REFERENCES master_inventory(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'False Positive', 'Mitigated')),
    assigned_engineer VARCHAR(255),
    remediation_steps TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cve_id, software_id)
);
