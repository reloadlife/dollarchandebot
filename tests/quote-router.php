<?php

$path = parse_url($_SERVER["REQUEST_URI"] ?? "/", PHP_URL_PATH) ?: "/";
header("content-type: application/json; charset=utf-8");

if (str_ends_with($path, "/USD")) {
    echo '{"price":150000,"label_fa":"دلار","unit":"toman","updated_at":1}';
    return;
}

if (str_ends_with($path, "/EUR")) {
    echo '{"price":12,"label_fa":"یورو","unit":"toman","updated_at":1}';
    return;
}

http_response_code(404);
echo "{}";
