CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS access_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    label VARCHAR(255),
    target_url_base VARCHAR(255),
    max_views INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    views_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_id UUID REFERENCES access_links(id) ON DELETE CASCADE,
    path VARCHAR(255) NOT NULL,
    target_url TEXT NOT NULL,
    label VARCHAR(255),
    UNIQUE(link_id, path)
);

CREATE TABLE IF NOT EXISTS access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_id UUID REFERENCES access_links(id) ON DELETE CASCADE,
    path VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
