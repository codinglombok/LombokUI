<?php

// Runs every case of vectors/lombokui-vectors-v1.json against the PHP port (SPEC 1).

declare(strict_types=1);

require_once __DIR__ . '/../src/LombokUI.php';

use Lombok\UI\LombokUI;
use Lombok\UI\LombokUIError;

$root = dirname(__DIR__, 2);
$text = (string) file_get_contents("$root/vectors/lombokui-vectors-v1.json");
$spec = (string) file_get_contents("$root/docs/SPEC_LombokUI_v0.1.0.md");

/** Structural JSON equality: objects by key, numbers by value, booleans never equal numbers. */
function same(mixed $a, mixed $b): bool
{
    if (is_bool($a) || is_bool($b)) {
        return $a === $b;
    }
    if ((is_int($a) || is_float($a)) && (is_int($b) || is_float($b))) {
        return (float) $a === (float) $b;
    }
    $objA = $a instanceof stdClass || (is_array($a) && $a !== [] && !array_is_list($a));
    $objB = $b instanceof stdClass || (is_array($b) && $b !== [] && !array_is_list($b));
    if ($objA || $objB) {
        $pa = (array) $a;
        $pb = (array) $b;
        if (!(($objA || $pa === []) && ($objB || $pb === []))) {
            return false;
        }
        $ka = array_map('strval', array_keys($pa));
        $kb = array_map('strval', array_keys($pb));
        sort($ka);
        sort($kb);
        if ($ka !== $kb) {
            return false;
        }
        foreach ($pa as $k => $v) {
            if (!same($v, $pb[$k])) {
                return false;
            }
        }
        return true;
    }
    if (is_array($a) && is_array($b)) {
        if (count($a) !== count($b)) {
            return false;
        }
        foreach ($a as $i => $v) {
            if (!same($v, $b[$i])) {
                return false;
            }
        }
        return true;
    }
    return $a === $b;
}

$failures = [];
$total = 0;
if (!str_contains($spec, hash('sha256', $text))) {
    $failures[] = 'SHA-256 of the vector file is not recorded in SPEC';
}
$doc = json_decode($text, false, 512, JSON_THROW_ON_ERROR);
foreach ($doc->groups as $group) {
    foreach ($group->cases as $case) {
        $total++;
        try {
            $got = (object) ['result' => LombokUI::call($case->fn, $case->args)];
        } catch (LombokUIError $e) {
            $got = (object) ['error' => $e->errorCode];
        }
        if (!same($got, $case->expect)) {
            $failures[] = $case->name . "\n  expect " . substr(json_encode($case->expect), 0, 400) . "\n  got    " . substr(json_encode($got), 0, 400);
        }
        if ($case->fn === 'render' && isset($case->expect->result) && (!isset($got->result) || $got->result !== $case->expect->result)) {
            $failures[] = $case->name . ': render output is not byte-identical';
        }
    }
}
if ($total < 100) {
    $failures[] = "only $total cases";
}
foreach (['en', 'id'] as $tag) {
    $onDisk = json_decode((string) file_get_contents("$root/locales/$tag/lombokui.json"), true);
    if ($onDisk !== \Lombok\UI\Messages::CATALOGS[$tag]) {
        $failures[] = "catalog $tag differs from locales/$tag/lombokui.json";
    }
}
if (LombokUI::VERSION !== trim((string) file_get_contents("$root/version.txt"))) {
    $failures[] = 'VERSION differs from version.txt';
}
if ($failures !== []) {
    fwrite(STDERR, implode("\n", array_slice($failures, 0, 15)) . "\n" . count($failures) . " failure(s) in $total cases\n");
    exit(1);
}
echo "vectors: $total/$total passed\n";
