select _id, _data, date_added, datetaken, mime_type, bucket_display_name, bucket_id, orientation FROM images where ((((is_pending=0 AND NOT _modifier=4) OR (is_pending=1 AND lower(_data) REGEXP '/\.pending-(\d+)-([^/]+)$' AND owner_package_name IN ('com.campmobile.snow'))))
AND (is_trashed=0) AND (volume_name IN ('external_primary'))) AND ((_size>0)) ORDER BY datetaken DESC;
