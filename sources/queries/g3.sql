SELECT COUNT(_id) FROM images WHERE ((((is_pending=0 AND NOT _modifier=4) OR (is_pending=1 AND lower(_data) NOT REGEXP '.*/\.pending-(\d+)-([^/]+)$' AND owner_package_name IN ( 'com.android.gallery3d' )))) AND (is_trashed=0) AND (volume_name IN ( 'external_primary' ))) AND ((bucket_id = '726192347'));

