-- App roles (not superuser postgres) and dedicated databases.
CREATE USER nexatech_identity WITH PASSWORD 'changeme';
CREATE USER nexatech_customer WITH PASSWORD 'changeme';
CREATE USER nexatech_catalog WITH PASSWORD 'changeme';
CREATE USER nexatech_media WITH PASSWORD 'changeme';
CREATE USER nexatech_inventory WITH PASSWORD 'changeme';
CREATE USER nexatech_cart WITH PASSWORD 'changeme';
CREATE USER nexatech_order WITH PASSWORD 'changeme';
CREATE USER nexatech_payment WITH PASSWORD 'changeme';
CREATE USER nexatech_shipping WITH PASSWORD 'changeme';
CREATE USER nexatech_review WITH PASSWORD 'changeme';

CREATE DATABASE nexatech_identity OWNER nexatech_identity;
CREATE DATABASE nexatech_customer OWNER nexatech_customer;
CREATE DATABASE nexatech_catalog OWNER nexatech_catalog;
CREATE DATABASE nexatech_media OWNER nexatech_media;
CREATE DATABASE nexatech_inventory OWNER nexatech_inventory;
CREATE DATABASE nexatech_cart OWNER nexatech_cart;
CREATE DATABASE nexatech_order OWNER nexatech_order;
CREATE DATABASE nexatech_payment OWNER nexatech_payment;
CREATE DATABASE nexatech_shipping OWNER nexatech_shipping;
CREATE DATABASE nexatech_review OWNER nexatech_review;

GRANT ALL PRIVILEGES ON DATABASE nexatech_identity TO nexatech_identity;
GRANT ALL PRIVILEGES ON DATABASE nexatech_customer TO nexatech_customer;
GRANT ALL PRIVILEGES ON DATABASE nexatech_catalog TO nexatech_catalog;
GRANT ALL PRIVILEGES ON DATABASE nexatech_media TO nexatech_media;
GRANT ALL PRIVILEGES ON DATABASE nexatech_inventory TO nexatech_inventory;
GRANT ALL PRIVILEGES ON DATABASE nexatech_cart TO nexatech_cart;
GRANT ALL PRIVILEGES ON DATABASE nexatech_order TO nexatech_order;
GRANT ALL PRIVILEGES ON DATABASE nexatech_payment TO nexatech_payment;
GRANT ALL PRIVILEGES ON DATABASE nexatech_shipping TO nexatech_shipping;
GRANT ALL PRIVILEGES ON DATABASE nexatech_review TO nexatech_review;
