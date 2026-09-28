<?php

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('dollarchande_woo_settings');
delete_option('dollarchande_woo_last');
wp_clear_scheduled_hook('dollarchande_woo_sync');
