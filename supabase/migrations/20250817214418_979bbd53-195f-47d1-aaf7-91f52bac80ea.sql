-- Add index on file_path for faster exclusion queries
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);
CREATE INDEX IF NOT EXISTS idx_documents_v2_file_path ON documents_v2(file_path);

-- Add composite index for migration ordering
CREATE INDEX IF NOT EXISTS idx_documents_created_at_file_path ON documents(created_at, file_path);