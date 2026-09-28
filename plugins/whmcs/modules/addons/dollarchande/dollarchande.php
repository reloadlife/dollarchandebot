<?php

if (!defined("WHMCS")) {
    die("This file cannot be accessed directly");
}

if (!function_exists("dollarchande_config")) {
    function dollarchande_config() {
        return array(
            "name" => "DollarChande",
            "description" => "Writes a free-market toman rate into one WHMCS currency. No API key.",
            "version" => "1.0.0",
            "author" => "DollarChande",
            "language" => "english",
            "fields" => array(
                "api_base" => array(
                    "FriendlyName" => "API base",
                    "Type" => "text",
                    "Size" => "60",
                    "Default" => "https://api.dollarchande.live",
                    "Description" => "No path. The module calls /api/v1/symbols/{symbol}.",
                ),
                "api_key" => array(
                    "FriendlyName" => "API key",
                    "Type" => "text",
                    "Size" => "60",
                    "Default" => "",
                    "Description" => "From the Telegram bot: /key",
                ),
                "symbol" => array(
                    "FriendlyName" => "Symbol",
                    "Type" => "text",
                    "Size" => "12",
                    "Default" => "USD",
                    "Description" => "USD, USDT, EUR, GOLD18, and the other public symbols.",
                ),
                "currency_id" => array(
                    "FriendlyName" => "Currency ID",
                    "Type" => "text",
                    "Size" => "8",
                    "Default" => "",
                    "Description" => "tblcurrencies.id of the toman or rial currency. Do not pick the default currency.",
                ),
                "multiplier" => array(
                    "FriendlyName" => "Multiplier",
                    "Type" => "text",
                    "Size" => "8",
                    "Default" => "1",
                    "Description" => "1 when that currency is toman. 10 when it is rial.",
                ),
            ),
        );
    }
}

if (!function_exists("dollarchande_activate")) {
    function dollarchande_activate() {
        try {
            \WHMCS\Database\Capsule::statement("ALTER TABLE `tblcurrencies` MODIFY `rate` DECIMAL(18,8) NOT NULL DEFAULT '1.00000000'");
        } catch (Exception $e) {
            return array(
                "status" => "error",
                "description" => "Could not widen tblcurrencies.rate: " . $e->getMessage(),
            );
        }
        try {
            if (!\WHMCS\Database\Capsule::schema()->hasTable("mod_dollarchande")) {
                \WHMCS\Database\Capsule::schema()->create("mod_dollarchande", function ($table) {
                    $table->increments("id");
                    $table->unsignedInteger("ran_at")->default(0);
                    $table->string("symbol", 16)->default("");
                    $table->string("rate", 32)->default("");
                    $table->text("message")->nullable();
                });
            }
        } catch (Exception $e) {
            return array(
                "status" => "error",
                "description" => "Could not create mod_dollarchande: " . $e->getMessage(),
            );
        }
        return array(
            "status" => "success",
            "description" => "Set the currency id, then use Update now. The default currency stays at rate 1.",
        );
    }
}

if (!function_exists("dollarchande_deactivate")) {
    function dollarchande_deactivate() {
        return array(
            "status" => "success",
            "description" => "DollarChande stopped. The currency rate and mod_dollarchande table were left in place.",
        );
    }
}

if (!function_exists("dollarchande_settings_from_db")) {
    function dollarchande_settings_from_db() {
        $rows = array();
        try {
            $loaded = \WHMCS\Database\Capsule::table("tbladdonmodules")->where("module", "dollarchande")->get(array("setting", "value"));
            foreach ($loaded as $row) {
                $rows[$row->setting] = $row->value;
            }
        } catch (Exception $e) {
            $rows = array();
        }
        return array(
            "api_base" => isset($rows["api_base"]) ? $rows["api_base"] : "https://api.dollarchande.live",
            "api_key" => isset($rows["api_key"]) ? $rows["api_key"] : "",
            "symbol" => isset($rows["symbol"]) ? $rows["symbol"] : "USD",
            "currency_id" => isset($rows["currency_id"]) ? $rows["currency_id"] : "",
            "multiplier" => isset($rows["multiplier"]) ? $rows["multiplier"] : "1",
        );
    }
}

if (!function_exists("dollarchande_clean_base")) {
    function dollarchande_clean_base($value) {
        $value = trim((string) $value);
        if (!preg_match('#^https?://#i', $value)) {
            return "https://api.dollarchande.live";
        }
        return rtrim($value, "/");
    }
}

if (!function_exists("dollarchande_clean_symbol")) {
    function dollarchande_clean_symbol($value) {
        $value = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $value));
        if (!preg_match('/^[A-Z0-9]{2,16}$/', $value)) {
            return "USD";
        }
        return $value;
    }
}

if (!function_exists("dollarchande_sane_price")) {
    function dollarchande_sane_price($symbol, $price) {
        if ($price <= 0 || $price > 1000000000000) {
            return false;
        }
        $tight = array("USD", "USDT", "EUR", "GBP", "AED", "TRY");
        if (in_array($symbol, $tight, true)) {
            return $price >= 1000 && $price <= 10000000;
        }
        return true;
    }
}

if (!function_exists("dollarchande_fetch_price")) {
    function dollarchande_fetch_price($base, $symbol, $api_key = "") {
        $url = dollarchande_clean_base($base) . "/api/v1/symbols/" . rawurlencode($symbol);
        if (!function_exists("curl_init")) {
            return array("ok" => false, "message" => "curl is not available.");
        }
        $ch = curl_init($url);
        $headers = array(
            "Accept: application/json",
            "User-Agent: DollarChande-WHMCS/1.0",
        );
        if ($api_key !== "") {
            $headers[] = "X-Api-Key: " . $api_key;
        }
        curl_setopt_array($ch, array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => $headers,
        ));
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false || $code !== 200) {
            return array("ok" => false, "message" => "نرخ الان نرسید.");
        }
        $json = json_decode($body, true);
        if (!is_array($json) || !isset($json["price"]) || !is_numeric($json["price"])) {
            return array("ok" => false, "message" => "نرخ الان نرسید.");
        }
        $price = (float) $json["price"];
        if (!dollarchande_sane_price($symbol, $price)) {
            return array("ok" => false, "message" => "نرخ خارج از بازه منطقی بود و نوشته نشد.");
        }
        return array("ok" => true, "price" => $price);
    }
}

if (!function_exists("dollarchande_log_row")) {
    function dollarchande_log_row($symbol, $rate, $message) {
        try {
            \WHMCS\Database\Capsule::table("mod_dollarchande")->insert(array(
                "ran_at" => time(),
                "symbol" => $symbol,
                "rate" => (string) $rate,
                "message" => $message,
            ));
        } catch (Exception $e) {
            return;
        }
    }
}

if (!function_exists("dollarchande_apply")) {
    function dollarchande_apply($vars, $force) {
        $base = dollarchande_clean_base(isset($vars["api_base"]) ? $vars["api_base"] : "");
        $apiKey = isset($vars["api_key"]) ? trim((string) $vars["api_key"]) : "";
        $symbol = dollarchande_clean_symbol(isset($vars["symbol"]) ? $vars["symbol"] : "USD");
        $currencyId = isset($vars["currency_id"]) ? (int) $vars["currency_id"] : 0;
        $multiplier = isset($vars["multiplier"]) ? (float) $vars["multiplier"] : 1;
        if ($multiplier <= 0 || $multiplier > 1000) {
            $multiplier = 1;
        }
        if ($currencyId < 1) {
            $message = "شناسه ارز را در تنظیمات ماژول بنویسید.";
            dollarchande_log_row($symbol, "", $message);
            return array("ok" => false, "message" => $message);
        }
        if (!$force) {
            try {
                $last = \WHMCS\Database\Capsule::table("mod_dollarchande")->orderBy("id", "desc")->first();
            } catch (Exception $e) {
                $last = null;
            }
            if ($last && (time() - (int) $last->ran_at) < 3600 && $last->message === "ok") {
                return array("ok" => true, "message" => "هنوز به دور بعدی نرسیده.");
            }
        }
        try {
            $currency = \WHMCS\Database\Capsule::table("tblcurrencies")->where("id", $currencyId)->first();
        } catch (Exception $e) {
            $message = "خواندن ارز شکست خورد.";
            dollarchande_log_row($symbol, "", $message);
            return array("ok" => false, "message" => $message);
        }
        if (!$currency) {
            $message = "ارزی با این شناسه نیست.";
            dollarchande_log_row($symbol, "", $message);
            return array("ok" => false, "message" => $message);
        }
        if ((int) $currency->default === 1) {
            $message = "این ارز پیش‌فرض است و نرخ آن باید ۱ بماند. ارز تومان یا ریال را انتخاب کنید.";
            dollarchande_log_row($symbol, "", $message);
            return array("ok" => false, "message" => $message);
        }
        $fetched = dollarchande_fetch_price($base, $symbol, $apiKey);
        if (!$fetched["ok"]) {
            dollarchande_log_row($symbol, "", $fetched["message"]);
            return array("ok" => false, "message" => $fetched["message"]);
        }
        $next = $fetched["price"] * $multiplier;
        $stored = rtrim(rtrim(number_format($next, 8, ".", ""), "0"), ".");
        if ($stored === "") {
            $stored = "0";
        }
        try {
            \WHMCS\Database\Capsule::table("tblcurrencies")->where("id", $currencyId)->update(array("rate" => $stored));
            $written = (float) \WHMCS\Database\Capsule::table("tblcurrencies")->where("id", $currencyId)->value("rate");
        } catch (Exception $e) {
            $message = "نوشتن نرخ شکست خورد. ستون rate را DECIMAL(18,8) کنید.";
            dollarchande_log_row($symbol, $stored, $message);
            return array("ok" => false, "message" => $message);
        }
        if (abs($written - (float) $stored) > 0.01) {
            $message = "نرخ ذخیره نشد. ستون rate برای این عدد کوچک است.";
            dollarchande_log_row($symbol, $stored, $message);
            return array("ok" => false, "message" => $message);
        }
        if (function_exists("logActivity")) {
            logActivity("DollarChande set " . $currency->code . " (#" . $currencyId . ") rate to " . $stored . " from " . $symbol);
        }
        dollarchande_log_row($symbol, $stored, "ok");
        return array(
            "ok" => true,
            "message" => $currency->code . " = " . $stored,
        );
    }
}

if (!function_exists("dollarchande_cron_tick")) {
    function dollarchande_cron_tick() {
        dollarchande_apply(dollarchande_settings_from_db(), false);
    }
}

if (!function_exists("dollarchande_DailyCronJob")) {
    function dollarchande_DailyCronJob($vars) {
        dollarchande_apply(is_array($vars) ? $vars : dollarchande_settings_from_db(), false);
    }
}

if (!function_exists("dollarchande_output")) {
    function dollarchande_output($vars) {
        $notice = "";
        $ok = false;
        if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST["dollarchande_sync"])) {
            check_token("WHMCS.admin.default");
            $result = dollarchande_apply($vars, true);
            $notice = $result["message"];
            $ok = $result["ok"];
        }
        $token = generate_token("plain");
        $currencies = array();
        try {
            $currencies = \WHMCS\Database\Capsule::table("tblcurrencies")->orderBy("id")->get(array("id", "code", "rate", "default"));
        } catch (Exception $e) {
            $currencies = array();
        }
        $last = null;
        try {
            $last = \WHMCS\Database\Capsule::table("mod_dollarchande")->orderBy("id", "desc")->first();
        } catch (Exception $e) {
            $last = null;
        }
        echo '<div style="max-width:760px">';
        echo "<h2>DollarChande</h2>";
        echo "<p>نرخ بازار آزاد را در ارز تومان یا ریال می‌نویسد. ارز پیش‌فرض را دست نمی‌زند، چون نرخ آن باید ۱ بماند.</p>";
        echo "<p>اگر قیمت محصولات به دلار است و ارز مشتری تومان است، شناسه همان ارز تومان را بگذارید. ضریب ۱ برای تومان و ۱۰ برای ریال است.</p>";
        if ($notice !== "") {
            $color = $ok ? "#146c43" : "#9a3412";
            echo '<p style="color:' . $color . '">' . htmlspecialchars($notice, ENT_QUOTES, "UTF-8") . "</p>";
        }
        if ($last) {
            echo "<p>آخرین تلاش: " . htmlspecialchars((string) $last->message, ENT_QUOTES, "UTF-8");
            if ($last->rate !== "") {
                echo " / " . htmlspecialchars((string) $last->rate, ENT_QUOTES, "UTF-8");
            }
            echo "</p>";
        }
        echo '<form method="post">';
        echo '<input type="hidden" name="token" value="' . htmlspecialchars($token, ENT_QUOTES, "UTF-8") . '">';
        echo '<p><button type="submit" name="dollarchande_sync" value="1">Update now</button></p>';
        echo "</form>";
        echo "<table class=\"datatable\" width=\"100%\" border=\"0\" cellspacing=\"1\" cellpadding=\"3\">";
        echo "<tr><th>ID</th><th>Code</th><th>Rate</th><th>Default</th></tr>";
        foreach ($currencies as $row) {
            echo "<tr><td>" . (int) $row->id . "</td><td>" . htmlspecialchars((string) $row->code, ENT_QUOTES, "UTF-8") . "</td><td>" . htmlspecialchars((string) $row->rate, ENT_QUOTES, "UTF-8") . "</td><td>" . ((int) $row->default === 1 ? "yes" : "") . "</td></tr>";
        }
        echo "</table>";
        echo "</div>";
    }
}
