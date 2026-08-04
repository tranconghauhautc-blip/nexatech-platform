-- Create isolated E2E test databases (not runtime deploy DBs).
CREATE USER nexatech_e2e WITH PASSWORD 'e2e_password_change_me';

SELECT 'CREATE DATABASE nexatech_identity_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_identity_test')\gexec
SELECT 'CREATE DATABASE nexatech_customer_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_customer_test')\gexec
SELECT 'CREATE DATABASE nexatech_catalog_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_catalog_test')\gexec
SELECT 'CREATE DATABASE nexatech_media_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_media_test')\gexec
SELECT 'CREATE DATABASE nexatech_inventory_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_inventory_test')\gexec
SELECT 'CREATE DATABASE nexatech_cart_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_cart_test')\gexec
SELECT 'CREATE DATABASE nexatech_order_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_order_test')\gexec
SELECT 'CREATE DATABASE nexatech_payment_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_payment_test')\gexec
SELECT 'CREATE DATABASE nexatech_shipping_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_shipping_test')\gexec
SELECT 'CREATE DATABASE nexatech_review_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_review_test')\gexec
SELECT 'CREATE DATABASE nexatech_warranty_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_warranty_test')\gexec
SELECT 'CREATE DATABASE nexatech_support_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_support_test')\gexec
SELECT 'CREATE DATABASE nexatech_notification_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_notification_test')\gexec
SELECT 'CREATE DATABASE nexatech_reporting_test OWNER nexatech_e2e'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexatech_reporting_test')\gexec
