<?php

declare(strict_types=1);

namespace Lombok\UI;

/** Built-in message catalogs. They MUST equal locales/<tag>/lombokui.json (checked by the tests). */
final class Messages
{
    public const LABEL_KEYS = ['close', 'breadcrumb', 'pagination', 'previous_page', 'next_page'];

    /** @var array<string, array<string, string>> */
    public const CATALOGS = [
        'en' => [
            'lombokui.error.invalid_component' => 'The component name is unknown.',
            'lombokui.error.invalid_option' => 'A component option or function argument is invalid.',
            'lombokui.error.invalid_event' => 'The event is invalid for this component.',
            'lombokui.error.invalid_props' => 'A render property is invalid.',
            'lombokui.label.close' => 'Close',
            'lombokui.label.breadcrumb' => 'Breadcrumb',
            'lombokui.label.pagination' => 'Pagination',
            'lombokui.label.previous_page' => 'Previous page',
            'lombokui.label.next_page' => 'Next page',
        ],
        'id' => [
            'lombokui.error.invalid_component' => 'Nama komponen tidak dikenal.',
            'lombokui.error.invalid_option' => 'Opsi komponen atau argumen fungsi tidak sah.',
            'lombokui.error.invalid_event' => 'Event tidak sah untuk komponen ini.',
            'lombokui.error.invalid_props' => 'Properti render tidak sah.',
            'lombokui.label.close' => 'Tutup',
            'lombokui.label.breadcrumb' => 'Jejak navigasi',
            'lombokui.label.pagination' => 'Navigasi halaman',
            'lombokui.label.previous_page' => 'Halaman sebelumnya',
            'lombokui.label.next_page' => 'Halaman berikutnya',
        ],
    ];

    /** Exact tag, then the language subtag, then `en` (SPEC 8.2). */
    public static function resolveLocale(string $tag): string
    {
        $t = str_replace('_', '-', Util::fold($tag));
        if (isset(self::CATALOGS[$t])) {
            return $t;
        }
        $lang = explode('-', $t)[0];
        return isset(self::CATALOGS[$lang]) ? $lang : 'en';
    }

    /** @param array<string, string>|null $overrides */
    public static function label(string $locale, string $key, ?array $overrides): string
    {
        if ($overrides !== null && array_key_exists($key, $overrides)) {
            return $overrides[$key];
        }
        return self::CATALOGS[self::resolveLocale($locale)]["lombokui.label.$key"];
    }
}
