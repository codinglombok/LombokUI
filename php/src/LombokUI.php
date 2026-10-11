<?php

declare(strict_types=1);

namespace Lombok\UI;

require_once __DIR__ . '/Util.php';
require_once __DIR__ . '/Machine.php';
require_once __DIR__ . '/Components.php';
require_once __DIR__ . '/Position.php';
require_once __DIR__ . '/Messages.php';
require_once __DIR__ . '/Render.php';

/**
 * LombokUI public API. The normative contract is docs/SPEC_LombokUI_v0.1.0.md.
 * Objects may be passed as associative arrays or as stdClass (as produced by json_decode).
 */
final class LombokUI
{
    public const VERSION = '0.1.0';
    public const FUNCTIONS = ['attrs', 'pagination', 'position', 'render', 'run'];

    /** Dynamic entry point used by vector runners and foreign hosts (SPEC 4). */
    public static function call(string $fn, array $args): mixed
    {
        $a = static fn (int $i, mixed $default): mixed => array_key_exists($i, $args) ? $args[$i] : $default;
        return match ($fn) {
            'run' => Machines::run($a(0, null), $a(1, new \stdClass()), $a(2, null)),
            'attrs' => Machines::attrsAfter($a(0, null), $a(1, new \stdClass()), $a(2, null) ?? []),
            'position' => Layout::position($a(0, null)),
            'pagination' => Layout::pagination($a(0, null)),
            'render' => Render::render($a(0, null), $a(1, null)),
            default => Util::fail('invalid_component', "unknown function \"$fn\""),
        };
    }

    public static function run(mixed $component, mixed $options, mixed $events): array
    {
        return Machines::run($component, $options, $events);
    }

    public static function attrs(mixed $component, mixed $options, mixed $events = []): array
    {
        return Machines::attrsAfter($component, $options, $events);
    }

    public static function createMachine(string $component, mixed $options = null): Machine
    {
        return new Machine($component, $options);
    }

    public static function position(mixed $args): array
    {
        return Layout::position($args);
    }

    public static function pagination(mixed $args): array
    {
        return Layout::pagination($args);
    }

    public static function render(string $component, mixed $props = null): string
    {
        return Render::render($component, $props);
    }
}
