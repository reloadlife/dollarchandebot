<?php
/**
 * Plugin Name: دلارچنده
 * Plugin URI: https://dollarchande-web.pages.dev/
 * Description: نرخ بازار آزاد را نشان می‌دهد. کلید نمی‌خواهد.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: DollarChande
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: dollarchande
 */

if (!defined('ABSPATH')) {
    exit;
}

const DOLLARCHANDE_WP_DEFAULT_BASE = 'https://api.dollarchande.live';

function dollarchande_wp_base($value) {
    $value = trim((string) $value);
    if (!preg_match('#^https?://#i', $value)) {
        return DOLLARCHANDE_WP_DEFAULT_BASE;
    }
    return untrailingslashit($value);
}

function dollarchande_wp_symbol($value) {
    $value = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $value));
    if (!preg_match('/^[A-Z0-9]{2,16}$/', $value)) {
        return 'USD';
    }
    return $value;
}

function dollarchande_wp_settings() {
    $saved = get_option('dollarchande_wp_settings', array());
    if (!is_array($saved)) {
        $saved = array();
    }
    $minutes = isset($saved['cache_minutes']) ? (int) $saved['cache_minutes'] : 5;
    if ($minutes < 1) {
        $minutes = 1;
    }
    if ($minutes > 180) {
        $minutes = 180;
    }
    return array(
        'api_base' => dollarchande_wp_base(isset($saved['api_base']) ? $saved['api_base'] : ''),
        'api_key' => isset($saved['api_key']) ? trim((string) $saved['api_key']) : '',
        'symbol' => dollarchande_wp_symbol(isset($saved['symbol']) ? $saved['symbol'] : 'USD'),
        'cache_minutes' => $minutes,
    );
}

function dollarchande_wp_sane($symbol, $price) {
    if ($price <= 0 || $price > 1000000000000) {
        return false;
    }
    $tight = array('USD', 'USDT', 'EUR', 'GBP', 'AED', 'TRY');
    if (in_array($symbol, $tight, true)) {
        return $price >= 1000 && $price <= 10000000;
    }
    return true;
}

function dollarchande_wp_fetch($base, $symbol, $api_key = '') {
    $url = $base . '/api/v1/symbols/' . rawurlencode($symbol);
    $headers = array(
        'Accept' => 'application/json',
        'User-Agent' => 'DollarChande-WordPress/1.0',
    );
    if ($api_key !== '') {
        $headers['X-Api-Key'] = $api_key;
    }
    $res = wp_remote_get($url, array(
        'timeout' => 12,
        'headers' => $headers,
    ));
    if (is_wp_error($res)) {
        return new WP_Error('dollarchande_http', 'نرخ الان نرسید.');
    }
    $code = (int) wp_remote_retrieve_response_code($res);
    $body = json_decode(wp_remote_retrieve_body($res), true);
    if ($code !== 200 || !is_array($body) || !isset($body['price']) || !is_numeric($body['price'])) {
        return new WP_Error('dollarchande_quote', 'نرخ الان نرسید.');
    }
    $price = (float) $body['price'];
    if (!dollarchande_wp_sane($symbol, $price)) {
        return new WP_Error('dollarchande_range', 'نرخ خارج از بازه منطقی بود و ذخیره نشد.');
    }
    $label = isset($body['label_fa']) ? (string) $body['label_fa'] : $symbol;
    return array(
        'id' => $symbol,
        'price' => $price,
        'label_fa' => $label,
        'unit' => 'toman',
        'updated_at' => isset($body['updated_at']) ? (int) $body['updated_at'] : time(),
    );
}

function dollarchande_wp_quote($symbol = '') {
    $settings = dollarchande_wp_settings();
    $symbol = $symbol === '' ? $settings['symbol'] : dollarchande_wp_symbol($symbol);
    $key = 'dcwp_' . md5($settings['api_base'] . '|' . $symbol);
    $cached = get_transient($key);
    if (is_array($cached) && isset($cached['price'])) {
        return $cached;
    }
    $quote = dollarchande_wp_fetch($settings['api_base'], $symbol, $settings['api_key']);
    if (is_wp_error($quote)) {
        return $quote;
    }
    set_transient($key, $quote, $settings['cache_minutes'] * MINUTE_IN_SECONDS);
    return $quote;
}

function dollarchande_rate($symbol = '') {
    $quote = dollarchande_wp_quote($symbol);
    if (is_wp_error($quote)) {
        return null;
    }
    return (float) $quote['price'];
}

function dollarchande_wp_shortcode($atts) {
    $atts = shortcode_atts(array('symbol' => ''), $atts, 'dollarchande');
    $quote = dollarchande_wp_quote($atts['symbol']);
    if (is_wp_error($quote)) {
        return '<span class="dollarchande">نرخ الان نرسید.</span>';
    }
    $number = number_format((float) $quote['price'], 0, '.', ',');
    $label = $quote['label_fa'] !== '' ? $quote['label_fa'] : $quote['id'];
    return sprintf(
        '<span class="dollarchande" data-symbol="%s">%s: <span dir="ltr">%s</span> تومان</span>',
        esc_attr($quote['id']),
        esc_html($label),
        esc_html($number)
    );
}
add_shortcode('dollarchande', 'dollarchande_wp_shortcode');

function dollarchande_wp_schedules($schedules) {
    $schedules['dollarchande_15min'] = array(
        'interval' => 15 * MINUTE_IN_SECONDS,
        'display' => 'Every 15 minutes',
    );
    return $schedules;
}
add_filter('cron_schedules', 'dollarchande_wp_schedules');

function dollarchande_wp_refresh() {
    $settings = dollarchande_wp_settings();
    $key = 'dcwp_' . md5($settings['api_base'] . '|' . $settings['symbol']);
    $quote = dollarchande_wp_fetch($settings['api_base'], $settings['symbol'], $settings['api_key']);
    if (!is_wp_error($quote)) {
        set_transient($key, $quote, $settings['cache_minutes'] * MINUTE_IN_SECONDS);
    }
}
add_action('dollarchande_wp_refresh', 'dollarchande_wp_refresh');

function dollarchande_wp_activate() {
    if (!wp_next_scheduled('dollarchande_wp_refresh')) {
        wp_schedule_event(time() + 60, 'dollarchande_15min', 'dollarchande_wp_refresh');
    }
}
register_activation_hook(__FILE__, 'dollarchande_wp_activate');

function dollarchande_wp_deactivate() {
    wp_clear_scheduled_hook('dollarchande_wp_refresh');
}
register_deactivation_hook(__FILE__, 'dollarchande_wp_deactivate');

function dollarchande_wp_menu() {
    add_options_page('دلارچنده', 'دلارچنده', 'manage_options', 'dollarchande', 'dollarchande_wp_render');
}
add_action('admin_menu', 'dollarchande_wp_menu');

function dollarchande_wp_render() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $notice = '';
    if (isset($_POST['dollarchande_wp_save'])) {
        check_admin_referer('dollarchande_wp_save');
        $next = array(
            'api_base' => dollarchande_wp_base(isset($_POST['api_base']) ? wp_unslash($_POST['api_base']) : ''),
            'api_key' => isset($_POST['api_key']) ? trim(sanitize_text_field(wp_unslash($_POST['api_key']))) : '',
            'symbol' => dollarchande_wp_symbol(isset($_POST['symbol']) ? wp_unslash($_POST['symbol']) : 'USD'),
            'cache_minutes' => isset($_POST['cache_minutes']) ? (int) $_POST['cache_minutes'] : 5,
        );
        update_option('dollarchande_wp_settings', $next);
        $notice = 'ذخیره شد.';
    }
    $settings = dollarchande_wp_settings();
    $quote = dollarchande_wp_quote($settings['symbol']);
    ?>
    <div class="wrap">
        <h1>دلارچنده</h1>
        <?php if ($notice !== '') : ?>
            <div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>
        <?php if (is_wp_error($quote)) : ?>
            <div class="notice notice-warning"><p><?php echo esc_html($quote->get_error_message()); ?></p></div>
        <?php else : ?>
            <p>
                <?php echo esc_html($quote['id']); ?>:
                <strong dir="ltr"><?php echo esc_html(number_format((float) $quote['price'], 0, '.', ',')); ?></strong>
                تومان
            </p>
        <?php endif; ?>
        <form method="post">
            <?php wp_nonce_field('dollarchande_wp_save'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="dc-base">آدرس API</label></th>
                    <td><input id="dc-base" name="api_base" type="url" class="regular-text" dir="ltr" value="<?php echo esc_attr($settings['api_base']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="dc-key">کلید API</label></th>
                    <td>
                        <input id="dc-key" name="api_key" type="text" class="regular-text" dir="ltr" value="<?php echo esc_attr($settings['api_key']); ?>" autocomplete="off">
                        <p class="description">از ربات، با دستور /key.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="dc-symbol">نماد پیش‌فرض</label></th>
                    <td>
                        <input id="dc-symbol" name="symbol" type="text" class="regular-text" dir="ltr" value="<?php echo esc_attr($settings['symbol']); ?>">
                        <p class="description">مثلاً USD یا USDT یا GOLD18.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="dc-cache">ماندگاری کش (دقیقه)</label></th>
                    <td><input id="dc-cache" name="cache_minutes" type="number" min="1" max="180" value="<?php echo esc_attr((string) $settings['cache_minutes']); ?>"></td>
                </tr>
            </table>
            <p>کد کوتاه: <code dir="ltr">[dollarchande symbol="USD"]</code></p>
            <p>در قالب: <code dir="ltr">&lt;?php echo esc_html(dollarchande_rate('USD')); ?&gt;</code></p>
            <?php submit_button('ذخیره', 'primary', 'dollarchande_wp_save'); ?>
        </form>
    </div>
    <?php
}
