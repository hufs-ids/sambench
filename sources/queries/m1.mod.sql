SELECT
  *
FROM
  files
WHERE
  (
    (
      (
        is_pending = 1
        AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$'
        AND owner_package_name IN ('com.android.messaging')
      )
      OR (
        is_pending = 0
        AND NOT _modifier = 4
      )
    )
    AND (is_trashed = 0)
    AND (volume_name IN ('external_primary'))
    AND (
      mime_type IN (
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/vnd.wap.wbmp',
        'image/x-ms-bmp',
        'video/3gp',
        'video/3gpp',
        'video/3gpp2',
        'video/h263',
        'video/m4v',
        'video/mp4',
        'video/mpeg',
        'video/mpeg4',
        'video/webm',
        'audio/mp3',
        'audio/mp4',
        'audio/midi',
        'audio/mid',
        'audio/amr',
        'audio/x-wav',
        'audio/aac',
        'audio/x-midi',
        'audio/x-mid',
        'audio/x-mp3'
      )
      AND media_type IN (1, 3, 2)
    )
  )
  AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$' -- 두 번째 추가
  AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$'
ORDER BY
  date_modified DESC;

