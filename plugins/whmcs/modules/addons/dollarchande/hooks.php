<?php

if (!defined("WHMCS")) {
    die("This file cannot be accessed directly");
}

require_once __DIR__ . "/dollarchande.php";

add_hook("AfterCronJob", 1, function () {
    if (function_exists("dollarchande_cron_tick")) {
        dollarchande_cron_tick();
    }
});
