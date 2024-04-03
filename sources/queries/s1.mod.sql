SELECT
  *
FROM
  files
WHERE
  (
    (
      (
        (
          is_pending = 1
          AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$'
        )
      )
    )
    OR (
      is_pending = 0
      AND NOT _modifier = 4
    )
    AND (is_trashed = 0)
    AND (volume_name IN ('external_primary'))
  )
  AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$'
  AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$'
  AND (
    (
      _size > 0
      AND (
        mime_type = 'image/jpeg'
        OR mime_type = 'image/png'
        OR mime_type = 'image/x-ms-bmp'
        OR mime_type = 'image/heic'
        OR mime_type = 'image/heif'
        OR mime_type = 'image/x-adobe-dng'
      )
    )
  );
