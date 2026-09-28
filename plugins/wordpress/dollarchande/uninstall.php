<?php

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('dollarchande_wp_settings');
wp_clear_scheduled_hook('dollarchande_wp_refresh');
