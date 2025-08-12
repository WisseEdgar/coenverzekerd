-- Harden storage policies for 'documents' bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') LIKE '%bucket_id = ''documents''%'
        OR COALESCE(with_check, '') LIKE '%bucket_id = ''documents''%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END
$$;

CREATE POLICY "Documents bucket - users can read own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    public.is_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Documents bucket - users can upload to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Documents bucket - users/admin can update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (
    public.is_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Documents bucket - users/admin can delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND (
    public.is_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- Tighten admin audit log insert policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_log;

CREATE POLICY "Admins can insert audit logs"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));