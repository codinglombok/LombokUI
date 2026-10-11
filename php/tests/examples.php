<?php

// Native PHP usage (associative arrays instead of decoded JSON) and helper edge cases.

declare(strict_types=1);

require_once __DIR__ . '/../src/LombokUI.php';

use Lombok\UI\LombokUI;
use Lombok\UI\LombokUIError;
use Lombok\UI\Util;

$checks = 0;
$fail = static function (string $what): never {
    fwrite(STDERR, "FAIL: $what\n");
    exit(1);
};
$eq = static function (mixed $got, mixed $want, string $what) use (&$checks, $fail): void {
    $checks++;
    if ($got !== $want) {
        $fail($what . "\n  want " . var_export($want, true) . "\n  got  " . var_export($got, true));
    }
};

$eq(
    LombokUI::render('breadcrumb', ['items' => [['label' => 'Beranda', 'href' => '/'], ['label' => 'Profil']], 'locale' => 'id']),
    '<nav aria-label="Jejak navigasi"><ol class="breadcrumb"><li><a href="/">Beranda</a></li><li aria-current="page">Profil</li></ol></nav>',
    'python/README breadcrumb example renders the same in PHP',
);
$eq(LombokUI::render('badge', ['label' => '<b>']), '<span class="badge">&lt;b&gt;</span>', 'escaping');

$m = LombokUI::createMachine('switch', ['idBase' => 'notif']);
$seen = [];
$m->subscribe(function (array $s) use (&$seen): void {
    $seen[] = $s['checked'];
});
$m->send(['type' => 'keydown', 'key' => ' ']);
$eq($seen, [true], 'machine wrapper notifies subscribers');
$eq($m->attrs()['control']['aria-checked'], 'true', 'switch attrs');

$tabs = LombokUI::createMachine('tabs', ['idBase' => 't', 'items' => [['id' => 'a'], ['id' => 'b', 'disabled' => true], ['id' => 'c']]]);
$tabs->send(['type' => 'focus', 'id' => 'a']);
$eq($tabs->send(['type' => 'keydown', 'key' => 'ArrowRight']), [['type' => 'change', 'name' => 'selected', 'value' => 'c'], ['type' => 'focus', 'target' => 'tab:c']], 'README tabs quick start');

try {
    LombokUI::render('breadcrumb', ['items' => [['label' => 'x', 'href' => " Java\tScript:alert(1)"]]]);
    $fail('javascript: URL must be rejected');
} catch (LombokUIError $e) {
    $eq($e->errorCode, 'invalid_props', 'error code');
    $eq($e->messageId, 'lombokui.error.invalid_props', 'message id');
}

foreach ([[1e-7, 7], [1.5e-7, 8], [0.25, 2], [5.0, 0], [5, 0], [0.1, 1], [123.456, 3], [1e21, 0]] as [$v, $d]) {
    $eq(Util::decimalsOf($v), $d, "decimalsOf($v)");
}
foreach ([[0.3, 1, '0.3'], [-0.0, 2, '0'], [2.0, 3, '2'], [1.25, 2, '1.25']] as [$v, $d, $s]) {
    $eq(Util::formatNumber($v, $d), $s, "formatNumber($v, $d)");
}

$c = LombokUI::position(['reference' => ['x' => 100, 'y' => 100, 'width' => 40, 'height' => 20], 'floating' => ['width' => 60, 'height' => 30]]);
$eq([$c['x'], $c['y'], $c['placement']], [90.0, 120.0, 'bottom'], 'position with native arrays');
$eq(LombokUI::pagination(['page' => 5, 'total' => 10])['items'], [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10], 'pagination with native arrays');

echo "examples: $checks checks passed\n";
