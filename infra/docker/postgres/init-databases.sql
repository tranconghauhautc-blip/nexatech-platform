-- App roles (not superuser postgres) and dedicated databases.
CREATE USER nexatech_identity WITH PASSWORD 'changeme';
CREATE USER nexatech_customer WITH PASSWORD 'changeme';
CREATE USER nexatech_catalog WITH PASSWORD 'changeme';
CREATE USER nexatech_media WITH PASSWORD 'changeme';

CREATE DATABASE nexatech_identity OWNER nexatech_identity;
CREATE DATABASE nexatech_customer OWNER nexatech_customer;
CREATE DATABASE nexatech_catalog OWNER nexatech_catalog;
CREATE DATABASE nexatech_media OWNER nexatech_media;

GRANT ALL PRIVILEGES ON DATABASE nexatech_identity TO nexatech_identity;
GRANT ALL PRIVILEGES ON DATABASE nexatech_customer TO nexatech_customer;
GRANT ALL PRIVILEGES ON DATABASE nexatech_catalog TO nexatech_catalog;
GRANT ALL PRIVILEGES ON DATABASE nexatech_media TO nexatech_media;
