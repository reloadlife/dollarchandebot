<?php

/**
 * Host stubs only. The assertions call the shipped plugin functions.
 */

$base = "http://127.0.0.1:18771";
$fail = static function (string $message): void {
    fwrite(STDERR, $message . "\n");
    exit(1);
};

$server = proc_open(
    [PHP_BINARY, "-S", "127.0.0.1:18771", __DIR__ . "/quote-router.php"],
    [1 => ["file", "/dev/null", "w"], 2 => ["file", "/dev/null", "w"]],
    $pipes,
    __DIR__
);
if (!is_resource($server)) {
    $fail("php server did not start");
}

$up = false;
for ($i = 0; $i < 40; $i++) {
    $probe = @file_get_contents($base . "/api/v1/symbols/USD");
    if ($probe !== false && str_contains($probe, "150000")) {
        $up = true;
        break;
    }
    usleep(50000);
}
if (!$up) {
    proc_terminate($server);
    $fail("quote router did not answer");
}

define("ABSPATH", __DIR__);
define("WHMCS", true);
define("MINUTE_IN_SECONDS", 60);

function add_shortcode($tag, $callback): void {}
function add_filter($tag, $callback): void {}
function add_action($tag, $callback, $priority = 10, $args = 1): void {}
function add_hook($tag, $priority, $callback): void {}
function register_activation_hook($file, $callback): void {}
function register_deactivation_hook($file, $callback): void {}
function untrailingslashit($value): string { return rtrim((string) $value, "/"); }
function shortcode_atts($defaults, $atts, $tag = ""): array { return array_merge($defaults, is_array($atts) ? $atts : []); }
function esc_html($value): string { return htmlspecialchars((string) $value, ENT_QUOTES, "UTF-8"); }
function esc_attr($value): string { return htmlspecialchars((string) $value, ENT_QUOTES, "UTF-8"); }
function get_transient($key) { return false; }
function set_transient($key, $value, $ttl): bool { return true; }
function wp_remote_retrieve_response_code($res): int { return (int) ($res["code"] ?? 0); }
function wp_remote_retrieve_body($res): string { return (string) ($res["body"] ?? ""); }

class WP_Error {
    public function __construct(public string $code, public string $message) {}
    public function get_error_message(): string { return $this->message; }
}
function is_wp_error($value): bool { return $value instanceof WP_Error; }

function wp_remote_get($url, $args = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => ["Accept: application/json"],
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false) {
        return new WP_Error("http", "transport");
    }
    return ["body" => $body, "code" => $code];
}

function get_option($name, $default = false) {
    global $base;
    if ($name === "dollarchande_wp_settings") {
        return ["api_base" => $base, "api_key" => "dc_test", "symbol" => "USD", "cache_minutes" => 5];
    }
    if ($name === "dollarchande_woo_settings") {
        return ["api_base" => $base, "api_key" => "dc_test", "symbol" => "USD", "multiplier" => 10, "step" => 1000];
    }
    return $default;
}

function wc_format_decimal($number, $dp = 0): string {
    return (string) (int) round((float) $number);
}

class DcProduct {
    public bool $saved = false;
    public function __construct(
        public array $meta,
        public string $regular = "100",
        public string $price = "100",
        public string $sale = "",
    ) {}
    public function is_type($type): bool { return false; }
    public function get_meta($key) { return $this->meta[$key] ?? ""; }
    public function get_regular_price() { return $this->regular; }
    public function get_price() { return $this->price; }
    public function get_sale_price() { return $this->sale; }
    public function set_regular_price($value): void { $this->regular = (string) $value; }
    public function set_price($value): void { $this->price = (string) $value; }
    public function save(): void { $this->saved = true; }
}

require __DIR__ . "/whmcs-stub.php";
require dirname(__DIR__) . "/plugins/wordpress/dollarchande/dollarchande.php";
require dirname(__DIR__) . "/plugins/woocommerce/dollarchande-woocommerce/dollarchande-woocommerce.php";
require dirname(__DIR__) . "/plugins/whmcs/modules/addons/dollarchande/hooks.php";

    $span = dollarchande_wp_shortcode(["symbol" => "USD"]);
    if (!str_contains($span, 'data-symbol="USD"') || !str_contains($span, "150,000") || !str_contains($span, "تومان") || !str_contains($span, "دلار")) {
        $fail("wordpress shortcode was " . $span);
    }
    $miss = dollarchande_wp_shortcode(["symbol" => "EUR"]);
    if ($miss !== '<span class="dollarchande">نرخ الان نرسید.</span>') {
        $fail("wordpress out-of-range span was " . $miss);
    }

    $shelf = dollarchande_woo_money(1, 100000, 10, 3000);
    if ((string) $shelf !== "999000") {
        $fail("woo shelf was " . $shelf);
    }

    $settings = dollarchande_woo_settings();
    $insane = new DcProduct(["_dollarchande_enabled" => "yes", "_dollarchande_base" => "2", "_dollarchande_symbol" => "EUR"]);
    $insaneResult = dollarchande_woo_apply_product($insane, $settings);
    if ($insaneResult !== "error" || $insane->saved || $insane->regular !== "100") {
        $fail("woo wrote an out-of-range rate: " . $insaneResult . " " . $insane->regular);
    }

    $sane = new DcProduct(["_dollarchande_enabled" => "yes", "_dollarchande_base" => "2", "_dollarchande_symbol" => "USD"]);
    $saneResult = dollarchande_woo_apply_product($sane, $settings);
    if ($saneResult !== "updated" || !$sane->saved || $sane->regular !== "3000000") {
        $fail("woo sane write was " . $saneResult . " " . $sane->regular);
    }

    $blocked = dollarchande_apply([
        "api_base" => $base,
        "api_key" => "dc_test",
        "symbol" => "EUR",
        "currency_id" => "5",
        "multiplier" => "10",
    ], true);
    if (!empty($blocked["ok"]) || \WHMCS\Database\Capsule::$updates !== 0 || \WHMCS\Database\Capsule::$rates[5]["rate"] !== "1.00000000") {
        $fail("whmcs wrote an out-of-range rate: " . json_encode($blocked));
    }

    $written = dollarchande_apply([
        "api_base" => $base,
        "api_key" => "dc_test",
        "symbol" => "USD",
        "currency_id" => "5",
        "multiplier" => "10",
    ], true);
    if (empty($written["ok"]) || \WHMCS\Database\Capsule::$rates[5]["rate"] !== "1500000") {
        $fail("whmcs rate write was " . json_encode($written) . " stored " . \WHMCS\Database\Capsule::$rates[5]["rate"]);
    }

echo "plugins ok\n";
proc_terminate($server);
