<?php
/**
 * Plugin Name: دلارچنده برای ووکامرس
 * Plugin URI: https://dollarchande.live/
 * Description: قیمت کالاهای انتخاب‌شده را با نرخ بازار آزاد تازه می‌کند.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Author: DollarChande
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: dollarchande-woocommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

const DOLLARCHANDE_WOO_DEFAULT_BASE = 'https://api.dollarchande.live';

function dollarchande_woo_base($value) {
    $value = trim((string) $value);
    if (!preg_match('#^https?://#i', $value)) {
        return DOLLARCHANDE_WOO_DEFAULT_BASE;
    }
    return untrailingslashit($value);
}

function dollarchande_woo_symbol($value) {
    $value = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $value));
    if (!preg_match('/^[A-Z0-9]{2,16}$/', $value)) {
        return '';
    }
    return $value;
}

function dollarchande_woo_settings() {
    $saved = get_option('dollarchande_woo_settings', array());
    if (!is_array($saved)) {
        $saved = array();
    }
    $symbol = dollarchande_woo_symbol(isset($saved['symbol']) ? $saved['symbol'] : 'USD');
    if ($symbol === '') {
        $symbol = 'USD';
    }
    $multiplier = isset($saved['multiplier']) ? (float) $saved['multiplier'] : 1;
    if ($multiplier <= 0 || $multiplier > 1000) {
        $multiplier = 1;
    }
    $step = isset($saved['step']) ? (int) $saved['step'] : 1000;
    if ($step < 1) {
        $step = 1;
    }
    if ($step > 1000000) {
        $step = 1000000;
    }
    return array(
        'api_base' => dollarchande_woo_base(isset($saved['api_base']) ? $saved['api_base'] : ''),
        'api_key' => isset($saved['api_key']) ? trim((string) $saved['api_key']) : '',
        'symbol' => $symbol,
        'multiplier' => $multiplier,
        'step' => $step,
    );
}

function dollarchande_woo_sane($symbol, $price) {
    if ($price <= 0 || $price > 1000000000000) {
        return false;
    }
    $tight = array('USD', 'USDT', 'EUR', 'GBP', 'AED', 'TRY');
    if (in_array($symbol, $tight, true)) {
        return $price >= 1000 && $price <= 10000000;
    }
    return true;
}

function dollarchande_woo_fetch($base, $symbol, $api_key = '') {
    $url = $base . '/api/v1/symbols/' . rawurlencode($symbol);
    $headers = array(
        'Accept' => 'application/json',
        'User-Agent' => 'DollarChande-WooCommerce/1.0',
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
    if (!dollarchande_woo_sane($symbol, $price)) {
        return new WP_Error('dollarchande_range', 'نرخ خارج از بازه منطقی بود و قیمت‌ها عوض نشد.');
    }
    return array('price' => $price);
}

function dollarchande_woo_rate($symbol) {
    static $memory = array();
    $settings = dollarchande_woo_settings();
    $symbol = dollarchande_woo_symbol($symbol);
    if ($symbol === '') {
        $symbol = $settings['symbol'];
    }
    if (array_key_exists($symbol, $memory)) {
        return $memory[$symbol];
    }
    $key = 'dcwoo_' . md5($settings['api_base'] . '|' . $symbol);
    $cached = get_transient($key);
    if (is_array($cached) && isset($cached['price'])) {
        $memory[$symbol] = (float) $cached['price'];
        return $memory[$symbol];
    }
    $quote = dollarchande_woo_fetch($settings['api_base'], $symbol, $settings['api_key']);
    if (is_wp_error($quote)) {
        $memory[$symbol] = null;
        return null;
    }
    set_transient($key, $quote, 5 * MINUTE_IN_SECONDS);
    $memory[$symbol] = (float) $quote['price'];
    return $memory[$symbol];
}

function dollarchande_woo_money($base, $rate, $multiplier, $step) {
    $raw = (float) $base * (float) $rate * (float) $multiplier;
    $step = (int) $step;
    if ($step < 1) {
        $step = 1;
    }
    $rounded = round($raw / $step) * $step;
    if ($rounded < 0) {
        $rounded = 0;
    }
    return wc_format_decimal($rounded, 0);
}

function dollarchande_woo_apply_product($product, $settings) {
    if (!$product || $product->is_type('variable') || $product->is_type('grouped')) {
        return 'skip';
    }
    if ($product->get_meta('_dollarchande_enabled') !== 'yes') {
        return 'skip';
    }
    $base = (float) $product->get_meta('_dollarchande_base');
    if ($base <= 0) {
        return 'skip';
    }
    $symbol = dollarchande_woo_symbol((string) $product->get_meta('_dollarchande_symbol'));
    if ($symbol === '') {
        $symbol = $settings['symbol'];
    }
    $rate = dollarchande_woo_rate($symbol);
    if ($rate === null) {
        return 'error';
    }
    $next = dollarchande_woo_money($base, $rate, $settings['multiplier'], $settings['step']);
    $current = wc_format_decimal($product->get_regular_price(), 0);
    $active = wc_format_decimal($product->get_price(), 0);
    $sale = $product->get_sale_price();
    if ($current === $next && ($sale !== '' || $active === $next)) {
        return 'same';
    }
    $product->set_regular_price($next);
    if ($sale === '') {
        $product->set_price($next);
    }
    $product->save();
    return 'updated';
}

function dollarchande_woo_run_sync() {
    if (!function_exists('wc_get_product')) {
        return;
    }
    $settings = dollarchande_woo_settings();
    $updated = 0;
    $skipped = 0;
    $errors = 0;
    $page = 1;
    $capped = false;
    do {
        $ids = get_posts(array(
            'post_type' => array('product', 'product_variation'),
            'post_status' => array('publish', 'private', 'draft', 'pending'),
            'posts_per_page' => 100,
            'paged' => $page,
            'fields' => 'ids',
            'orderby' => 'ID',
            'order' => 'ASC',
            'meta_query' => array(
                array(
                    'key' => '_dollarchande_enabled',
                    'value' => 'yes',
                ),
            ),
        ));
        foreach ($ids as $id) {
            $result = dollarchande_woo_apply_product(wc_get_product($id), $settings);
            if ($result === 'updated') {
                $updated++;
            } elseif ($result === 'error') {
                $errors++;
            } else {
                $skipped++;
            }
        }
        $page++;
        if ($page > 50 && count($ids) === 100) {
            $capped = true;
            break;
        }
    } while (count($ids) === 100);

    update_option('dollarchande_woo_last', array(
        'time' => time(),
        'updated' => $updated,
        'skipped' => $skipped,
        'errors' => $errors,
        'capped' => $capped,
    ), false);
}
add_action('dollarchande_woo_sync', 'dollarchande_woo_run_sync');

function dollarchande_woo_activate() {
    if (!wp_next_scheduled('dollarchande_woo_sync')) {
        wp_schedule_event(time() + 120, 'hourly', 'dollarchande_woo_sync');
    }
}
register_activation_hook(__FILE__, 'dollarchande_woo_activate');

function dollarchande_woo_deactivate() {
    wp_clear_scheduled_hook('dollarchande_woo_sync');
}
register_deactivation_hook(__FILE__, 'dollarchande_woo_deactivate');

function dollarchande_woo_missing_notice() {
    if (!current_user_can('activate_plugins')) {
        return;
    }
    echo '<div class="notice notice-warning"><p>افزونه ووکامرس دلارچنده بدون ووکامرس کاری نمی‌کند.</p></div>';
}

function dollarchande_woo_boot() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'dollarchande_woo_missing_notice');
        return;
    }
    add_action('admin_menu', 'dollarchande_woo_menu');
    add_action('admin_init', 'dollarchande_woo_handle_post');
    add_action('woocommerce_product_options_pricing', 'dollarchande_woo_product_fields');
    add_action('woocommerce_admin_process_product_object', 'dollarchande_woo_save_product');
    add_action('woocommerce_variation_options_pricing', 'dollarchande_woo_variation_fields', 10, 3);
    add_action('woocommerce_admin_process_variation_object', 'dollarchande_woo_prepare_variation', 10, 2);
}
add_action('plugins_loaded', 'dollarchande_woo_boot', 20);

function dollarchande_woo_menu() {
    add_submenu_page(
        'woocommerce',
        'دلارچنده',
        'دلارچنده',
        'manage_woocommerce',
        'dollarchande-woo',
        'dollarchande_woo_render'
    );
}

function dollarchande_woo_handle_post() {
    if (!isset($_POST['dollarchande_woo_action'])) {
        return;
    }
    if (!current_user_can('manage_woocommerce')) {
        return;
    }
    check_admin_referer('dollarchande_woo_settings');
    $action = sanitize_text_field(wp_unslash($_POST['dollarchande_woo_action']));
    if ($action === 'save') {
        update_option('dollarchande_woo_settings', array(
            'api_base' => dollarchande_woo_base(isset($_POST['api_base']) ? wp_unslash($_POST['api_base']) : ''),
            'api_key' => isset($_POST['api_key']) ? trim(sanitize_text_field(wp_unslash($_POST['api_key']))) : '',
            'symbol' => dollarchande_woo_symbol(isset($_POST['symbol']) ? wp_unslash($_POST['symbol']) : 'USD') ?: 'USD',
            'multiplier' => isset($_POST['multiplier']) ? (float) wp_unslash($_POST['multiplier']) : 1,
            'step' => isset($_POST['step']) ? (int) $_POST['step'] : 1000,
        ));
        set_transient('dollarchande_woo_notice', 'ذخیره شد.', 30);
    }
    if ($action === 'sync') {
        dollarchande_woo_run_sync();
        set_transient('dollarchande_woo_notice', 'همگام‌سازی تمام شد.', 30);
    }
}

function dollarchande_woo_render() {
    if (!current_user_can('manage_woocommerce')) {
        return;
    }
    $settings = dollarchande_woo_settings();
    $last = get_option('dollarchande_woo_last', array());
    $notice = get_transient('dollarchande_woo_notice');
    if ($notice) {
        delete_transient('dollarchande_woo_notice');
    }
    $rate = dollarchande_woo_rate($settings['symbol']);
    ?>
    <div class="wrap">
        <h1>دلارچنده برای ووکامرس</h1>
        <?php if ($notice) : ?>
            <div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>
        <?php if ($rate === null) : ?>
            <div class="notice notice-warning"><p>نرخ الان نرسید.</p></div>
        <?php else : ?>
            <p>
                <?php echo esc_html($settings['symbol']); ?>:
                <strong dir="ltr"><?php echo esc_html(number_format($rate, 0, '.', ',')); ?></strong>
                تومان
            </p>
        <?php endif; ?>
        <?php if (is_array($last) && !empty($last['time'])) : ?>
            <p>
                آخرین دور:
                <?php echo esc_html((string) (int) $last['updated']); ?> کالا عوض شد،
                <?php echo esc_html((string) (int) $last['skipped']); ?> رد شد،
                <?php echo esc_html((string) (int) $last['errors']); ?> خطا.
                <?php if (!empty($last['capped'])) : ?>
                    این دور تا ۵۰۰۰ کالا را دید.
                <?php endif; ?>
            </p>
        <?php endif; ?>
        <form method="post">
            <?php wp_nonce_field('dollarchande_woo_settings'); ?>
            <input type="hidden" name="dollarchande_woo_action" value="save">
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="dcw-base">آدرس API</label></th>
                    <td><input id="dcw-base" name="api_base" type="url" class="regular-text" dir="ltr" value="<?php echo esc_attr($settings['api_base']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="dcw-key">کلید API</label></th>
                    <td>
                        <input id="dcw-key" name="api_key" type="text" class="regular-text" dir="ltr" value="<?php echo esc_attr($settings['api_key']); ?>" autocomplete="off">
                        <p class="description">از ربات، با دستور /key.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="dcw-symbol">نماد</label></th>
                    <td><input id="dcw-symbol" name="symbol" type="text" dir="ltr" value="<?php echo esc_attr($settings['symbol']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="dcw-mult">ضریب</label></th>
                    <td>
                        <input id="dcw-mult" name="multiplier" type="number" min="0.001" step="0.001" value="<?php echo esc_attr((string) $settings['multiplier']); ?>">
                        <p class="description">۱ اگر قیمت فروشگاه تومان است. ۱۰ اگر ریال است.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="dcw-step">گام گرد کردن</label></th>
                    <td>
                        <input id="dcw-step" name="step" type="number" min="1" step="1" value="<?php echo esc_attr((string) $settings['step']); ?>">
                        <p class="description">مثلاً ۱۰۰۰ یعنی قیمت به هزار تومان گرد می‌شود.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('ذخیره'); ?>
        </form>
        <form method="post">
            <?php wp_nonce_field('dollarchande_woo_settings'); ?>
            <input type="hidden" name="dollarchande_woo_action" value="sync">
            <?php submit_button('همگام‌سازی الان', 'secondary'); ?>
        </form>
        <p>فقط کالاهایی که «به‌روزرسانی با دلارچنده» دارند عوض می‌شوند. قیمت حراج دست نمی‌خورد.</p>
    </div>
    <?php
}

function dollarchande_woo_product_fields() {
    woocommerce_wp_checkbox(array(
        'id' => '_dollarchande_enabled',
        'label' => 'به‌روزرسانی با دلارچنده',
        'description' => 'قیمت تومان از قیمت پایه و نرخ آزاد ساخته می‌شود.',
    ));
    woocommerce_wp_text_input(array(
        'id' => '_dollarchande_base',
        'label' => 'قیمت پایه',
        'type' => 'text',
        'data_type' => 'price',
        'description' => 'به ارز نماد. مثلاً ۱۲.۵ دلار.',
        'desc_tip' => true,
    ));
    woocommerce_wp_text_input(array(
        'id' => '_dollarchande_symbol',
        'label' => 'نماد',
        'description' => 'خالی یعنی نماد تنظیمات.',
        'desc_tip' => true,
    ));
}

function dollarchande_woo_read_posted_symbol($raw) {
    $symbol = dollarchande_woo_symbol(sanitize_text_field(wp_unslash($raw)));
    return $symbol;
}

function dollarchande_woo_save_product($product) {
    if (!isset($_POST['_dollarchande_base'])) {
        return;
    }
    $enabled = (isset($_POST['_dollarchande_enabled']) && wp_unslash($_POST['_dollarchande_enabled']) === 'yes') ? 'yes' : 'no';
    $base = isset($_POST['_dollarchande_base']) ? wc_format_decimal(wp_unslash($_POST['_dollarchande_base'])) : '';
    if ($base !== '' && (float) $base < 0) {
        $base = '';
    }
    $symbol = isset($_POST['_dollarchande_symbol']) ? dollarchande_woo_read_posted_symbol($_POST['_dollarchande_symbol']) : '';
    $product->update_meta_data('_dollarchande_enabled', $enabled);
    $product->update_meta_data('_dollarchande_base', $base);
    $product->update_meta_data('_dollarchande_symbol', $symbol);
    if ($enabled !== 'yes' || (float) $base <= 0 || $product->is_type('variable') || $product->is_type('grouped')) {
        return;
    }
    $settings = dollarchande_woo_settings();
    $use = $symbol !== '' ? $symbol : $settings['symbol'];
    $rate = dollarchande_woo_rate($use);
    if ($rate === null) {
        set_transient('dollarchande_woo_notice', 'قیمت ذخیره شد، ولی نرخ الان نرسید.', 60);
        return;
    }
    $next = dollarchande_woo_money($base, $rate, $settings['multiplier'], $settings['step']);
    $product->set_regular_price($next);
    if ($product->get_sale_price() === '') {
        $product->set_price($next);
    }
}

function dollarchande_woo_variation_fields($loop, $variation_data, $variation) {
    woocommerce_wp_checkbox(array(
        'id' => '_dollarchande_enabled_' . $loop,
        'name' => '_dollarchande_enabled[' . $loop . ']',
        'value' => get_post_meta($variation->ID, '_dollarchande_enabled', true),
        'label' => 'به‌روزرسانی با دلارچنده',
    ));
    woocommerce_wp_text_input(array(
        'id' => '_dollarchande_base_' . $loop,
        'name' => '_dollarchande_base[' . $loop . ']',
        'value' => get_post_meta($variation->ID, '_dollarchande_base', true),
        'label' => 'قیمت پایه',
        'wrapper_class' => 'form-row form-row-first',
    ));
    woocommerce_wp_text_input(array(
        'id' => '_dollarchande_symbol_' . $loop,
        'name' => '_dollarchande_symbol[' . $loop . ']',
        'value' => get_post_meta($variation->ID, '_dollarchande_symbol', true),
        'label' => 'نماد',
        'wrapper_class' => 'form-row form-row-last',
    ));
}

function dollarchande_woo_prepare_variation($variation, $loop) {
    if (!isset($_POST['_dollarchande_base'][$loop])) {
        return;
    }
    $enabled = (isset($_POST['_dollarchande_enabled'][$loop]) && wp_unslash($_POST['_dollarchande_enabled'][$loop]) === 'yes') ? 'yes' : 'no';
    $base = wc_format_decimal(wp_unslash($_POST['_dollarchande_base'][$loop]));
    if ($base !== '' && (float) $base < 0) {
        $base = '';
    }
    $symbol = isset($_POST['_dollarchande_symbol'][$loop]) ? dollarchande_woo_read_posted_symbol($_POST['_dollarchande_symbol'][$loop]) : '';
    $variation->update_meta_data('_dollarchande_enabled', $enabled);
    $variation->update_meta_data('_dollarchande_base', $base);
    $variation->update_meta_data('_dollarchande_symbol', $symbol);
    if ($enabled !== 'yes' || (float) $base <= 0) {
        return;
    }
    $settings = dollarchande_woo_settings();
    $use = $symbol !== '' ? $symbol : $settings['symbol'];
    $rate = dollarchande_woo_rate($use);
    if ($rate === null) {
        set_transient('dollarchande_woo_notice', 'متغیر ذخیره شد، ولی نرخ الان نرسید.', 60);
        return;
    }
    $next = dollarchande_woo_money($base, $rate, $settings['multiplier'], $settings['step']);
    $variation->set_regular_price($next);
    if ($variation->get_sale_price() === '') {
        $variation->set_price($next);
    }
}
