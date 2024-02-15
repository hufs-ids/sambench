select _id, _data, date_added, datetaken, mime_type, bucket_display_name, bucket_id, orientation FROM
images where (is_trashed=0) AND
    (volume_name in ('external_primary')) AND
    ((_size>0)) AND
    (((is_pending=0 AND not _modifier=4) OR
      (is_pending=1 AND owner_package_name in ('com.campmobile.snow') AND
       lower(_data) not regexp '/\.pending-(\d+)-([^/]+)$'))) ORDER BY datetaken DESC;

