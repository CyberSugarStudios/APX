Optional: put browser-image-compression.js (v2.0.2) in this folder to use a local copy.
Download: https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js

Map uploads load it from here first, then from that jsdelivr link. If neither loads,
APX uses its own built-in compressor, which aims for the same size limits.
